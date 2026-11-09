import type { Metadata } from 'next';
import { StoreProvider } from '@/context/StoreContext';
import { StoreShell } from '@/components/layout/StoreShell';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BSP Store | Tecnología y Periféricos Gaming en Colombia',
    template: '%s | BSP Store Colombia',
  },
  description:
    'Tienda especializada en periféricos Logitech G, audio, teclados mecánicos y mouses inalámbricos en Colombia. Envíos a todo el país y pagos seguros con Llave Bre-B (@bbbsp) y Wompi.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'BSP Store',
    title: 'BSP Store | Tecnología y Periféricos Gaming en Colombia',
    description:
      'Equipamiento original para gaming y productividad con envíos nacionales y pagos seguros en Colombia.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO">
      <body>
        <StoreProvider>
          <StoreShell>{children}</StoreShell>
        </StoreProvider>
      </body>
    </html>
  );
}
