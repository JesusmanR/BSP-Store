import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/rate-limit';
import { attachSessionCookie } from '@/server/http/session';
import { loginOrRegisterWithGoogle } from '@/server/services/auth.service';
import { googleAuthSchema } from '@/server/validation/schemas';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/v1/auth/google/callback`;

  const oauthConfigured = Boolean(clientId);
  const authorizeUrl = oauthConfigured
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}`
    : null;

  return apiSuccess({
    provider: 'google',
    oauthConfigured,
    authorizeUrl,
    localSandboxSupported: process.env.NODE_ENV !== 'production',
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:google:${ip}`, 12, 60_000);

    const body = await request.json();
    const validated = googleAuthSchema.parse(body);

    const { user, sessionToken } = await loginOrRegisterWithGoogle(validated, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipAddress: ip,
    });

    const response = apiSuccess({
      user,
      sessionToken,
    });
    attachSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
