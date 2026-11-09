'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cop, findProductByIdOrSlug, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { SectionTitle } from '@/components/catalog/SectionTitle';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Quantity } from '@/components/ui/Quantity';

export default function ProductDetailPage() {
  const params = useParams<{ idOrSlug: string }>();
  const router = useRouter();
  const { add, favorites, toggleFavorite } = useStore();

  const currentProduct = findProductByIdOrSlug(params?.idOrSlug ?? '1') ?? products[0]!;

  const [detailQty, setDetailQty] = useState(1);
  const [tab, setTab] = useState('Descripción');
  const [gallery, setGallery] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(currentProduct.variants[0]?.id ?? '');

  useEffect(() => {
    setDetailQty(1);
    setGallery(0);
    setTab('Descripción');
    setSelectedVariant(currentProduct.variants[0]?.id ?? '');
  }, [currentProduct.id, currentProduct.variants]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const activeVariant =
    currentProduct.variants.find((v) => v.id === selectedVariant) ?? currentProduct.variants[0];

  return (
    <div className="container page product-page">
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
            Disponibilidad por confirmar
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
                {currentProduct.variants.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    className={`variant-pill ${selectedVariant === v.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVariant(v.id)}
                  >
                    {v.label}
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
                <strong>Envíos a Colombia</strong>El costo se calcula según tu destino.
              </span>
            </div>
            <div>
              <Icon name="shield" />
              <span>
                <strong>Compra con respaldo</strong>Consulta condiciones de garantía antes de
                comprar.
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
              {t === 'Opiniones' && ' (0)'}
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
                Especificaciones de referencia. Verifica la versión exacta con el vendedor.
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
            <div className="reviews-placeholder">
              <Icon name="chat" size={34} />
              <h3>Aún no hay opiniones verificadas</h3>
              <p>
                Solo se mostrarán reseñas asociadas a compras reales cuando se conecte la tienda.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <SectionTitle eyebrow="HACEN UN GRAN EQUIPO" title="Completa tu experiencia" />
        <ProductGrid list={products.filter((p) => p.id !== currentProduct.id).slice(0, 4)} />
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
