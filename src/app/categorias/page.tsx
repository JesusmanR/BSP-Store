'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { categories as staticCategories, cop, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  productCount?: number;
};

export default function CategoriesPage() {
  const router = useRouter();
  const { catalogProducts, setCategory, setSelectedBrand, setQuery, setStockFilter } = useStore();
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('Todas');

  const activeProducts = catalogProducts.length > 0 ? catalogProducts : products;

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/v1/categories');
        if (!res.ok) return;
        const payload = await res.json();
        if (active && payload?.ok && Array.isArray(payload?.data?.categories)) {
          setApiCategories(payload.data.categories as ApiCategory[]);
        }
      } catch {
        // Fallback to static categories
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const mergedCategories = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        subtitle: string;
        image: string;
        icon: string;
        count: number;
        minPrice: number | null;
      }
    >();

    for (const c of staticCategories) {
      const catProducts = activeProducts.filter(
        (p) => p.category.toLowerCase() === c.name.toLowerCase()
      );
      const minPrice =
        catProducts.length > 0 ? Math.min(...catProducts.map((p) => p.price)) : null;
      map.set(c.name.toLowerCase(), {
        name: c.name,
        subtitle: c.subtitle,
        image: c.image || catProducts[0]?.image || '',
        icon: c.icon || 'grid',
        count: catProducts.length,
        minPrice,
      });
    }

    for (const apiCat of apiCategories) {
      const key = apiCat.name.toLowerCase();
      const catProducts = activeProducts.filter((p) => p.category.toLowerCase() === key);
      const minPrice =
        catProducts.length > 0 ? Math.min(...catProducts.map((p) => p.price)) : null;
      const existing = map.get(key);
      map.set(key, {
        name: apiCat.name,
        subtitle: apiCat.description || existing?.subtitle || 'Explora esta línea de productos',
        image: existing?.image || catProducts[0]?.image || '',
        icon: apiCat.icon || existing?.icon || 'grid',
        count: catProducts.length,
        minPrice,
      });
    }

    return Array.from(map.values());
  }, [activeProducts, apiCategories]);

  const handleOpenCategoryInShop = (catName: string) => {
    setCategory(catName);
    setSelectedBrand('Todas');
    setQuery('');
    setStockFilter(false);
    router.push('/tienda');
  };

  const previewProducts = useMemo(() => {
    if (selectedCat === 'Todas') return activeProducts;
    return activeProducts.filter((p) => p.category.toLowerCase() === selectedCat.toLowerCase());
  }, [activeProducts, selectedCat]);

  return (
    <div className="container page">
      <Breadcrumb current="Categorías" />
      <div className="page-heading">
        <span className="eyebrow blue">CATÁLOGO ESPECIALIZADO</span>
        <h1>
          Explora por categoría<span className="blue">.</span>
        </h1>
        <p>
          Selecciona el tipo de periférico o componente que buscas para filtrar el catálogo o ver
          las opciones disponibles.
        </p>
      </div>

      <div className="categories-grid" style={{ marginBottom: '48px' }}>
        {mergedCategories.map((c) => (
          <div
            key={c.name}
            className={`category-card ${c.image ? 'with-image' : ''} ${
              selectedCat.toLowerCase() === c.name.toLowerCase() ? 'selected-cat-card' : ''
            }`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border:
                selectedCat.toLowerCase() === c.name.toLowerCase()
                  ? '2px solid #168BFF'
                  : undefined,
            }}
            onClick={() => setSelectedCat(c.name)}
          >
            <div>
              <span className="cat-icon">
                <Icon name={c.icon} size={22} />
              </span>
              {c.image && <img src={c.image} alt={c.name} loading="lazy" />}
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{c.name}</h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(22, 139, 255, 0.12)',
                    color: '#168BFF',
                  }}
                >
                  {c.count} {c.count === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <p>{c.subtitle}</p>
              {c.minPrice && (
                <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px', color: '#168BFF' }}>
                  Desde {cop(c.minPrice)} COP
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCategoryInShop(c.name);
                  }}
                >
                  Filtrar en tienda
                  <Icon name="arrow" size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="section" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div>
            <span className="eyebrow blue">VISTA RÁPIDA DE PRODUCTOS</span>
            <h2 style={{ fontSize: '26px', marginTop: '4px' }}>
              {selectedCat === 'Todas' ? 'Todas las categorías' : `Categoría: ${selectedCat}`}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {selectedCat !== 'Todas' && (
              <Button secondary onClick={() => setSelectedCat('Todas')}>
                Ver todas las categorías
              </Button>
            )}
            <Button
              onClick={() =>
                handleOpenCategoryInShop(selectedCat === 'Todas' ? 'Todas' : selectedCat)
              }
            >
              Ir al buscador avanzado de tienda
              <Icon name="arrow" size={16} />
            </Button>
          </div>
        </div>

        {previewProducts.length > 0 ? (
          <ProductGrid list={previewProducts} />
        ) : (
          <div className="empty-state">
            <Icon name="grid" size={44} />
            <h2>Próximamente nuevos productos en {selectedCat}</h2>
            <p>Estamos preparando nuevas referencias para esta categoría.</p>
            <Button onClick={() => setSelectedCat('Todas')}>Ver productos disponibles</Button>
          </div>
        )}
      </section>
    </div>
  );
}
