'use client';

import { products } from '@/data/catalog';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { SectionTitle } from '@/components/catalog/SectionTitle';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Icon } from '@/components/ui/Icon';

export default function OffersPage() {
  return (
    <div className="container page">
      <Breadcrumb current="Ofertas y novedades" />
      <div className="page-heading">
        <span className="eyebrow blue">EL MOMENTO DE TU PRÓXIMO UPGRADE</span>
        <h1>
          Ofertas y novedades<span className="blue">.</span>
        </h1>
        <p>Buenas oportunidades, siempre con información transparente.</p>
      </div>

      <div className="offers-empty">
        <Icon name="bolt" size={38} />
        <div>
          <h3>Sin promociones verificadas por ahora</h3>
          <p>
            Solo publicaremos descuentos respaldados por precios reales desde el panel
            administrativo. Mientras tanto, explora nuestros productos de referencia.
          </p>
        </div>
      </div>

      <section className="section">
        <SectionTitle
          eyebrow="INSPIRACIÓN PARA TU ESCRITORIO"
          title="Descubre nuestra selección"
        />
        <ProductGrid list={products.slice(0, 4)} />
      </section>
    </div>
  );
}
