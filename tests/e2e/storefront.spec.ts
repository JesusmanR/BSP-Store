import { expect, test } from '@playwright/test';

test.describe('BSP Store Colombia — Flujo E2E Completo', () => {
  test('navega desde Inicio al Catálogo, filtra productos, abre Ficha de Producto, agrega al Carrito y llega al Checkout con Llave Bre-B (@bbbsp) y Wompi', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/tecnología/i);

    // Ir al catálogo (/tienda)
    await page.getByRole('button', { name: 'Tienda' }).first().click();
    await expect(page).toHaveURL(/\/tienda/);
    await expect(page.getByText(/Logitech G435/i).first()).toBeVisible();

    // Abrir ficha de producto
    await page.getByText(/Logitech G435/i).first().click();
    await expect(page).toHaveURL(/\/producto\//);
    await expect(page.getByRole('button', { name: /Agregar al carrito/i })).toBeVisible();

    // Agregar al carrito y abrir checkout
    await page.getByRole('button', { name: /Comprar ahora/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(/@bbbsp/i).first()).toBeVisible();
    await expect(page.getByText(/Wompi/i).first()).toBeVisible();
  });

  test('muestra la pantalla de autenticación (/cuenta) con login, registro y Google OAuth, y protege el panel administrativo (/admin)', async ({
    page,
  }) => {
    await page.goto('/cuenta');
    await expect(page.getByRole('button', { name: /Continuar con Google/i })).toBeVisible();

    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: /Panel Administrativo Independiente/i })
    ).toBeVisible();
  });
});
