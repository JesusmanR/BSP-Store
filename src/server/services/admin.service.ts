import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const createProductAdminSchema = z.object({
  sku: z.string().trim().min(3).max(60),
  name: z.string().trim().min(3).max(160),
  subtitle: z.string().trim().min(3).max(220),
  description: z.string().trim().min(10).max(2000),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  discountPercent: z.number().int().min(0).max(90).optional(),
  badge: z.enum(['OFERTA', 'NUEVO', 'DESTACADO']).nullable().optional(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1),
  imageUrl: z.string().trim().min(3),
  galleryUrls: z.array(z.string().trim().min(3)).optional(),
  features: z.array(z.string().trim().min(2)).optional(),
  variants: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        sku: z.string().trim().min(2),
        colorHex: z.string().trim().optional(),
        optionValue: z.string().trim().min(1),
        priceDelta: z.number().int().optional(),
      })
    )
    .optional(),
  initialStock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(1).default(5),
  isFeatured: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  isOffer: z.boolean().optional().default(false),
});

export const updateProductAdminSchema = z.object({
  name: z.string().trim().min(3).max(160).optional(),
  subtitle: z.string().trim().min(3).max(220).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  price: z.number().int().positive().optional(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  discountPercent: z.number().int().min(0).max(90).nullable().optional(),
  badge: z.enum(['OFERTA', 'NUEVO', 'DESTACADO']).nullable().optional(),
  categoryId: z.string().min(1).optional(),
  brandId: z.string().min(1).optional(),
  imageUrl: z.string().trim().min(3).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isOffer: z.boolean().optional(),
});

export const createCategoryAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(40).optional(),
});

export const createBrandAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

export const adjustInventoryAdminSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().min(0),
  reason: z.string().trim().min(3).max(240),
  lowStockThreshold: z.number().int().min(1).max(500).optional(),
});

export const updateOrderAdminSchema = z.object({
  orderId: z.string().min(1),
  action: z.enum([
    'VERIFY_BREB_PAYMENT',
    'REJECT_BREB_PAYMENT',
    'UPDATE_STATUS_AND_SHIPMENT',
  ]),
  status: z
    .enum([
      'PENDING_PAYMENT',
      'PENDING_BREB_VERIFICATION',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
      'REFUNDED',
    ])
    .optional(),
  carrierId: z.string().nullable().optional(),
  trackingNumber: z.string().trim().max(100).nullable().optional(),
  shipmentStatus: z
    .enum(['PENDING', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'])
    .optional(),
  notes: z.string().trim().max(300).optional(),
});

export const updateCustomerAdminSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * 1. Reportes Ejecutivos del Panel Administrativo (Ventas, Pedidos, Más Vendidos, Inventario, Ingresos, Descuentos, Clientes)
 */
export async function getAdminDashboardReport() {
  const [
    orders,
    products,
    customersCount,
    coupons,
    recentMovements,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
        shipment: { include: { carrier: true } },
      },
    }),
    prisma.product.findMany({
      include: {
        inventory: true,
        category: true,
        brand: true,
      },
      orderBy: { legacyId: 'asc' },
    }),
    prisma.user.count({
      where: { role: { code: 'CUSTOMER' } },
    }),
    prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryMovement.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        inventory: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  const paidStatuses = new Set(['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']);
  const confirmedOrders = orders.filter((o) => paidStatuses.has(o.status));

  const totalRevenueCop = confirmedOrders.reduce((sum, o) => sum + o.totalCop, 0);
  const totalDiscountsCop = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.discountCop, 0);
  const totalShippingCop = confirmedOrders.reduce((sum, o) => sum + o.shippingCop, 0);

  const pendingBrebCount = orders.filter(
    (o) => o.status === 'PENDING_BREB_VERIFICATION'
  ).length;
  const pendingDispatchCount = orders.filter(
    (o) => o.status === 'PAID' || o.status === 'PROCESSING'
  ).length;

  // Productos más vendidos
  const productSalesMap = new Map<
    string,
    { productId: string; productName: string; sku: string; unitsSold: number; revenueCop: number }
  >();
  for (const order of orders.filter((o) => o.status !== 'CANCELLED')) {
    for (const item of order.items) {
      const existing = productSalesMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        unitsSold: 0,
        revenueCop: 0,
      };
      existing.unitsSold += item.quantity;
      existing.revenueCop += item.lineTotal;
      productSalesMap.set(item.productId, existing);
    }
  }
  const topSellingProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 6);

  // Alertas de inventario (bajo stock y agotados)
  const inventoryAlerts = products
    .map((p) => {
      const onHand = p.inventory?.quantityOnHand ?? 0;
      const reserved = p.inventory?.quantityReserved ?? 0;
      const available = Math.max(0, onHand - reserved);
      const threshold = p.inventory?.lowStockThreshold ?? 5;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        onHand,
        reserved,
        available,
        threshold,
        status:
          available === 0
            ? ('OUT_OF_STOCK' as const)
            : available <= threshold
              ? ('LOW_STOCK' as const)
              : ('HEALTHY' as const),
      };
    })
    .filter((item) => item.status !== 'HEALTHY');

  return {
    metrics: {
      totalOrders: orders.length,
      confirmedOrdersCount: confirmedOrders.length,
      totalRevenueCop,
      totalDiscountsCop,
      totalShippingCop,
      pendingBrebCount,
      pendingDispatchCount,
      totalCustomers: customersCount,
      totalActiveProducts: products.filter((p) => p.isActive).length,
      lowStockCount: inventoryAlerts.length,
    },
    topSellingProducts,
    inventoryAlerts,
    coupons,
    recentMovements,
    recentAuditLogs,
  };
}

