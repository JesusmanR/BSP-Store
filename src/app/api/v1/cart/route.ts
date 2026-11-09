import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import {
  getOrCreateServerCart,
  upsertCartItem,
} from '@/server/services/cart.service';

const cartItemMutationSchema = z.object({
  guestToken: z.string().trim().optional(),
  productIdOrLegacyId: z.union([z.number().int().positive(), z.string().min(1)]),
  variantId: z.string().optional(),
  quantity: z.number().int().min(0).max(20),
});

export async function GET(request: NextRequest) {
  try {
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const guestToken = request.nextUrl.searchParams.get('guestToken') ?? 'default-guest';

    const cart = await getOrCreateServerCart({
      userId: user?.id ?? null,
      guestToken: user ? null : guestToken,
    });

    return apiSuccess(cart);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const body = await request.json();
    const parsed = cartItemMutationSchema.parse(body);

    const cart = await upsertCartItem({
      userId: user?.id ?? null,
      guestToken: user ? null : (parsed.guestToken ?? 'default-guest'),
      productIdOrLegacyId: parsed.productIdOrLegacyId,
      variantId: parsed.variantId ?? null,
      quantity: parsed.quantity,
    });

    return apiSuccess(cart);
  } catch (error) {
    return handleApiError(error);
  }
}
