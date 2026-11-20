import { AppError } from './errors';

type Bucket = {
  count: number;
  resetAt: number;
};

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

function pruneExpiredBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets.entries()) {
    if (now >= b.resetAt) {
      buckets.delete(k);
    }
  }
  // Si aún excede el límite bajo ataque distribuido, evacuar entradas más antiguas (FIFO)
  if (buckets.size >= MAX_BUCKETS) {
    const excess = buckets.size - Math.floor(MAX_BUCKETS * 0.8);
    let removed = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

/**
 * Rate limiter en memoria con evicción anti-OOM para proteger endpoints sensibles
 * (autenticación, recuperación de contraseña, checkout, contacto y webhooks).
 */
export function enforceRateLimit(key: string, maxRequests = 15, windowMs = 60_000): void {
  const now = Date.now();
  pruneExpiredBuckets(now);

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

export function extractClientIp(forwardedHeader?: string | null): string {
  if (!forwardedHeader) return 'local';
  const firstIp = forwardedHeader.split(',')[0]?.trim() ?? '';
  if (!firstIp) return 'local';
  const sanitized = firstIp.replace(/[^a-fA-F0-9:.]/g, '').slice(0, 64);
  return sanitized || 'local';
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
