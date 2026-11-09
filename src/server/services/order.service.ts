import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';
import { buildBrebPaymentInstructions } from '@/server/payments/breb.adapter';
import { OFFICIAL_BREB_KEY } from '@/server/payments/types';
import { wompiGateway } from '@/server/payments/wompi.adapter';
import {
  calculateShippingCost,
  validateCouponCode,
} from '@/server/services/shipping.service';

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Ingresa el nombre completo del comprador.').max(120),
  customerEmail: z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido.'),
  customerPhone: z.string().trim().min(7, 'Ingresa un teléfono de contacto válido.').max(20),
  department: z.string().trim().min(2, 'Selecciona el departamento de entrega.').max(60),
  city: z.string().trim().min(2, 'Ingresa la ciudad o municipio.').max(60),
  streetAddress: z.string().trim().min(5, 'Ingresa la dirección de entrega.').max(180),
  additionalInfo: z.string().trim().max(220).optional(),
  paymentMethod: z.enum(['BREB', 'WOMPI_PSE', 'WOMPI_CARD']),
  couponCode: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productIdOrLegacyId: z.union([z.number().int().positive(), z.string().min(1)]),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1, 'El pedido debe contener al menos un producto.'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BSP-${datePart}-${randomPart}`;
}

/**
 * Crea un pedido de manera atómica en PostgreSQL 17:
 * 1. Valida productos y existencias reales en servidor (nunca confía en precios del cliente).
 * 2. Calcula subtotal, descuento por cupón y tarifa de envío por departamento.
 * 3. Reserva inventario atómicamente (`quantityReserved`) y registra `InventoryMovement` (`RESERVATION`).
 * 4. Crea `Order`, `OrderItem`, `Payment` (Llave Bre-B `@bbbsp` o Wompi SHA256) y `Shipment`.
 */
export async function createCheckoutOrder(input: CreateOrderInput, userId?: string | null) {
  const parsed = createOrderSchema.parse(input);

  // 1. Validar cupón (si aplica) y costo de envío antes/dentro de la transacción
  const orderResult = await prisma.$transaction(async (tx) => {
    const resolvedItems: Array<{
      productId: string;
      inventoryId: string;
      productName: string;
      sku: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const reqItem of parsed.items) {
      const numericId = Number(reqItem.productIdOrLegacyId);
      const product = await tx.product.findFirst({
        where:
          !Number.isNaN(numericId) && numericId > 0
            ? { legacyId: numericId, isActive: true }
            : { id: String(reqItem.productIdOrLegacyId), isActive: true },
        include: {
          inventory: true,
          variants: true,
        },
      });

      if (!product || !product.inventory) {
        throw new AppError(
          'PRODUCT_UNAVAILABLE',
          `El producto solicitado (${reqItem.productIdOrLegacyId}) no está disponible.`,
          404
        );
      }

      const available =
        product.inventory.quantityOnHand - product.inventory.quantityReserved;
      if (available < reqItem.quantity) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          `Inventario insuficiente para ${product.name}. Disponibles: ${Math.max(0, available)}.`,
          409
        );
      }

      const unitPrice = product.price;
      resolvedItems.push({
        productId: product.id,
        inventoryId: product.inventory.id,
        productName: product.name,
        sku: product.sku,
        unitPrice,
        quantity: reqItem.quantity,
        lineTotal: unitPrice * reqItem.quantity,
      });
    }

    const subtotalCop = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);

    // Evaluar cupón si se proporcionó
    let discountCop = 0;
    let couponId: string | null = null;
    if (parsed.couponCode && parsed.couponCode.trim() !== '') {
      const couponRes = await validateCouponCode(parsed.couponCode, subtotalCop);
      discountCop = couponRes.discountCop;
      couponId = couponRes.couponId;
      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    // Calcular envío por departamento/ciudad
    const shippingQuote = await calculateShippingCost(
      parsed.department,
      parsed.city,
      subtotalCop - discountCop
    );
    const shippingCop = shippingQuote.shippingCop;
    const totalCop = Math.max(0, subtotalCop - discountCop + shippingCop);

    // Reservar inventario y registrar movimiento
    for (const item of resolvedItems) {
      await tx.inventory.update({
        where: { id: item.inventoryId },
        data: {
          quantityReserved: { increment: item.quantity },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: item.inventoryId,
          type: 'RESERVATION',
          quantity: item.quantity,
          reason: 'Reserva de inventario por creación de pedido en Checkout',
          createdById: userId ?? null,
        },
      });
    }

    const orderNumber = generateOrderNumber();
    const isBreb = parsed.paymentMethod === 'BREB';

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: userId ?? null,
        customerName: parsed.customerName,
        customerEmail: parsed.customerEmail,
        customerPhone: parsed.customerPhone,
        department: parsed.department,
        city: parsed.city,
        streetAddress: parsed.streetAddress,
        additionalInfo: parsed.additionalInfo ?? null,
        subtotalCop,
        discountCop,
        shippingCop,
        totalCop,
        couponId,
        paymentMethod: parsed.paymentMethod,
        status: isBreb ? 'PENDING_BREB_VERIFICATION' : 'PENDING_PAYMENT',
        items: {
          create: resolvedItems.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            sku: i.sku,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
          })),
        },
        shipment: {
          create: {
            status: 'PENDING',
            shippingCost: shippingCop,
          },
        },
      },
      include: {
        items: true,
        shipment: true,
      },
    });

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: isBreb ? 'BREB_TRANSFER' : 'WOMPI',
        method: parsed.paymentMethod,
        reference: order.orderNumber,
        brebKeyUsed: isBreb ? OFFICIAL_BREB_KEY : null,
        amountCop: totalCop,
        currency: 'COP',
        status: 'PENDING',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: userId ?? null,
        action: 'ORDER_CREATED',
        entity: 'Order',
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          totalCop,
          paymentMethod: parsed.paymentMethod,
        },
      },
    });

    return { order, payment };
  });

  if (parsed.paymentMethod === 'BREB') {
    const brebInstructions = buildBrebPaymentInstructions(
      orderResult.order.orderNumber,
      orderResult.order.totalCop
    );
    return {
      order: orderResult.order,
      payment: orderResult.payment,
      brebInstructions,
      wompiSession: null,
    };
  }

  const wompiSession = await wompiGateway.createPaymentSession({
    orderId: orderResult.order.id,
    orderNumber: orderResult.order.orderNumber,
    amountInCop: orderResult.order.totalCop,
    currency: 'COP',
    customerEmail: orderResult.order.customerEmail,
    customerFullName: orderResult.order.customerName,
    customerPhone: orderResult.order.customerPhone,
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/checkout?order=${orderResult.order.orderNumber}`,
  });

  return {
    order: orderResult.order,
    payment: orderResult.payment,
    brebInstructions: null,
    wompiSession,
  };
}

