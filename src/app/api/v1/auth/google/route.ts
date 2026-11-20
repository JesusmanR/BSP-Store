import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { attachSessionCookie } from '@/server/http/session';
import { loginOrRegisterWithGoogle } from '@/server/services/auth.service';
import { googleAuthSchema } from '@/server/validation/schemas';

const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
export const GOOGLE_OAUTH_STATE_COOKIE = 'bsp_oauth_state';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const redirectUri = `${appUrl}/api/v1/auth/google/callback`;

  const oauthConfigured = Boolean(clientId && clientSecret);
  if (!oauthConfigured) {
    return apiSuccess({
      provider: 'google',
      oauthConfigured: false,
      authorizeUrl: null,
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const authorizeUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&state=${encodeURIComponent(state)}` +
    `&prompt=select_account`;

  const response = apiSuccess({
    provider: 'google',
    oauthConfigured: true,
    authorizeUrl,
  });

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth/google',
    maxAge: 600, // 10 minutos
  });

  return response;
}

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`auth:google:${ip}`, 12, 60_000);

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      throw new AppError(
        'OAUTH_NOT_CONFIGURED',
        'El inicio de sesión con Google OAuth no está configurado en este servidor.',
        503
      );
    }

    const body = await request.json();
    const idToken = typeof body?.idToken === 'string' ? body.idToken.trim() : '';
    if (!idToken) {
      throw new AppError(
        'MISSING_ID_TOKEN',
        'Se requiere un idToken firmado y válido emitido por Google OAuth.',
        400
      );
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!verifyRes.ok) {
      throw new AppError('INVALID_GOOGLE_TOKEN', 'El idToken de Google no pudo ser verificado.', 401);
    }

    const tokenPayload = (await verifyRes.json()) as {
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
      tokenPayload.email_verified === true || tokenPayload.email_verified === 'true';
    const expSeconds = Number(tokenPayload.exp ?? 0);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      !tokenPayload.sub ||
      !tokenPayload.email ||
      !emailVerified ||
      tokenPayload.aud !== clientId ||
      !tokenPayload.iss ||
      !VALID_GOOGLE_ISSUERS.has(tokenPayload.iss) ||
      !Number.isFinite(expSeconds) ||
      expSeconds <= nowSeconds
    ) {
      throw new AppError(
        'INVALID_GOOGLE_TOKEN',
        'El token de Google no superó la validación de identidad, audiencia o vigencia.',
        401
      );
    }

    const validated = googleAuthSchema.parse({
      email: tokenPayload.email,
      googleId: tokenPayload.sub,
      name: tokenPayload.name ?? tokenPayload.email.split('@')[0] ?? 'Cliente BSP',
      avatarUrl: tokenPayload.picture,
    });

    const { user, sessionToken } = await loginOrRegisterWithGoogle(validated, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipAddress: ip,
    });

    const response = apiSuccess({ user });
    attachSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
