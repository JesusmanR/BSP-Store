import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRoleLabelEs } from '@/lib/roles';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { extractSessionToken, requireAuth } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import { isSafeMediaUrl } from '@/server/services/media-upload.service';

const NO_HTML_REGEX = /^[^<>]*$/;

const safeAvatarSchema = z
  .string()
  .trim()
  .max(350_000, 'La imagen de perfil es demasiado pesada.')
  .refine(
    (val) => {
      if (val === '') return true;
      return isSafeMediaUrl(val, { allowCatalogSvgPresets: false, allowAnyTrustedHttps: false });
    },
    {
      message:
        'Formato de imagen no permitido. Usa únicamente fotos JPG, PNG o WebP válidas (no se permiten SVG ni enlaces inseguros).',
    }
  );

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ingresa tu nombre completo')
    .max(120)
    .regex(NO_HTML_REGEX, 'El nombre no puede contener caracteres HTML.')
    .optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+\s()-]*$/, 'Ingresa un teléfono válido.')
    .optional()
    .nullable(),
  documentType: z
    .string()
    .trim()
    .max(20)
    .regex(NO_HTML_REGEX, 'Tipo de documento inválido.')
    .optional()
    .nullable(),
  documentNumber: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-zA-Z0-9.-]*$/, 'Número de documento inválido.')
    .optional()
    .nullable(),
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
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`auth:me:patch:${ip}`, 25, 60_000);

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