/**
 * 2. Gestión de Productos, Categorías, Marcas, Variantes e Imágenes
 */
export async function listAdminCatalog() {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: true,
        brand: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
        inventory: true,
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return { products, categories, brands };
}

export async function createAdminProduct(
  input: z.infer<typeof createProductAdminSchema>,
  actorId: string
) {
  const parsed = createProductAdminSchema.parse(input);
  const slugBase = toSlug(parsed.name);

  const existingSku = await prisma.product.findUnique({ where: { sku: parsed.sku } });
  if (existingSku) {
    throw new AppError('DUPLICATE_SKU', `Ya existe un producto con el SKU ${parsed.sku}.`, 409);
  }

  const uniqueSlug = `${slugBase}-${Date.now().toString(36)}`;

  const created = await prisma.$transaction(async (tx) => {
    const gallery =
      parsed.galleryUrls && parsed.galleryUrls.length > 0
        ? parsed.galleryUrls
        : [parsed.imageUrl];

    const product = await tx.product.create({
      data: {
        sku: parsed.sku,
        slug: uniqueSlug,
        name: parsed.name,
        tag:
          parsed.badge ??
          (parsed.isOffer
            ? 'OFERTA'
            : parsed.isNew
              ? 'NUEVO'
              : parsed.isFeatured
                ? 'DESTACADO'
                : parsed.subtitle),
        description: parsed.description,
        price: parsed.price,
        compareAtPrice: parsed.compareAtPrice ?? null,
        specs: parsed.features ?? ['Garantía oficial en Colombia', 'Despacho asegurado'],
        isActive: true,
        isFeatured: parsed.isFeatured,
        isNew: parsed.isNew,
        isOffer: parsed.isOffer,
        categoryId: parsed.categoryId,
        brandId: parsed.brandId,
        images: {
          create: gallery.map((url, idx) => ({
            url,
            altText: `${parsed.name} - Vista ${idx + 1}`,
            sortOrder: idx,
            isPrimary: idx === 0,
          })),
        },
        variants: {
          create:
            parsed.variants && parsed.variants.length > 0
              ? parsed.variants.map((v) => ({
                  sku: v.sku,
                  name: v.name,
                  optionType: 'Color / Edición',
                  optionValue: v.optionValue,
                  stockQuantity: parsed.initialStock,
                }))
              : [
                  {
                    sku: `${parsed.sku}-STD`,
                    name: 'Estándar',
                    optionType: 'Edición',
                    optionValue: 'Estándar',
                    stockQuantity: parsed.initialStock,
                  },
                ],
        },
        inventory: {
          create: {
            quantityOnHand: parsed.initialStock,
            quantityReserved: 0,
            lowStockThreshold: parsed.lowStockThreshold,
          },
        },
      },
      include: {
        category: true,
        brand: true,
        images: true,
        variants: true,
        inventory: true,
      },
    });

    if (product.inventory && parsed.initialStock > 0) {
      await tx.inventoryMovement.create({
        data: {
          inventoryId: product.inventory.id,
          type: 'IN',
          quantity: parsed.initialStock,
          reason: 'Inventario inicial al crear producto en panel administrativo',
          createdById: actorId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_PRODUCT_CREATED',
        entity: 'Product',
        entityId: product.id,
        metadata: {
          sku: product.sku,
          name: product.name,
          price: product.price,
          initialStock: parsed.initialStock,
        },
      },
    });

    return product;
  });

  return created;
}

export async function updateAdminProduct(
  productId: string,
  input: z.infer<typeof updateProductAdminSchema>,
  actorId: string
) {
  const parsed = updateProductAdminSchema.parse(input);

  const existing = await prisma.product.findUnique({
    where: { id: productId },
    include: { images: true },
  });

  if (!existing) {
    throw new AppError('PRODUCT_NOT_FOUND', 'El producto especificado no existe.', 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.imageUrl) {
      const primaryImg = existing.images.find((i) => i.isPrimary) ?? existing.images[0];
      if (primaryImg) {
        await tx.productImage.update({
          where: { id: primaryImg.id },
          data: { url: parsed.imageUrl },
        });
      } else {
        await tx.productImage.create({
          data: {
            productId: existing.id,
            url: parsed.imageUrl,
            altText: existing.name,
            isPrimary: true,
            sortOrder: 0,
          },
        });
      }
    }

    const product = await tx.product.update({
      where: { id: productId },
      data: {
        name: parsed.name,
        tag: parsed.badge ?? parsed.subtitle,
        description: parsed.description,
        price: parsed.price,
        compareAtPrice: parsed.compareAtPrice,
        categoryId: parsed.categoryId,
        brandId: parsed.brandId,
        isActive: parsed.isActive,
        isFeatured: parsed.isFeatured,
        isNew: parsed.isNew,
        isOffer: parsed.isOffer,
      },
      include: {
        category: true,
        brand: true,
        images: true,
        variants: true,
        inventory: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_PRODUCT_UPDATED',
        entity: 'Product',
        entityId: product.id,
        metadata: parsed,
      },
    });

    return product;
  });

  return updated;
}

