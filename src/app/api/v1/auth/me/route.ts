import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRoleLabelEs } from '@/lib/roles';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { extractSessionToken, requireAuth } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';

const RASTER_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

const safeAvatarSchema = z
  .string()
  .trim()
  .max(350_000, 'La imagen de perfil es demasiado pesada (máximo 250 KB procesada).')
  .refine(
    (val) => {
      if (val === '') return true;
      if (val.startsWith('data:image/')) {
        return RASTER_DATA_URL_REGEX.test(val);
      }
      if (val.startsWith('/images/') && !val.includes('..')) {
        return true;
      }
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    {
      message:
        'Formato de imagen no permitido. Usa únicamente fotos JPG, PNG o WebP (no se permiten SVG ni enlaces inseguros).',
    }
  );

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre completo').max(120).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  documentType: z.string().trim().max(20).optional().nullable(),
  documentNumber: z.string().trim().max(40).optional().nullable(),
  avatarUrl: safeAvatarSchema.optional().nullable(),
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
        roleLabel: getRoleLabelEs(user.role),
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
        name: parsed.name !== undefined ? parsed.name : undefined,
        phone:
          parsed.phone !== undefined
            ? parsed.phone && parsed.phone.trim().length > 0
              ? parsed.phone.trim()
              : null
            : undefined,
        documentType:
          parsed.documentType !== undefined
            ? parsed.documentType?.trim() || null
            : undefined,
        documentNumber:
          parsed.documentNumber !== undefined
            ? parsed.documentNumber?.trim() || null
            : undefined,
        avatarUrl:
          parsed.avatarUrl !== undefined
            ? parsed.avatarUrl && parsed.avatarUrl.trim().length > 0
              ? parsed.avatarUrl.trim()
              : null
            : undefined,
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
          avatarUpdated: parsed.avatarUrl !== undefined,
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
        roleLabel: getRoleLabelEs(updated.role.code),
        permissions: Array.isArray(updated.role.permissions)
          ? (updated.role.permissions as string[])
          : [],
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
