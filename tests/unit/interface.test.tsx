import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  categories,
  cop,
  findProductByIdOrSlug,
  products,
} from '@/data/catalog';
import { StoreProvider } from '@/context/StoreContext';
import { ProductCard } from '@/components/catalog/ProductCard';
import { Quantity } from '@/components/ui/Quantity';
import { OFFICIAL_BREB_KEY, estimateGatewayCommission } from '@/server/payments/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useParams: () => ({ idOrSlug: '1' }),
}));

describe('Fase 3: Interfaz — Catálogo, Componentes de Figma Make y Medios de Pago', () => {
  it('conserva los 6 productos y las 6 categorías originales de Figma Make con SKU y slug SEO', () => {
    expect(products).toHaveLength(6);
    expect(categories).toHaveLength(6);

    const byId = findProductByIdOrSlug('1');
    const bySlug = findProductByIdOrSlug('mouse-logitech-g502-x-plus');
    expect(byId?.name).toBe('Mouse Logitech G502 X Plus');
    expect(bySlug?.id).toBe(1);
    expect(byId?.sku).toBe('BSP-0001');
  });

  it('configura la llave Bre-B (@bbbsp) sin costo ($0 COP) y Wompi para PSE/TC', () => {
    expect(OFFICIAL_BREB_KEY).toBe('@bbbsp');
    const breb = estimateGatewayCommission('BREB_TRANSFER', 649900);
    expect(breb.totalGatewayCostCop).toBe(0);
    expect(breb.estimatedNetBeforeRetentionsCop).toBe(649900);

    const wompiPse = estimateGatewayCommission('WOMPI', 649900, 'PSE');
    expect(wompiPse.totalGatewayCostCop).toBeGreaterThan(0);
  });

  it('renderiza ProductCard con precio en COP, favoritos y botón de agregar al carrito', () => {
    const product = products[0]!;
    render(
      <StoreProvider>
        <ProductCard p={product} />
      </StoreProvider>
    );

    expect(screen.getByText('Mouse Logitech G502 X Plus')).toBeDefined();
    expect(screen.getByText(cop(product.price))).toBeDefined();

    const favBtn = screen.getByRole('button', { name: /Guardar en favoritos/i });
    fireEvent.click(favBtn);
    expect(screen.getByRole('button', { name: /Quitar de favoritos/i })).toBeDefined();
  });

  it('controla el selector Quantity respetando los límites 1..20', () => {
    let val = 1;
    const setVal = (n: number) => {
      val = n;
    };

    const { rerender } = render(<Quantity value={val} set={setVal} />);
    const decBtn = screen.getByRole('button', { name: /Disminuir cantidad/i });
    const incBtn = screen.getByRole('button', { name: /Aumentar cantidad/i });

    expect(decBtn.hasAttribute('disabled')).toBe(true);
    fireEvent.click(incBtn);
    expect(val).toBe(2);

    rerender(<Quantity value={val} set={setVal} />);
    expect(decBtn.hasAttribute('disabled')).toBe(false);
  });
});
