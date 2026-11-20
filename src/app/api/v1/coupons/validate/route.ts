import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { validateCouponCode } from '@/server/services/shipping.service';

const couponInputSchema = z.object({
  code: z.string().trim().min(1, 'Ingresa un código de descuento.').max(32),
  subtotalCop: z.coerce.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`coupon:validate:${ip}`, 20, 60_000);

    const body = await request.json();
    const { code, subtotalCop } = couponInputSchema.parse(body);
    const coupon = await validateCouponCode(code, subtotalCop);
    return apiSuccess(coupon);
  } catch (error) {
    return handleApiError(error);
  }
}
