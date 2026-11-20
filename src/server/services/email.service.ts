import nodemailer from 'nodemailer';

export type EmailSendResult = {
  delivered: boolean;
  skipped?: boolean;
  provider: 'resend' | 'smtp' | 'none';
  messageId?: string;
  error?: string;
};

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://bspstore.com.co').replace(/\/+$/, '');
const DEFAULT_FROM =
  process.env.EMAIL_FROM || 'BSP Store Colombia <compras@bspstore.com.co>';
const ADMIN_NOTIFY_TO =
  process.env.EMAIL_ADMIN_NOTIFY_TO || 'compras@bspstore.com.co';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCop(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CO')} COP`;
}

function wrapBspEmailHtml(title: string, preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es-CO">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0f18;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e6edf7;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0f18;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#111927;border:1px solid #223047;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#0d1524 0%,#142642 100%);border-bottom:1px solid #223047;">
              <div style="font-size:20px;font-weight:800;letter-spacing:0.04em;color:#ffffff;">
                BSP <span style="color:#168bff;">STORE</span>
              </div>
              <div style="font-size:11px;color:#8ba3c4;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">
                Tecnología y Periféricos · Colombia
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#0c121e;border-top:1px solid #1e2a3d;font-size:11px;color:#7f93b0;line-height:1.6;">
              <strong style="color:#c7d6ec;">BSP Store Colombia</strong> · Bucaramanga, Santander<br />
              WhatsApp: 302 800 0240 · compras@bspstore.com.co<br />
              Tratamiento de datos conforme a la Ley 1581 de 2012 (Habeas Data Colombia).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envía un correo transaccional usando Resend (si RESEND_API_KEY está presente)
 * o SMTP (compatible directamente con Hostinger: smtp.hostinger.com:465 SSL).
 * Nunca lanza excepciones que bloqueen el checkout o las pruebas automatizadas.
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailSendResult> {
  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_EMAIL_IN_TEST !== 'true') {
    return { delivered: false, skipped: true, provider: 'none' };
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
          reply_to: params.replyTo,
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        console.error('[BSP Email / Resend Error]:', res.status, errTxt);
        return { delivered: false, provider: 'resend', error: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as { id?: string };
      return { delivered: true, provider: 'resend', messageId: data.id };
    } catch (error) {
      console.error('[BSP Email / Resend Exception]:', error);
      return {
        delivered: false,
        provider: 'resend',
        error: error instanceof Error ? error.message : 'Resend error',
      };
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || '465');

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: DEFAULT_FROM,
        to: params.to,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      return { delivered: true, provider: 'smtp', messageId: info.messageId };
    } catch (error) {
      console.error('[BSP Email / SMTP Error]:', error);
      return {
        delivered: false,
        provider: 'smtp',
        error: error instanceof Error ? error.message : 'SMTP error',
      };
    }
  }

  return { delivered: false, skipped: true, provider: 'none' };
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetToken: string;
}): Promise<EmailSendResult> {
  const resetLink = `${APP_URL}/cuenta?tab=forgot&token=${encodeURIComponent(params.resetToken)}`;
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff;">Restablece tu contraseña</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#c7d6ec;">
      Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>BSP Store</strong>.
      Este enlace es válido por <strong>30 minutos</strong> y solo puede usarse una vez.
    </p>
    <p style="margin:0 0 22px;">
      <a href="${escapeHtml(resetLink)}" style="display:inline-block;padding:12px 22px;background:#168bff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
        Crear nueva contraseña
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#8ba3c4;line-height:1.6;">
      Si no solicitaste este cambio, puedes ignorar este correo de forma segura; tu contraseña actual permanecerá intacta.
    </p>`;

  return sendTransactionalEmail({
    to: params.to,
    subject: 'Restablece tu contraseña — BSP Store Colombia',
    html: wrapBspEmailHtml('Restablece tu contraseña', 'Enlace seguro válido por 30 minutos', bodyHtml),
    text: `Restablece tu contraseña en BSP Store (válido por 30 minutos): ${resetLink}`,
  });
}

export async function sendOrderConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  totalCop: number;
  shippingCop: number;
  paymentMethod: string;
  brebKey?: string | null;
  city: string;
  department: string;
  items: Array<{ productName: string; quantity: number; lineTotal: number }>;
}): Promise<EmailSendResult> {
  const trackingUrl = `${APP_URL}/seguimiento`;
  const itemsHtml = params.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #1f2c40;font-size:13px;color:#e6edf7;">
          ${escapeHtml(it.productName)} <span style="color:#8ba3c4;">× ${it.quantity}</span>
        </td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #1f2c40;font-size:13px;font-weight:600;color:#ffffff;">
          ${formatCop(it.lineTotal)}
        </td>
      </tr>`
    )
    .join('');

  const isBreb = params.paymentMethod === 'BREB';
  const paymentBox = isBreb
    ? `<div style="margin:18px 0;padding:14px 16px;background:#0e223d;border:1px solid #1d4e89;border-radius:10px;font-size:13px;color:#cfe4ff;line-height:1.6;">
        <strong style="color:#ffffff;">Transferencia inmediata Bre-B (0% comisión)</strong><br />
        Llave Bre-B: <strong style="color:#55b7ff;">${escapeHtml(params.brebKey || '@bbbsp')}</strong><br />
        Recuerda registrar el número de comprobante desde tu cuenta o enviarlo por WhatsApp (302 800 0240) indicando el pedido <strong>${escapeHtml(params.orderNumber)}</strong>.
      </div>`
    : `<div style="margin:18px 0;padding:14px 16px;background:#0e223d;border:1px solid #1d4e89;border-radius:10px;font-size:13px;color:#cfe4ff;line-height:1.6;">
        <strong style="color:#ffffff;">Pago electrónico Wompi Colombia</strong><br />
        Tu pedido quedará confirmado automáticamente en cuanto Wompi apruebe la transacción.
      </div>`;

  const bodyHtml = `
    <h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;">¡Gracias por tu compra, ${escapeHtml(params.customerName)}!</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#c7d6ec;line-height:1.6;">
      Registramos tu pedido <strong style="color:#55b7ff;">${escapeHtml(params.orderNumber)}</strong> con destino a
      <strong>${escapeHtml(params.city)}, ${escapeHtml(params.department)}</strong>.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0;">
      ${itemsHtml}
      <tr>
        <td style="padding:10px 0 4px;font-size:13px;color:#8ba3c4;">Envío</td>
        <td align="right" style="padding:10px 0 4px;font-size:13px;color:#e6edf7;">
          ${params.shippingCop === 0 ? 'GRATIS' : formatCop(params.shippingCop)}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:15px;font-weight:700;color:#ffffff;">Total</td>
        <td align="right" style="padding:6px 0;font-size:16px;font-weight:800;color:#55b7ff;">
          ${formatCop(params.totalCop)}
        </td>
      </tr>
    </table>
    ${paymentBox}
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:11px 20px;background:#168bff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">
        Seguir mi pedido
      </a>
    </p>`;

  return sendTransactionalEmail({
    to: params.to,
    subject: `Confirmación de pedido ${params.orderNumber} — BSP Store`,
    html: wrapBspEmailHtml(
      `Pedido ${params.orderNumber}`,
      `Confirmación de tu compra en BSP Store por ${formatCop(params.totalCop)}`,
      bodyHtml
    ),
    text: `Gracias por tu compra en BSP Store. Pedido: ${params.orderNumber}. Total: ${formatCop(params.totalCop)}. Destino: ${params.city}, ${params.department}. Sigue tu pedido en: ${trackingUrl}`,
  });
}

