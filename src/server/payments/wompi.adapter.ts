import crypto from 'node:crypto';
import type {
  CreatePaymentSessionInput,
  NormalizedPaymentStatus,
  PaymentGatewayPort,
  PaymentSessionResult,
  WebhookEventPayload,
} from './types';

/**
 * Calcula la firma de integridad SHA256 oficial de Wompi Colombia:
 * SHA256("<Referencia><MontoEnCentavos><Moneda><SecretoIntegridad>")
 */
export function generateWompiIntegritySignature(
  reference: string,
  amountInCents: number,
  currency: 'COP',
  integritySecret: string
): string {
  const raw = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }
  return current === undefined || current === null ? '' : String(current);
}

/**
 * Verifica la autenticidad de un evento Webhook de Wompi Colombia usando
 * las propiedades declaradas en `signature.properties` + `timestamp` + `WOMPI_EVENTS_SECRET`.
 */
export function verifyWompiEventChecksum(
  eventBody: {
    data?: Record<string, unknown>;
    timestamp?: number | string;
    signature?: {
      properties?: string[];
      checksum?: string;
    };
  },
  eventsSecret: string,
  headerChecksum?: string
): boolean {
  const properties = eventBody.signature?.properties ?? [];
  const expectedChecksum = (headerChecksum || eventBody.signature?.checksum || '').toLowerCase();
  const timestamp = eventBody.timestamp;

  if (!expectedChecksum || !timestamp || properties.length === 0 || !eventBody.data) {
    return false;
  }

  const valuesConcat = properties
    .map((prop) => getNestedValue(eventBody.data as Record<string, unknown>, prop))
    .join('');

  const stringToSign = `${valuesConcat}${timestamp}${eventsSecret}`;
  const calculated = crypto.createHash('sha256').update(stringToSign, 'utf8').digest('hex');

  if (calculated.length !== expectedChecksum.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(calculated, 'utf8'),
    Buffer.from(expectedChecksum, 'utf8')
  );
}

export function normalizeWompiStatus(rawStatus: string): NormalizedPaymentStatus {
  const upper = rawStatus.toUpperCase();
  if (upper === 'APPROVED') return 'APPROVED';
  if (upper === 'DECLINED') return 'DECLINED';
  if (upper === 'VOIDED') return 'VOIDED';
  if (upper === 'ERROR') return 'ERROR';
  return 'PENDING';
}

export class WompiGatewayAdapter implements PaymentGatewayPort {
  public readonly provider = 'WOMPI' as const;

  private get publicKey(): string {
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY) {
      throw new Error('NEXT_PUBLIC_WOMPI_PUBLIC_KEY must be configured in production.');
    }
    return process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || 'pub_test_bsp_store_colombia';
  }

  private get integritySecret(): string {
    if (process.env.NODE_ENV === 'production' && !process.env.WOMPI_INTEGRITY_SECRET) {
      throw new Error('WOMPI_INTEGRITY_SECRET must be configured in production.');
    }
    return process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_secret_bsp_store';
  }

  private get eventsSecret(): string {
    if (process.env.NODE_ENV === 'production' && !process.env.WOMPI_EVENTS_SECRET) {
      throw new Error('WOMPI_EVENTS_SECRET must be configured in production.');
    }
    return process.env.WOMPI_EVENTS_SECRET || 'test_events_secret_bsp_store';
  }

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult> {
    const amountInCents = Math.round(input.amountInCop * 100);
    const reference = input.orderNumber;
    const integritySignature = generateWompiIntegritySignature(
      reference,
      amountInCents,
      'COP',
      this.integritySecret
    );

    const checkoutParams = new URLSearchParams({
      'public-key': this.publicKey,
      currency: 'COP',
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': integritySignature,
      'redirect-url': input.redirectUrl,
    });

    return {
      provider: 'WOMPI',
      reference,
      checkoutUrl: `https://checkout.wompi.co/p/?${checkoutParams.toString()}`,
      integritySignature,
      publicKey: this.publicKey,
      amountInCents,
      currency: 'COP',
    };
  }

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): boolean {
    try {
      const parsed = JSON.parse(rawBody);
      const headerChecksum = headers['x-event-checksum'] ?? headers['X-Event-Checksum'];
      return verifyWompiEventChecksum(parsed, this.eventsSecret, headerChecksum);
    } catch {
      return false;
    }
  }

  async parseWebhookEvent(rawBody: string): Promise<WebhookEventPayload> {
    const parsed = JSON.parse(rawBody);
    const tx = parsed?.data?.transaction ?? {};
    const amountInCents = Number(tx.amount_in_cents ?? 0);
    const eventId =
      String(parsed?.id ?? '') ||
      `${tx.id ?? 'tx'}-${tx.status ?? 'PENDING'}-${parsed?.timestamp ?? Date.now()}`;

    return {
      provider: 'WOMPI',
      eventId,
      externalTransactionId: String(tx.id ?? ''),
      orderReference: String(tx.reference ?? ''),
      status: normalizeWompiStatus(String(tx.status ?? 'PENDING')),
      amountInCop: Math.round(amountInCents / 100),
      paymentMethodType: tx.payment_method_type ? String(tx.payment_method_type) : undefined,
      rawPayload: parsed,
    };
  }

  async getTransactionStatus(_externalTransactionId: string): Promise<{
    status: NormalizedPaymentStatus;
    amountInCop: number;
  }> {
    return {
      status: 'PENDING',
      amountInCop: 0,
    };
  }
}

export const wompiGateway = new WompiGatewayAdapter();
