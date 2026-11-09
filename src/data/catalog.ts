import { slugify } from '@/lib/format';

export type ProductVariantOption = {
  id: string;
  label: string;
  skuSuffix: string;
};

export type Product = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  tag?: string;
  description: string;
  specs: [string, string][];
  variants: ProductVariantOption[];
};

export type CategoryItem = {
  name: string;
  subtitle: string;
  image: string;
  icon: string;
};

const rawProducts: Omit<Product, 'slug' | 'sku'>[] = [
  {
    id: 1,
    name: 'Mouse Logitech G502 X Plus',
    brand: 'LOGITECH G',
    category: 'Mouse gamer',
    price: 649900,
    image: '/images/g502x-plus-gallery-1-black.png',
    tag: 'PRECISIÓN SIN LÍMITES',
    description:
      'Diseñado para acompañarte en cada partida. El G502 X Plus combina conectividad inalámbrica LIGHTSPEED, iluminación LIGHTSYNC RGB y un diseño ergonómico con controles personalizables.',
    specs: [
      ['Sensor', 'HERO 25K'],
      ['Conexión', 'Inalámbrica LIGHTSPEED / USB'],
      ['Resolución', '100 – 25.600 DPI'],
      ['Peso', '106 g'],
      ['Compatibilidad', 'Windows 10 o superior / macOS 10.14 o superior'],
    ],
    variants: [
      { id: 'negro', label: 'Negro (Black)', skuSuffix: 'BLK' },
      { id: 'blanco', label: 'Blanco (White)', skuSuffix: 'WHT' },
    ],
  },
  {
    id: 2,
    name: 'Teclado Logitech G915 TKL',
    brand: 'LOGITECH G',
    category: 'Teclados',
    price: 899900,
    image: '/images/g915-tkl-gallery-1-carbon.png',
    description:
      'Un teclado mecánico de perfil bajo y formato compacto. Libera espacio en tu escritorio sin renunciar a un control preciso y una experiencia de escritura cómoda.',
    specs: [
      ['Formato', 'Tenkeyless (TKL)'],
      ['Conexión', 'LIGHTSPEED / Bluetooth'],
      ['Iluminación', 'LIGHTSYNC RGB'],
      ['Construcción', 'Aleación de aluminio'],
      ['Compatibilidad', 'Windows / macOS'],
    ],
    variants: [
      { id: 'tactile', label: 'GL Tactile (Carbón)', skuSuffix: 'TAC' },
      { id: 'linear', label: 'GL Linear (Carbón)', skuSuffix: 'LIN' },
    ],
  },
  {
    id: 3,
    name: 'Audífonos Logitech G733',
    brand: 'LOGITECH G',
    category: 'Audífonos y audio',
    price: 579900,
    image: '/images/g733-black-gallery-1.png',
    tag: 'SONIDO QUE ENVUELVE',
    description:
      'Sumérgete en tus juegos con audio inalámbrico, una banda de suspensión cómoda y un micrófono desmontable. Una experiencia ligera para tus sesiones más largas.',
    specs: [
      ['Conexión', 'Inalámbrica LIGHTSPEED'],
      ['Transductores', 'PRO-G de 40 mm'],
      ['Peso', '278 g'],
      ['Micrófono', 'Desmontable'],
      ['Compatibilidad', 'PC / PlayStation (según funciones)'],
    ],
    variants: [
      { id: 'negro', label: 'Negro (Black)', skuSuffix: 'BLK' },
      { id: 'azul', label: 'Azul (Blue)', skuSuffix: 'BLU' },
    ],
  },
  {
    id: 4,
    name: 'Mouse Logitech G PRO X Superlight',
    brand: 'LOGITECH G',
    category: 'Mouse gamer',
    price: 729900,
    image: '/images/pro-x-superlight-black-gallery-1.png',
    description:
      'Movimiento ligero y control preciso en un mouse creado para el juego competitivo. Diseño minimalista, sensor HERO 25K y conectividad inalámbrica.',
    specs: [
      ['Sensor', 'HERO 25K'],
      ['Peso', 'Menos de 63 g'],
      ['Conexión', 'LIGHTSPEED'],
      ['Carga', 'Micro USB'],
      ['Compatibilidad', 'Windows / macOS'],
    ],
    variants: [
      { id: 'negro', label: 'Negro (Black)', skuSuffix: 'BLK' },
      { id: 'blanco', label: 'Blanco (White)', skuSuffix: 'WHT' },
    ],
  },
  {
    id: 5,
    name: 'Teclado Logitech G PRO',
    brand: 'LOGITECH G',
    category: 'Teclados',
    price: 499900,
    image: '/images/us-pro-gaming-keyboard-gallery-topdown.png',
    description:
      'Un teclado compacto para un escritorio más libre. Diseño portátil con iluminación personalizable y respuesta mecánica.',
    specs: [
      ['Formato', 'TKL'],
      ['Conexión', 'USB'],
      ['Iluminación', 'LIGHTSYNC RGB'],
      ['Compatibilidad', 'Windows / macOS'],
    ],
    variants: [{ id: 'gx-blue', label: 'GX Blue Clicky (US)', skuSuffix: 'US' }],
  },
  {
    id: 6,
    name: 'Audífonos Logitech G PRO X 2',
    brand: 'LOGITECH G',
    category: 'Audífonos y audio',
    price: 849900,
    image: '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png',
    description:
      'Audio pensado para el juego competitivo, con transductores de grafeno, micrófono desmontable y estructura resistente para acompañar tu setup.',
    specs: [
      ['Transductores', 'Grafeno de 50 mm'],
      ['Conexión', 'LIGHTSPEED / Bluetooth / 3,5 mm'],
      ['Micrófono', 'Desmontable'],
      ['Compatibilidad', 'PC / consola según conexión'],
    ],
    variants: [{ id: 'negro', label: 'Negro (LIGHTSPEED)', skuSuffix: 'BLK' }],
  },
];