export async function createAdminCategory(
  input: z.infer<typeof createCategoryAdminSchema>,
  actorId: string
) {
  const parsed = createCategoryAdminSchema.parse(input);
  const slug = toSlug(parsed.name);

  const category = await prisma.category.upsert({
    where: { slug },
    update: {
      name: parsed.name,
      description: parsed.description,
      icon: parsed.icon ?? 'grid',
      isActive: true,
    },
    create: {
      name: parsed.name,
      slug,
      description: parsed.description ?? `Categoría ${parsed.name}`,
      icon: parsed.icon ?? 'grid',
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'ADMIN_CATEGORY_UPSERTED',
      entity: 'Category',
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
    },
  });

  return category;
}

export async function createAdminBrand(
  input: z.infer<typeof createBrandAdminSchema>,
  actorId: string
) {
  const parsed = createBrandAdminSchema.parse(input);
  const slug = toSlug(parsed.name);

  const brand = await prisma.brand.upsert({
    where: { slug },
    update: {
      name: parsed.name,
      description: parsed.description,
      isActive: true,
    },
    create: {
      name: parsed.name,
      slug,
      description: parsed.description ?? `Marca oficial ${parsed.name}`,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'ADMIN_BRAND_UPSERTED',
      entity: 'Brand',
      entityId: brand.id,
      metadata: { name: brand.name, slug: brand.slug },
    },
  });

  return brand;
}

