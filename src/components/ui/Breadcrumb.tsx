import Link from 'next/link';
import { Icon } from './Icon';

export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav className="breadcrumb" aria-label="Ruta de navegación">
      <Link href="/">Inicio</Link>
      <Icon name="chevron" size={13} />
      {current !== 'Tienda' && (
        <>
          <Link href="/tienda">Tienda</Link>
          <Icon name="chevron" size={13} />
        </>
      )}
      <span>{current}</span>
    </nav>
  );
}
