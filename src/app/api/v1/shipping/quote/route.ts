import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import {
  calculateShippingCost,
  listShippingZonesAndCarriers,
} from '@/server/services/shipping.service';

const quoteSchema = z.object({
  department: z.string().trim().min(2),
  city: z.string().trim().optional(),
  subtotalCop: z.coerce.number().int().min(0).default(0),
});

export async function GET() {
  try {
    const result = await listShippingZonesAndCarriers();
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { department, city, subtotalCop } = quoteSchema.parse(body);
    const quote = await calculateShippingCost(department, city, subtotalCop);
    return apiSuccess(quote);
  } catch (error) {
    return handleApiError(error);
  }
}
