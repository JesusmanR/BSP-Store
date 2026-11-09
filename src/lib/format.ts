const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * Formatea un valor entero en pesos colombianos (COP), p. ej. 429900 -> "$ 429.900" o "$429.900"
 */
export function formatCOP(amountInPesos: number): string {
  if (!Number.isFinite(amountInPesos)) {
    return '$ 0';
  }
  return copFormatter.format(Math.round(amountInPesos));
}

/**
 * Calcula el porcentaje entero de descuento entre el precio anterior y el precio actual.
 */
export function calculateDiscountPercent(price: number, compareAtPrice?: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price || compareAtPrice <= 0 || price < 0) {
    return 0;
  }
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/**
 * Genera un slug URL-amigable para productos, categorías y marcas (SEO técnico).
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