/**
 * 3. Gestión de Inventario y Movimientos Auditados
 */
export async function adjustAdminInventory(
  input: z.infer<typeof adjustInventoryAdminSchema>,
  actorId: string
) {
  const parsed = adjustInventoryAdminSchema.parse(input);

  const inventory = await prisma.inventory.findUnique({
    where: { productId: parsed.productId },
    include: { product: true },
  });

  if (!inventory) {
    throw new AppError(
      'INVENTORY_NOT_FOUND',
      'No se encontró el registro de inventario para este producto.',
      404
    );
  }

  let newQuantityOnHand = inventory.quantityOnHand;
  if (parsed.type === 'IN') {
    newQuantityOnHand = inventory.quantityOnHand + parsed.quantity;
  } else if (parsed.type === 'OUT') {
    if (inventory.quantityOnHand - parsed.quantity < inventory.quantityReserved) {
      throw new AppError(
        'INVALID_STOCK_REDUCTION',
        `No puedes retirar más unidades de las disponibles sin reservar (${inventory.quantityOnHand - inventory.quantityReserved}).`,
        409
      );
    }
    newQuantityOnHand = inventory.quantityOnHand - parsed.quantity;
  } else if (parsed.type === 'ADJUSTMENT') {
    if (parsed.quantity < inventory.quantityReserved) {
      throw new AppError(
        'INVALID_STOCK_ADJUSTMENT',
        `El stock físico no puede ser menor a las unidades actualmente reservadas (${inventory.quantityReserved}).`,
        409
      );
    }
    newQuantityOnHand = parsed.quantity;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantityOnHand: newQuantityOnHand,
        lowStockThreshold: parsed.lowStockThreshold ?? inventory.lowStockThreshold,
      },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        type: parsed.type,
        quantity: parsed.quantity,
        reason: parsed.reason,
        createdById: actorId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_INVENTORY_ADJUSTED',
        entity: 'Inventory',
        entityId: inventory.id,
        metadata: {
          productSku: inventory.product.sku,
          type: parsed.type,
          previousOnHand: inventory.quantityOnHand,
          newOnHand: newQuantityOnHand,
          reason: parsed.reason,
        },
      },
    });

    return { inventory: inv, movement };
  });

  return updated;
}

/**
 * 4. Gestión de Pedidos, Verificación de Transferencias Bre-B (@bbbsp) y Despachos
 */
export async function listAdminOrders(filters?: {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }

  if (filters?.from || filters?.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  if (filters?.search && filters.search.trim() !== '') {
    const q = filters.search.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerEmail: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [orders, carriers] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
        shipment: { include: { carrier: true } },
        coupon: true,
      },
    }),
    prisma.carrier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { orders, carriers };
}

