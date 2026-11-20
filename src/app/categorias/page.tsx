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
  imageUrl?: string | null;
};

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  'mouse gamer': '/images/g502x-plus-gallery-1-black.png',
  teclados: '/images/g915-tkl-gallery-1-carbon.png',
  'audífonos y audio': '/images/g733-black-gallery-1.png',
  componentes: '/images/pro-x-superlight-black-gallery-1.png',
  accesorios: '/images/us-pro-gaming-keyboard-gallery-topdown.png',
  monitores: '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png',
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
      const key = c.name.toLowerCase();
      const catProducts = activeProducts.filter((p) => p.category.toLowerCase() === key);
      const minPrice =
        catProducts.length > 0 ? Math.min(...catProducts.map((p) => p.price)) : null;
      map.set(key, {
        name: c.name,
        subtitle: c.subtitle,
        image:
          c.image ||
          catProducts[0]?.image ||
          CATEGORY_FALLBACK_IMAGES[key] ||
          '/images/g502x-plus-gallery-1-black.png',
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
        subtitle: apiCat.description || existing?.subtitle || 'Equipamiento especializado para tu setup',
        image:
          apiCat.imageUrl ||
          existing?.image ||
          catProducts[0]?.image ||
          CATEGORY_FALLBACK_IMAGES[key] ||
          '/images/g502x-plus-gallery-1-black.png',
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
          Selecciona la línea de productos que buscas para explorar sus referencias o filtrar
          directamente en la tienda.
        </p>
      </div>

      {/* Cuadrícula de Categorías con el mismo diseño limpio de Tarjetas de Producto */}
      <div className="product-grid" style={{ marginBottom: '52px' }}>
        {mergedCategories.map((c) => {
          const isSelected = selectedCat.toLowerCase() === c.name.toLowerCase();
          return (
            <article
              key={c.name}
              className="product-card"
              style={{
                border: isSelected ? '2px solid #168BFF' : undefined,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedCat(c.name)}
            >
              <div className="product-image-wrap">
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
                    background: 'rgba(22, 139, 255, 0.14)',
                    color: '#168BFF',
                    border: '1px solid rgba(22, 139, 255, 0.3)',
                  }}
                >
                  {c.count} {c.count === 1 ? 'referencia' : 'referencias'}
                </span>
                <div className="product-image-link">
                  <img src={c.image} alt={c.name} loading="lazy" />
                </div>
              </div>

              <div className="product-info">
                <span className="eyebrow brand-label">CATEGORÍA BSP STORE</span>
                <div className="product-name" style={{ minHeight: 'auto', fontSize: '15px' }}>
                  {c.name}
                </div>
                <span className="stock is-available">
                  <span /> {c.subtitle}
                </span>
                <div className="product-price" style={{ fontSize: '15px', marginTop: '12px' }}>
                  {c.minPrice ? (
                    <>
                      Desde {cop(c.minPrice)} <small>COP</small>
                    </>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#7b8594', fontWeight: 500 }}>
                      Catálogo en actualización
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="add-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCategoryInShop(c.name);
                  }}
                >
                  <Icon name={c.icon} size={16} />
                  Ver en tienda
                  <Icon name="arrow" size={15} />
                </button>
              </div>
            </article>
          );
        })}
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
            <span className="eyebrow blue">PRODUCTOS DESTACADOS POR LÍNEA</span>
            <h2 style={{ fontSize: '26px', marginTop: '4px' }}>
              {selectedCat === 'Todas' ? 'Todos los productos' : `Productos en ${selectedCat}`}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {selectedCat !== 'Todas' && (
              <Button secondary onClick={() => setSelectedCat('Todas')}>
                Quitar filtro de categoría
              </Button>
            )}
            <Button
              onClick={() =>
                handleOpenCategoryInShop(selectedCat === 'Todas' ? 'Todas' : selectedCat)
              }
            >
              Abrir en tienda
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
