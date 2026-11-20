'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { brandLogos, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Icon } from '@/components/ui/Icon';

type ApiBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  productCount?: number;
};

const BRAND_DESCRIPTIONS: Record<string, string> = {
  ASUS: 'Hardware y periféricos de alto rendimiento para gaming y estaciones de trabajo.',
  CORSAIR: 'Teclados mecánicos, refrigeración, memorias y periféricos para entusiastas.',
  HYPERX: 'Audífonos, micrófonos y periféricos diseñados para máxima comodidad competitiva.',
  'LOGITECH G':
    'Líder en innovación inalámbrica LIGHTSPEED, sensores HERO 25K y periféricos de esports.',
  RAZER: 'Ecosistema de periféricos gaming de alta precisión con iluminación Chroma RGB.',
  REDRAGON: 'Periféricos mecánicos y accesorios gamer con excelente relación costo-beneficio.',
};

const OFFICIAL_BRAND_LOGOS: Record<string, string> = {
  'LOGITECH G': '/images/brands/logitech-g.svg',
  RAZER: '/images/brands/razer.svg',
  HYPERX: '/images/brands/hyperx.svg',
  CORSAIR: '/images/brands/corsair.svg',
  ASUS: '/images/brands/asus.svg',
  REDRAGON: '/images/brands/redragon.svg',
};

