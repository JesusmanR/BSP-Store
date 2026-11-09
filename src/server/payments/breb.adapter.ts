import { OFFICIAL_BREB_KEY, OFFICIAL_BREB_RECIPIENT } from './types';

export interface BrebPaymentInstructions {
  provider: 'BREB_TRANSFER';
  brebKey: string;
  recipientName: string;
  orderNumber: string;
  amountCop: number;
  commissionCop: 0;
  orderStatus: 'PENDING_BREB_VERIFICATION';
  steps: string[];
}

/**
 * Construye las instrucciones verificables para el pago mediante
 * Transferencia Inmediata con Llave Bre-B (@bbbsp) en Colombia ($0 COP comisión).
 */
export function buildBrebPaymentInstructions(
  orderNumber: string,
  amountCop: number
): BrebPaymentInstructions {
  return {
    provider: 'BREB_TRANSFER',
    brebKey: OFFICIAL_BREB_KEY,
    recipientName: OFFICIAL_BREB_RECIPIENT,
    orderNumber,
    amountCop,
    commissionCop: 0,
    orderStatus: 'PENDING_BREB_VERIFICATION',
    steps: [
      `Abre la aplicación de tu banco o billetera digital en Colombia (Bancolombia, Nequi, Daviplata, Nu, Davivienda, BBVA, etc.).`,
      `Selecciona la opción "Transferir con Llave Bre-B" e ingresa la llave oficial: ${OFFICIAL_BREB_KEY}.`,
      `Transfiere el valor exacto del pedido ($ ${new Intl.NumberFormat('es-CO').format(amountCop)} COP) e incluye la referencia ${orderNumber} en la descripción.`,
      `Registra el número de comprobante en tu pedido para que nuestro equipo verifique el ingreso y autorice el despacho.`,
    ],
  };
}
