type Props = {
  className?: string;
  sizes: string;
  priority?: boolean;
};

export function BrandMascot({ className, sizes, priority = false }: Props) {
  return (
    <img
      className={className}
      src="/brand/bsp-mascot-1600.webp"
      srcSet="/brand/bsp-mascot-800.webp 800w, /brand/bsp-mascot-1600.webp 1600w"
      sizes={sizes}
      width={1600}
      height={893}
      alt="Mascota de BSP STORE: panda robótico en grafito con detalles luminosos azules, saludando en un laboratorio tecnológico."
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  );
}
