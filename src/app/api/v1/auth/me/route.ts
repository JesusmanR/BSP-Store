import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { extractSessionToken, requireAuth } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre completo').max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  documentType: z.string().trim().max(20).optional().nullable(),
  documentNumber: z.string().trim().max(40).optional().nullable(),
});

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

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await requireAuth(request);
    const body = await request.json();
    const parsed = updateProfileSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        name: parsed.name,
        phone: parsed.phone ? parsed.phone.trim() : null,
        documentType: parsed.documentType ? parsed.documentType.trim() : undefined,
        documentNumber: parsed.documentNumber ? parsed.documentNumber.trim() : undefined,
      },
      include: {
        role: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: sessionUser.id,
        action: 'USER_PROFILE_UPDATED',
        entity: 'User',
        entityId: sessionUser.id,
        metadata: {
          name: updated.name,
          phone: updated.phone,
          law: 'Ley 1581 de 2012 (Actualización / Rectificación de Datos)',
        },
      },
    });

    return apiSuccess({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
        role: updated.role.code,
        permissions: Array.isArray(updated.role.permissions)
          ? (updated.role.permissions as string[])
          : [],
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