/**
 * Procesa de forma verificada e idempotente una notificación Webhook de Wompi Colombia.
 * - Verifica la firma criptográfica SHA256 antes de tocar cualquier dato.
 * - Garantiza idempotencia estricta mediante `PaymentEvent.eventId @unique` (nunca procesa dos veces el mismo evento).
 * - Si el pago es `APPROVED`, confirma el pedido (`PAID`) y descuenta el inventario reservado (`OUT`).
 * - Si el pago es `DECLINED`, `VOIDED` o `ERROR`, cancela el pedido (`CANCELLED`) y libera el inventario (`RELEASE`).
 */
export async function processWompiWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>
) {
  const signatureValid = wompiGateway.verifyWebhookSignature(rawBody, headers);
  if (!signatureValid) {
    throw new AppError(
      'INVALID_WEBHOOK_SIGNATURE',
      'La firma criptográfica del webhook de Wompi no es válida.',
      401
    );
  }

  const event = await wompiGateway.parseWebhookEvent(rawBody);

  // Verificar idempotencia antes de procesar
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: { eventId: event.eventId },
  });

  if (existingEvent) {
    return {
      idempotentDuplicate: true,
      eventId: event.eventId,
      status: event.status,
    };
  }

  const payment = await prisma.payment.findUnique({
    where: { reference: event.orderReference },
    include: {
      order: {
        include: { items: true },
      },
    },
  });

  if (!payment) {
    throw new AppError(
      'PAYMENT_REFERENCE_NOT_FOUND',
      `No existe un pago registrado con la referencia ${event.orderReference}.`,
      404
    );
  }

  // Verificar que el monto coincida exactamente en servidor (COP)
  if (event.status === 'APPROVED' && event.amountInCop !== payment.amountCop) {
    throw new AppError(
      'PAYMENT_AMOUNT_MISMATCH',
      'El monto reportado en el webhook no coincide con el total del pedido.',
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        provider: 'WOMPI',
        eventId: event.eventId,
        eventType: 'transaction.updated',
        signatureOk: true,
        payload: event.rawPayload as object,
      },
    });

    if (event.status === 'APPROVED' && payment.status !== 'APPROVED') {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'APPROVED',
          externalTransactionId: event.externalTransactionId,
          paidAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAID' },
      });

      for (const item of payment.order.items) {
        const inv = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              quantityOnHand: { decrement: item.quantity },
              quantityReserved: { decrement: item.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: inv.id,
              type: 'OUT',
              quantity: item.quantity,
              reason: `Venta confirmada por Webhook Wompi (${payment.order.orderNumber})`,
              referenceId: payment.order.orderNumber,
            },
          });
        }
      }
    } else if (
      ['DECLINED', 'VOIDED', 'ERROR'].includes(event.status) &&
      payment.status === 'PENDING'
    ) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: event.status as 'DECLINED' | 'VOIDED' | 'ERROR',
          externalTransactionId: event.externalTransactionId,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'CANCELLED' },
      });

      for (const item of payment.order.items) {
        const inv = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              quantityReserved: { decrement: item.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: inv.id,
              type: 'RELEASE',
              quantity: item.quantity,
              reason: `Liberación de reserva por pago ${event.status} (${payment.order.orderNumber})`,
              referenceId: payment.order.orderNumber,
            },
          });
        }
      }
    }
  });

  return {
    idempotentDuplicate: false,
    eventId: event.eventId,
    orderNumber: payment.order.orderNumber,
    status: event.status,
  };
}

