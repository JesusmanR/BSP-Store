'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { categories, cop, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function ShopPage() {
  const router = useRouter();
  const {
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    maxPrice,
    setMaxPrice,
    brand,
    setBrand,
    stockFilter,
    setStockFilter,
    resetFilters,
  } = useStore();

  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = products
    .filter(
      (p) =>
        (category === 'Todas' || p.category === category) &&
        p.price <= maxPrice &&
        (!brand || p.brand === 'LOGITECH G') &&
        !stockFilter &&
        `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) =>
      sort === 'asc'
        ? a.price - b.price
        : sort === 'desc'
          ? b.price - a.price
          : sort === 'new'
            ? b.id - a.id
            : a.id - b.id
    );

  return (
    <div className="container page shop-page">
      <Breadcrumb current="Tienda" />
      <div className="page-heading">
        <span className="eyebrow blue">ENCUENTRA TU PRÓXIMO UPGRADE</span>
        <h1>
          Explora nuestra tienda<span className="blue">.</span>
        </h1>
        <p>Tecnología que se adapta a ti, a tu juego y a tus ideas.</p>
      </div>

      <div className="demo-note">
        <Icon name="shield" size={17} />
        Catálogo migrado a Next.js App Router. Los filtros se sincronizarán con PostgreSQL 17 en la
        Fase 4.
      </div>

      <div className="shop-layout">
        <aside className={`filters ${filtersOpen ? 'filters-open' : ''}`}>
          <div className="filter-heading">
            <h3>Filtros</h3>
            <button type="button" onClick={resetFilters}>
              Limpiar
            </button>
          </div>

          <fieldset>
            <legend>Categorías</legend>
            {['Todas', ...categories.map((c) => c.name)].map((c) => (
              <label key={c}>
                <input
                  type="radio"
                  name="category"
                  checked={category === c}
                  onChange={() => setCategory(c)}
                />
                {c}
                <span>
                  {c === 'Todas'
                    ? products.length
                    : products.filter((p) => p.category === c).length}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Marca</legend>
            <label>
              <input
                type="checkbox"
                checked={brand}
                onChange={(e) => setBrand(e.target.checked)}
              />
              Logitech G<span>{products.length}</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Precio</legend>
            <input
              aria-label="Precio máximo"
              type="range"
              min="100000"
              max="1000000"
              step="10000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(+e.target.value)}
            />
            <div className="price-range">
              <span>$ 100.000</span>
              <strong>{cop(maxPrice)}</strong>
            </div>
          </fieldset>

          <fieldset>
            <legend>Disponibilidad</legend>
            <label>
              <input
                type="checkbox"
                checked={stockFilter}
                onChange={(e) => setStockFilter(e.target.checked)}
              />
              Solo existencias verificadas
            </label>
            <p>El inventario en tiempo real se conectará en la Fase 4.</p>
          </fieldset>

          <div className="filter-help">
            <Icon name="headphones" size={28} />
            <strong>¿No sabes cuál elegir?</strong>
            <p>Te ayudamos a encontrar lo ideal.</p>
            <button
              type="button"
              className="text-link"
              onClick={() => router.push('/contacto')}
            >
              Recibir asesoría
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </aside>

        <div className="shop-results">
          <form className="catalog-search" onSubmit={(e) => e.preventDefault()}>
            <Icon name="search" size={20} />
            <input
              aria-label="Buscar en el catálogo"
              placeholder="Busca tu próximo producto..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery('')}
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </form>

          <div className="result-toolbar">
            <button
              type="button"
              className="mobile-filter btn btn-secondary"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Icon name="grid" size={16} />
              Filtros
            </button>
            <p>
              <strong>{filtered.length}</strong> productos
              {category !== 'Todas' && <span> en {category}</span>}
            </p>
            <label>
              Ordenar por:{' '}
              <select
                aria-label="Ordenar productos"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="relevance">Selección editorial</option>
                <option value="asc">Menor precio</option>
                <option value="desc">Mayor precio</option>
                <option value="new">Últimos agregados</option>
              </select>
            </label>
          </div>

          {filtered.length ? (
            <ProductGrid list={filtered} />
          ) : (
            <div className="empty-state">
              <Icon name="search" size={45} />
              <h2>Vamos a buscar algo diferente</h2>
              <p>No hay productos que coincidan con estos filtros.</p>
              <Button onClick={resetFilters}>Ver todos los productos</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
