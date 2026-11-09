import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';

export async function GET(request: NextRequest) {
  try {
    const token = extractSessionToken(request);
    const user = await getSessionUser(token);

    if (!user) {
      return apiSuccess({ authenticated: false, user: null });
    }

    const [addresses, oauthAccounts] = await Promise.all([
      prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.oAuthAccount.findMany({
        where: { userId: user.id },
        select: { provider: true, createdAt: true },
      }),
    ]);

    return apiSuccess({
      authenticated: true,
      user: {
        ...user,
        addresses,
        connectedProviders: oauthAccounts.map((a) => a.provider),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
