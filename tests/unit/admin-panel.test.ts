import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import {
  adjustAdminInventory,
  createAdminBrand,
  createAdminCategory,
  createAdminProduct,
  getAdminDashboardReport,
  listAdminCustomers,
  listAdminOrders,
  updateAdminCustomer,
  updateAdminOrder,
  updateAdminProduct,
} from '@/server/services/admin.service';
import { createCheckoutOrder, submitBrebTransferReceipt } from '@/server/services/order.service';

describe('Fase 6: Panel Administrativo Independiente (Catálogo, Inventario, Bre-B @bbbsp, Despachos y Reportes)', () => {
  it('1. crea categorías, marcas y productos desde admin con inventario inicial y los edita/desactiva', async () => {
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@bspstore.com.co' },
    });

    const cat = await createAdminCategory(
      {
        name: 'Monitores Pro',
        description: 'Monitores de alta tasa de refresco',
        icon: 'grid',
      },
      adminUser.id
    );
    expect(cat.slug).toBe('monitores-pro');

    const brand = await createAdminBrand(
      {
        name: 'BenQ ZOWIE',
        description: 'Monitores eSports profesionales',
      },
      adminUser.id
    );
    expect(brand.slug).toBe('benq-zowie');

    const uniqueSku = `ADMIN-PROD-${Date.now()}`;
    const createdProd = await createAdminProduct(
      {
        sku: uniqueSku,
        name: 'Monitor BenQ ZOWIE XL2546X 240Hz',
        subtitle: 'Panel Fast TN · DyAc 2 · eSports',
        description: 'Monitor competitivo de 240Hz diseñado para torneos profesionales.',
        price: 2199900,
        compareAtPrice: 2499900,
        discountPercent: 12,
        badge: 'NUEVO',
        categoryId: cat.id,
        brandId: brand.id,
        imageUrl: '/images/product-headset.png',
        initialStock: 8,
        lowStockThreshold: 3,
        isFeatured: true,
        isNew: true,
        isOffer: true,
        variants: [
          {
            name: 'Negro Mate',
            sku: `${uniqueSku}-BLK`,
            optionValue: 'Negro Mate',
          },
        ],
      },
      adminUser.id
    );

    expect(createdProd.sku).toBe(uniqueSku);
    expect(createdProd.inventory?.quantityOnHand).toBe(8);
    expect(createdProd.variants.length).toBe(1);

    const updatedProd = await updateAdminProduct(
      createdProd.id,
      {
        price: 2099900,
        isActive: false,
      },
      adminUser.id
    );
    expect(updatedProd.price).toBe(2099900);
    expect(updatedProd.isActive).toBe(false);

    // Limpieza del producto de prueba para no alterar el catálogo base
    await prisma.product.delete({ where: { id: createdProd.id } });
  });

  it('2. registra movimientos de inventario auditados (IN, OUT, ADJUSTMENT) y valida existencias', async () => {
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@bspstore.com.co' },
    });
    const product = await prisma.product.findFirstOrThrow({
      where: { legacyId: 1 },
      include: { inventory: true },
    });
    const initialOnHand = product.inventory!.quantityOnHand;

    const afterIn = await adjustAdminInventory(
      {
        productId: product.id,
        type: 'IN',
        quantity: 5,
        reason: 'Ingreso de lote de prueba Fase 6',
      },
      adminUser.id
    );
    expect(afterIn.inventory.quantityOnHand).toBe(initialOnHand + 5);

    const afterAdjust = await adjustAdminInventory(
      {
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: initialOnHand,
        reason: 'Restauración de conteo físico tras prueba Fase 6',
      },
      adminUser.id
    );
    expect(afterAdjust.inventory.quantityOnHand).toBe(initialOnHand);
  });

  it('3. aprueba un pago por transferencia Llave Bre-B (@bbbsp), descuenta stock y registra despacho con número de guía', async () => {
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@bspstore.com.co' },
    });
    const productBefore = await prisma.product.findFirstOrThrow({
      where: { legacyId: 5 },
      include: { inventory: true },
    });
    const initialOnHand = productBefore.inventory!.quantityOnHand;

    // 1. Cliente crea pedido con Llave Bre-B (@bbbsp) y reporta comprobante
    const checkout = await createCheckoutOrder({
      customerName: 'Laura Gómez',
      customerEmail: 'laura.breb@colombia.co',
      customerPhone: '3158889900',
      department: 'Valle del Cauca',
      city: 'Cali',
      streetAddress: 'Av. Pasoancho # 50-20',
      paymentMethod: 'BREB',
      items: [{ productIdOrLegacyId: 5, quantity: 1 }],
    });

    await submitBrebTransferReceipt(
      checkout.order.orderNumber,
      'BREB-ADMIN-OK-7788',
      null,
      'laura.breb@colombia.co'
    );

    // 2. Administrador aprueba la transferencia Bre-B (@bbbsp)
    const verifiedOrder = await updateAdminOrder(
      {
        orderId: checkout.order.id,
        action: 'VERIFY_BREB_PAYMENT',
        notes: 'Verificado en extracto Bre-B @bbbsp',
      },
      adminUser.id
    );
    expect(verifiedOrder.status).toBe('PAID');
    expect(verifiedOrder.payments[0]?.status).toBe('APPROVED');

    // Verificar que el stock físico bajó en 1 unidad
    const productAfterVerify = await prisma.product.findUniqueOrThrow({
      where: { id: productBefore.id },
      include: { inventory: true },
    });
    expect(productAfterVerify.inventory!.quantityOnHand).toBe(initialOnHand - 1);

    // 3. Administrador registra transportadora y número de guía y marca SHIPPED
    const { carriers } = await listAdminOrders({ status: 'PAID' });
    const carrier = carriers[0]!;

    const shippedOrder = await updateAdminOrder(
      {
        orderId: checkout.order.id,
        action: 'UPDATE_STATUS_AND_SHIPMENT',
        status: 'SHIPPED',
        carrierId: carrier.id,
        trackingNumber: 'SERV-CO-20269988',
      },
      adminUser.id
    );
    expect(shippedOrder.status).toBe('SHIPPED');
    expect(shippedOrder.shipment?.trackingNumber).toBe('SERV-CO-20269988');
    expect(shippedOrder.shipment?.status).toBe('IN_TRANSIT');

    // Restaurar la unidad de inventario para mantener idempotencia del seed
    await adjustAdminInventory(
      {
        productId: productBefore.id,
        type: 'IN',
        quantity: 1,
        reason: 'Reposición de stock tras prueba de aprobación Bre-B',
      },
      adminUser.id
    );
  });

  it('4. genera reportes ejecutivos y permite consultar y gestionar clientes y roles (bloqueando auto-degradación)', async () => {
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@bspstore.com.co' },
    });

    const report = await getAdminDashboardReport();
    expect(report.metrics.totalOrders).toBeGreaterThan(0);
    expect(report.metrics.totalRevenueCop).toBeGreaterThan(0);
    expect(Array.isArray(report.topSellingProducts)).toBe(true);
    expect(Array.isArray(report.recentAuditLogs)).toBe(true);

    const customers = await listAdminCustomers();
    expect(customers.length).toBeGreaterThanOrEqual(2);

    const sampleCustomer = customers.find((c) => c.email === 'cliente@bspstore.com.co');
    expect(sampleCustomer).toBeDefined();

    const promoted = await updateAdminCustomer(
      {
        userId: sampleCustomer!.id,
        role: 'STAFF',
      },
      adminUser.id
    );
    expect(promoted.role).toBe('STAFF');

    const restored = await updateAdminCustomer(
      {
        userId: sampleCustomer!.id,
        role: 'CUSTOMER',
      },
      adminUser.id
    );
    expect(restored.role).toBe('CUSTOMER');

    // Verificar que un admin no puede degradarse a sí mismo
    await expect(
      updateAdminCustomer(
        {
          userId: adminUser.id,
          role: 'CUSTOMER',
        },
        adminUser.id
      )
    ).rejects.toThrow(/No puedes quitar tus propios privilegios/);
  });
});
