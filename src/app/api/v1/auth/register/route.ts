import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/rate-limit';
import { attachSessionCookie } from '@/server/http/session';
import { registerCustomer } from '@/server/services/auth.service';
import { registerSchema } from '@/server/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'local';
    enforceRateLimit(`auth:register:${ip}`, 10, 60_000);

    const body = await request.json();
    const validated = registerSchema.parse(body);

    const { user, sessionToken } = await registerCustomer(validated, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      ipAddress: ip,
    });

    const response = apiSuccess(
      {
        user,
        sessionToken,
      },
      201
    );
    attachSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
