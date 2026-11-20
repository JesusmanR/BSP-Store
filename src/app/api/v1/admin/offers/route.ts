import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { requireAdminUser } from '@/server/http/admin-guard';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { applyAdminOfferByScope } from '@/server/services/admin.service';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);

    const [offers, campaigns, categories, brands, products] = await Promise.all([
      prisma.product.findMany({
        where: { isOffer: true },
        include: { category: true, brand: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.discount.findMany({
        where: { isActive: true },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.brand.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.findMany({
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          compareAtPrice: true,
          isOffer: true,
          categoryId: true,
          brandId: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return apiSuccess({
      offers: offers.map((o) => ({
        id: o.id,
        sku: o.sku,
        name: o.name,
        price: o.price,
        compareAtPrice: o.compareAtPrice,
        discountPercent:
          o.compareAtPrice && o.compareAtPrice > o.price
            ? Math.round(((o.compareAtPrice - o.price) / o.compareAtPrice) * 100)
            : 0,
        category: { id: o.category.id, name: o.category.name },
        brand: { id: o.brand.id, name: o.brand.name },
      })),
      campaigns,
      categories,
      brands,
      products,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request, true);
    const body = await request.json();
    const result = await applyAdminOfferByScope(body, admin.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdminUser(request, true);
    const body = await request.json().catch(() => ({}));
    const result = await applyAdminOfferByScope(
      {
        categoryId: body.categoryId ?? null,
        brandId: body.brandId ?? null,
        productId: body.productId ?? null,
        discountPercent: 0,
      },
      admin.id
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
