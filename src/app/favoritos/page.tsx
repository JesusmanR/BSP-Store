'use client';

import { useRouter } from 'next/navigation';
import { products } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { ProductGrid } from '@/components/catalog/ProductCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function FavoritesPage() {
  const router = useRouter();
  const { favorites } = useStore();
  const favoriteProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <div className="container page">
      <Breadcrumb current="Mis favoritos" />
      <div className="page-heading">
        <span className="eyebrow blue">GUARDA LO QUE TE INSPIRA</span>
        <h1>
          Tu lista de deseos<span className="blue">.</span>
        </h1>
        <p>Una selección personal para tu próximo upgrade.</p>
      </div>

      {favoriteProducts.length ? (
        <ProductGrid list={favoriteProducts} />
      ) : (
        <div className="empty-state">
          <Icon name="heart" size={55} />
          <h2>Tus favoritos te esperan aquí</h2>
          <p>Toca el corazón de un producto para guardarlo en tu lista.</p>
          <Button onClick={() => router.push('/tienda')}>
            Descubrir productos
            <Icon name="arrow" size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}
