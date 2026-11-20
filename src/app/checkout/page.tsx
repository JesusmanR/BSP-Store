'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  colombiaDepartments,
  cop,
  getCitiesByDepartment,
  isLocalDeliveryDestination,
  NATIONAL_CARRIERS,
} from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { EmptyCartState, OrderSummaryCard } from '@/components/cart/CartContent';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import type { SavedAddress } from '@/app/cuenta/page';

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

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_BREB_VERIFICATION: 'Pendiente de verificación de transferencia Bre-B',
  PENDING_PAYMENT: 'Pendiente de confirmación de pago',
  PAID: 'Pagado',
  PROCESSING: 'En alistamiento',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
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
  const [department, setDepartment] = useState('Santander');
  const [city, setCity] = useState('Bucaramanga');
  const [streetAddress, setStreetAddress] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Direcciones guardadas del cliente
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('NEW');
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [newAddressLabel, setNewAddressLabel] = useState('Casa');

  const [payment, setPayment] = useState<'BREB' | 'WOMPI_PSE' | 'WOMPI_CARD'>('BREB');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CreatedOrderResult | null>(null);
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptSaved, setReceiptSaved] = useState(false);

  const availableCities = getCitiesByDepartment(department);
  const isLocalDelivery = isLocalDeliveryDestination(department, city);

  const quoteShipping = useCallback(
    async (dept: string, targetCity: string) => {
      if (!dept) return;
      try {
        const discount = appliedCoupon?.discountCop ?? 0;
        const res = await fetch('/api/v1/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department: dept,
            city: targetCity || dept,
            subtotalCop: Math.max(0, subtotal - discount),
          }),
        });
        const payload = await res.json();
        if (res.ok && payload.ok) {
          setShipping(payload.data.shippingCop);
          return;
        }
      } catch {
        // Fallback local/nacional
      }
      setShipping(isLocalDeliveryDestination(dept, targetCity) ? 12000 : 18000);
    },
    [appliedCoupon?.discountCop, setShipping, subtotal]
  );

  const applySavedAddress = useCallback(
    (addr: SavedAddress) => {
      setSelectedAddressId(addr.id);
      const nameParts = addr.recipientName.trim().split(/\s+/);
      setFirstName(nameParts[0] ?? '');
      setLastName(nameParts.slice(1).join(' ') || (nameParts[0] ?? ''));
      setPhone(addr.phone.replace(/\D/g, '').slice(-10));
      setDepartment(addr.department);
      const deptCities = getCitiesByDepartment(addr.department);
      const resolvedCity = deptCities.includes(addr.city)
        ? addr.city
        : (addr.city || deptCities[0] || addr.department);
      setCity(resolvedCity);
      setStreetAddress(addr.streetAddress);
      setAdditionalInfo(addr.additionalInfo ?? '');
      void quoteShipping(addr.department, resolvedCity);
    },
    [quoteShipping]
  );

  // Cargar datos del usuario y sus direcciones guardadas al abrir Checkout
  useEffect(() => {
    if (!user) {
      void quoteShipping(department, city);
      return;
    }

    const parts = user.name.trim().split(/\s+/);
    setFirstName((prev) => prev || (parts[0] ?? ''));
    setLastName((prev) => prev || (parts.slice(1).join(' ') || (parts[0] ?? '')));
    setEmail((prev) => prev || user.email);
    if (user.phone) {
      setPhone((prev) => prev || user.phone || '');
    }

    let active = true;
    fetch('/api/v1/addresses', { cache: 'no-store' })
      .then((res) => res.json())
      .then((payload) => {
        if (!active || !payload?.ok) return;
        const list: SavedAddress[] = payload.data.addresses ?? [];
        setSavedAddresses(list);
        if (list.length > 0) {
          const preferred = list.find((a) => a.isDefault) ?? list[0]!;
          applySavedAddress(preferred);
        } else {
          void quoteShipping('Santander', 'Bucaramanga');
        }
      })
      .catch(() => {
        void quoteShipping('Santander', 'Bucaramanga');
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDepartmentChange = async (dept: string) => {
    setDepartment(dept);
    const cities = getCitiesByDepartment(dept);
    const defaultCity = cities[0] ?? dept;
    setCity(defaultCity);
    await quoteShipping(dept, defaultCity);
  };

  const handleCityChange = async (newCity: string) => {
    setCity(newCity);
    await quoteShipping(department, newCity);
  };

  const handleSelectSavedAddress = (addrId: string) => {
    if (addrId === 'NEW') {
      setSelectedAddressId('NEW');
      setStreetAddress('');
      setAdditionalInfo('');
      return;
    }
    const found = savedAddresses.find((a) => a.id === addrId);
    if (found) {
      applySavedAddress(found);
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

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg('El teléfono celular debe tener exactamente 10 dígitos numéricos (ej. 3028000240).');
      return;
    }

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // Si el usuario autenticado ingresó una dirección nueva y pidió guardarla
      if (user && selectedAddressId === 'NEW' && saveNewAddress && streetAddress.trim()) {
        await fetch('/api/v1/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: newAddressLabel.trim() || 'Principal',
            recipientName: fullName,
            phone,
            department,
            city,
            streetAddress,
            additionalInfo: additionalInfo || undefined,
            isDefault: savedAddresses.length === 0,
          }),
        }).catch(() => null);
      }

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
      setErrorMsg('Error de conexión al procesar el pedido. Intenta nuevamente.');
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
            PEDIDO CONFIRMADO · {createdOrder.order.orderNumber}
          </span>
          <h1>¡Tu pedido ha sido creado!</h1>
          <p>
            Total del pedido: <strong>{cop(createdOrder.order.totalCop)} COP</strong> · Estado:{' '}
            <strong>
              {ORDER_STATUS_LABELS[createdOrder.order.status] ?? createdOrder.order.status}
            </strong>
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
                  Comprobante <strong>{receiptRef}</strong> recibido. Nuestro equipo verificará la
                  transferencia para autorizar la entrega.
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
                    className="breb-receipt-input"
                    placeholder="Número de comprobante / referencia Bre-B"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                  />
                  <Button type="submit" disabled={loading}>
                    Enviar comprobante
                  </Button>
                </form>
              )}
            </div>
          ) : (
            createdOrder.wompiSession && (
              <div className="demo-note" style={{ maxWidth: '580px', marginInline: 'auto' }}>
                <Icon name="lock" size={18} />
                <div>
                  <strong>Orden lista para pago en Wompi:</strong> Referencia{' '}
                  <code>{createdOrder.wompiSession.reference}</code>
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
                Continuar a pasarela segura Wompi
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
              <Icon name="lock" size={15} /> Elige entre transferencia inmediata sin costo con
              Llave Bre-B ({BREB_KEY}) o pasarela Wompi (PSE, tarjetas y otros medios).
            </p>
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}

          <form className="checkout-layout" onSubmit={handleCreateOrder}>
            <div className="checkout-fields">
              {!user && (
                <div
                  className="demo-note"
                  style={{
                    marginBottom: '20px',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="check" size={18} />
                    <span>
                      <strong>Compra rápida como invitado:</strong> No necesitas crear una cuenta
                      para finalizar tu pedido.
                    </span>
                  </span>
                  <Link
                    href="/cuenta"
                    style={{ color: '#168BFF', fontWeight: 700, fontSize: '12px' }}
                  >
                    ¿Ya tienes cuenta? Inicia sesión →
                  </Link>
                </div>
              )}

              <section>
                <h3>
                  <span>01</span> Datos de quien recibe
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
                  <label className="field">
                    Teléfono celular (10 dígitos) <span>*</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={10}
                      minLength={10}
                      pattern="[0-9]{10}"
                      placeholder="3028000240"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                    {phone.length > 0 && phone.length < 10 && (
                      <small className="checkout-phone-hint">
                        Ingresa los 10 dígitos de tu celular ({phone.length}/10)
                      </small>
                    )}
                  </label>
                </div>
              </section>

              <section>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <h3 style={{ marginBottom: 0 }}>
                    <span>02</span> Dirección de entrega
                  </h3>
                  {user && (
                    <Link
                      href="/cuenta"
                      style={{ fontSize: '12px', color: '#168BFF', fontWeight: 700 }}
                    >
                      Gestionar mis direcciones →
                    </Link>
                  )}
                </div>

                {/* Selector de direcciones guardadas si el cliente tiene direcciones */}
                {user && savedAddresses.length > 0 && (
                  <div
                    style={{
                      marginBottom: '18px',
                      display: 'grid',
                      gap: '10px',
                    }}
                  >
                    <span className="checkout-saved-heading">
                      Selecciona una de tus direcciones guardadas:
                    </span>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        const addrLocal = isLocalDeliveryDestination(addr.department, addr.city);
                        return (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => handleSelectSavedAddress(addr.id)}
                            className={`checkout-saved-card ${isSelected ? 'is-selected' : ''}`}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <strong>{addr.label}</strong>
                              <span
                                className={`checkout-saved-badge ${addrLocal ? 'is-local' : ''}`}
                              >
                                {addrLocal ? 'Domicilio Local' : 'Nacional'}
                              </span>
                            </div>
                            <span className="checkout-saved-street">{addr.streetAddress}</span>
                            <small className="checkout-saved-city">
                              {addr.city}, {addr.department}
                            </small>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => handleSelectSavedAddress('NEW')}
                        className={`checkout-new-address-btn ${
                          selectedAddressId === 'NEW' ? 'is-selected' : ''
                        }`}
                      >
                        <Icon name="plus" size={16} />
                        Usar otra dirección
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-grid">
                  <label className="field">
                    Departamento <span>*</span>
                    <select
                      aria-label="Departamento"
                      required
                      value={department}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                    >
                      <option value="" disabled>
                        Selecciona un departamento
                      </option>
                      {colombiaDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    Ciudad / municipio <span>*</span>
                    <select
                      aria-label="Ciudad / municipio"
                      required
                      value={city}
                      onChange={(e) => handleCityChange(e.target.value)}
                    >
                      {availableCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Field
                    label="Dirección exacta"
                    required
                    className="full-width"
                    placeholder="Calle, carrera, número, conjunto o barrio"
                    autoComplete="street-address"
                    value={streetAddress}
                    onChange={setStreetAddress}
                  />
                  <label className="field full-width">
                    Indicaciones adicionales{' '}
                    <textarea
                      placeholder="Apartamento, torre, portería o referencias para la entrega (opcional)"
                      rows={2}
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                    />
                  </label>

                  {user && selectedAddressId === 'NEW' && (
                    <div className="full-width checkout-save-address">
                      <label className="checkout-save-address-label">
                        <input
                          type="checkbox"
                          checked={saveNewAddress}
                          onChange={(e) => setSaveNewAddress(e.target.checked)}
                        />
                        <span>Guardar esta dirección en mi cuenta como:</span>
                      </label>
                      {saveNewAddress && (
                        <input
                          type="text"
                          className="checkout-save-address-input"
                          value={newAddressLabel}
                          onChange={(e) => setNewAddressLabel(e.target.value)}
                          placeholder="Casa, Oficina..."
                        />
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3>
                  <span>03</span> Modalidad de entrega
                </h3>
                <label className="shipping-option">
                  <input
                    type="radio"
                    name="shipping"
                    required
                    onChange={() => {
                      if (shipping === null) {
                        setShipping(isLocalDelivery ? 12000 : 18000);
                      }
                    }}
                    checked={shipping !== null}
                  />
                  <span>
                    <strong>
                      {isLocalDelivery ? 'Domicilio Local' : 'Envío Nacional Asegurado'}
                    </strong>
                    <small>
                      {shipping === 0
                        ? `¡Envío gratis aplicado por monto de compra! (${
                            isLocalDelivery
                              ? 'Domicilio directo 1 a 2 días hábiles'
                              : `Transportadora nacional: ${NATIONAL_CARRIERS.join(', ')}`
                          })`
                        : isLocalDelivery
                          ? `Entrega directa a domicilio en ${city} (1 a 2 días hábiles · Sin intermediación de transportadoras nacionales)`
                          : `Despacho asegurado hacia ${city}, ${department} (2 a 5 días hábiles vía ${NATIONAL_CARRIERS.join(', ')})`}
                    </small>
                  </span>
                  <strong>
                    {shipping === null
                      ? cop(isLocalDelivery ? 12000 : 18000)
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
                        Davivienda, etc.) usando la llave <strong>{BREB_KEY}</strong>. Al confirmar
                        podrás adjuntar el número de comprobante.
                      </span>
                    </div>
                  ) : (
                    <p className="muted">
                      Serás dirigido de forma segura a <strong>Wompi Colombia</strong> para
                      completar el pago con PSE, tarjeta de crédito/débito u otro medio habilitado.
                    </p>
                  )}

                  <label className="terms-check">
                    <input type="checkbox" required />
                    <span>
                      Acepto los{' '}
                      <Link
                        href="/terminos"
                        target="_blank"
                        style={{ color: '#168BFF', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Términos y Condiciones (Ley 1480 de 2011)
                      </Link>{' '}
                      y autorizo el tratamiento de mis datos conforme a la{' '}
                      <Link
                        href="/privacidad"
                        target="_blank"
                        style={{ color: '#168BFF', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        Política de Datos Personales (Ley 1581 de 2012)
                      </Link>
                      .
                    </span>
                  </label>

                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner" />
                        Procesando tu pedido...
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