/**
 * Registra el número de comprobante / referencia de transferencia a la llave Bre-B (@bbbsp).
 * El pedido permanece en `PENDING_BREB_VERIFICATION` hasta confirmación administrativa.
 */
export async function submitBrebTransferReceipt(
  orderNumber: string,
  transferReceiptRef: string,
  actorId?: string | null,
  customerEmail?: string | null
) {
  const cleanRef = transferReceiptRef.trim();
  if (cleanRef.length < 4) {
    throw new AppError(
      'INVALID_RECEIPT_REF',
      'Ingresa un número o referencia de comprobante válido (mínimo 4 caracteres).',
      400
    );
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { payments: true },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'No se encontró el pedido especificado.', 404);
  }

  // Verificar autorización si el pedido está asociado a un usuario autenticado
  if (order.userId && actorId && order.userId !== actorId) {
    throw new AppError(
      'FORBIDDEN_ORDER_ACCESS',
      'No tienes autorización para modificar el comprobante de este pedido.',
      403
    );
  }

  if (
    order.userId &&
    !actorId &&
    customerEmail &&
    order.customerEmail.toLowerCase() !== customerEmail.toLowerCase()
  ) {
    throw new AppError(
      'FORBIDDEN_ORDER_ACCESS',
      'El correo electrónico no coincide con el titular del pedido.',
      403
    );
  }

  if (order.status !== 'PENDING_BREB_VERIFICATION' && order.status !== 'PENDING_PAYMENT') {
    throw new AppError(
      'ORDER_NOT_EDITABLE',
      'Este pedido ya fue procesado y no admite cambios de comprobante.',
      409
    );
  }

  const brebPayment = order.payments.find((p) => p.provider === 'BREB_TRANSFER');
  if (!brebPayment) {
    throw new AppError(
      'NOT_BREB_ORDER',
      'Este pedido no corresponde a una transferencia con Llave Bre-B (@bbbsp).',
      400
    );
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: brebPayment.id },
    data: {
      transferReceiptRef: cleanRef,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? order.userId ?? null,
      action: 'BREB_RECEIPT_SUBMITTED',
      entity: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber,
        brebKey: OFFICIAL_BREB_KEY,
        transferReceiptRef: cleanRef,
      },
    },
  });

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    transferReceiptRef: updatedPayment.transferReceiptRef,
  };
}

export async function listCustomerOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      payments: true,
      shipment: { include: { carrier: true } },
    },
  });
}

export async function getOrderByNumber(
  orderNumber: string,
  requester?: {
    userId?: string | null;
    role?: string | null;
    email?: string | null;
  }
) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      payments: true,
      shipment: { include: { carrier: true } },
    },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'El pedido consultado no existe.', 404);
  }

  if (requester) {
    const isAdminOrStaff = requester.role === 'ADMIN' || requester.role === 'STAFF';
    const isOwnerById = Boolean(order.userId && requester.userId === order.userId);
    const isOwnerByEmail = Boolean(
      requester.email && requester.email.toLowerCase() === order.customerEmail.toLowerCase()
    );

    if (!isAdminOrStaff && !isOwnerById && !isOwnerByEmail) {
      throw new AppError(
        'FORBIDDEN_ORDER_ACCESS',
        'No tienes autorización para consultar este pedido.',
        403
      );
    }
  }

  return order;
}