export default function BrandsPage() {
  const router = useRouter();
  const { catalogProducts, setCategory, setSelectedBrand, setQuery, setStockFilter } = useStore();
  const [selectedLetter, setSelectedLetter] = useState<string>('Todas');
  const [brandSearch, setBrandSearch] = useState('');
  const [apiBrands, setApiBrands] = useState<ApiBrand[]>([]);

  const activeProducts = catalogProducts.length > 0 ? catalogProducts : products;

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/v1/categories');
        if (!res.ok) return;
        const payload = await res.json();
        if (active && payload?.ok && Array.isArray(payload?.data?.brands)) {
          setApiBrands(payload.data.brands as ApiBrand[]);
        }
      } catch {
        // Fallback to static brands
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const alphabeticalBrands = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        description: string;
        logoUrl: string | null;
        count: number;
        categories: string[];
      }
    >();

    for (const b of brandLogos) {
      const upper = b.toUpperCase();
      const displayName = upper === 'LOGITECH G' ? 'Logitech G' : b;
      const brandProds = activeProducts.filter((p) => p.brand.toUpperCase() === upper);
      const cats = Array.from(new Set(brandProds.map((p) => p.category)));
      map.set(upper, {
        name: displayName,
        description:
          BRAND_DESCRIPTIONS[upper] ?? 'Marca oficial disponible en el catálogo de BSP Store.',
        logoUrl: OFFICIAL_BRAND_LOGOS[upper] ?? null,
        count: brandProds.length,
        categories: cats,
      });
    }

    for (const apiBrand of apiBrands) {
      const upper = apiBrand.name.toUpperCase();
      const brandProds = activeProducts.filter((p) => p.brand.toUpperCase() === upper);
      const cats = Array.from(new Set(brandProds.map((p) => p.category)));
      const existing = map.get(upper);
      map.set(upper, {
        name: apiBrand.name,
        description:
          apiBrand.description ||
          existing?.description ||
          BRAND_DESCRIPTIONS[upper] ||
          'Marca oficial disponible en el catálogo de BSP Store.',
        logoUrl: apiBrand.logoUrl || existing?.logoUrl || OFFICIAL_BRAND_LOGOS[upper] || null,
        count: brandProds.length,
        categories: cats,
      });
    }

    for (const p of activeProducts) {
      if (!p.brand) continue;
      const upper = p.brand.toUpperCase();
      if (!map.has(upper)) {
        const brandProds = activeProducts.filter((item) => item.brand.toUpperCase() === upper);
        const cats = Array.from(new Set(brandProds.map((item) => item.category)));
        map.set(upper, {
          name: p.brand,
          description:
            BRAND_DESCRIPTIONS[upper] ?? 'Marca oficial disponible en el catálogo de BSP Store.',
          logoUrl: OFFICIAL_BRAND_LOGOS[upper] ?? null,
          count: brandProds.length,
          categories: cats,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [activeProducts, apiBrands]);

  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    for (const b of alphabeticalBrands) {
      const first = b.name.charAt(0).toUpperCase();
      if (first) letters.add(first);
    }
    return Array.from(letters).sort((a, b) => a.localeCompare(b, 'es'));
  }, [alphabeticalBrands]);

  const visibleBrands = useMemo(() => {
    return alphabeticalBrands.filter((b) => {
      const matchesLetter =
        selectedLetter === 'Todas' || b.name.charAt(0).toUpperCase() === selectedLetter;
      const matchesQuery =
        !brandSearch.trim() ||
        b.name.toLowerCase().includes(brandSearch.trim().toLowerCase()) ||
        b.description.toLowerCase().includes(brandSearch.trim().toLowerCase());
      return matchesLetter && matchesQuery;
    });
  }, [alphabeticalBrands, brandSearch, selectedLetter]);

  const handleSelectBrand = (brandName: string) => {
    setCategory('Todas');
    setSelectedBrand(brandName);
    setQuery('');
    setStockFilter(false);
    router.push('/tienda');
  };

  return (
    <div className="container page">
      <Breadcrumb current="Marcas" />
      <div className="page-heading">
        <span className="eyebrow blue">DIRECTORIO OFICIAL DE MARCAS (A–Z)</span>
        <h1>
          Nuestras marcas<span className="blue">.</span>
        </h1>
        <p>
          Explora el listado alfabético de marcas disponibles en BSP Store y haz clic en cualquiera
          para filtrar sus productos en la tienda.
        </p>
      </div>

      {/* Buscador y filtro alfabético A-Z */}
      <div
        className="account-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
          padding: '16px 20px',
          borderRadius: '10px',
          border: '1px solid var(--line, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setSelectedLetter('Todas')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              background: selectedLetter === 'Todas' ? '#168BFF' : 'transparent',
              color: selectedLetter === 'Todas' ? '#ffffff' : 'inherit',
              border: '1px solid var(--line, #cbd5e1)',
              cursor: 'pointer',
            }}
          >
            Todas ({alphabeticalBrands.length})
          </button>
          {availableLetters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setSelectedLetter(letter)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                background: selectedLetter === letter ? '#168BFF' : 'transparent',
                color: selectedLetter === letter ? '#ffffff' : 'inherit',
                border: '1px solid var(--line, #cbd5e1)',
                cursor: 'pointer',
              }}
            >
              {letter}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--line, #cbd5e1)',
            minWidth: '240px',
          }}
        >
          <Icon name="search" size={18} />
          <input
            aria-label="Buscar marca"
            placeholder="Buscar marca..."
            value={brandSearch}
            onChange={(e) => setBrandSearch(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
              color: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Listado Alfabético de Marcas con Logos Originales */}
      <div className="product-grid">
        {visibleBrands.map((b) => (
          <article
            key={b.name}
            className="product-card"
            onClick={() => handleSelectBrand(b.name)}
            style={{ cursor: 'pointer' }}
          >
            <div
              className="product-image-wrap"
              style={{
                height: '155px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 2,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(22, 139, 255, 0.14)',
                  color: '#168BFF',
                  border: '1px solid rgba(22, 139, 255, 0.3)',
                }}
              >
                {b.count} {b.count === 1 ? 'producto' : 'productos'}
              </span>

              {b.logoUrl ? (
                <img
                  src={b.logoUrl}
                  alt={`Logo oficial ${b.name}`}
                  style={{
                    maxWidth: '82%',
                    maxHeight: '76px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <span
                  className="brand-logo"
                  style={{ color: '#0f172a', fontSize: '26px', background: 'transparent' }}
                >
                  {b.name}
                </span>
              )}
            </div>

            <div className="product-info">
              <span className="eyebrow brand-label">MARCA OFICIAL</span>
              <div className="product-name" style={{ minHeight: 'auto', fontSize: '15px' }}>
                {b.name}
              </div>
              <p
                style={{
                  fontSize: '11.5px',
                  color: '#7b8594',
                  lineHeight: 1.6,
                  marginTop: '8px',
                  minHeight: '54px',
                }}
              >
                {b.description}
              </p>

              <button
                type="button"
                className="add-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectBrand(b.name);
                }}
              >
                <Icon name="grid" size={16} />
                Ver productos de {b.name}
                <Icon name="arrow" size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
