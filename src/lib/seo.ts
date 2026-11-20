import type { Product as CatalogProduct } from '@/data/catalog';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bspstore.com.co';

/**
 * Genera el esquema JSON-LD `Organization` + `OnlineStore` de Schema.org
 * optimizado para BSP Store Colombia.
 */
export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'BSP Store Colombia',
    alternateName: 'BSP STORE',
    url: BASE_URL,
    logo: `${BASE_URL}/images/logo-bsp.png`,
    image: `${BASE_URL}/images/hero-setup.jpg`,
    description:
      'Tienda online especializada en periféricos Logitech G, audio, teclados mecánicos, mouses inalámbricos y tecnología para setups desde Bucaramanga, Santander para toda Colombia.',
    telephone: '+57-302-800-0240',
    email: 'compras@bspstore.com.co',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bucaramanga',
      addressRegion: 'Santander',
      addressCountry: 'CO',
    },
    sameAs: [
      'https://www.facebook.com/bspstore.co',
      'https://www.instagram.com/bspstore.co',
      'https://www.tiktok.com/@bspstore.co',
    ],
    currenciesAccepted: 'COP',
    paymentAccepted:
      'Transferencia inmediata Llave Bre-B (@bbbsp), PSE, Tarjeta de Crédito, Tarjeta Débito (Wompi Colombia)',
    priceRange: '$$',
    areaServed: {
      '@type': 'Country',
      name: 'Colombia',
      identifier: 'CO',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/tienda?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Genera el esquema JSON-LD `Product` de Schema.org con ofertas en COP.
 */
export function buildProductJsonLd(
  product: CatalogProduct,
  options?: { inStock?: boolean; baseUrl?: string }
) {
  const siteUrl = options?.baseUrl ?? BASE_URL;
  const inStock = options?.inStock ?? true;
  const canonicalUrl = `${siteUrl}/producto/${product.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    mpn: product.sku,
    description: product.description,
    category: product.category,
    image: [`${siteUrl}${product.image}`],
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'COP',
      price: product.price,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'BSP Store Colombia',
      },
    },
  };
}

/**
 * Genera el esquema JSON-LD `BreadcrumbList` de Schema.org.
 */
export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  baseUrl = BASE_URL
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}

/**
 * Serializa JSON-LD escapando caracteres HTML peligrosos (<, >, &) para prevenir Stored XSS.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
