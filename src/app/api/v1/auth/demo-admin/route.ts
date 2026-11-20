import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { attachSessionCookie } from '@/server/http/session';
import { loginAsDemoAdmin } from '@/server/services/auth.service';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    const { user, sessionToken } = await loginAsDemoAdmin({
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
