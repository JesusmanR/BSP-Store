import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { requireAuth } from '@/server/http/session';

const favoriteActionSchema = z.object({
  productIdOrLegacyId: z.union([z.number().int().positive(), z.string().trim().min(1)]),
  action: z.enum(['toggle', 'add', 'remove']).optional().default('toggle'),
});

async function resolveDbProduct(idOrSlug: number | string) {
  const asNum = typeof idOrSlug === 'number' ? idOrSlug : Number(idOrSlug);
  if (Number.isInteger(asNum) && asNum > 0) {
    const byLegacy = await prisma.product.findUnique({ where: { legacyId: asNum } });
    if (byLegacy) return byLegacy;
  }
  const str = String(idOrSlug).trim();
  return prisma.product.findFirst({
    where: {
      OR: [{ id: str }, { slug: str.toLowerCase() }, { sku: str.toUpperCase() }],
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const rows = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const favoriteIds = rows
      .map((r) => r.product.legacyId)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    return apiSuccess({
      favoriteIds,
      favorites: rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        legacyId: r.product.legacyId,
        slug: r.product.slug,
        sku: r.product.sku,
        name: r.product.name,
        price: r.product.price,
        category: r.product.category.name,
        brand: r.product.brand.name,
        image: r.product.images[0]?.url ?? '/images/g502x-plus-gallery-1-black.png',
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const parsed = favoriteActionSchema.parse(body);

    const product = await resolveDbProduct(parsed.productIdOrLegacyId);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Producto no encontrado en el catálogo.', 404);
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId: product.id,
        },
      },
    });

    let isFavorite = false;

    if (parsed.action === 'add' || (parsed.action === 'toggle' && !existing)) {
      if (!existing) {
        await prisma.favorite.create({
          data: {
            userId: user.id,
            productId: product.id,
          },
        });
      }
      isFavorite = true;
    } else if (parsed.action === 'remove' || (parsed.action === 'toggle' && existing)) {
      if (existing) {
        await prisma.favorite.delete({
          where: { id: existing.id },
        });
      }
      isFavorite = false;
    }

    const allFavorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: { product: { select: { legacyId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const favoriteIds = allFavorites
      .map((f) => f.product.legacyId)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    return apiSuccess({
      isFavorite,
      productId: product.id,
      legacyId: product.legacyId,
      favoriteIds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
