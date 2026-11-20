import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { requireAdminUser } from '@/server/http/admin-guard';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { saveUploadedImage } from '@/server/services/media-upload.service';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request, true);
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`admin:upload:${admin.id}:${ip}`, 40, 15 * 60_000);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      throw new AppError('MISSING_FILE', 'Adjunta un archivo de imagen en el campo "file".', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const saved = await saveUploadedImage('catalog', buffer, file.type);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'ADMIN_MEDIA_UPLOADED',
        entity: 'Media',
        entityId: saved.filename,
        metadata: {
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          url: saved.url,
        },
      },
    });

    return apiSuccess(
      {
        url: saved.url,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
