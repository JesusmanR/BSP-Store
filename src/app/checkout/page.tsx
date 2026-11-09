'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { colombiaDepartments, cop } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { EmptyCartState, OrderSummaryCard } from '@/components/cart/CartContent';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

const BREB_KEY = '@bbbsp';

const paymentOptions = [
  {
    id: 'BREB',
    label: 'Transferencia inmediata Bre-B (Llave @bbbsp · Sin costo)',
    icon: 'bolt',
  },
  {
    id: 'WOMPI_PSE',
    label: 'Wompi — PSE (Débito bancario)',
    icon: 'lock',
  },
  {
    id: 'WOMPI_CARD',
    label: 'Wompi — Tarjeta de crédito, débito u otro medio',
    icon: 'card',
  },
] as const;

type CreatedOrderResult = {
  order: {
    id: string;
    orderNumber: string;
    totalCop: number;
    status: string;
    paymentMethod: string;
  };
  brebInstructions?: {
    brebKey: string;
    amountCop: number;
    steps: string[];
  } | null;
  wompiSession?: {
    reference: string;
    checkoutUrl?: string;
    integritySignature: string;
    amountInCents: number;
  } | null;
};

export default function CheckoutPage() {
  const router = useRouter();
  const {
    user,
    cart,
    subtotal,
    shipping,
    setShipping,
    appliedCoupon,
    setAppliedCoupon,
    clearCart,
    setToast,
  } = useStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  const [payment, setPayment] = useState<'BREB' | 'WOMPI_PSE' | 'WOMPI_CARD'>('BREB');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CreatedOrderResult | null>(null);
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptSaved, setReceiptSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const parts = user.name.split(' ');
    if (!firstName) setFirstName(parts[0] ?? '');
    if (!lastName && parts.length > 1) setLastName(parts.slice(1).join(' '));
    if (!email) setEmail(user.email);
    if (!phone && user.phone) setPhone(user.phone);
  }, [user, firstName, lastName, email, phone]);

  const handleDepartmentChange = async (dept: string) => {
    setDepartment(dept);
    if (!city && dept === 'Bogotá D. C.') {
      setCity('Bogotá');
    }
    try {
      const discount = appliedCoupon?.discountCop ?? 0;
      const res = await fetch('/api/v1/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: dept,
          city: city || dept,
          subtotalCop: Math.max(0, subtotal - discount),
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setShipping(payload.data.shippingCop);
      }
    } catch {
      setShipping(dept === 'Bogotá D. C.' ? 12000 : 18000);
    }
  };

  const copyBrebKey = async () => {
    try {
      await navigator.clipboard.writeText(BREB_KEY);
      setToast(`Llave Bre-B ${BREB_KEY} copiada al portapapeles`);
    } catch {
      setToast(`Llave Bre-B: ${BREB_KEY}`);
    }
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: fullName,
          customerEmail: email,
          customerPhone: phone,
          department,
          city,
          streetAddress,
          additionalInfo: additionalInfo || undefined,
          paymentMethod: payment,
          couponCode: appliedCoupon?.code,
          items: cart.map((item) => ({
            productIdOrLegacyId: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        const firstIssue = payload?.error?.issues?.[0]?.message;
        setErrorMsg(
          firstIssue ?? payload?.error?.message ?? 'No fue posible registrar el pedido.'
        );
        return;
      }

      setCreatedOrder(payload.data);
      clearCart();
      setAppliedCoupon(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMsg('Error de red al procesar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBrebReceipt = async (e: FormEvent) => {
    e.preventDefault();
    if (!createdOrder) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${createdOrder.order.orderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferReceiptRef: receiptRef,
          customerEmail: email || undefined,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setReceiptSaved(true);
        setToast('Comprobante Bre-B registrado para verificación.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page checkout-page">
      <Breadcrumb current="Finalizar compra" />

      {createdOrder ? (
        <div className="confirmation">
          <div className="confirmation-check">
            <Icon name="check" size={43} />
          </div>
          <span className="eyebrow blue">
            PEDIDO REGISTRADO · {createdOrder.order.orderNumber}
          </span>
          <h1>¡Tu pedido ha sido creado!</h1>
          <p>
            Total verificado en servidor: <strong>{cop(createdOrder.order.totalCop)} COP</strong> ·
            Estado actual: <strong>{createdOrder.order.status}</strong>
          </p>

          {createdOrder.brebInstructions ? (
            <div
              className="breb-card"
              style={{ maxWidth: '580px', marginInline: 'auto', textAlign: 'left' }}
            >
              <strong>
                Completa tu transferencia sin comisión a la Llave Bre-B ({BREB_KEY}):
              </strong>
              <div className="breb-key-row">
                <span className="breb-key-badge">{BREB_KEY}</span>
                <button type="button" className="breb-copy-btn" onClick={copyBrebKey}>
                  <Icon name="copy" size={14} />
                  Copiar llave {BREB_KEY}
                </button>
              </div>
              <ol style={{ paddingLeft: '18px', marginTop: '8px', display: 'grid', gap: '6px' }}>
                {createdOrder.brebInstructions.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              {receiptSaved ? (
                <div className="auth-success" style={{ marginTop: '14px', marginBottom: 0 }}>
                  Comprobante <strong>{receiptRef}</strong> registrado. Nuestro equipo verificará la
                  transferencia para autorizar el despacho.
                </div>
              ) : (
                <form
                  onSubmit={handleRegisterBrebReceipt}
                  style={{ display: 'flex', gap: '8px', marginTop: '14px' }}
                >
                  <input
                    type="text"
                    required
                    minLength={4}
                    placeholder="Número de comprobante / referencia Bre-B"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #b9dcff',
                      background: '#fff',
                    }}
                  />
                  <Button type="submit" disabled={loading}>
                    Registrar comprobante
                  </Button>
                </form>
              )}
            </div>
          ) : (
            createdOrder.wompiSession && (
              <div className="demo-note" style={{ maxWidth: '580px', marginInline: 'auto' }}>
                <Icon name="lock" size={18} />
                <div>
                  <strong>Sesión Wompi generada con firma SHA256:</strong> Reference{' '}
                  <code>{createdOrder.wompiSession.reference}</code> · Firma{' '}
                  <code>{createdOrder.wompiSession.integritySignature.slice(0, 16)}...</code>
                </div>
              </div>
            )
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {createdOrder.wompiSession?.checkoutUrl && (
              <a
                href={createdOrder.wompiSession.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                Ir a pasarela segura Wompi
                <Icon name="arrow" size={18} />
              </a>
            )}
            <Button
              secondary={Boolean(createdOrder.wompiSession?.checkoutUrl)}
              onClick={() => {
                setCreatedOrder(null);
                router.push('/tienda');
              }}
            >
              Seguir explorando productos
              <Icon name="arrow" size={18} />
            </Button>
          </div>
        </div>
      ) : !cart.length ? (
        <EmptyCartState />
      ) : (
        <>
          <div className="page-heading">
            <span className="eyebrow blue">EL ÚLTIMO PASO HACIA TU NUEVO SETUP</span>
            <h1>
              Finalizar compra<span className="blue">.</span>
            </h1>
            <p>
              <Icon name="lock" size={15} /> Elige entre transferencia sin costo con Llave Bre-B (
              {BREB_KEY}) o pasarela Wompi (PSE, TC y otros medios).
            </p>
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}

          <form className="checkout-layout" onSubmit={handleCreateOrder}>
            <div className="checkout-fields">
              <section>
                <h3>
                  <span>01</span> Datos personales
                </h3>
                <div className="form-grid">
                  <Field
                    label="Nombre"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={setFirstName}
                  />
                  <Field
                    label="Apellidos"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={setLastName}
                  />
                  <Field
                    label="Correo electrónico"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={setEmail}
                  />
                  <Field
                    label="Teléfono"
                    type="tel"
                    required
                    pattern="[0-9+ ()-]{7,16}"
                    placeholder="300 123 4567"
                    autoComplete="tel"
                    value={phone}
                    onChange={setPhone}
                  />
                </div>
              </section>

              <section>
                <h3>
                  <span>02</span> Dirección de entrega
                </h3>
                <div className="form-grid">
                  <label className="field">
                    Departamento <span>*</span>
                    <select
                      required
                      value={department}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                    >
                      <option value="" disabled>
                        Selecciona un departamento
                      </option>
                      {colombiaDepartments.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Ciudad / municipio"
                    required
                    autoComplete="address-level2"
                    value={city}
                    onChange={setCity}
                  />
                  <Field
                    label="Dirección"
                    required
                    className="full-width"
                    placeholder="Calle, carrera, número, barrio"
                    autoComplete="street-address"
                    value={streetAddress}
                    onChange={setStreetAddress}
                  />
                  <label className="field full-width">
                    Información adicional{' '}
                    <textarea
                      placeholder="Apartamento, edificio o indicaciones para la entrega (opcional)"
                      rows={3}
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section>
                <h3>
                  <span>03</span> Opciones de envío
                </h3>
                <label className="shipping-option">
                  <input
                    type="radio"
                    name="shipping"
                    required
                    onChange={() => {
                      if (shipping === null) {
                        setShipping(department === 'Bogotá D. C.' ? 12000 : 18000);
                      }
                    }}
                    checked={shipping !== null}
                  />
                  <span>
                    <strong>Envío nacional asegurado</strong>
                    <small>
                      {shipping === 0
                        ? '¡Beneficio de envío gratis aplicado por monto de compra!'
                        : 'Tarifa calculada automáticamente según tu departamento en Colombia'}
                    </small>
                  </span>
                  <strong>
                    {shipping === null
                      ? cop(18000)
                      : shipping === 0
                        ? 'Gratis ($ 0)'
                        : cop(shipping)}
                  </strong>
                </label>
              </section>
            </div>

            <div>
              <div className="checkout-summary">
                <OrderSummaryCard checkout />

                <div className="payment-methods">
                  <h3>
                    <span>04</span> Método de pago
                  </h3>

                  {paymentOptions.map((m) => (
                    <label key={m.id} className={payment === m.id ? 'selected' : ''}>
                      <input
                        type="radio"
                        name="payment"
                        checked={payment === m.id}
                        onChange={() => setPayment(m.id)}
                      />
                      <Icon name={m.icon} size={20} />
                      {m.label}
                    </label>
                  ))}

                  {payment === 'BREB' ? (
                    <div className="breb-card" role="region" aria-label="Instrucciones Llave Bre-B">
                      <strong>Transferencia inmediata sin comisión con Llave Bre-B:</strong>
                      <div className="breb-key-row">
                        <span className="breb-key-badge">{BREB_KEY}</span>
                        <button type="button" className="breb-copy-btn" onClick={copyBrebKey}>
                          <Icon name="copy" size={14} />
                          Copiar llave {BREB_KEY}
                        </button>
                      </div>
                      <span>
                        Transfiere desde tu banco o billetera (Bancolombia, Nequi, Daviplata, Nu,
                        Davivienda, etc.) usando la llave <strong>{BREB_KEY}</strong>. Tu pedido
                        quedará pendiente de verificación del comprobante.
                      </span>
                    </div>
                  ) : (
                    <p className="muted">
                      Se generará tu sesión firmada con <strong>Wompi (SHA256)</strong> para
                      completar el pago con PSE, tarjeta de crédito/débito u otro medio habilitado.
                    </p>
                  )}

                  <label className="terms-check">
                    <input type="checkbox" required />
                    Acepto los términos, condiciones y la política de tratamiento de datos
                    personales.
                  </label>

                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner" />
                        Registrando pedido en servidor...
                      </>
                    ) : (
                      <>
                        {payment === 'BREB'
                          ? `Confirmar pedido con Llave ${BREB_KEY}`
                          : 'Confirmar y pagar con Wompi'}
                        <Icon name="arrow" size={18} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