export async function updateAdminOrder(
  input: z.infer<typeof updateOrderAdminSchema>,
  actorId: string
) {
  const parsed = updateOrderAdminSchema.parse(input);

  const order = await prisma.order.findUnique({
    where: { id: parsed.orderId },
    include: {
      items: true,
      payments: true,
      shipment: true,
    },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'El pedido especificado no existe.', 404);
  }

  // Caso A: Aprobar transferencia a Llave Bre-B (@bbbsp)
  if (parsed.action === 'VERIFY_BREB_PAYMENT') {
    const brebPayment = order.payments.find((p) => p.provider === 'BREB_TRANSFER');
    if (!brebPayment) {
      throw new AppError(
        'NOT_BREB_PAYMENT',
        'Este pedido no tiene un pago asociado con Llave Bre-B (@bbbsp).',
        400
      );
    }

    if (brebPayment.status === 'APPROVED') {
      return order;
    }

    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: brebPayment.id },
        data: {
          status: 'APPROVED',
          paidAt: new Date(),
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          notes: parsed.notes ?? order.notes,
        },
        include: {
          items: true,
          payments: true,
          shipment: { include: { carrier: true } },
        },
      });

      // Descontar unidades reservadas y convertirlas en salida real (OUT)
      for (const item of order.items) {
        const inv = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (inv) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: {
              quantityOnHand: { decrement: item.quantity },
              quantityReserved: { decrement: Math.min(inv.quantityReserved, item.quantity) },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: inv.id,
              type: 'OUT',
              quantity: item.quantity,
              reason: `Pago Bre-B (@bbbsp) verificado por admin en pedido ${order.orderNumber}`,
              referenceId: order.orderNumber,
              createdById: actorId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ADMIN_BREB_PAYMENT_APPROVED',
          entity: 'Order',
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            transferReceiptRef: brebPayment.transferReceiptRef,
            amountCop: brebPayment.amountCop,
          },
        },
      });

      return updatedOrder;
    });
  }

  // Caso B: Rechazar transferencia Bre-B (@bbbsp) y liberar reserva de inventario
  if (parsed.action === 'REJECT_BREB_PAYMENT') {
    const brebPayment = order.payments.find((p) => p.provider === 'BREB_TRANSFER');
    if (!brebPayment) {
      throw new AppError(
        'NOT_BREB_PAYMENT',
        'Este pedido no tiene un pago asociado con Llave Bre-B (@bbbsp).',
        400
      );
    }

    if (brebPayment.status === 'APPROVED' || order.status === 'PAID') {
      throw new AppError(
        'BREB_ALREADY_APPROVED',
        'No se puede rechazar una transferencia Bre-B ya aprobada; utiliza el flujo de reembolso.',
        409
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: brebPayment.id },
        data: { status: 'DECLINED' },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          notes: parsed.notes ?? 'Comprobante Bre-B rechazado en validación administrativa.',
        },
        include: {
          items: true,
          payments: true,
          shipment: { include: { carrier: true } },
        },
      });

      if (order.status === 'PENDING_BREB_VERIFICATION' || order.status === 'PENDING_PAYMENT') {
        for (const item of order.items) {
          const inv = await tx.inventory.findUnique({
            where: { productId: item.productId },
          });
          if (inv && inv.quantityReserved >= item.quantity) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantityReserved: { decrement: item.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                inventoryId: inv.id,
                type: 'RELEASE',
                quantity: item.quantity,
                reason: `Liberación de reserva por rechazo de pago Bre-B (${order.orderNumber})`,
                referenceId: order.orderNumber,
                createdById: actorId,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ADMIN_BREB_PAYMENT_REJECTED',
          entity: 'Order',
          entityId: order.id,
          metadata: { orderNumber: order.orderNumber, notes: parsed.notes },
        },
      });

      return updatedOrder;
    });
  }

  // Caso C: Actualizar estado del pedido, transportadora, número de guía y estado de despacho
  return prisma.$transaction(async (tx) => {
    const nextOrderStatus = parsed.status ?? order.status;

    if (
      nextOrderStatus === 'CANCELLED' &&
      (order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_BREB_VERIFICATION')
    ) {
      for (const item of order.items) {
        const inv = await tx.inventory.findUnique({
          where: { productId: item.productId },
        });
        if (inv && inv.quantityReserved >= item.quantity) {
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantityReserved: { decrement: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: inv.id,
              type: 'RELEASE',
              quantity: item.quantity,
              reason: `Cancelación administrativa de pedido ${order.orderNumber}`,
              referenceId: order.orderNumber,
              createdById: actorId,
            },
          });
        }
      }
    }

    if (order.shipment) {
      const nextShipmentStatus =
        parsed.shipmentStatus ??
        (nextOrderStatus === 'SHIPPED'
          ? 'IN_TRANSIT'
          : nextOrderStatus === 'DELIVERED'
            ? 'DELIVERED'
            : order.shipment.status);

      await tx.shipment.update({
        where: { id: order.shipment.id },
        data: {
          carrierId:
            parsed.carrierId !== undefined ? parsed.carrierId : order.shipment.carrierId,
          trackingNumber:
            parsed.trackingNumber !== undefined
              ? parsed.trackingNumber
              : order.shipment.trackingNumber,
          status: nextShipmentStatus,
          shippedAt:
            nextShipmentStatus === 'IN_TRANSIT' && !order.shipment.shippedAt
              ? new Date()
              : order.shipment.shippedAt,
          deliveredAt:
            nextShipmentStatus === 'DELIVERED' && !order.shipment.deliveredAt
              ? new Date()
              : order.shipment.deliveredAt,
        },
      });
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: nextOrderStatus,
        notes: parsed.notes !== undefined ? parsed.notes : order.notes,
      },
      include: {
        items: true,
        payments: true,
        shipment: { include: { carrier: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_ORDER_UPDATED',
        entity: 'Order',
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          status: nextOrderStatus,
          trackingNumber: parsed.trackingNumber,
          shipmentStatus: parsed.shipmentStatus,
        },
      },
    });

    return updatedOrder;
  });
}

