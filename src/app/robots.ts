import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bspstore.com.co';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/tienda', '/producto/', '/ofertas', '/contacto'],
        disallow: ['/admin', '/api/', '/cuenta', '/checkout', '/carrito'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
