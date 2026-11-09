import { prisma } from '@/server/db/prisma';
import { AppError } from '@/server/http/errors';

export async function getOrCreateServerCart(params: {
  userId?: string | null;
  guestToken?: string | null;
}) {
  if (!params.userId && !params.guestToken) {
    throw new AppError('CART_OWNER_REQUIRED', 'Se requiere sesión o token de carrito.', 400);
  }

  let cart = params.userId
    ? await prisma.cart.findUnique({
        where: { userId: params.userId },
        include: {
          items: {
            include: {
              product: { include: { images: true, inventory: true, brand: true } },
              variant: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    : await prisma.cart.findUnique({
        where: { guestToken: params.guestToken! },
        include: {
          items: {
            include: {
              product: { include: { images: true, inventory: true, brand: true } },
              variant: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId: params.userId ?? null,
        guestToken: params.userId ? null : (params.guestToken ?? null),
      },
      include: {
        items: {
          include: {
            product: { include: { images: true, inventory: true, brand: true } },
            variant: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  const enrichedItems = cart.items.map((item) => {
    const unitPrice = item.variant?.priceOverride ?? item.product.price;
    const availableStock = Math.max(
      0,
      (item.product.inventory?.quantityOnHand ?? 0) -
        (item.product.inventory?.quantityReserved ?? 0)
    );
    return {
      id: item.id,
      productId: item.productId,
      legacyId: item.product.legacyId,
      name: item.product.name,
      sku: item.variant?.sku ?? item.product.sku,
      brand: item.product.brand.name,
      image: item.product.images[0]?.url ?? '/images/g502x-plus-gallery-1-black.png',
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      availableStock,
    };
  });

  const subtotalCop = enrichedItems.reduce((acc, i) => acc + i.lineTotal, 0);
  const totalCount = enrichedItems.reduce((acc, i) => acc + i.quantity, 0);

  return {
    cartId: cart.id,
    items: enrichedItems,
    totalCount,
    subtotalCop,
  };
}

export async function upsertCartItem(params: {
  userId?: string | null;
  guestToken?: string | null;
  productIdOrLegacyId: string | number;
  variantId?: string | null;
  quantity: number;
}) {
  if (params.quantity < 0 || params.quantity > 20) {
    throw new AppError('INVALID_QUANTITY', 'La cantidad debe estar entre 0 y 20 unidades.', 400);
  }

  const cartState = await getOrCreateServerCart({
    userId: params.userId,
    guestToken: params.guestToken,
  });

  const numericLegacy = Number(params.productIdOrLegacyId);
  const product = await prisma.product.findFirst({
    where:
      !Number.isNaN(numericLegacy) && numericLegacy > 0
        ? { legacyId: numericLegacy, isActive: true }
        : { id: String(params.productIdOrLegacyId), isActive: true },
    include: { inventory: true },
  });

  if (!product) {
    throw new AppError('PRODUCT_NOT_FOUND', 'El producto no existe o no está disponible.', 404);
  }

  const available = Math.max(
    0,
    (product.inventory?.quantityOnHand ?? 0) - (product.inventory?.quantityReserved ?? 0)
  );

  if (params.quantity > available) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      `Solo quedan ${available} unidades disponibles de ${product.name}.`,
      409
    );
  }

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cartState.cartId,
      productId: product.id,
      variantId: params.variantId ?? null,
    },
  });

  if (params.quantity === 0) {
    if (existingItem) {
      await prisma.cartItem.delete({ where: { id: existingItem.id } });
    }
  } else if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: params.quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cartState.cartId,
        productId: product.id,
        variantId: params.variantId ?? null,
        quantity: params.quantity,
      },
    });
  }

  return getOrCreateServerCart({
    userId: params.userId,
    guestToken: params.guestToken,
  });
}