/**
 * 5. Gestión de Clientes, Historial de Compras y Roles/Permisos
 */
export async function listAdminCustomers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      role: true,
      addresses: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          totalCop: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
        },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.name,
    email: u.email,
    phone: u.phone,
    documentType: u.documentType,
    documentNumber: u.documentNumber,
    isActive: u.isActive,
    role: u.role.code,
    roleName: u.role.name,
    createdAt: u.createdAt,
    addressesCount: u.addresses.length,
    ordersCount: u.orders.length,
    totalSpentCop: u.orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + o.totalCop, 0),
    orders: u.orders,
  }));
}

export async function updateAdminCustomer(
  input: z.infer<typeof updateCustomerAdminSchema>,
  actorId: string
) {
  const parsed = updateCustomerAdminSchema.parse(input);

  if (parsed.userId === actorId && (parsed.role !== 'ADMIN' || parsed.isActive === false)) {
    throw new AppError(
      'SELF_DEMOTION_FORBIDDEN',
      'No puedes quitar tus propios privilegios de administrador ni desactivar tu propia cuenta.',
      400
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.userId },
    include: { role: true },
  });

  if (!targetUser) {
    throw new AppError('USER_NOT_FOUND', 'El usuario especificado no existe.', 404);
  }

  let nextRoleId = targetUser.roleId;
  if (parsed.role && parsed.role !== targetUser.role.code) {
    const roleRecord = await prisma.role.findUnique({ where: { code: parsed.role } });
    if (!roleRecord) {
      throw new AppError('ROLE_NOT_FOUND', `El rol ${parsed.role} no está configurado.`, 404);
    }
    nextRoleId = roleRecord.id;
  }

  const updated = await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      roleId: nextRoleId,
      isActive: parsed.isActive ?? targetUser.isActive,
    },
    include: { role: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'ADMIN_USER_UPDATED',
      entity: 'User',
      entityId: updated.id,
      metadata: {
        email: updated.email,
        newRole: updated.role.code,
        isActive: updated.isActive,
      },
    },
  });

  return {
    id: updated.id,
    fullName: updated.name,
    email: updated.email,
    role: updated.role.code,
    isActive: updated.isActive,
  };
}
