import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { requireAuth } from '@/server/http/session';
import { addressSchema } from '@/server/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return apiSuccess({ addresses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validated = addressSchema.parse(body);

    if (validated.isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        ...validated,
      },
    });

    return apiSuccess({ address }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
