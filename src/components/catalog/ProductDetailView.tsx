'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { cop, findProductByIdOrSlug, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { buildBreadcrumbJsonLd, buildProductJsonLd, safeJsonLd } from '@/lib/seo';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { SectionTitle } from '@/components/catalog/SectionTitle';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Quantity } from '@/components/ui/Quantity';

type ProductReviewItem = {
  id: string;
  productSlug: string;
  userId: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

export default function ProductDetailPage() {
  const params = useParams<{ idOrSlug?: string }>();
  const router = useRouter();
  const { add, favorites, toggleFavorite, catalogProducts, user, setToast } = useStore();

  const [clientIdParam, setClientIdParam] = useState<string>(params?.idOrSlug ?? '');

  useEffect(() => {
    if (params?.idOrSlug) {
      setClientIdParam(params.idOrSlug);
      return;
    }
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const fromQuery = searchParams.get('id') || searchParams.get('slug');
      if (fromQuery) {
        setClientIdParam(fromQuery);
        return;
      }
      const pathMatch = /^\/producto\/([^/]+)\/?$/.exec(window.location.pathname);
      if (pathMatch?.[1]) {
        setClientIdParam(decodeURIComponent(pathMatch[1]));
      }
    }
  }, [params?.idOrSlug]);

  const rawParam = params?.idOrSlug || clientIdParam || '1';
  const activeCatalog = catalogProducts.length > 0 ? catalogProducts : products;
  const currentProduct =
    activeCatalog.find(
      (p) => String(p.id) === rawParam || p.slug.toLowerCase() === rawParam.toLowerCase()
    ) ??
    findProductByIdOrSlug(rawParam) ??
    activeCatalog[0]!;

  const [detailQty, setDetailQty] = useState(1);
  const [tab, setTab] = useState('Descripción');
  const [gallery, setGallery] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(currentProduct.variants[0]?.id ?? '');

  // Reviews state
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadReviews = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/v1/products/${encodeURIComponent(slug)}/reviews`);
      if (!res.ok) return;
      const payload = await res.json();
      if (payload?.ok && payload?.data) {
        setReviews(payload.data.reviews ?? []);
        setAverageRating(payload.data.averageRating ?? 0);
      }
    } catch {
      // Ignore network errors in test/static render
    }
  }, []);

  useEffect(() => {
    setDetailQty(1);
    setGallery(0);
    setTab('Descripción');
    setSelectedVariant(currentProduct.variants[0]?.id ?? '');
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      void loadReviews(currentProduct.slug);
    }
  }, [currentProduct.id, currentProduct.slug, currentProduct.variants, loadReviews]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setToast('Inicia sesión en tu cuenta para publicar tu opinión.');
      router.push('/cuenta');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(
        `/api/v1/products/${encodeURIComponent(currentProduct.slug)}/reviews`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            rating: reviewRating,
            title: reviewTitle.trim(),
            comment: reviewComment.trim(),
          }),
        }
      );
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        setToast(payload?.error?.message ?? 'No se pudo publicar tu opinión.');
        return;
      }
      setReviews(payload.data.reviews ?? []);
      setAverageRating(payload.data.averageRating ?? 0);
      setReviewTitle('');
      setReviewComment('');
      setToast('¡Gracias! Tu opinión sobre el producto ha sido publicada.');
    } catch {
      setToast('Error de conexión al enviar tu opinión.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const activeVariant =
    currentProduct.variants.find((v) => v.id === selectedVariant) ?? currentProduct.variants[0];

  const productJsonLd = buildProductJsonLd(currentProduct);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Inicio', path: '/' },
    { name: 'Tienda', path: '/tienda' },
    { name: currentProduct.name, path: `/producto/${currentProduct.slug}` },
  ]);

  return (
    <div className="container page product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <Breadcrumb current={currentProduct.name} />

      <div className="product-detail">
        <div className="gallery">
          <button
            type="button"
            className="gallery-main"
            onClick={() => setZoom(true)}
            aria-label="Ampliar imagen"
          >
            <img
              style={{
                transform:
                  gallery === 1
                    ? 'rotate(-15deg) scale(.88)'
                    : gallery === 2
                      ? 'scale(1.2)'
                      : undefined,
              }}
              src={currentProduct.image}
              alt={currentProduct.name}
            />
            <span>
              <Icon name="search" size={18} />
              Ampliar imagen
            </span>
          </button>

          <div className="thumbnails">
            {['Vista principal', 'Vista girada', 'Detalle ampliado'].map((s, i) => (
              <button
                type="button"
                className={gallery === i ? 'selected' : ''}
                onClick={() => setGallery(i)}
                key={s}
                aria-label={s}
              >
                <img
                  style={{
                    transform:
                      i === 1 ? 'rotate(-15deg)' : i === 2 ? 'scale(1.35)' : undefined,
                  }}
                  src={currentProduct.image}
                  alt={s}
                />
              </button>
            ))}
            <small>Vistas de referencia de una misma imagen.</small>
          </div>
        </div>

        <div className="product-detail-info">
          <span className="eyebrow blue">{currentProduct.brand}</span>
          <h1>{currentProduct.name}</h1>
          <p className="reference">
            Referencia / SKU: {currentProduct.sku}
            {activeVariant ? `-${activeVariant.skuSuffix}` : ''}
          </p>
          <span className="stock">
            <span />
            Disponible para despacho ({currentProduct.stockAvailable ?? 15} unidades)
          </span>
          <div className="detail-price">
            {cop(currentProduct.price)}
            <span>COP</span>
          </div>
          <p className="price-disclaimer">
            Pagos sin costo por Llave Bre-B (@bbbsp) o vía Wompi (PSE / Tarjetas)
          </p>
          <p className="detail-description">{currentProduct.description}</p>

          {currentProduct.variants.length > 0 && (
            <div className="variant-selector">
              <span className="variant-selector-label">Opción / Variante</span>
              <div className="variant-pills">
                {currentProduct.variants.map((v, idx) => (
                  <button
                    type="button"
                    key={v.id}
                    className={`variant-pill ${selectedVariant === v.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVariant(v.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px',
                    }}
                  >
                    <span
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        background: '#f4f7fb',
                        border: '1px solid #cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '3px',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={currentProduct.image}
                        alt={v.label}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          filter: idx === 1 ? 'brightness(1.12) contrast(0.95)' : undefined,
                        }}
                      />
                    </span>
                    <span style={{ textAlign: 'left', lineHeight: 1.25 }}>
                      <strong style={{ display: 'block', fontSize: '12px' }}>{v.label}</strong>
                      <small style={{ fontSize: '10px', opacity: 0.7 }}>
                        Ref: {currentProduct.sku}-{v.skuSuffix}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="detail-buy">
            <Quantity value={detailQty} set={setDetailQty} />
            <Button onClick={() => add(currentProduct, detailQty, true, selectedVariant)}>
              <Icon name="cart" size={19} />
              Agregar al carrito
            </Button>
          </div>

          <Button
            secondary
            className="buy-now"
            onClick={() => {
              add(currentProduct, detailQty, false, selectedVariant);
              router.push('/checkout');
            }}
          >
            Comprar ahora
            <Icon name="arrow" size={19} />
          </Button>

          <button
            type="button"
            className="detail-favorite text-link"
            onClick={() => toggleFavorite(currentProduct.id)}
          >
            <Icon name="heart" size={18} />
            {favorites.includes(currentProduct.id)
              ? 'Guardado en tus favoritos'
              : 'Guardar para después'}
          </button>

          <div className="product-assurances">
            <div>
              <Icon name="truck" />
              <span>
                <strong>Domicilio Local y Envíos Nacionales</strong>Domicilio en Bucaramanga y área
                metropolitana o envío asegurado a toda Colombia.
              </span>
            </div>
            <div>
              <Icon name="shield" />
              <span>
                <strong>Compra con respaldo</strong>Garantía legal en Colombia (Ley 1480 de 2011).
              </span>
            </div>
            <div>
              <Icon name="headphones" />
              <span>
                <strong>¿Tienes alguna duda?</strong>
                <button type="button" onClick={() => router.push('/contacto')}>
                  Habla con nuestro equipo
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="detail-tabs">
        <div className="tab-list">
          {['Descripción', 'Especificaciones', 'Compatibilidad', 'Opiniones'].map((t) => (
            <button
              type="button"
              className={tab === t ? 'selected' : ''}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
              {t === 'Opiniones' && ` (${reviews.length})`}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'Descripción' ? (
            <>
              <h3>Diseñado para ir un paso más allá</h3>
              <p>{currentProduct.description}</p>
              <h4>Características principales</h4>
              <ul>
                {currentProduct.specs.slice(0, 3).map((s) => (
                  <li key={s[0]}>
                    {s[0]}: {s[1]}
                  </li>
                ))}
              </ul>
            </>
          ) : tab === 'Especificaciones' ? (
            <>
              <h3>Conoce cada detalle</h3>
              <table>
                <tbody>
                  {currentProduct.specs.map((s) => (
                    <tr key={s[0]}>
                      <th>{s[0]}</th>
                      <td>{s[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">
                Especificaciones de referencia. Verifica la versión exacta con nuestro equipo en
                caso de duda.
              </p>
            </>
          ) : tab === 'Compatibilidad' ? (
            <>
              <h3>Un lugar en tu setup</h3>
              <p>{currentProduct.specs.find((s) => s[0] === 'Compatibilidad')?.[1]}</p>
              <p>
                Algunas funciones requieren software del fabricante. Consulta la compatibilidad con
                tu dispositivo antes de comprar.
              </p>
            </>
          ) : (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {reviews.length === 0 ? (
                <div className="reviews-placeholder">
                  <Icon name="chat" size={34} />
                  <h3>Aún no hay opiniones publicadas para este producto</h3>
                  <p>
                    Sé el primero en compartir tu experiencia real con este periférico en BSP Store
                    Colombia.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1.1rem',
                      borderRadius: '12px',
                      background: 'rgba(25, 130, 230, 0.12)',
                      border: '1px solid rgba(25, 130, 230, 0.28)',
                    }}
                  >
                    <strong style={{ fontSize: '1.25rem', color: '#5fb4ff' }}>
                      ★ {averageRating.toFixed(1)} / 5.0
                    </strong>
                    <span style={{ color: '#9fb2cc', fontSize: '0.92rem' }}>
                      Basado en {reviews.length}{' '}
                      {reviews.length === 1 ? 'opinión registrada' : 'opiniones registradas'}
                    </span>
                  </div>

                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '1.1rem',
                        borderRadius: '14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          marginBottom: '0.45rem',
                        }}
                      >
                        <div>
                          <strong style={{ marginRight: '0.6rem' }}>{rev.title}</strong>
                          <span style={{ color: '#fbbf24' }}>{'★'.repeat(rev.rating)}</span>
                        </div>
                        {rev.verifiedPurchase && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '999px',
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#4ade80',
                              fontWeight: 600,
                            }}
                          >
                            Compra verificada en BSP Store
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 0.5rem', color: '#cbd5e1', fontSize: '0.92rem' }}>
                        {rev.comment}
                      </p>
                      <small style={{ color: '#64748b' }}>
                        Por {rev.authorName} · {new Date(rev.createdAt).toLocaleDateString('es-CO')}
                      </small>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleReviewSubmit}
                style={{
                  padding: '1.25rem',
                  borderRadius: '16px',
                  background: 'rgba(13, 25, 43, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'grid',
                  gap: '0.85rem',
                }}
              >
                <h4 style={{ margin: 0 }}>Deja tu opinión sobre {currentProduct.name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                  <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem' }}>
                    Calificación
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '10px',
                        background: '#0b1526',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.14)',
                      }}
                    >
                      <option value={5}>★★★★★ (5 - Excelente)</option>
                      <option value={4}>★★★★☆ (4 - Muy bueno)</option>
                      <option value={3}>★★★☆☆ (3 - Bueno)</option>
                      <option value={2}>★★☆☆☆ (2 - Regular)</option>
                      <option value={1}>★☆☆☆☆ (1 - Por mejorar)</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem' }}>
                    Título de tu opinión
                    <input
                      required
                      minLength={3}
                      placeholder="Ej. Excelente precisión y batería duradera"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '10px',
                        background: '#0b1526',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.14)',
                      }}
                    />
                  </label>
                </div>
                <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.88rem' }}>
                  Tu experiencia con el producto
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    placeholder="Cuéntanos qué tal te pareció el producto, la entrega y el desempeño en tu setup..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '10px',
                      background: '#0b1526',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                  />
                </label>
                <div>
                  <Button type="submit" disabled={submittingReview}>
                    {submittingReview ? 'Publicando opinión...' : 'Publicar opinión'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <SectionTitle eyebrow="HACEN UN GRAN EQUIPO" title="Completa tu experiencia" />
        <ProductGrid list={activeCatalog.filter((p) => p.id !== currentProduct.id).slice(0, 4)} />
      </section>

      {zoom && (
        <div
          className="overlay zoom-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            className="zoom-close icon-button"
            aria-label="Cerrar imagen ampliada"
            onClick={() => setZoom(false)}
          >
            <Icon name="close" size={26} />
          </button>
          <img src={currentProduct.image} alt={`${currentProduct.name}, imagen ampliada`} />
          <p>{currentProduct.name} · Haz clic para cerrar</p>
        </div>
      )}
    </div>
  );
}
