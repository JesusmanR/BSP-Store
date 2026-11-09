import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { clearSessionCookie, extractSessionToken } from '@/server/http/session';
import { logoutSession } from '@/server/services/auth.service';

export async function POST(request: NextRequest) {
  try {
    const token = extractSessionToken(request);
    await logoutSession(token);

    const response = apiSuccess({ loggedOut: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
