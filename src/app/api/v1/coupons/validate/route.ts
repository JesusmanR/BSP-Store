import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { validateCouponCode } from '@/server/services/shipping.service';

const couponInputSchema = z.object({
  code: z.string().trim().min(1, 'Ingresa un código de descuento.'),
  subtotalCop: z.coerce.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotalCop } = couponInputSchema.parse(body);
    const coupon = await validateCouponCode(code, subtotalCop);
    return apiSuccess(coupon);
  } catch (error) {
    return handleApiError(error);
  }
}
