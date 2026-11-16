'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { brandLogos, categories, cop, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function ShopPage() {
  const router = useRouter();
  const {
    catalogProducts,
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    maxPrice,
    setMaxPrice,
    selectedBrand,
    setSelectedBrand,
    stockFilter,
    setStockFilter,
    resetFilters,
  } = useStore();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeProducts = catalogProducts.length > 0 ? catalogProducts : products;

  const catalogMaxPrice = useMemo(() => {
    const highest = Math.max(1000000, ...activeProducts.map((p) => p.price));
    return Math.ceil(highest / 10000) * 10000;
  }, [activeProducts]);

  const effectiveMaxPrice = maxPrice >= 1000000 ? catalogMaxPrice : maxPrice;

  const allCategories = useMemo(() => {
    const base = categories.map((c) => c.name);
    for (const p of activeProducts) {
      if (p.category && !base.some((b) => b.toLowerCase() === p.category.toLowerCase())) {
        base.push(p.category);
      }
    }
    return base;
  }, [activeProducts]);

  const allBrands = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brandLogos) {
      const normalized = b.toUpperCase();
      map.set(normalized, normalized === 'LOGITECH G' ? 'Logitech G' : b);
    }
    for (const p of activeProducts) {
      if (p.brand) {
        const normalized = p.brand.toUpperCase();
        if (!map.has(normalized)) {
          map.set(normalized, p.brand);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [activeProducts]);

  const filtered = activeProducts
    .filter(
      (p) =>
        (category === 'Todas' || p.category.toLowerCase() === category.toLowerCase()) &&
        p.price <= effectiveMaxPrice &&
        (selectedBrand === 'Todas' || p.brand.toUpperCase() === selectedBrand.toUpperCase()) &&
        (!stockFilter || (p.stockAvailable ?? 15) > 0) &&
        `${p.name} ${p.category} ${p.brand}`.toLowerCase().includes(query.toLowerCase())
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

  const hasActiveFilter =
    category !== 'Todas' ||
    selectedBrand !== 'Todas' ||
    stockFilter ||
    maxPrice < 1000000 ||
    Boolean(query.trim());

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

      <div className="shop-layout">
        <aside className={`filters ${filtersOpen ? 'filters-open' : ''}`}>
          <div className="filter-heading">
            <h3>Filtros</h3>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                style={{ color: '#168BFF', fontWeight: 700 }}
              >
                Quitar todos
              </button>
            )}
          </div>

          <fieldset>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <strong style={{ fontSize: '12px' }}>Categorías</strong>
              {category !== 'Todas' && (
                <button
                  type="button"
                  onClick={() => setCategory('Todas')}
                  style={{
                    fontSize: '11px',
                    color: '#168BFF',
                    fontWeight: 700,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Quitar filtro ✕
                </button>
              )}
            </div>
            {['Todas', ...allCategories].map((c) => {
              const isSelected = category.toLowerCase() === c.toLowerCase();
              const catCount =
                c === 'Todas'
                  ? activeProducts.length
                  : activeProducts.filter((p) => p.category.toLowerCase() === c.toLowerCase())
                      .length;
              return (
                <label
                  key={c}
                  className="filter-row-label"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    marginBottom: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    {c}{' '}
                    <small style={{ opacity: 0.65, fontWeight: 500 }}>({catCount})</small>
                  </div>
                  <input
                    type="radio"
                    name="category"
                    checked={isSelected}
                    onChange={() => setCategory(c)}
                    style={{ margin: 0, flexShrink: 0 }}
                  />
                </label>
              );
            })}
          </fieldset>

          <fieldset>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <strong style={{ fontSize: '12px' }}>Marcas (A–Z)</strong>
              {selectedBrand !== 'Todas' && (
                <button
                  type="button"
                  onClick={() => setSelectedBrand('Todas')}
                  style={{
                    fontSize: '11px',
                    color: '#168BFF',
                    fontWeight: 700,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Quitar filtro ✕
                </button>
              )}
            </div>
            {['Todas', ...allBrands].map((b) => {
              const isSelected = selectedBrand.toUpperCase() === b.toUpperCase();
              const brandCount =
                b === 'Todas'
                  ? activeProducts.length
                  : activeProducts.filter((p) => p.brand.toUpperCase() === b.toUpperCase()).length;
              return (
                <label
                  key={b}
                  className="filter-row-label"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    marginBottom: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    {b}{' '}
                    <small style={{ opacity: 0.65, fontWeight: 500 }}>({brandCount})</small>
                  </div>
                  <input
                    type="radio"
                    name="brand"
                    checked={isSelected}
                    onChange={() => setSelectedBrand(b)}
                    style={{ margin: 0, flexShrink: 0 }}
                  />
                </label>
              );
            })}
          </fieldset>

          <fieldset>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '12px' }}>Precio</strong>
            </div>
            <input
              aria-label="Precio máximo"
              type="range"
              min="100000"
              max={catalogMaxPrice}
              step="10000"
              value={effectiveMaxPrice}
              onChange={(e) => setMaxPrice(+e.target.value)}
            />
            <div className="price-range">
              <span>$ 100.000</span>
              <strong>{cop(effectiveMaxPrice)}</strong>
            </div>
          </fieldset>

          <fieldset>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '12px' }}>Disponibilidad</strong>
            </div>
            <label
              className="filter-row-label"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                marginBottom: '10px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  fontSize: '11.5px',
                  lineHeight: 1.4,
                }}
              >
                Solo con existencias disponibles
              </div>
              <input
                type="checkbox"
                checked={stockFilter}
                onChange={(e) => setStockFilter(e.target.checked)}
                style={{ margin: 0, flexShrink: 0 }}
              />
            </label>
            <p>Despacho desde Bucaramanga con Domicilio Local y envío nacional asegurado.</p>
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

          {hasActiveFilter && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center',
                marginTop: '14px',
              }}
            >
              {category !== 'Todas' && (
                <button
                  type="button"
                  onClick={() => setCategory('Todas')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'rgba(22, 139, 255, 0.12)',
                    color: '#168BFF',
                    border: '1px solid rgba(22, 139, 255, 0.3)',
                  }}
                >
                  Categoría: {category} ✕
                </button>
              )}
              {selectedBrand !== 'Todas' && (
                <button
                  type="button"
                  onClick={() => setSelectedBrand('Todas')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'rgba(22, 139, 255, 0.12)',
                    color: '#168BFF',
                    border: '1px solid rgba(22, 139, 255, 0.3)',
                  }}
                >
                  Marca: {selectedBrand} ✕
                </button>
              )}
              {stockFilter && (
                <button
                  type="button"
                  onClick={() => setStockFilter(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'rgba(22, 139, 255, 0.12)',
                    color: '#168BFF',
                    border: '1px solid rgba(22, 139, 255, 0.3)',
                  }}
                >
                  En stock ✕
                </button>
              )}
            </div>
          )}

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
              {selectedBrand !== 'Todas' && <span> · Marca {selectedBrand}</span>}
            </p>
            <label>
              Ordenar por:{' '}
              <select
                aria-label="Ordenar productos"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="relevance">Selecciona</option>
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
