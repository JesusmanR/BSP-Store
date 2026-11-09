import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/prisma';
import {
  getSessionUser,
  loginOrRegisterWithGoogle,
  loginWithPassword,
  logoutSession,
  registerCustomer,
  requestPasswordReset,
  resetPasswordWithToken,
} from '@/server/services/auth.service';
import {
  getProductDetail,
  listCatalogProducts,
  listCategoriesAndBrands,
} from '@/server/services/catalog.service';
import { catalogQuerySchema } from '@/server/validation/schemas';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Fase 4: Backend, Modelo Relacional PostgreSQL 17, Autenticación y Catálogo', () => {
  it('consulta categorías, marcas y productos reales desde PostgreSQL 17 con filtros', async () => {
    const meta = await listCategoriesAndBrands();
    expect(meta.categories.length).toBeGreaterThanOrEqual(6);
    expect(meta.brands.some((b) => b.name === 'LOGITECH G')).toBe(true);

    const allProducts = await listCatalogProducts(
      catalogQuerySchema.parse({ category: 'Todas', sort: 'relevance', page: 1, pageSize: 12 })
    );
    expect(allProducts.items.length).toBe(6);
    expect(allProducts.items[0]?.stockAvailable).toBeGreaterThan(0);

    const miceOnly = await listCatalogProducts(
      catalogQuerySchema.parse({ category: 'Mouse gamer' })
    );
    expect(miceOnly.items.every((p) => p.category === 'Mouse gamer')).toBe(true);

    const detail = await getProductDetail('mouse-logitech-g502-x-plus');
    expect(detail.product.sku).toBe('BSP-0001');
    expect(detail.product.variants.length).toBeGreaterThan(0);
    expect(detail.related.length).toBe(4);
  });

  it('registra un cliente, inicia sesión con bcrypt, verifica sesión y cierra sesión en PostgreSQL', async () => {
    const testEmail = `test.fase4.${Date.now()}@bspstore.com.co`;

    const registered = await registerCustomer({
      name: 'Camila Rodríguez',
      email: testEmail,
      password: 'Password123',
      phone: '3109876543',
    });

    expect(registered.user.email).toBe(testEmail);
    expect(registered.user.role).toBe('CUSTOMER');
    expect(registered.sessionToken.length).toBeGreaterThan(30);

    const sessionUser = await getSessionUser(registered.sessionToken);
    expect(sessionUser?.id).toBe(registered.user.id);

    await logoutSession(registered.sessionToken);
    const afterLogout = await getSessionUser(registered.sessionToken);
    expect(afterLogout).toBeNull();

    const relogin = await loginWithPassword({
      email: testEmail,
      password: 'Password123',
    });
    expect(relogin.user.id).toBe(registered.user.id);

    // Cleanup test user
    await prisma.user.delete({ where: { id: registered.user.id } });
  });

  it('conecta o registra un usuario mediante Google OAuth en la tabla oauth_accounts', async () => {
    const googleEmail = `google.fase4.${Date.now()}@bspstore.com.co`;
    const googleId = `gid-${Date.now()}`;

    const googleAuth = await loginOrRegisterWithGoogle({
      email: googleEmail,
      name: 'Usuario Google Prueba',
      googleId,
    });

    expect(googleAuth.user.email).toBe(googleEmail);
    expect(googleAuth.user.role).toBe('CUSTOMER');

    const linked = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleId,
        },
      },
    });
    expect(linked?.userId).toBe(googleAuth.user.id);

    await prisma.user.delete({ where: { id: googleAuth.user.id } });
  });

  it('ejecuta el flujo completo de recuperación de contraseña con token seguro', async () => {
    const resetEmail = `reset.fase4.${Date.now()}@bspstore.com.co`;
    const reg = await registerCustomer({
      name: 'Andrés Gómez',
      email: resetEmail,
      password: 'OldPassword123',
    });

    const { resetToken } = await requestPasswordReset(resetEmail);
    expect(resetToken).toBeDefined();

    await resetPasswordWithToken(resetToken!, 'NewPassword999');

    const loginNew = await loginWithPassword({
      email: resetEmail,
      password: 'NewPassword999',
    });
    expect(loginNew.user.id).toBe(reg.user.id);

    await prisma.user.delete({ where: { id: reg.user.id } });
  });
});
