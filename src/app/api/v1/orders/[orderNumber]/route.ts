import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import {
  getOrderByNumber,
  submitBrebTransferReceipt,
} from '@/server/services/order.service';

const receiptSchema = z.object({
  transferReceiptRef: z.string().trim().min(4).max(80),
  customerEmail: z.string().trim().toLowerCase().email().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`order-get:${ip}`, 30, 60_000);

    const { orderNumber } = await context.params;
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const emailParam = request.nextUrl.searchParams.get('email');

    const order = await getOrderByNumber(orderNumber, {
      userId: user?.id ?? null,
      role: user?.role ?? null,
      email: emailParam,
    });
    return apiSuccess({ order });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`order-breb-receipt:${ip}`, 10, 60_000);

    const { orderNumber } = await context.params;
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const body = await request.json();
    const { transferReceiptRef, customerEmail } = receiptSchema.parse(body);

    const result = await submitBrebTransferReceipt(
      orderNumber,
      transferReceiptRef,
      user?.id ?? null,
      customerEmail ?? user?.email ?? null
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
