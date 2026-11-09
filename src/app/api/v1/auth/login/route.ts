import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/rate-limit';
import { attachSessionCookie } from '@/server/http/session';
import { loginWithPassword } from '@/server/services/auth.service';
import { loginSchema } from '@/server/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:login:${ip}`, 12, 60_000);

    const body = await request.json();
    const validated = loginSchema.parse(body);

    const { user, sessionToken } = await loginWithPassword(validated, {
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
