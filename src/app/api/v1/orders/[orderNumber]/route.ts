import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import {
  cancelPendingOrderByCustomer,
  getOrderByNumber,
  submitBrebTransferReceipt,
} from '@/server/services/order.service';

const receiptSchema = z.object({
  transferReceiptRef: z.string().trim().min(4).max(80),
  customerEmail: z.string().trim().toLowerCase().email().optional(),
});

const cancelOrderSchema = z.object({
  action: z.literal('cancel').optional().default('cancel'),
  customerEmail: z.string().trim().toLowerCase().email().optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`order-get:${ip}`, 20, 15 * 60_000);

    const { orderNumber } = await context.params;
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const emailParam = request.nextUrl.searchParams.get('email');

    const fullOrder = await getOrderByNumber(orderNumber, {
      userId: user?.id ?? null,
      role: user?.role ?? null,
      email: emailParam,
      allowByOrderNumberOnly: true,
    });

    const isAdminOrStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';
    const isOwnerById = Boolean(fullOrder.userId && user?.id === fullOrder.userId);
    const isOwnerByEmail = Boolean(
      emailParam && emailParam.trim().toLowerCase() === fullOrder.customerEmail.toLowerCase()
    );

    // Solo devolver PII completa al titular verificado o a administradores; en rastreo público (/seguimiento) ocultar PII
    if (isAdminOrStaff || isOwnerById || isOwnerByEmail) {
      return apiSuccess({ order: fullOrder, isPublicTrackingView: false });
    }

    const publicTrackingOrder = {
      id: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      status: fullOrder.status,
      department: fullOrder.department,
      city: fullOrder.city,
      totalCop: fullOrder.totalCop,
      shippingCop: fullOrder.shippingCop,
      createdAt: fullOrder.createdAt,
      items: fullOrder.items.map((it) => ({
        id: it.id,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      payments: [],
      shipment: fullOrder.shipment
        ? {
            status: fullOrder.shipment.status,
            trackingNumber: fullOrder.shipment.trackingNumber,
            carrier: fullOrder.shipment.carrier
              ? {
                  name: fullOrder.shipment.carrier.name,
                  code: fullOrder.shipment.carrier.code,
                }
              : null,
          }
        : null,
    };

    return apiSuccess({ order: publicTrackingOrder, isPublicTrackingView: true });
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

    if (!user && !customerEmail) {
      throw new AppError(
        'FORBIDDEN_ORDER_ACCESS',
        'Inicia sesión o ingresa el correo del pedido para registrar el comprobante Bre-B.',
        403
      );
    }

    const result = await submitBrebTransferReceipt(
      orderNumber,
      transferReceiptRef,
      user?.id ?? null,
      customerEmail ?? user?.email ?? null,
      {
        requesterRole: user?.role ?? null,
        requireStrictVerification: true,
      }
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`order-cancel:${ip}`, 10, 60_000);

    const { orderNumber } = await context.params;
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const body = await request.json().catch(() => ({}));
    const parsed = cancelOrderSchema.parse(body);

    const order = await cancelPendingOrderByCustomer(
      orderNumber,
      {
        userId: user?.id ?? null,
        role: user?.role ?? null,
        email: parsed.customerEmail ?? user?.email ?? null,
      },
      parsed.reason
    );

    return apiSuccess({ order });
  } catch (error) {
    return handleApiError(error);
  }
}
