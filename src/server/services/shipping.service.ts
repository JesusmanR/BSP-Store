import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';
import {
  isLocalDeliveryDestination,
  NATIONAL_CARRIERS,
} from '@/data/colombia-locations';

export type ShippingQuoteResult = {
  department: string;
  city: string;
  shippingCop: number;
  freeShippingApplied: boolean;
  freeShippingThresholdCop: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isLocalDelivery: boolean;
  deliveryMethodName: string;
  availableCarriers: string[];
};

const SPECIAL_NATIONAL_DEPARTMENTS = new Set([
  'amazonas',
  'guainía',
  'guainia',
  'guaviare',
  'putumayo',
  'san andrés y providencia',
  'san andres y providencia',
  'vaupés',
  'vaupes',
  'vichada',
  'chocó',
  'choco',
]);

export async function calculateShippingCost(
  department: string,
  city?: string,
  subtotalCop = 0
): Promise<ShippingQuoteResult> {
  const normalizedDept = department.trim();
  const normalizedCity = (city ?? '').trim() || normalizedDept;
  const localDelivery = isLocalDeliveryDestination(normalizedDept, normalizedCity);

  let zone = await prisma.shippingZone.findFirst({
    where: {
      department: { equals: normalizedDept, mode: 'insensitive' },
      isActive: true,
    },
  });

  if (!zone) {
    zone = await prisma.shippingZone.findFirst({
      where: {
        department: 'Otro departamento',
        isActive: true,
      },
    });
  }

  const isSpecialZone = SPECIAL_NATIONAL_DEPARTMENTS.has(normalizedDept.toLowerCase());
  const isRegionalSantander =
    !localDelivery && normalizedDept.toLowerCase() === 'santander';
  const baseRateCop = localDelivery
    ? 12000
    : isRegionalSantander
      ? 15000
      : (zone?.baseRateCop ?? (isSpecialZone ? 24000 : 18000));
  const threshold = zone?.freeShippingThresholdCop ?? 500000;
  const freeShippingApplied = threshold > 0 && subtotalCop >= threshold;

  return {
    department: normalizedDept,
    city: normalizedCity,
    shippingCop: freeShippingApplied ? 0 : baseRateCop,
    freeShippingApplied,
    freeShippingThresholdCop: threshold,
    estimatedDaysMin: localDelivery ? 1 : (zone?.estimatedDaysMin ?? (isSpecialZone ? 3 : 2)),
    estimatedDaysMax: localDelivery ? 2 : (zone?.estimatedDaysMax ?? (isSpecialZone ? 6 : 5)),
    isLocalDelivery: localDelivery,
    deliveryMethodName: localDelivery ? 'Domicilio Local' : 'Envío Nacional Asegurado',
    availableCarriers: localDelivery ? ['Domicilio Local'] : [...NATIONAL_CARRIERS],
  };
}

export async function validateCouponCode(code: string, subtotalCop: number) {
  const normalizedCode = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
  });

  if (!coupon || !coupon.isActive) {
    throw new AppError(
      'INVALID_COUPON',
      `El código de descuento "${normalizedCode}" no existe o se encuentra inactivo.`,
      404
    );
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new AppError('COUPON_NOT_ACTIVE', 'Este cupón aún no se encuentra vigente.', 400);
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new AppError('COUPON_EXPIRED', 'Este código de descuento ha expirado.', 400);
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new AppError(
      'COUPON_USAGE_LIMIT_REACHED',
      'Este cupón ha alcanzado su límite máximo de redenciones.',
      400
    );
  }
  if (coupon.minOrderCop > 0 && subtotalCop < coupon.minOrderCop) {
    throw new AppError(
      'COUPON_MIN_AMOUNT_NOT_MET',
      `Este cupón requiere una compra mínima de $ ${new Intl.NumberFormat('es-CO').format(coupon.minOrderCop)} COP.`,
      400
    );
  }

  let discountCop = 0;
  if (coupon.type === 'PERCENTAGE') {
    discountCop = Math.round((subtotalCop * coupon.value) / 100);
  } else {
    discountCop = Math.min(subtotalCop, coupon.value);
  }

  return {
    couponId: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.type,
    discountValue: coupon.value,
    discountCop,
  };
}

export async function listShippingZonesAndCarriers() {
  const [zones, carriers] = await Promise.all([
    prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: { department: 'asc' },
    }),
    prisma.carrier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { zones, carriers };
}
