import crypto from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { generateWompiIntegritySignature } from '@/server/payments/wompi.adapter';
import { getOrCreateServerCart, upsertCartItem } from '@/server/services/cart.service';
import {
  createCheckoutOrder,
  processWompiWebhook,
  submitBrebTransferReceipt,
} from '@/server/services/order.service';
import {
  calculateShippingCost,
  validateCouponCode,
} from '@/server/services/shipping.service';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Fase 5: Operación Comercial — Carrito en BD, Checkout Transaccional, Llave Bre-B (@bbbsp) y Webhooks Wompi', () => {
  it('calcula cupones y tarifas de envío por departamento en el servidor (incluyendo envío gratis >= $500.000 COP)', async () => {
    const coupon = await validateCouponCode('BSPWELCOME10', 649900);
    expect(coupon.code).toBe('BSPWELCOME10');
    expect(coupon.discountCop).toBe(64990);

    const shippingBogota = await calculateShippingCost('Bogotá D. C.', 'Bogotá', 300000);
    expect(shippingBogota.shippingCop).toBe(12000);
    expect(shippingBogota.freeShippingApplied).toBe(false);

    const freeShippingAntioquia = await calculateShippingCost('Antioquia', 'Medellín', 600000);
    expect(freeShippingAntioquia.shippingCop).toBe(0);
    expect(freeShippingAntioquia.freeShippingApplied).toBe(true);
  });

  it('persiste y actualiza el carrito en PostgreSQL 17 validando precios e inventario real', async () => {
    const guestToken = `test-guest-${Date.now()}`;

    const afterAdd = await upsertCartItem({
      guestToken,
      productIdOrLegacyId: 1,
      quantity: 2,
    });

    expect(afterAdd.totalCount).toBe(2);
    expect(afterAdd.subtotalCop).toBe(649900 * 2);

    // Actualizar la misma línea sin duplicar aunque variantId sea null
    const afterUpdate = await upsertCartItem({
      guestToken,
      productIdOrLegacyId: 1,
      quantity: 1,
    });
    expect(afterUpdate.items).toHaveLength(1);
    expect(afterUpdate.totalCount).toBe(1);

    const loaded = await getOrCreateServerCart({ guestToken });
    expect(loaded.subtotalCop).toBe(649900);

    await prisma.cart.delete({ where: { id: loaded.cartId } });
  });

  it('crea un pedido con Llave Bre-B (@bbbsp) sin costo, reserva inventario y registra el comprobante', async () => {
    const beforeInv = await prisma.product.findUnique({
      where: { sku: 'BSP-0005' },
      include: { inventory: true },
    });
    const initialReserved = beforeInv!.inventory!.quantityReserved;

    const created = await createCheckoutOrder({
      customerName: 'Laura Martínez',
      customerEmail: 'laura.breb@bspstore.com.co',
      customerPhone: '3151234567',
      department: 'Bogotá D. C.',
      city: 'Bogotá',
      streetAddress: 'Carrera 15 # 85-20 Apto 402',
      paymentMethod: 'BREB',
      couponCode: 'BSPWELCOME10',
      items: [{ productIdOrLegacyId: 5, quantity: 1 }], // Teclado Logitech G PRO ($499.900)
    });

    // $499.900 - 10% ($49.990) = $449.910 (< $500.000 -> envío Bogotá $12.000) -> Total = $461.910
    expect(created.order.status).toBe('PENDING_BREB_VERIFICATION');
    expect(created.order.subtotalCop).toBe(499900);
    expect(created.order.discountCop).toBe(49990);
    expect(created.order.shippingCop).toBe(12000);
    expect(created.order.totalCop).toBe(461910);
    expect(created.payment.provider).toBe('BREB_TRANSFER');
    expect(created.payment.brebKeyUsed).toBe('@bbbsp');
    expect(created.brebInstructions?.brebKey).toBe('@bbbsp');

    const afterReserveInv = await prisma.inventory.findUnique({
      where: { id: beforeInv!.inventory!.id },
    });
    expect(afterReserveInv!.quantityReserved).toBe(initialReserved + 1);

    const receiptResult = await submitBrebTransferReceipt(
      created.order.orderNumber,
      'BREB-REF-998877'
    );
    expect(receiptResult.transferReceiptRef).toBe('BREB-REF-998877');
    expect(receiptResult.status).toBe('PENDING_BREB_VERIFICATION');

    // Revertir reserva de prueba y limpiar pedido
    await prisma.inventory.update({
      where: { id: beforeInv!.inventory!.id },
      data: { quantityReserved: initialReserved },
    });
    await prisma.order.delete({ where: { id: created.order.id } });
  });

  it('crea un pedido con Wompi, verifica firma SHA256 y procesa Webhook APPROVED con idempotencia estricta', async () => {
    const product = await prisma.product.findUnique({
      where: { sku: 'BSP-0001' },
      include: { inventory: true },
    });
    const initialOnHand = product!.inventory!.quantityOnHand;
    const initialReserved = product!.inventory!.quantityReserved;

    const created = await createCheckoutOrder({
      customerName: 'Carlos Ramírez',
      customerEmail: 'carlos.wompi@bspstore.com.co',
      customerPhone: '3007654321',
      department: 'Antioquia',
      city: 'Medellín',
      streetAddress: 'Calle 10 # 43A-15',
      paymentMethod: 'WOMPI_PSE',
      items: [{ productIdOrLegacyId: 1, quantity: 1 }], // $649.900 (>= $500.000 -> envío gratis $0)
    });

    expect(created.order.status).toBe('PENDING_PAYMENT');
    expect(created.order.totalCop).toBe(649900);
    expect(created.wompiSession).not.toBeNull();

    const expectedIntegrity = generateWompiIntegritySignature(
      created.order.orderNumber,
      649900 * 100,
      'COP',
      process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_secret_bsp_store'
    );
    expect(created.wompiSession!.integritySignature).toBe(expectedIntegrity);

    // 1. Rechazar webhook con firma inválida
    const fakeWebhookBody = JSON.stringify({
      event: 'transaction.updated',
      id: `evt-invalid-${Date.now()}`,
      timestamp: 1730000000,
      data: {
        transaction: {
          id: 'wompi-tx-100',
          status: 'APPROVED',
          amount_in_cents: 64990000,
          reference: created.order.orderNumber,
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
        checksum: '0000000000000000000000000000000000000000000000000000000000000000',
      },
    });

    await expect(processWompiWebhook(fakeWebhookBody, {})).rejects.toThrow(
      /firma criptográfica del webhook de Wompi no es válida/i
    );

    // 2. Procesar webhook firmado válidamente con SHA256
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET || 'test_events_secret_bsp_store';
    const txId = `wompi-tx-${Date.now()}`;
    const txStatus = 'APPROVED';
    const amountInCents = 64990000;
    const timestamp = 1730000500;
    const rawToSign = `${txId}${txStatus}${amountInCents}${timestamp}${eventsSecret}`;
    const validChecksum = crypto.createHash('sha256').update(rawToSign, 'utf8').digest('hex');

    const validWebhookBody = JSON.stringify({
      event: 'transaction.updated',
      id: `evt-valid-${Date.now()}`,
      timestamp,
      data: {
        transaction: {
          id: txId,
          status: txStatus,
          amount_in_cents: amountInCents,
          reference: created.order.orderNumber,
          payment_method_type: 'PSE',
        },
      },
      signature: {
        properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
        checksum: validChecksum,
      },
    });

    const firstProcess = await processWompiWebhook(validWebhookBody, {
      'x-event-checksum': validChecksum,
    });
    expect(firstProcess.idempotentDuplicate).toBe(false);
    expect(firstProcess.status).toBe('APPROVED');

    // Verificar que el pedido pasó a PAID y el inventario descontó 1 unidad
    const paidOrder = await prisma.order.findUnique({ where: { id: created.order.id } });
    expect(paidOrder?.status).toBe('PAID');

    const afterPaidInv = await prisma.inventory.findUnique({
      where: { id: product!.inventory!.id },
    });
    expect(afterPaidInv?.quantityOnHand).toBe(initialOnHand - 1);
    expect(afterPaidInv?.quantityReserved).toBe(initialReserved);

    // 3. Enviar el mismo webhook por segunda vez -> Debe ser 100% idempotente
    const secondProcess = await processWompiWebhook(validWebhookBody, {
      'x-event-checksum': validChecksum,
    });
    expect(secondProcess.idempotentDuplicate).toBe(true);

    const afterDuplicateInv = await prisma.inventory.findUnique({
      where: { id: product!.inventory!.id },
    });
    expect(afterDuplicateInv?.quantityOnHand).toBe(initialOnHand - 1);

    // Restaurar inventario inicial y limpiar datos de prueba
    await prisma.inventory.update({
      where: { id: product!.inventory!.id },
      data: {
        quantityOnHand: initialOnHand,
        quantityReserved: initialReserved,
      },
    });
    await prisma.paymentEvent.deleteMany({ where: { eventId: firstProcess.eventId } });
    await prisma.order.delete({ where: { id: created.order.id } });
  });
});