export const products: Product[] = rawProducts.map((p) => ({
  ...p,
  slug: slugify(p.name),
  sku: `BSP-${String(p.id).padStart(4, '0')}`,
}));

export const categories: CategoryItem[] = [
  {
    name: 'Mouse gamer',
    subtitle: 'Precisión en cada movimiento',
    image: products[0]!.image,
    icon: 'mouse',
  },
  {
    name: 'Teclados',
    subtitle: 'Cada tecla cuenta',
    image: products[1]!.image,
    icon: 'keyboard',
  },
  {
    name: 'Audífonos y audio',
    subtitle: 'Escucha la diferencia',
    image: products[2]!.image,
    icon: 'headphones',
  },
  { name: 'Componentes', subtitle: 'Potencia desde adentro', image: '', icon: 'cpu' },
  { name: 'Accesorios', subtitle: 'Los detalles hacen el setup', image: '', icon: 'gamepad' },
  { name: 'Monitores', subtitle: 'Una nueva perspectiva', image: '', icon: 'monitor' },
];

export const brandLogos = ['logitech G', 'RAZER', 'HYPERX', 'CORSAIR', 'ASUS', 'Redragon'] as const;

export const colombiaDepartments = [
  'Bogotá D. C.',
  'Antioquia',
  'Valle del Cauca',
  'Atlántico',
  'Cundinamarca',
  'Santander',
  'Bolívar',
  'Risaralda',
  'Otro departamento',
] as const;

export const cop = (value: number) => '$ ' + new Intl.NumberFormat('es-CO').format(value);

export function findProductByIdOrSlug(idOrSlug: string): Product | undefined {
  const numericId = Number(idOrSlug);
  if (!Number.isNaN(numericId) && numericId > 0) {
    return products.find((p) => p.id === numericId);
  }
  const normalized = idOrSlug.toLowerCase().trim();
  return products.find((p) => p.slug === normalized);
}
