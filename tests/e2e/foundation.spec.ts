import { expect, test } from '@playwright/test';

test.describe('Fase 2 & 3: Fundación e Interfaz Figma Make — BSP Store', () => {
  test('responde estado saludable en /api/v1/health conectado a PostgreSQL y reporta llave @bbbsp', async ({
    request,
  }) => {
    const response = await request.get('/api/v1/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.database.status).toBe('connected');
    expect(body.data.payments.brebTransferKey).toBe('@bbbsp');
  });

  test('renderiza el Inicio migrado de Figma Make y navega a Tienda y Ficha de Producto', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Lleva tu setup');
    await expect(page.getByText('Arma tu setup, a tu manera')).toBeVisible();

    await page.goto('/tienda');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Explora nuestra tienda');

    await page.goto('/producto/1');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Mouse Logitech G502 X Plus'
    );
  });
});
