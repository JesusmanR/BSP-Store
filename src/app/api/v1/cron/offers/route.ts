import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireAdminUser } from '@/server/http/admin-guard';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { syncScheduledOffers } from '@/server/services/admin.service';

function isAuthorizedCronSecret(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  if (!configuredSecret || configuredSecret.length < 16) return false;

  const authHeader = request.headers.get('authorization')?.trim() ?? '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const provided = authHeader.slice(7).trim();

  const bufA = Buffer.from(configuredSecret, 'utf8');
  const bufB = Buffer.from(provided, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Endpoint programable (Cron cada 5-15 min o disparo manual de ADMIN):
 * Activa campañas Discount cuya fecha startsAt ya llegó y expira campañas vencidas (expiresAt <= now).
 */
export async function POST(request: NextRequest) {
  try {
    let actorId: string | null = null;
    if (!isAuthorizedCronSecret(request)) {
      const admin = await requireAdminUser(request, true).catch(() => null);
      if (!admin) {
        throw new AppError(
          'UNAUTHORIZED_CRON',
          'Se requiere CRON_SECRET válido o sesión de administrador.',
          401
        );
      }
      actorId = admin.id;
    }

    const summary = await syncScheduledOffers(actorId);
    return apiSuccess(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
