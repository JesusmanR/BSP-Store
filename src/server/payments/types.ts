export type PaymentGatewayProvider = 'WOMPI' | 'BREB_TRANSFER' | 'BOLD' | 'MERCADO_PAGO';

export type PaymentMethodType =
  | 'BREB_KEY_TRANSFER'
  | 'PSE'
  | 'CARD'
  | 'NEQUI'
  | 'BANCOLOMBIA_TRANSFER'
  | 'DAVIPLATA'
  | 'CASH_EFECTY';

export const OFFICIAL_BREB_KEY = process.env.NEXT_PUBLIC_BREB_KEY ?? '@bbbsp';
export const OFFICIAL_BREB_RECIPIENT = process.env.NEXT_PUBLIC_BREB_RECIPIENT_NAME ?? 'BSP Store';

export type NormalizedPaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'VOIDED'
  | 'ERROR';

export interface CreatePaymentSessionInput {
  orderId: string;
  orderNumber: string;
  amountInCop: number;
  taxInCop?: number;
  currency: 'COP';
  customerEmail: string;
  customerFullName: string;
  customerPhone?: string;
  redirectUrl: string;
}

export interface PaymentSessionResult {
  provider: PaymentGatewayProvider;
  reference: string;
  checkoutUrl?: string;
  integritySignature: string;
  publicKey: string;
  amountInCents: number;
  currency: 'COP';
}

export interface WebhookEventPayload {
  provider: PaymentGatewayProvider;
  eventId: string;
  externalTransactionId: string;
  orderReference: string;
  status: NormalizedPaymentStatus;
  amountInCop: number;
  paymentMethodType?: string;
  rawPayload: unknown;
}

/**
 * Puerto desacoplado (Hexagonal / Clean Architecture) para pasarelas de pago en Colombia.
 * Permite intercambiar o habilitar simultáneamente Wompi, Bold y Mercado Pago.
 */
export interface PaymentGatewayPort {
  readonly provider: PaymentGatewayProvider;
  createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>, timestamp?: string): boolean;
  parseWebhookEvent(rawBody: string): Promise<WebhookEventPayload>;
  getTransactionStatus(externalTransactionId: string): Promise<{
    status: NormalizedPaymentStatus;
    amountInCop: number;
  }>;
}

export interface GatewayCommissionEstimate {
  provider: PaymentGatewayProvider;
  method: 'CARD_OR_WALLET' | 'PSE';
  grossAmountCop: number;
  percentageRate: number;
  fixedFeeCop: number;
  commissionBeforeVatCop: number;
  vatOnCommissionCop: number;
  totalGatewayCostCop: number;
  estimatedNetBeforeRetentionsCop: number;
}

const VAT_COLOMBIA = 0.19;

/**
 * Calcula la comisión estimada de pasarela en Colombia (Tarifas estándar públicas + IVA del 19% sobre comisión)
 * para comparar Wompi, Bold y Mercado Pago sobre un ticket en COP.
 */
export function estimateGatewayCommission(
  provider: PaymentGatewayProvider,
  grossAmountCop: number,
  method: 'CARD_OR_WALLET' | 'PSE' = 'CARD_OR_WALLET'
): GatewayCommissionEstimate {
  let percentageRate = 0;
  let fixedFeeCop = 0;

  switch (provider) {
    case 'BREB_TRANSFER':
      // Transferencia directa mediante llave Bre-B (@bbbsp): $0 COP comisión
      percentageRate = 0;
      fixedFeeCop = 0;
      break;
    case 'WOMPI':
      // Wompi Plan Avanzado (estándar e-commerce): 2.65% + $700 COP + IVA (PSE, TC/TD y otros medios)
      percentageRate = method === 'PSE' ? 0.0265 : 0.0265;
      fixedFeeCop = 700;
      break;
    case 'BOLD':
      // Bold pagos en línea (Link / Botón de pagos):
      // PSE, Nequi, Daviplata, Botón Bancolombia: 2.89% + $900 COP + IVA
      // Tarjetas crédito/débito nacionales: 2.99% + $900 COP + IVA
      percentageRate = method === 'PSE' ? 0.0289 : 0.0299;
      fixedFeeCop = 900;
      break;
    case 'MERCADO_PAGO':
      // Mercado Pago Checkout Pro liberación inmediata estándar Colombia: 3.29% + $800 COP + IVA
      percentageRate = 0.0329;
      fixedFeeCop = 800;
      break;
  }

  const commissionBeforeVatCop = Math.round(grossAmountCop * percentageRate + fixedFeeCop);
  const vatOnCommissionCop = Math.round(commissionBeforeVatCop * VAT_COLOMBIA);
  const totalGatewayCostCop = commissionBeforeVatCop + vatOnCommissionCop;
  const estimatedNetBeforeRetentionsCop = Math.max(0, grossAmountCop - totalGatewayCostCop);

  return {
    provider,
    method,
    grossAmountCop,
    percentageRate,
    fixedFeeCop,
    commissionBeforeVatCop,
    vatOnCommissionCop,
    totalGatewayCostCop,
    estimatedNetBeforeRetentionsCop,
  };
}
