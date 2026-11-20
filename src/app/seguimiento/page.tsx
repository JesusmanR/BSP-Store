'use client';

import { useState, type FormEvent } from 'react';
import { cop, isLocalDeliveryDestination } from '@/data/catalog';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

type TrackedOrderData = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  department: string;
  city: string;
  streetAddress: string;
  totalCop: number;
  shippingCop: number;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    transferReceiptRef: string | null;
  }>;
  shipment: {
    status: string;
    trackingNumber: string | null;
    carrier: { name: string; code: string } | null;
  } | null;
};

const STATUS_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_BREB_VERIFICATION: {
    label: 'Pendiente de verificación de transferencia Bre-B',
    bg: '#fef3c7',
    color: '#92400e',
  },
  PENDING_PAYMENT: {
    label: 'Pendiente de confirmación de pago',
    bg: '#fef3c7',
    color: '#92400e',
  },
  PAID: {
    label: 'Pago confirmado · En preparación',
    bg: '#dbeafe',
    color: '#1e40af',
  },
  PROCESSING: {
    label: 'En alistamiento en bodega',
    bg: '#e0e7ff',
    color: '#3730a3',
  },
  SHIPPED: {
    label: 'Despachado / En camino',
    bg: '#dcfce7',
    color: '#166534',
  },
  DELIVERED: {
    label: 'Entregado satisfactoriamente',
    bg: '#dcfce7',
    color: '#166534',
  },
  CANCELLED: {
    label: 'Cancelado',
    bg: '#fee2e2',
    color: '#991b1b',
  },
};

export default function OrderTrackingPage() {
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [order, setOrder] = useState<TrackedOrderData | null>(null);

  const handleTrack = async (e: FormEvent) => {
    e.preventDefault();
    const cleanNum = orderNumberInput.trim().toUpperCase();
    if (!cleanNum) {
      setErrorMsg('Ingresa tu número de pedido para consultarlo.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setOrder(null);
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(cleanNum)}`, {
        cache: 'no-store',
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        setErrorMsg(
          payload?.error?.message ??
            'No encontramos un pedido con ese número. Verifica que esté bien escrito (ej. BSP-2026-...).'
        );
        return;
      }
      setOrder(payload.data.order as TrackedOrderData);
    } catch {
      setErrorMsg('No fue posible consultar el estado del pedido en este momento.');
    } finally {
      setLoading(false);
    }
  };

  const isLocal = order ? isLocalDeliveryDestination(order.department, order.city) : false;
  const statusInfo = order
    ? (STATUS_BADGES[order.status] ?? {
        label: order.status,
        bg: '#f1f5f9',
        color: '#334155',
      })
    : null;
  const carrierName = order
    ? (order.shipment?.carrier?.name ??
      (isLocal ? 'Domicilio Local (Bucaramanga)' : 'Transportadora Nacional'))
    : '';
  const trackingNumber = order?.shipment?.trackingNumber || 'En asignación por bodega';

  return (
    <div className="container page">
      <Breadcrumb current="Sigue tu pedido" />
      <div className="page-heading">
        <span className="eyebrow blue">RASTREO EN TIEMPO REAL · LOCAL Y NACIONAL</span>
        <h1>
          Sigue tu pedido<span className="blue">.</span>
        </h1>
        <p>
          Ingresa el número de tu pedido para consultar si tu entrega es local o nacional, la
          empresa transportadora y tu número de guía.
        </p>
      </div>

      <div
        className="account-card"
        style={{
          maxWidth: '760px',
          margin: '0 auto 32px',
          padding: '28px 32px',
        }}
      >
        <form
          onSubmit={handleTrack}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <label className="field" style={{ flex: 1, minWidth: '240px', margin: 0 }}>
            Número de pedido <span>*</span>
            <input
              required
              placeholder="Ej. BSP-2026-..."
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value.toUpperCase())}
            />
          </label>
          <Button type="submit" disabled={loading}>
            <Icon name="search" size={18} />
            {loading ? 'Consultando...' : 'Consultar pedido'}
          </Button>
        </form>

        {errorMsg && (
          <div className="auth-error" role="alert" style={{ marginTop: '18px', marginBottom: 0 }}>
            {errorMsg}
          </div>
        )}
      </div>

      {order && statusInfo && (
        <div
          className="account-card"
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            padding: '28px 32px',
            display: 'grid',
            gap: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--line, #e2e8f0)',
            }}
          >
            <div>
              <span className="eyebrow blue">PEDIDO LOCALIZADO</span>
              <h2 style={{ fontSize: '24px', marginTop: '4px' }}>{order.orderNumber}</h2>
            </div>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                background: statusInfo.bg,
                color: statusInfo.color,
              }}
            >
              {statusInfo.label}
            </span>
          </div>

          {/* 4 Tarjetas informativas: Modalidad (Local/Nacional), Empresa de envío, Número de guía y Destino */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '14px',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--line, #e2e8f0)',
              }}
            >
              <span className="eyebrow" style={{ color: '#64748b' }}>
                MODALIDAD DE ENTREGA
              </span>
              <strong style={{ display: 'block', fontSize: '15px', marginTop: '6px', color: '#168BFF' }}>
                {isLocal ? 'Domicilio Local' : 'Envío Nacional Asegurado'}
              </strong>
              <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                {isLocal
                  ? 'Entrega directa en Bucaramanga y Área Metropolitana'
                  : 'Despacho asegurado a nivel nacional'}
              </small>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--line, #e2e8f0)',
              }}
            >
              <span className="eyebrow" style={{ color: '#64748b' }}>
                EMPRESA DE ENVÍO
              </span>
              <strong style={{ display: 'block', fontSize: '15px', marginTop: '6px' }}>
                {carrierName}
              </strong>
              <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                {isLocal ? 'Mensajería propia BSP Store' : 'Transportadora aliada'}
              </small>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--line, #e2e8f0)',
              }}
            >
              <span className="eyebrow" style={{ color: '#64748b' }}>
                NÚMERO DE GUÍA
              </span>
              <strong
                style={{
                  display: 'block',
                  fontSize: '15px',
                  marginTop: '6px',
                  color: order.shipment?.trackingNumber ? '#16a34a' : 'inherit',
                }}
              >
                {trackingNumber}
              </strong>
              <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                Destino: {order.city}, {order.department}
              </small>
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid var(--line, #e2e8f0)',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>
                <strong>Productos del pedido:</strong>{' '}
                {order.items.map((it) => `${it.productName} (x${it.quantity})`).join(', ')}
              </span>
              <strong>Total: {cop(order.totalCop)} COP</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Fecha de compra: {new Date(order.createdAt).toLocaleDateString('es-CO')} · Ciudad de
              entrega: {order.city} ({order.department})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
