import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';

export async function listShippingZonesAndCarriers() {
  const [zones, carriers] = await Promise.all([
    prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: [{ baseRateCop: 'asc' }, { department: 'asc' }],
    }),
    prisma.carrier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    zones,
    carriers,
  };
}

export async function calculateShippingCost(
  departmentOrCity: string,
  city?: string,
  subtotalCop = 0
): Promise<{
  department: string;
  city: string;
  baseRateCop: number;
  shippingCop: number;
  freeShippingApplied: boolean;
  freeShippingThresholdCop: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}> {
  const normalized = departmentOrCity.trim();
  const isBogota =
    normalized.toLowerCase().includes('bogot') ||
    (city ?? '').toLowerCase().includes('bogot');

  const zone = await prisma.shippingZone.findFirst({
    where: {
      isActive: true,
      OR: [
        { department: { equals: normalized, mode: 'insensitive' } },
        {
          department: {
            contains: isBogota ? 'Bogotá' : normalized,
            mode: 'insensitive',
          },
        },
      ],
    },
  });

  const baseRateCop = zone?.baseRateCop ?? (isBogota ? 12000 : 18000);
  const freeShippingThresholdCop = zone?.freeShippingThresholdCop ?? 500000;
  const freeShippingApplied =
    freeShippingThresholdCop !== null &&
    subtotalCop > 0 &&
    subtotalCop >= freeShippingThresholdCop;

  return {
    department: zone?.department ?? normalized,
    city: city?.trim() || normalized,
    baseRateCop,
    shippingCop: freeShippingApplied ? 0 : baseRateCop,
    freeShippingApplied,
    freeShippingThresholdCop,
    estimatedDaysMin: zone?.estimatedDaysMin ?? (isBogota ? 1 : 2),
    estimatedDaysMax: zone?.estimatedDaysMax ?? (isBogota ? 3 : 5),
  };
}

export async function validateCouponCode(
  rawCode: string,
  subtotalCop: number
): Promise<{
  couponId: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED_COP';
  value: number;
  discountCop: number;
}> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new AppError('INVALID_COUPON', 'Ingresa un código de descuento para validarlo.', 400);
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code },
  });

  if (!coupon || !coupon.isActive) {
    throw new AppError('INVALID_COUPON', 'Este código de descuento no existe o no está activo.', 404);
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new AppError('COUPON_NOT_STARTED', 'Este cupón aún no se encuentra vigente.', 400);
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new AppError('COUPON_EXPIRED', 'Este cupón de descuento ha expirado.', 400);
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new AppError('COUPON_EXHAUSTED', 'Este cupón ha alcanzado su límite de usos.', 400);
  }
  if (subtotalCop < coupon.minOrderCop) {
    throw new AppError(
      'COUPON_MIN_ORDER_NOT_MET',
      `Este cupón aplica para compras desde $ ${new Intl.NumberFormat('es-CO').format(coupon.minOrderCop)} COP.`,
      400
    );
  }

  const rawDiscount =
    coupon.type === 'PERCENTAGE'
      ? Math.round((subtotalCop * coupon.value) / 100)
      : coupon.value;

  const discountCop = Math.min(subtotalCop, Math.max(0, rawDiscount));

  return {
    couponId: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    value: coupon.value,
    discountCop,
  };
}
