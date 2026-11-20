import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { attachSessionCookie } from '@/server/http/session';
import { loginOrRegisterWithGoogle } from '@/server/services/auth.service';
import { googleAuthSchema } from '@/server/validation/schemas';
import { GOOGLE_OAUTH_STATE_COOKIE } from '../route';

const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

function redirectWithError(request: NextRequest, reason: string) {
  const url = new URL('/cuenta', request.url);
  url.searchParams.set('oauth_error', reason);
  const res = NextResponse.redirect(url, 302);
  res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return res;
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Callback OAuth 2.0 Authorization Code de Google:
 * 1. Valida CSRF state contra cookie HttpOnly (timing-safe).
 * 2. Intercambia code por id_token en oauth2.googleapis.com/token.
 * 3. Verifica aud, iss, email_verified y exp del id_token.
 * 4. Crea sesión segura HttpOnly para el cliente (bloqueando auto-vínculo ADMIN/STAFF).
 */
export async function GET(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`auth:google-cb:${ip}`, 15, 60_000);

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
    if (!clientId || !clientSecret) {
      return redirectWithError(request, 'not_configured');
    }

    const oauthError = request.nextUrl.searchParams.get('error');
    if (oauthError) {
      return redirectWithError(request, 'cancelled');
    }

    const code = request.nextUrl.searchParams.get('code')?.trim() ?? '';
    const state = request.nextUrl.searchParams.get('state')?.trim() ?? '';
    const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value?.trim() ?? '';

    if (!code || !state || !expectedState || !safeEqualStrings(state, expectedState)) {
      return redirectWithError(request, 'invalid_state');
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '');
    const redirectUri = `${appUrl}/api/v1/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithError(request, 'token_exchange_failed');
    }

    const tokenData = (await tokenRes.json()) as { id_token?: string };
    const idToken = tokenData.id_token?.trim();
    if (!idToken) {
      return redirectWithError(request, 'missing_id_token');
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!verifyRes.ok) {
      return redirectWithError(request, 'token_verification_failed');
    }

    const payload = (await verifyRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
      aud?: string;
      iss?: string;
      exp?: string | number;
    };

    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';
    const expSeconds = Number(payload.exp ?? 0);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      !payload.sub ||
      !payload.email ||
      !emailVerified ||
      payload.aud !== clientId ||
      !payload.iss ||
      !VALID_GOOGLE_ISSUERS.has(payload.iss) ||
      !Number.isFinite(expSeconds) ||
      expSeconds <= nowSeconds
    ) {
      return redirectWithError(request, 'invalid_identity');
    }

    const validated = googleAuthSchema.parse({
      email: payload.email,
      googleId: payload.sub,
      name: payload.name ?? payload.email.split('@')[0] ?? 'Cliente BSP',
      avatarUrl: payload.picture,
    });

    const { sessionToken } = await loginOrRegisterWithGoogle(validated, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipAddress: ip,
    });

    const successUrl = new URL('/cuenta', request.url);
    const response = NextResponse.redirect(successUrl, 302);
    attachSessionCookie(response, sessionToken);
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error('[BSP Google OAuth Callback Error]:', error);
    return redirectWithError(request, 'oauth_failed');
  }
}
