'use client';

import Link from 'next/link';
import { cop, type Product } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Icon } from '@/components/ui/Icon';

export function ProductCard({ p }: { p: Product }) {
  const { favorites, toggleFavorite, add } = useStore();
  const isFav = favorites.includes(p.id);

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <button
          type="button"
          className={`favorite-btn ${isFav ? 'is-favorite' : ''}`}
          aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          onClick={() => toggleFavorite(p.id)}
        >
          <Icon name="heart" size={19} />
        </button>
        <Link
          href={`/producto/${p.id}`}
          className="product-image-link"
          aria-label={`Ver ${p.name}`}
        >
          <img src={p.image} alt={p.name} loading="lazy" />
        </Link>
      </div>
      <div className="product-info">
        <span className="eyebrow brand-label">{p.brand}</span>
        <Link href={`/producto/${p.id}`} className="product-name">
          {p.name}
        </Link>
        <span className="stock is-available">
          <span /> En stock · Envío nacional
        </span>
        <div className="product-price">
          {cop(p.price)} <small>COP</small>
        </div>
        <button type="button" className="add-button" onClick={() => add(p)}>
          <Icon name="cart" size={17} />
          Agregar al carrito
          <Icon name="plus" size={16} />
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
