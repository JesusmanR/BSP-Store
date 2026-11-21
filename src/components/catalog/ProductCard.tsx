'use client';

import Link from 'next/link';
import { cop, type Product } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Icon } from '@/components/ui/Icon';

export function ProductCard({ p }: { p: Product }) {
  const { favorites, toggleFavorite, add } = useStore();
  const isFav = favorites.includes(p.id);
  const stockCount = p.stockAvailable ?? 15;
  const isOutOfStock = stockCount <= 0;
  const isLowStock = stockCount > 0 && stockCount <= 3;
  const hasDiscount = Boolean(p.compareAtPrice && p.compareAtPrice > p.price);
  const discountPct =
    hasDiscount && p.compareAtPrice
      ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100)
      : 0;

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {(p.tag || hasDiscount) && (
          <span
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 2,
              padding: '0.22rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.03em',
              background: hasDiscount ? 'rgba(16, 185, 129, 0.18)' : 'rgba(22, 139, 255, 0.18)',
              color: hasDiscount ? '#6ee7b7' : '#60a5fa',
              border: hasDiscount
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(22, 139, 255, 0.35)',
            }}
          >
            {hasDiscount ? `-${discountPct}%` : p.tag}
          </span>
        )}
        <button
          type="button"
          className={`favorite-btn ${isFav ? 'is-favorite' : ''}`}
          aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          onClick={() => toggleFavorite(p.id)}
        >
          <Icon name="heart" size={19} />
        </button>
        <Link
          href={`/producto?id=${encodeURIComponent(p.slug || String(p.id))}`}
          className="product-image-link"
          aria-label={`Ver ${p.name}`}
        >
          <img src={p.image} alt={p.name} loading="lazy" />
        </Link>
      </div>
      <div className="product-info">
        <span className="eyebrow brand-label">{p.brand}</span>
        <Link href={`/producto?id=${encodeURIComponent(p.slug || String(p.id))}`} className="product-name">
          {p.name}
        </Link>
        <span className={`stock ${isOutOfStock ? '' : 'is-available'}`}>
          <span />{' '}
          {isOutOfStock
            ? 'Agotado temporalmente'
            : isLowStock
              ? `¡Últimas ${stockCount} unidades! · Envío nacional`
              : 'En stock · Envío nacional'}
        </span>
        <div className="product-price" style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span>
            {cop(p.price)} <small>COP</small>
          </span>
          {hasDiscount && p.compareAtPrice && (
            <del style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
              {cop(p.compareAtPrice)}
            </del>
          )}
        </div>
        <button
          type="button"
          className="add-button"
          disabled={isOutOfStock}
          onClick={() => add(p)}
        >
          <Icon name="cart" size={17} />
          {isOutOfStock ? 'Sin existencias' : 'Agregar al carrito'}
          {!isOutOfStock && <Icon name="plus" size={16} />}
        </button>
      </div>
    </article>
  );
}

export function ProductGrid({ list }: { list: Product[] }) {
  return (
    <div className="product-grid">
      {list.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  );
}
