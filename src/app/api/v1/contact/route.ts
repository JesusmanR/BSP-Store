import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { extractSessionToken, requireRole } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';

export type StoredContactInquiry = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  userId: string | null;
  createdAt: string;
};

const CONTACT_SETTING_KEY = 'contact.inquiries';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre completo').max(120),
  email: z.string().trim().email('Ingresa un correo electrónico válido'),
  topic: z.string().trim().min(2).max(120).default('Asesoría de productos'),
  message: z.string().trim().min(10, 'El mensaje debe tener al menos 10 caracteres').max(2000),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ['ADMIN', 'STAFF']);
    const setting = await prisma.storeSetting.findUnique({
      where: { key: CONTACT_SETTING_KEY },
    });
    const inquiries: StoredContactInquiry[] = Array.isArray(setting?.value)
      ? (setting.value as unknown as StoredContactInquiry[])
      : [];

    return apiSuccess({
      total: inquiries.length,
      inquiries,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(extractSessionToken(request));
    const body = await request.json();
    const parsed = contactSchema.parse(body);

    const existing = await prisma.storeSetting.findUnique({
      where: { key: CONTACT_SETTING_KEY },
    });
    const currentList: StoredContactInquiry[] = Array.isArray(existing?.value)
      ? (existing.value as unknown as StoredContactInquiry[])
      : [];

    const inquiry: StoredContactInquiry = {
      id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      topic: parsed.topic,
      message: parsed.message,
      userId: sessionUser?.id ?? null,
      createdAt: new Date().toISOString(),
    };

    const updatedList = [inquiry, ...currentList].slice(0, 200);

    await prisma.storeSetting.upsert({
      where: { key: CONTACT_SETTING_KEY },
      update: {
        value: updatedList,
        description: 'Consultas y solicitudes de asesoría enviadas desde /contacto',
      },
      create: {
        key: CONTACT_SETTING_KEY,
        value: updatedList,
        description: 'Consultas y solicitudes de asesoría enviadas desde /contacto',
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: sessionUser?.id ?? null,
        action: 'CONTACT_INQUIRY_CREATED',
        entity: 'ContactInquiry',
        entityId: inquiry.id,
        metadata: {
          name: inquiry.name,
          email: inquiry.email,
          topic: inquiry.topic,
        },
      },
    });

    return apiSuccess({ inquiry }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
