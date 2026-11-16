'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { brandLogos, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Icon } from '@/components/ui/Icon';

const BRAND_DESCRIPTIONS: Record<string, string> = {
  ASUS: 'Hardware y periféricos de alto rendimiento para gaming y estaciones de trabajo.',
  CORSAIR: 'Teclados mecánicos, refrigeración, memorias y periféricos para entusiastas.',
  HYPERX: 'Audífonos, micrófonos y periféricos diseñados para máxima comodidad competitiva.',
  'LOGITECH G':
    'Líder en innovación inalámbrica LIGHTSPEED, sensores HERO 25K y periféricos de esports.',
  RAZER: 'Ecosistema de periféricos gaming de alta precisión con iluminación Chroma RGB.',
  REDRAGON: 'Periféricos mecánicos y accesorios gamer con excelente relación costo-beneficio.',
};

export default function BrandsPage() {
  const router = useRouter();
  const { catalogProducts, setCategory, setSelectedBrand, setQuery, setStockFilter } = useStore();
  const [selectedLetter, setSelectedLetter] = useState<string>('Todas');
  const [brandSearch, setBrandSearch] = useState('');

  const activeProducts = catalogProducts.length > 0 ? catalogProducts : products;

  const alphabeticalBrands = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        description: string;
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
          count: brandProds.length,
          categories: cats,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [activeProducts]);

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
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid var(--line, #e2e8f0)',
          background: 'var(--surface, #ffffff)',
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

      {/* Listado Alfabético de Marcas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        {visibleBrands.map((b) => (
          <div
            key={b.name}
            onClick={() => handleSelectBrand(b.name)}
            style={{
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid var(--line, #e2e8f0)',
              background: 'var(--surface, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {b.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'rgba(22, 139, 255, 0.12)',
                    color: '#168BFF',
                  }}
                >
                  {b.count} {b.count === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <p style={{ fontSize: '13px', opacity: 0.8, lineHeight: 1.6 }}>{b.description}</p>
              {b.categories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                  {b.categories.map((cat) => (
                    <span
                      key={cat}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--line, #e2e8f0)',
                        opacity: 0.85,
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', minHeight: '40px', fontSize: '13px' }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectBrand(b.name);
              }}
            >
              Ver catálogo de {b.name}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