export async function sendShipmentDispatchedEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  carrierName: string;
  trackingNumber: string;
  city: string;
  department: string;
}): Promise<EmailSendResult> {
  const trackingUrl = `${APP_URL}/seguimiento`;
  const bodyHtml = `
    <h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;">¡Tu pedido ya está en camino!</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#c7d6ec;line-height:1.6;">
      Hola ${escapeHtml(params.customerName)}, despachamos tu pedido <strong style="color:#55b7ff;">${escapeHtml(params.orderNumber)}</strong> hacia <strong>${escapeHtml(params.city)}, ${escapeHtml(params.department)}</strong>.
    </p>
    <div style="padding:16px;background:#0e223d;border:1px solid #1d4e89;border-radius:10px;font-size:13px;line-height:1.7;color:#e6edf7;">
      <strong>Empresa de envío:</strong> ${escapeHtml(params.carrierName)}<br />
      <strong>Número de guía:</strong> <span style="color:#4ade80;font-weight:700;">${escapeHtml(params.trackingNumber)}</span>
    </div>
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:11px 20px;background:#168bff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">
        Consultar estado de entrega
      </a>
    </p>`;

  return sendTransactionalEmail({
    to: params.to,
    subject: `Pedido ${params.orderNumber} despachado · Guía ${params.trackingNumber}`,
    html: wrapBspEmailHtml(
      `Pedido ${params.orderNumber} despachado`,
      `Guía ${params.trackingNumber} con ${params.carrierName}`,
      bodyHtml
    ),
    text: `Tu pedido ${params.orderNumber} fue despachado con ${params.carrierName}. Guía: ${params.trackingNumber}. Rastrea en: ${trackingUrl}`,
  });
}

export async function sendContactInquiryNotificationEmail(params: {
  name: string;
  email: string;
  topic: string;
  message: string;
}): Promise<EmailSendResult> {
  const bodyHtml = `
    <h1 style="margin:0 0 10px;font-size:18px;color:#ffffff;">Nueva consulta desde /contacto</h1>
    <p style="margin:0 0 12px;font-size:13px;color:#c7d6ec;line-height:1.6;">
      <strong>Nombre:</strong> ${escapeHtml(params.name)}<br />
      <strong>Correo:</strong> ${escapeHtml(params.email)}<br />
      <strong>Asunto:</strong> ${escapeHtml(params.topic)}
    </p>
    <div style="padding:14px;background:#0c1422;border:1px solid #223047;border-radius:8px;font-size:13px;color:#e6edf7;white-space:pre-wrap;">
      ${escapeHtml(params.message)}
    </div>`;

  return sendTransactionalEmail({
    to: ADMIN_NOTIFY_TO,
    replyTo: params.email,
    subject: `[Contacto BSP Store] ${params.topic} — ${params.name}`,
    html: wrapBspEmailHtml('Nueva consulta BSP Store', `${params.name}: ${params.topic}`, bodyHtml),
    text: `Consulta de ${params.name} (${params.email}) - ${params.topic}:\n\n${params.message}`,
  });
}
