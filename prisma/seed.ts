import bcrypt from 'bcryptjs';
import { PrismaClient, RoleCode } from '@prisma/client';
import { brandLogos, categories, colombiaDepartments, products } from '../src/data/catalog';
import { slugify } from '../src/lib/format';

const prisma = new PrismaClient();

export async function seedDatabase() {
  // 1. Roles (CUSTOMER, STAFF, ADMIN)
  const customerRole = await prisma.role.upsert({
    where: { code: RoleCode.CUSTOMER },
    update: {
      name: 'Cliente',
      description: 'Comprador registrado en BSP Store',
      permissions: ['catalog:read', 'cart:manage', 'orders:own', 'profile:own'],
    },
    create: {
      code: RoleCode.CUSTOMER,
      name: 'Cliente',
      description: 'Comprador registrado en BSP Store',
      permissions: ['catalog:read', 'cart:manage', 'orders:own', 'profile:own'],
    },
  });

  await prisma.role.upsert({
    where: { code: RoleCode.STAFF },
    update: {
      name: 'Operador / Staff',
      description: 'Gestión operativa de pedidos, inventario y despachos',
      permissions: ['catalog:read', 'inventory:write', 'orders:manage', 'shipments:manage'],
    },
    create: {
      code: RoleCode.STAFF,
      name: 'Operador / Staff',
      description: 'Gestión operativa de pedidos, inventario y despachos',
      permissions: ['catalog:read', 'inventory:write', 'orders:manage', 'shipments:manage'],
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { code: RoleCode.ADMIN },
    update: {
      name: 'Administrador General',
      description: 'Control total del panel administrativo y configuración de BSP Store',
      permissions: ['*'],
    },
    create: {
      code: RoleCode.ADMIN,
      name: 'Administrador General',
      description: 'Control total del panel administrativo y configuración de BSP Store',
      permissions: ['*'],
    },
  });

  // 2. Usuarios base (Admin y Cliente de prueba)
  const adminPasswordHash = await bcrypt.hash('BspAdmin2026*', 10);
  const customerPasswordHash = await bcrypt.hash('BspCliente2026*', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bspstore.com.co' },
    update: {
      name: 'Administrador BSP Store',
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      email: 'admin@bspstore.com.co',
      passwordHash: adminPasswordHash,
      name: 'Administrador BSP Store',
      phone: '3000000000',
      roleId: adminRole.id,
      emailVerified: new Date(),
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'cliente@bspstore.com.co' },
    update: {
      name: 'Cliente BSP Store',
      roleId: customerRole.id,
      isActive: true,
    },
    create: {
      email: 'cliente@bspstore.com.co',
      passwordHash: customerPasswordHash,
      name: 'Cliente BSP Store',
      phone: '3001234567',
      roleId: customerRole.id,
      emailVerified: new Date(),
      isActive: true,
    },
  });

  // 3. Categorías
  const categoryMap = new Map<string, string>();
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]!;
    const slug = slugify(c.name);
    const catRecord = await prisma.category.upsert({
      where: { slug },
      update: {
        name: c.name,
        subtitle: c.subtitle,
        icon: c.icon,
        imageUrl: c.image || null,
        sortOrder: i,
        isActive: true,
      },
      create: {
        name: c.name,
        slug,
        subtitle: c.subtitle,
        icon: c.icon,
        imageUrl: c.image || null,
        sortOrder: i,
        isActive: true,
      },
    });
    categoryMap.set(c.name, catRecord.id);
  }

  // 4. Marcas
  const brandMap = new Map<string, string>();
  for (let i = 0; i < brandLogos.length; i++) {
    const brandName = i === 0 ? 'LOGITECH G' : brandLogos[i]!;
    const slug = slugify(brandName);
    const brandRecord = await prisma.brand.upsert({
      where: { slug },
      update: {
        name: brandName,
        sortOrder: i,
        isActive: true,
      },
      create: {
        name: brandName,
        slug,
        sortOrder: i,
        isActive: true,
      },
    });
    brandMap.set(brandName, brandRecord.id);
  }

  // 5. Productos, Imágenes, Variantes e Inventario
  for (const p of products) {
    const categoryId = categoryMap.get(p.category)!;
    const brandId = brandMap.get(p.brand)!;

    const dbProduct = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        legacyId: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        tag: p.tag ?? null,
        specs: p.specs,
        isFeatured: true,
        isNew: p.id >= 4,
        categoryId,
        brandId,
        isActive: true,
      },
      create: {
        legacyId: p.id,
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        tag: p.tag ?? null,
        specs: p.specs,
        isFeatured: true,
        isNew: p.id >= 4,
        categoryId,
        brandId,
        isActive: true,
      },
    });

    // Imagen principal
    await prisma.productImage.deleteMany({ where: { productId: dbProduct.id } });
    await prisma.productImage.create({
      data: {
        productId: dbProduct.id,
        url: p.image,
        altText: p.name,
        sortOrder: 0,
        isPrimary: true,
      },
    });

    // Variantes
    for (const v of p.variants) {
      const variantSku = `${p.sku}-${v.skuSuffix}`;
      await prisma.productVariant.upsert({
        where: { sku: variantSku },
        update: {
          productId: dbProduct.id,
          name: v.label,
          optionValue: v.label,
          stockQuantity: 12,
          isActive: true,
        },
        create: {
          productId: dbProduct.id,
          sku: variantSku,
          name: v.label,
          optionType: 'Edición / Color',
          optionValue: v.label,
          stockQuantity: 12,
          isActive: true,
        },
      });
    }

    // Inventario principal
    const inv = await prisma.inventory.upsert({
      where: { productId: dbProduct.id },
      update: {
        quantityOnHand: 15,
        lowStockThreshold: 3,
      },
      create: {
        productId: dbProduct.id,
        quantityOnHand: 15,
        quantityReserved: 0,
        lowStockThreshold: 3,
      },
    });

    const movCount = await prisma.inventoryMovement.count({
      where: { inventoryId: inv.id },
    });
    if (movCount === 0) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          type: 'IN',
          quantity: 15,
          reason: 'Carga inicial de catálogo semilla BSP Store',
          createdById: adminUser.id,
        },
      });
    }
  }

  // 6. Zonas de Envío en Colombia
  for (const dept of colombiaDepartments) {
    const rate = dept === 'Bogotá D. C.' ? 12000 : dept === 'Cundinamarca' ? 15000 : 18000;
    await prisma.shippingZone.upsert({
      where: {
        department_city: {
          department: dept,
          city: 'GENERAL',
        },
      },
      update: {
        baseRateCop: rate,
        freeShippingThresholdCop: 500000,
      },
      create: {
        department: dept,
        city: 'GENERAL',
        baseRateCop: rate,
        freeShippingThresholdCop: 500000,
        estimatedDaysMin: dept === 'Bogotá D. C.' ? 1 : 2,
        estimatedDaysMax: dept === 'Bogotá D. C.' ? 3 : 5,
        isActive: true,
      },
    });
  }

  // 7. Transportadoras Colombianas
  const carriers = [
    {
      code: 'SERVIENTREGA',
      name: 'Servientrega',
      trackingUrlTemplate: 'https://www.servientrega.com/wps/portal/rastreo-envio?guia={guia}',
    },
    {
      code: 'COORDINADORA',
      name: 'Coordinadora Mercantil',
      trackingUrlTemplate: 'https://coordinadora.com/rastreo/rastreo-de-guia/?guia={guia}',
    },
    {
      code: 'INTERRAPIDISIMO',
      name: 'Inter Rapidísimo',
      trackingUrlTemplate: 'https://interrapidisimo.com/sigue-tu-envio/?guia={guia}',
    },
    {
      code: 'ENVIA',
      name: 'Envía Colvanes',
      trackingUrlTemplate: 'https://envia.co/',
    },
  ];

  for (const c of carriers) {
    await prisma.carrier.upsert({
      where: { code: c.code },
      update: { name: c.name, trackingUrlTemplate: c.trackingUrlTemplate },
      create: {
        code: c.code,
        name: c.name,
        trackingUrlTemplate: c.trackingUrlTemplate,
        adapterType: 'COLOMBIA_ADAPTER',
        isActive: true,
      },
    });
  }

  // 8. Cupones promocionales reales
  await prisma.coupon.upsert({
    where: { code: 'BSPWELCOME10' },
    update: {
      description: '10% de descuento de bienvenida en compras desde $200.000 COP',
      type: 'PERCENTAGE',
      value: 10,
      minOrderCop: 200000,
      isActive: true,
    },
    create: {
      code: 'BSPWELCOME10',
      description: '10% de descuento de bienvenida en compras desde $200.000 COP',
      type: 'PERCENTAGE',
      value: 10,
      minOrderCop: 200000,
      isActive: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: 'BSPSETUP50' },
    update: {
      description: '$50.000 COP de descuento en setups desde $600.000 COP',
      type: 'FIXED_COP',
      value: 50000,
      minOrderCop: 600000,
      isActive: true,
    },
    create: {
      code: 'BSPSETUP50',
      description: '$50.000 COP de descuento en setups desde $600.000 COP',
      type: 'FIXED_COP',
      value: 50000,
      minOrderCop: 600000,
      isActive: true,
    },
  });

  // 9. Configuración Comercial de la Tienda (Llave Bre-B @bbbsp y Wompi)
  await prisma.storeSetting.upsert({
    where: { key: 'payment.config' },
    update: {
      value: {
        brebEnabled: true,
        brebKey: '@bbbsp',
        brebZeroCommission: true,
        wompiEnabled: true,
        wompiAllowedMethods: ['PSE', 'CARD', 'OTHER'],
      },
      description: 'Configuración oficial de pagos: Llave Bre-B (@bbbsp) sin costo y Wompi para PSE/TC',
    },
    create: {
      key: 'payment.config',
      value: {
        brebEnabled: true,
        brebKey: '@bbbsp',
        brebZeroCommission: true,
        wompiEnabled: true,
        wompiAllowedMethods: ['PSE', 'CARD', 'OTHER'],
      },
      description: 'Configuración oficial de pagos: Llave Bre-B (@bbbsp) sin costo y Wompi para PSE/TC',
    },
  });
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      console.log('✔ Base de datos PostgreSQL 17 sembrada exitosamente para BSP Store.');
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('Error en seed:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
