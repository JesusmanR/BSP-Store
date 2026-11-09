import type { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { extractSessionToken, requireAuth } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import {
  createCheckoutOrder,
  listCustomerOrders,
} from '@/server/services/order.service';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const orders = await listCustomerOrders(user.id);
    return apiSuccess({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`orders:create:${ip}`, 10, 60_000);

    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);

    const body = await request.json();
    const result = await createCheckoutOrder(body, user?.id ?? null);

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
