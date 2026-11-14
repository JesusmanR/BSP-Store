import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, AppError, handleApiError } from '@/server/http/errors';
import { requireAuth } from '@/server/http/session';
import { addressSchema } from '@/server/validation/schemas';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ addressId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { addressId } = await context.params;
    const existing = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.userId !== user.id) {
      throw new AppError('NOT_FOUND', 'La dirección seleccionada no fue encontrada.', 404);
    }

    const body = await request.json();
    const parsed = addressSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.address.updateMany({
          where: { userId: user.id, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: {
          label: parsed.label,
          recipientName: parsed.recipientName,
          phone: parsed.phone,
          department: parsed.department,
          city: parsed.city,
          neighborhood: parsed.neighborhood ?? null,
          streetAddress: parsed.streetAddress,
          additionalInfo: parsed.additionalInfo ?? null,
          isDefault: parsed.isDefault ?? existing.isDefault,
        },
      });
    });

    return apiSuccess({ address: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ addressId: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ addressId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { addressId } = await context.params;
    const existing = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!existing || existing.userId !== user.id) {
      throw new AppError('NOT_FOUND', 'La dirección seleccionada no fue encontrada.', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id: addressId },
      });

      if (existing.isDefault) {
        const nextAddress = await tx.address.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        });
        if (nextAddress) {
          await tx.address.update({
            where: { id: nextAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return apiSuccess({ deletedId: addressId });
  } catch (error) {
    return handleApiError(error);
  }
}
