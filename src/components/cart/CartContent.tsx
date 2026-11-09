'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cop, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Quantity } from '@/components/ui/Quantity';

export function CartRows({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { cart, changeQty, remove } = useStore();

  return (
    <div className={compact ? 'cart-rows compact' : 'cart-rows'}>
      {cart.map((i) => {
        const p = products.find((prod) => prod.id === i.id);
        if (!p) return null;
        return (
          <div className="cart-row" key={i.id}>
            <Link
              href={`/producto/${p.id}`}
              className="cart-product-image"
              onClick={onNavigate}
            >
              <img src={p.image} alt={p.name} />
            </Link>
            <div className="cart-product-info">
              <span className="eyebrow">{p.brand}</span>
              <Link href={`/producto/${p.id}`} onClick={onNavigate}>
                {p.name}
              </Link>
              <p>
                {cop(p.price)} <small>/ unidad</small>
              </p>
              <Quantity value={i.quantity} set={(n) => changeQty(i.id, n)} />
            </div>
            <div className="cart-line-end">
              <button
                type="button"
                className="icon-button"
                aria-label={`Eliminar ${p.name}`}
                onClick={() => remove(i.id)}
              >
                <Icon name="trash" size={18} />
              </button>
              <strong>{cop(p.price * i.quantity)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyCartState({ onExplore }: { onExplore?: () => void }) {
  const router = useRouter();
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <Icon name="cart" size={63} />
        <span>0</span>
      </div>
      <h2>Tu próximo setup empieza aquí</h2>
      <p>Tu carrito aún está vacío. Descubre la tecnología que va contigo.</p>
      <Button
        onClick={() => {
          onExplore?.();
          router.push('/tienda');
        }}
      >
        Explorar productos
        <Icon name="arrow" size={18} />
      </Button>
    </div>
  );
}

export function OrderSummaryCard({ checkout = false }: { checkout?: boolean }) {
  const router = useRouter();
  const { cart, count, subtotal, shipping } = useStore();

  return (
    <div className="order-summary">
      <span className="eyebrow blue">TODO CLARO, DESDE EL PRINCIPIO</span>
      <h3>Resumen del pedido</h3>
      {checkout &&
        cart.map((i) => {
          const p = products.find((prod) => prod.id === i.id);
          if (!p) return null;
          return (
            <div className="mini-order" key={i.id}>
              <img src={p.image} alt="" />
              <span>
                {p.name}
                <small>Cantidad: {i.quantity}</small>
              </span>
              <strong>{cop(p.price * i.quantity)}</strong>
            </div>
          );
        })}
      <div className="summary-line">
        <span>Subtotal ({count} productos)</span>
        <strong>{cop(subtotal)}</strong>
      </div>
      <div className="summary-line">
        <span>Envío {shipping !== null && <small>(estimado)</small>}</span>
        <strong>
          {shipping === null ? 'Por calcular' : shipping === 0 ? 'Sin costo' : cop(shipping)}
        </strong>
      </div>
      <div className="summary-total">
        <span>Total estimado</span>
        <strong>
          {cop(subtotal + (shipping || 0))}
          <small>COP · Impuestos incluidos</small>
        </strong>
      </div>
      {!checkout && (
        <>
          <Button onClick={() => router.push('/checkout')}>
            Finalizar compra
            <Icon name="arrow" size={18} />
          </Button>
          <button
            type="button"
            className="continue-link"
            onClick={() => router.push('/tienda')}
          >
            Seguir comprando
          </button>
        </>
      )}
      <p className="secure-note">
        <Icon name="lock" size={15} />
        {checkout
          ? 'Pagos vía Llave Bre-B (@bbbsp) sin comisión o pasarela Wompi.'
          : 'Precios verificados en el servidor antes de confirmar el pedido.'}
      </p>
    </div>
  );
}
