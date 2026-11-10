import type { Metadata } from 'next';
import { StoreProvider } from '@/context/StoreContext';
import { StoreShell } from '@/components/layout/StoreShell';
import { buildOrganizationJsonLd } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BSP Store | Tecnología y Periféricos Gaming en Colombia',
    template: '%s | BSP Store Colombia',
  },
  description:
    'Tienda especializada en periféricos Logitech G, audio, teclados mecánicos y mouses inalámbricos en Colombia. Envíos a todo el país y pagos seguros con Llave Bre-B (@bbbsp) y Wompi.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'BSP Store Colombia',
    title: 'BSP Store | Tecnología y Periféricos Gaming en Colombia',
    description:
      'Equipamiento original para gaming y productividad con envíos nacionales y pagos seguros en Colombia (Llave Bre-B @bbbsp y Wompi).',
    images: [
      {
        url: '/images/logo-bsp-light.jpg',
        width: 1200,
        height: 675,
        alt: 'BSP Store Colombia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BSP Store | Tecnología y Periféricos Gaming en Colombia',
    description:
      'Periféricos gaming y productividad en Colombia con envíos nacionales y pagos vía Bre-B (@bbbsp) y Wompi.',
    images: ['/images/logo-bsp-light.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = buildOrganizationJsonLd();

  return (
    <html lang="es-CO">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <StoreProvider>
          <StoreShell>{children}</StoreShell>
        </StoreProvider>
      </body>
    </html>
  );
}
