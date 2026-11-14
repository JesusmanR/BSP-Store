import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { AppError, apiSuccess, handleApiError } from '@/server/http/errors';
import { requireAuth } from '@/server/http/session';
import { getProductDetail } from '@/server/services/catalog.service';

export type StoredProductReview = {
  id: string;
  productSlug: string;
  userId: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(100),
  comment: z.string().trim().min(10, 'El comentario debe tener al menos 10 caracteres').max(1000),
});

function getReviewSettingKey(slug: string): string {
  return `product.reviews.${slug.toLowerCase()}`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await context.params;

    if (idOrSlug.toLowerCase() === 'all') {
      const settings = await prisma.storeSetting.findMany({
        where: { key: { startsWith: 'product.reviews.' } },
      });
      const allReviews: StoredProductReview[] = settings
        .flatMap((s) => (Array.isArray(s.value) ? (s.value as unknown as StoredProductReview[]) : []))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const totalReviews = allReviews.length;
      const averageRating =
        totalReviews > 0
          ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
          : 0;

      return apiSuccess({
        productSlug: 'all',
        totalReviews,
        averageRating,
        reviews: allReviews.slice(0, 10),
      });
    }

    const { product } = await getProductDetail(idOrSlug);
    const key = getReviewSettingKey(product.slug);

    const setting = await prisma.storeSetting.findUnique({ where: { key } });
    const reviews: StoredProductReview[] = Array.isArray(setting?.value)
      ? (setting.value as unknown as StoredProductReview[])
      : [];

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    return apiSuccess({
      productSlug: product.slug,
      totalReviews,
      averageRating,
      reviews,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { idOrSlug } = await context.params;
    const { product } = await getProductDetail(idOrSlug);

    const body = await request.json();
    const parsed = createReviewSchema.parse(body);

    const key = getReviewSettingKey(product.slug);
    const existingSetting = await prisma.storeSetting.findUnique({ where: { key } });
    const existingReviews: StoredProductReview[] = Array.isArray(existingSetting?.value)
      ? (existingSetting.value as unknown as StoredProductReview[])
      : [];

    const matchingOrder = await prisma.order.findFirst({
      where: {
        OR: [{ userId: user.id }, { customerEmail: user.email }],
        items: {
          some: {
            productId: product.dbId,
          },
        },
      },
      select: { id: true },
    });

    const newReview: StoredProductReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      productSlug: product.slug,
      userId: user.id,
      authorName: user.name,
      rating: parsed.rating,
      title: parsed.title,
      comment: parsed.comment,
      verifiedPurchase: Boolean(matchingOrder),
      createdAt: new Date().toISOString(),
    };

    const filtered = existingReviews.filter((r) => r.userId !== user.id);
    const updatedReviews = [newReview, ...filtered];

    await prisma.storeSetting.upsert({
      where: { key },
      update: {
        value: updatedReviews,
        description: `Opiniones de clientes para ${product.name}`,
      },
      create: {
        key,
        value: updatedReviews,
        description: `Opiniones de clientes para ${product.name}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'PRODUCT_REVIEW_SUBMITTED',
        entity: 'Product',
        entityId: product.dbId,
        metadata: {
          slug: product.slug,
          rating: parsed.rating,
          verifiedPurchase: newReview.verifiedPurchase,
        },
      },
    });

    const totalReviews = updatedReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((updatedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    return apiSuccess(
      {
        review: newReview,
        totalReviews,
        averageRating,
        reviews: updatedReviews,
      },
      201
    );
  } catch (error) {
    if (error instanceof AppError) {
      return handleApiError(error);
    }
    return handleApiError(error);
  }
}
