import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { products } from '@/data/catalog';
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildProductJsonLd,
} from '@/lib/seo';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { DELETE as privacyDelete, GET as privacyGet } from '@/app/api/v1/privacy/me/route';
import { prisma } from '@/server/db/prisma';
import { registerCustomer } from '@/server/services/auth.service';

describe('Fase 7: SEO Técnico (robots.txt, sitemap.xml, JSON-LD) y Cumplimiento Habeas Data (Ley 1581 Colombia)', () => {
  it('1. genera directivas robots.txt protegiendo /admin, /api/, /cuenta y /checkout y declarando sitemap.xml', () => {
    const robotsConfig = robots();
    expect(robotsConfig.sitemap).toContain('/sitemap.xml');

    const firstRule = Array.isArray(robotsConfig.rules)
      ? robotsConfig.rules[0]
      : robotsConfig.rules;
    expect(firstRule?.disallow).toContain('/admin');
    expect(firstRule?.disallow).toContain('/api/');
    expect(firstRule?.disallow).toContain('/checkout');
  });

  it('2. genera sitemap.xml dinámico con rutas principales y todos los productos activos en PostgreSQL 17', async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThanOrEqual(10);
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith('/tienda'))).toBe(true);
    expect(urls.some((u) => u.includes('/producto/'))).toBe(true);
  });

  it('3. construye datos estructurados Schema.org JSON-LD válidos para OnlineStore, Product (COP) y BreadcrumbList', () => {
    const orgSchema = buildOrganizationJsonLd();
    expect(orgSchema['@type']).toBe('OnlineStore');
    expect(orgSchema.currenciesAccepted).toBe('COP');
    expect(orgSchema.paymentAccepted).toContain('@bbbsp');

    const sampleProduct = products[0]!;
    const prodSchema = buildProductJsonLd(sampleProduct, { inStock: true });
    expect(prodSchema['@type']).toBe('Product');
    expect(prodSchema.sku).toBe(sampleProduct.sku);
    expect(prodSchema.offers.priceCurrency).toBe('COP');
    expect(prodSchema.offers.price).toBe(sampleProduct.price);
    expect(prodSchema.offers.availability).toBe('https://schema.org/InStock');

    const breadcrumbSchema = buildBreadcrumbJsonLd([
      { name: 'Inicio', path: '/' },
      { name: 'Tienda', path: '/tienda' },
    ]);
    expect(breadcrumbSchema['@type']).toBe('BreadcrumbList');
    expect(breadcrumbSchema.itemListElement).toHaveLength(2);
  });

  it('4. cumple la Ley 1581 de 2012 (Habeas Data Colombia) permitiendo portabilidad JSON y anonimización de cuenta', async () => {
    const uniqueEmail = `habeas.${Date.now()}@colombia.co`;
    const registered = await registerCustomer({
      name: 'Titular Habeas Data',
      email: uniqueEmail,
      phone: '3105556677',
      password: 'Password123*',
    });

    const getReq = new NextRequest('http://localhost:3000/api/v1/privacy/me', {
      headers: {
        authorization: `Bearer ${registered.sessionToken}`,
      },
    });
    const exportRes = await privacyGet(getReq);
    expect(exportRes.status).toBe(200);
    const exportJson = await exportRes.json();
    expect(exportJson.ok).toBe(true);
    expect(exportJson.data.regulation).toContain('Ley Estatutaria 1581 de 2012');
    expect(exportJson.data.subject.email).toBe(uniqueEmail);

    const deleteReq = new NextRequest('http://localhost:3000/api/v1/privacy/me', {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${registered.sessionToken}`,
      },
    });
    const deleteRes = await privacyDelete(deleteReq);
    expect(deleteRes.status).toBe(200);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.data.anonymized).toBe(true);

    const userInDb = await prisma.user.findUniqueOrThrow({
      where: { id: registered.user.id },
    });
    expect(userInDb.isActive).toBe(false);
    expect(userInDb.email).toContain('anonimizado.');
  });
});
