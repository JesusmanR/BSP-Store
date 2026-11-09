'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { brandLogos, categories, products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { SectionTitle } from '@/components/catalog/SectionTitle';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

const benefitItems = [
  { icon: 'truck', title: 'A todo Colombia', text: 'Tu próximo setup, más cerca' },
  { icon: 'shield', title: 'Compra con confianza', text: 'Garantía y respaldo para ti' },
  { icon: 'card', title: 'Pagos seguros', text: 'Wompi (PSE / TC) y Llave Bre-B @bbbsp' },
  { icon: 'headphones', title: 'Te asesoramos', text: 'Encuentra lo que necesitas' },
] as const;

export default function HomePage() {
  const router = useRouter();
  const { setCategory, setQuery, setStockFilter, setBrand, setModal } = useStore();
  const [featuredCategory, setFeaturedCategory] = useState('Todas');

  const goShop = (cat = 'Todas') => {
    setCategory(cat);
    setQuery('');
    setStockFilter(false);
    router.push('/tienda');
  };

  return (
    <>
      <section className="hero">
        <img
          className="hero-photo"
          src="/images/setup-gamer.jpg"
          alt="Setup gamer con monitores, teclado y un computador con iluminación azul"
        />
        <div className="hero-shade" />
        <div className="container hero-inner">
          <div className="hero-content">
            <div className="hero-label">
              <span /> TU PRÓXIMO NIVEL ESTÁ AQUÍ
            </div>
            <h1>
              Lleva tu setup
              <br />
              al <span>siguiente nivel.</span>
            </h1>
            <p>
              Tecnología, rendimiento y accesorios
              <br className="desktop-break" /> para tu experiencia digital.
            </p>
            <div className="hero-buttons">
              <Button onClick={() => goShop()}>
                Explorar productos
                <Icon name="arrow" size={20} />
              </Button>
              <button
                type="button"
                className="hero-secondary"
                onClick={() =>
                  document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                Encuentra tu categoría
                <Icon name="chevron" size={16} />
              </button>
            </div>
            <div className="hero-trust">
              <Icon name="shield" size={16} />
              <span>Tecnología con respaldo. Pasión por tu setup.</span>
            </div>
          </div>

          <div className="hero-caption">
            <span className="caption-line" />
            <span>
              NO ES SOLO UN SETUP.
              <br />
              <strong>ES TU ESPACIO.</strong>
            </span>
          </div>

          <div className="hero-bottom">
            <div className="hero-pagination">
              <span className="selected" />
            </div>
            <span>DISEÑADO PARA JUGAR. CREADO PARA MÁS.</span>
            <span className="hero-number">
              BSP <small>/ STORE</small>
            </span>
          </div>
        </div>
      </section>

      <section className="benefits-section">
        <div className="benefits container">
          {benefitItems.map((b) => (
            <div className="benefit" key={b.title}>
              <span className="benefit-icon">
                <Icon name={b.icon} size={27} />
              </span>
              <div>
                <strong>{b.title}</strong>
                <p>{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="categorias" className="section categories-section container">
        <SectionTitle
          eyebrow="UN UNIVERSO DE POSIBILIDADES"
          title="Arma tu setup, a tu manera"
          action="Explorar categorías"
          onClick={() => goShop()}
        />
        <div className="category-grid">
          {categories.map((c, index) => (
            <button
              type="button"
              className="category-card"
              key={c.name}
              onClick={() => goShop(c.name)}
            >
              <div className={`category-visual category-visual-${index}`}>
                {c.image ? (
                  <img src={c.image} alt={c.name} loading="lazy" />
                ) : (
                  <div className="category-object">
                    <Icon name={c.icon} size={76} />
                  </div>
                )}
                <span className="category-hover">
                  <Icon name="arrow" size={17} />
                </span>
              </div>
              <h3>{c.name}</h3>
              <p>{c.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section featured-section">
        <div className="container">
          <SectionTitle
            eyebrow="TECNOLOGÍA QUE MARCA LA DIFERENCIA"
            title="Elegidos para tu próximo nivel"
            onClick={() => goShop()}
          />
          <div className="section-tabs">
            <div>
              <button
                type="button"
                className={featuredCategory === 'Todas' ? 'selected' : ''}
                onClick={() => setFeaturedCategory('Todas')}
              >
                Destacados
              </button>
              {['Mouse gamer', 'Teclados', 'Audífonos y audio'].map((c) => (
                <button
                  type="button"
                  key={c}
                  className={featuredCategory === c ? 'selected' : ''}
                  onClick={() => setFeaturedCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <span>Selección de referencia · Precios en COP</span>
          </div>
          <ProductGrid
            list={products
              .filter((p) => featuredCategory === 'Todas' || p.category === featuredCategory)
              .slice(0, 4)}
          />
        </div>
      </section>

      <section className="container editorial-section">
        <div className="editorial-banner">
          <div className="editorial-copy">
            <span className="eyebrow">MENOS CABLES. MÁS LIBERTAD.</span>
            <h2>
              El control está
              <br />
              en tus manos.
            </h2>
            <p>
              Descubre periféricos que siguen tu ritmo.
              <br />
              Juega, crea y trabaja sin límites.
            </p>
            <Button onClick={() => goShop('Mouse gamer')}>
              Encuentra tu mouse
              <Icon name="arrow" size={18} />
            </Button>
          </div>
          <img
            src={products[3]!.image}
            alt="Mouse inalámbrico Logitech G PRO X Superlight"
            loading="lazy"
          />
          <div className="editorial-word">JUEGA</div>
          <span className="editorial-note">TU TALENTO. SIN DISTRACCIONES.</span>
        </div>
      </section>

      <section className="section container">
        <SectionTitle
          eyebrow="LOS ESENCIALES DE UN GRAN SETUP"
          title="Encuentra tu nueva combinación"
          onClick={() => goShop()}
        />
        <ProductGrid list={[products[2]!, products[1]!, products[3]!, products[0]!]} />
      </section>

      <section className="container offers-teaser">
        <div className="offers-icon">
          <Icon name="bolt" size={34} />
        </div>
        <div>
          <span className="eyebrow blue">MÁS TECNOLOGÍA. MÁS POSIBILIDADES.</span>
          <h2>El próximo upgrade te está esperando.</h2>
          <p>Explora nuestra selección y encuentra lo que hace falta en tu escritorio.</p>
        </div>
        <Button onClick={() => router.push('/ofertas')} secondary>
          Ver ofertas y novedades
          <Icon name="arrow" size={18} />
        </Button>
      </section>

      <section id="marcas" className="brands-section container">
        <span className="eyebrow">GRANDES MARCAS. GRANDES EXPERIENCIAS.</span>
        <div className="brand-logos">
          {brandLogos.map((b, i) => (
            <button
              type="button"
              key={b}
              className={`brand-logo brand-${i}`}
              onClick={() => {
                if (i === 0) {
                  setBrand(true);
                  goShop();
                } else {
                  setModal(b);
                }
              }}
            >
              {b}
            </button>
          ))}
        </div>
        <p>Marcas de referencia para tu setup. Administrables desde el panel de la tienda.</p>
      </section>

      <section className="community-section">
        <div className="container community-inner">
          <div>
            <span className="eyebrow blue">DE GAMERS, PARA TU DÍA A DÍA</span>
            <h2>
              Tu setup merece
              <br />
              una buena compañía.
            </h2>
            <p>
              No necesitas saberlo todo de tecnología.
              <br />
              Estamos aquí para ayudarte a elegir mejor.
            </p>
            <button
              type="button"
              className="text-link"
              onClick={() => router.push('/contacto')}
            >
              Hablemos de tu próximo setup
              <Icon name="arrow" size={19} />
            </button>
          </div>
          <div className="review-empty">
            <span className="quote-mark">“</span>
            <h3>Tu experiencia también cuenta.</h3>
            <p>
              Este espacio estará dedicado a opiniones de compradores verificados. Aún no hay
              reseñas publicadas.
            </p>
            <span>
              <Icon name="shield" size={17} />
              Opiniones reales, sin historias inventadas.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
