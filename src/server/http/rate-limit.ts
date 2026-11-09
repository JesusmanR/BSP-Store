import { AppError } from './errors';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Rate limiter en memoria por ventana deslizante para proteger endpoints sensibles
 * (autenticación, recuperación de contraseña, checkout y webhooks).
 */
export function enforceRateLimit(key: string, maxRequests = 15, windowMs = 60_000): void {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= maxRequests) {
    throw new AppError(
      'RATE_LIMIT_EXCEEDED',
      'Has realizado demasiadas solicitudes en poco tiempo. Intenta nuevamente en un minuto.',
      429
    );
  }

  current.count += 1;
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
