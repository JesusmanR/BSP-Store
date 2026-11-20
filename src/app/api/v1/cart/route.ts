import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/server/http/errors';
import { enforceRateLimit, extractClientIp } from '@/server/http/rate-limit';
import { extractSessionToken } from '@/server/http/session';
import { getSessionUser } from '@/server/services/auth.service';
import {
  getOrCreateServerCart,
  upsertCartItem,
} from '@/server/services/cart.service';

const GUEST_CART_COOKIE = 'bsp_guest_cart';

const cartItemMutationSchema = z.object({
  productIdOrLegacyId: z.union([z.number().int().positive(), z.string().min(1)]),
  variantId: z.string().optional(),
  quantity: z.number().int().min(0).max(20),
});

function resolveGuestToken(request: NextRequest): { token: string; isNew: boolean } {
  const fromCookie = request.cookies.get(GUEST_CART_COOKIE)?.value?.trim();
  if (fromCookie && /^[a-f0-9]{32,64}$/i.test(fromCookie)) {
    return { token: fromCookie, isNew: false };
  }
  return { token: crypto.randomBytes(24).toString('hex'), isNew: true };
}

export async function GET(request: NextRequest) {
  try {
    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const guest = user ? null : resolveGuestToken(request);

    const cart = await getOrCreateServerCart({
      userId: user?.id ?? null,
      guestToken: guest?.token ?? null,
    });

    const response = apiSuccess(cart);
    if (guest?.isNew) {
      response.cookies.set(GUEST_CART_COOKIE, guest.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 14,
      });
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers.get('x-forwarded-for'));
    enforceRateLimit(`cart:post:${ip}`, 60, 60_000);

    const sessionToken = extractSessionToken(request);
    const user = await getSessionUser(sessionToken);
    const body = await request.json();
    const parsed = cartItemMutationSchema.parse(body);
    const guest = user ? null : resolveGuestToken(request);

    const cart = await upsertCartItem({
      userId: user?.id ?? null,
      guestToken: guest?.token ?? null,
      productIdOrLegacyId: parsed.productIdOrLegacyId,
      variantId: parsed.variantId ?? null,
      quantity: parsed.quantity,
    });

    const response = apiSuccess(cart);
    if (guest?.isNew) {
      response.cookies.set(GUEST_CART_COOKIE, guest.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 14,
      });
    }
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
