import { afterAll, describe, expect, it } from 'vitest';
import { calculateDiscountPercent, formatCOP, slugify } from '@/lib/format';
import { prisma } from '@/server/db/prisma';
import { estimateGatewayCommission } from '@/server/payments/types';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Fase 2: Fundación — Utilidades comerciales, PostgreSQL y pasarelas de pago Colombia', () => {
  it('verifica lectura y escritura real en PostgreSQL 17 mediante Prisma ORM', async () => {
    const record = await prisma.storeSetting.upsert({
      where: { key: 'store.foundation.verified' },
      update: {
        value: {
          country: 'CO',
          currency: 'COP',
          gateways: ['WOMPI', 'BOLD', 'MERCADO_PAGO'],
        },
        description: 'Registro de verificación de conexión de Fase 2 (Fundación)',
      },
      create: {
        key: 'store.foundation.verified',
        value: {
          country: 'CO',
          currency: 'COP',
          gateways: ['WOMPI', 'BOLD', 'MERCADO_PAGO'],
        },
        description: 'Registro de verificación de conexión de Fase 2 (Fundación)',
      },
    });

    expect(record.key).toBe('store.foundation.verified');
    expect(record.value).toEqual({
      country: 'CO',
      currency: 'COP',
      gateways: ['WOMPI', 'BOLD', 'MERCADO_PAGO'],
    });
  });

  it('formatea valores en pesos colombianos (COP) sin decimales', () => {
    const formatted = formatCOP(429900);
    expect(formatted).toContain('429.900');
  });

  it('calcula correctamente el porcentaje de descuento entre precio anterior y actual', () => {
    expect(calculateDiscountPercent(429900, 499900)).toBe(14);
    expect(calculateDiscountPercent(389900, 389900)).toBe(0);
    expect(calculateDiscountPercent(389900, null)).toBe(0);
  });

  it('genera slugs limpios para URLs amigables en español', () => {
    expect(slugify('Audífonos Logitech G733 Lightspeed Inalámbricos')).toBe(
      'audifonos-logitech-g733-lightspeed-inalambricos'
    );
  });

  it('calcula y compara comisiones + IVA (19%) entre Wompi, Bold y Mercado Pago en Colombia', () => {
    const ticketCop = 429900; // Logitech G502 X PLUS

    const wompi = estimateGatewayCommission('WOMPI', ticketCop, 'CARD_OR_WALLET');
    const bold = estimateGatewayCommission('BOLD', ticketCop, 'CARD_OR_WALLET');
    const boldPse = estimateGatewayCommission('BOLD', ticketCop, 'PSE');
    const mercadoPago = estimateGatewayCommission('MERCADO_PAGO', ticketCop, 'CARD_OR_WALLET');

    // Wompi (2.65% + $700 + IVA) < Bold PSE (2.89% + $900 + IVA) < Bold Card (2.99% + $900 + IVA) < Mercado Pago (3.29% + $800 + IVA)
    expect(wompi.totalGatewayCostCop).toBeLessThan(boldPse.totalGatewayCostCop);
    expect(boldPse.totalGatewayCostCop).toBeLessThan(bold.totalGatewayCostCop);
    expect(bold.totalGatewayCostCop).toBeLessThan(mercadoPago.totalGatewayCostCop);
    expect(wompi.estimatedNetBeforeRetentionsCop).toBe(ticketCop - wompi.totalGatewayCostCop);
  });
});
