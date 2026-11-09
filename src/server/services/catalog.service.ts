import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';
import type { z } from 'zod';
import type { catalogQuerySchema } from '@/server/validation/schemas';

export async function listCatalogProducts(
  filters: z.infer<typeof catalogQuerySchema>
) {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (filters.category && filters.category !== 'Todas') {
    where.category = {
      OR: [{ name: filters.category }, { slug: filters.category.toLowerCase() }],
    };
  }

  if (filters.brand) {
    where.brand = {
      OR: [
        { name: { equals: filters.brand, mode: 'insensitive' } },
        { slug: filters.brand.toLowerCase() },
      ],
    };
  }

  if (filters.maxPrice) {
    where.price = { lte: filters.maxPrice };
  }

  if (filters.inStock) {
    where.inventory = {
      quantityOnHand: { gt: 0 },
    };
  }

  if (filters.q && filters.q.trim() !== '') {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    filters.sort === 'asc'
      ? { price: 'asc' }
      : filters.sort === 'desc'
        ? { price: 'desc' }
        : filters.sort === 'new'
          ? { createdAt: 'desc' }
          : { legacyId: 'asc' };

  const skip = (filters.page - 1) * filters.pageSize;

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: filters.pageSize,
      include: {
        category: true,
        brand: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { isActive: true } },
        inventory: true,
      },
    }),
  ]);

  return {
    items: items.map((p) => ({
      id: p.legacyId ?? 0,
      dbId: p.id,
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      brand: p.brand.name,
      category: p.category.name,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      tag: p.tag,
      description: p.description,
      specs: p.specs,
      image: p.images[0]?.url ?? '/images/g502x-plus-gallery-1-black.png',
      images: p.images,
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        label: v.name,
        stockQuantity: v.stockQuantity,
      })),
      stockAvailable: Math.max(
        0,
        (p.inventory?.quantityOnHand ?? 0) - (p.inventory?.quantityReserved ?? 0)
      ),
      isFeatured: p.isFeatured,
      isNew: p.isNew,
      isOffer: p.isOffer,
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  };
}

export async function getProductDetail(idOrSlug: string) {
  const numericId = Number(idOrSlug);
  const where: Prisma.ProductWhereInput =
    !Number.isNaN(numericId) && numericId > 0
      ? { legacyId: numericId, isActive: true }
      : {
          OR: [{ id: idOrSlug }, { slug: idOrSlug.toLowerCase() }],
          isActive: true,
        };

  const product = await prisma.product.findFirst({
    where,
    include: {
      category: true,
      brand: true,
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { where: { isActive: true } },
      inventory: true,
    },
  });

  if (!product) {
    throw new AppError('PRODUCT_NOT_FOUND', 'El producto solicitado no existe.', 404);
  }

  const related = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
    },
    take: 4,
    orderBy: { legacyId: 'asc' },
    include: {
      category: true,
      brand: true,
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { where: { isActive: true } },
      inventory: true,
    },
  });

  return {
    product: {
      id: product.legacyId ?? 0,
      dbId: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      brand: product.brand.name,
      category: product.category.name,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      tag: product.tag,
      description: product.description,
      specs: product.specs,
      image: product.images[0]?.url ?? '/images/g502x-plus-gallery-1-black.png',
      images: product.images,
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        label: v.name,
        stockQuantity: v.stockQuantity,
      })),
      stockAvailable: Math.max(
        0,
        (product.inventory?.quantityOnHand ?? 0) - (product.inventory?.quantityReserved ?? 0)
      ),
    },
    related: related.map((r) => ({
      id: r.legacyId ?? 0,
      dbId: r.id,
      sku: r.sku,
      slug: r.slug,
      name: r.name,
      brand: r.brand.name,
      category: r.category.name,
      price: r.price,
      image: r.images[0]?.url ?? '/images/g502x-plus-gallery-1-black.png',
    })),
  };
}

export async function listCategoriesAndBrands() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      subtitle: c.subtitle,
      icon: c.icon,
      imageUrl: c.imageUrl,
      productCount: c._count.products,
    })),
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      productCount: b._count.products,
    })),
  };
}
