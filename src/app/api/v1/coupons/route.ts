import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { requireRole } from '@/server/http/session';

const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'El código debe tener al menos 3 caracteres')
      .max(32)
      .transform((v) => v.toUpperCase()),
    description: z.string().trim().min(3).max(200),
    type: z.enum(['PERCENTAGE', 'FIXED_COP']),
    value: z.coerce.number().int().positive(),
    minOrderCop: z.coerce.number().int().min(0).default(0),
    maxUses: z.coerce.number().int().positive().optional().nullable(),
  })
  .refine((d) => (d.type === 'PERCENTAGE' ? d.value <= 90 : true), {
    message: 'El descuento porcentual no puede superar el 90%.',
    path: ['value'],
  });

const toggleCouponSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export async function GET() {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrderCop: true,
        expiresAt: true,
      },
    });

    return apiSuccess({ coupons });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(request, ['ADMIN']);
    const body = await request.json();
    const parsed = createCouponSchema.parse(body);

    const coupon = await prisma.coupon.upsert({
      where: { code: parsed.code },
      update: {
        description: parsed.description,
        type: parsed.type,
        value: parsed.value,
        minOrderCop: parsed.minOrderCop,
        maxUses: parsed.maxUses ?? null,
        isActive: true,
      },
      create: {
        code: parsed.code,
        description: parsed.description,
        type: parsed.type,
        value: parsed.value,
        minOrderCop: parsed.minOrderCop,
        maxUses: parsed.maxUses ?? null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'COUPON_UPSERTED',
        entity: 'Coupon',
        entityId: coupon.id,
        metadata: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minOrderCop: coupon.minOrderCop,
        },
      },
    });

    return apiSuccess({ coupon }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRole(request, ['ADMIN']);
    const body = await request.json();
    const parsed = toggleCouponSchema.parse(body);

    const coupon = await prisma.coupon.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: parsed.isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
        entity: 'Coupon',
        entityId: coupon.id,
        metadata: { code: coupon.code, isActive: coupon.isActive },
      },
    });

    return apiSuccess({ coupon });
  } catch (error) {
    return handleApiError(error);
  }
}
