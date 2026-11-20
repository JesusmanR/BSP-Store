'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { cop, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { SectionTitle } from '@/components/catalog/SectionTitle';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

type OfferCouponCard = {
  code: string;
  badge: string;
  title: string;
  description: string;
  minOrderText: string;
};

const FALLBACK_COUPONS: OfferCouponCard[] = [
  {
    code: 'BSPWELCOME10',
    badge: '10% DE DESCUENTO',
    title: 'Cupón de bienvenida BSP Store',
    description:
      '10% de descuento en tu primera compra por montos iguales o superiores a $ 200.000 COP.',
    minOrderText: 'Compra mínima: $ 200.000 COP',
  },
  {
    code: 'BSPSETUP50',
    badge: '$ 50.000 COP OFF',
    title: 'Bono para renovar tu setup completo',
    description:
      'Descuento directo de $ 50.000 COP al armar tu combo de periféricos desde $ 600.000 COP.',
    minOrderText: 'Compra mínima: $ 600.000 COP',
  },
];

export default function OffersPage() {
  const router = useRouter();
  const { setToast, catalogProducts } = useStore();
  const [coupons, setCoupons] = useState<OfferCouponCard[]>(FALLBACK_COUPONS);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedBrand, setSelectedBrand] = useState('Todas');
  const [selectedProductSlug, setSelectedProductSlug] = useState('Todos');
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);

  const activeProducts = catalogProducts.length > 0 ? catalogProducts : products;

  const categoryOptions = useMemo(
    () => Array.from(new Set(activeProducts.map((p) => p.category))).sort((a, b) => a.localeCompare(b, 'es')),
    [activeProducts]
  );

  const brandOptions = useMemo(
    () => Array.from(new Set(activeProducts.map((p) => p.brand))).sort((a, b) => a.localeCompare(b, 'es')),
    [activeProducts]
  );

  const productOptions = useMemo(
    () =>
      activeProducts.filter(
        (p) =>
          (selectedCategory === 'Todas' || p.category === selectedCategory) &&
          (selectedBrand === 'Todas' || p.brand === selectedBrand)
      ),
    [activeProducts, selectedCategory, selectedBrand]
  );

  const filteredOffers = useMemo(() => {
    return activeProducts.filter((p) => {
      const hasDiscount = Boolean(p.isOffer || (p.compareAtPrice && p.compareAtPrice > p.price));
      if (onlyDiscounted && !hasDiscount) return false;
      if (selectedCategory !== 'Todas' && p.category !== selectedCategory) return false;
      if (selectedBrand !== 'Todas' && p.brand !== selectedBrand) return false;
      if (selectedProductSlug !== 'Todos' && p.slug !== selectedProductSlug) return false;
      return true;
    });
  }, [activeProducts, onlyDiscounted, selectedCategory, selectedBrand, selectedProductSlug]);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
    void (async () => {
      try {
        const res = await fetch('/api/v1/coupons');
        if (!res.ok) return;
        const payload = await res.json();
        if (payload?.ok && Array.isArray(payload?.data?.coupons) && payload.data.coupons.length > 0) {
          const mapped: OfferCouponCard[] = payload.data.coupons.map(
            (c: {
              code: string;
              description: string | null;
              type: 'PERCENTAGE' | 'FIXED_COP';
              value: number;
              minOrderCop: number;
            }) => ({
              code: c.code,
              badge:
                c.type === 'PERCENTAGE' ? `${c.value}% DE DESCUENTO` : `${cop(c.value)} COP OFF`,
              title: `Cupón promocional ${c.code}`,
              description:
                c.description ??
                `Beneficio exclusivo aplicable en tus compras en BSP Store Colombia.`,
              minOrderText:
                c.minOrderCop > 0
                  ? `Compra mínima: ${cop(c.minOrderCop)} COP`
                  : 'Sin monto mínimo de compra',
            })
          );
          setCoupons(mapped);
        }
      } catch {
        // Keep fallback coupons
      }
    })();
  }, []);

  const handleCopyCoupon = async (code: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setToast(`Código ${code} copiado. Aplícalo en tu carrito de compras.`);
    } catch {
      setToast(`Usa el código ${code} en tu carrito de compras.`);
    }
  };

  return (
    <div className="container page">
      <Breadcrumb current="Ofertas y novedades" />
      <div className="page-heading">
        <span className="eyebrow blue">EL MOMENTO DE TU PRÓXIMO UPGRADE</span>
        <h1>
          Ofertas y novedades<span className="blue">.</span>
        </h1>
        <p>Beneficios exclusivos, cupones activos y periféricos seleccionados para tu setup.</p>
      </div>

      <section style={{ marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {coupons.map((coupon) => (
            <div
              key={coupon.code}
              style={{
                padding: '1.5rem',
                borderRadius: '18px',
                background: 'rgba(13, 25, 43, 0.92)',
                border: '1px solid rgba(25, 130, 230, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.25rem 0.7rem',
                    borderRadius: '999px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    background: 'rgba(25, 130, 230, 0.16)',
                    color: '#5fb4ff',
                    marginBottom: '0.75rem',
                  }}
                >
                  <Icon name="bolt" size={14} />
                  {coupon.badge}
                </div>
                <h3 style={{ margin: '0 0 0.45rem', fontSize: '1.15rem', color: '#ffffff' }}>
                  {coupon.title}
                </h3>
                <p style={{ margin: '0 0 0.6rem', color: '#9fb2cc', fontSize: '0.92rem' }}>
                  {coupon.description}
                </p>
                <small style={{ color: '#7f95b5' }}>{coupon.minOrderText}</small>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  flexWrap: 'wrap',
                }}
              >
                <code
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px dashed rgba(95, 180, 255, 0.45)',
                    color: '#fff',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  {coupon.code}
                </code>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button secondary onClick={() => void handleCopyCoupon(coupon.code)}>
                    Copiar código
                  </Button>
                  <Button onClick={() => router.push('/carrito')}>Ir al carrito</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="FILTRA POR CATEGORÍA, MARCA O PRODUCTO"
          title="Ofertas y selección destacada"
        />

        <div className="offers-filter-bar">
          <label className="field">
            Categoría
            <select
              aria-label="Filtrar ofertas por categoría"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedProductSlug('Todos');
              }}
            >
              <option value="Todas">Todas las categorías</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Marca
            <select
              aria-label="Filtrar ofertas por marca"
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setSelectedProductSlug('Todos');
              }}
            >
              <option value="Todas">Todas las marcas</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Producto
            <select
              aria-label="Filtrar ofertas por producto"
              value={selectedProductSlug}
              onChange={(e) => setSelectedProductSlug(e.target.value)}
            >
              <option value="Todos">Todos los productos ({productOptions.length})</option>
              {productOptions.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="offers-filter-actions">
            <label className="offers-discount-toggle">
              <input
                type="checkbox"
                checked={onlyDiscounted}
                onChange={(e) => setOnlyDiscounted(e.target.checked)}
              />
              <span>Solo con descuento activo</span>
            </label>

            {(selectedCategory !== 'Todas' ||
              selectedBrand !== 'Todas' ||
              selectedProductSlug !== 'Todos' ||
              onlyDiscounted) && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: '38px', padding: '8px 14px', fontSize: '11px' }}
                onClick={() => {
                  setSelectedCategory('Todas');
                  setSelectedBrand('Todas');
                  setSelectedProductSlug('Todos');
                  setOnlyDiscounted(false);
                }}
              >
                Quitar filtros
              </button>
            )}
          </div>
        </div>

        {filteredOffers.length > 0 ? (
          <ProductGrid list={filteredOffers} />
        ) : (
          <div className="empty-state">
            <Icon name="search" size={44} />
            <h2>No hay ofertas con esa combinación</h2>
            <p>Prueba seleccionando Todas las categorías, marcas o productos.</p>
            <Button
              onClick={() => {
                setSelectedCategory('Todas');
                setSelectedBrand('Todas');
                setSelectedProductSlug('Todos');
                setOnlyDiscounted(false);
              }}
            >
              Ver todas las ofertas
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
