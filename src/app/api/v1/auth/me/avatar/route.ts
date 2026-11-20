import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import {
  deleteManagedMediaByUrl,
  saveUploadedImage,
} from '@/server/services/media-upload.service';

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`avatar:upload:${ip}`, 15, 15 * 60_000);

    const token = extractSessionToken(request);
    const sessionUser = await getSessionUser(token);
    if (!sessionUser) {
      throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para actualizar tu foto de perfil.', 401);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      throw new AppError('MISSING_FILE', 'Adjunta un archivo de imagen en el campo "file".', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await saveUploadedImage('avatars', buffer, file.type);

    const previous = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { avatarUrl: true },
    });

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: { avatarUrl: saved.url },
      select: { id: true, avatarUrl: true },
    });

    if (previous?.avatarUrl && previous.avatarUrl !== saved.url) {
      await deleteManagedMediaByUrl(previous.avatarUrl);
    }

    await prisma.auditLog.create({
      data: {
        actorId: sessionUser.id,
        action: 'USER_AVATAR_UPLOADED',
        entity: 'User',
        entityId: sessionUser.id,
        metadata: {
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          storageUrl: saved.url,
        },
      },
    });

    return apiSuccess({ avatarUrl: updated.avatarUrl }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractSessionToken(request);
    const sessionUser = await getSessionUser(token);
    if (!sessionUser) {
      throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para eliminar tu foto de perfil.', 401);
    }

    const previous = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { avatarUrl: true },
    });

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { avatarUrl: null },
    });

    await deleteManagedMediaByUrl(previous?.avatarUrl);

    return apiSuccess({ avatarUrl: null });
  } catch (error) {
    return handleApiError(error);
  }
}
