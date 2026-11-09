'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, shipping, setShipping, clearCart, setToast } = useStore();

  const [payment, setPayment] = useState<string>('BREB');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copyBrebKey = async () => {
    try {
      await navigator.clipboard.writeText(BREB_KEY);
      setToast(`Llave Bre-B ${BREB_KEY} copiada al portapapeles`);
    } catch {
      setToast(`Llave Bre-B: ${BREB_KEY}`);
    }
  };

  return (
    <div className="container page checkout-page">
      <Breadcrumb current="Finalizar compra" />

      {confirmed ? (
        <div className="confirmation">
          <div className="confirmation-check">
            <Icon name="check" size={43} />
          </div>
          <span className="eyebrow blue">FLUJO DE INTERFAZ COMPLETADO</span>
          <h1>¡Tu setup está un paso más cerca!</h1>
          <p>
            {payment === 'BREB'
              ? `Elegiste Transferencia Inmediata Bre-B con la llave ${BREB_KEY} (sin costos adicionales).`
              : 'Elegiste pago mediante la pasarela segura Wompi (PSE / Tarjetas).'}
          </p>
          <div className="demo-note">
            En la Fase 5 este paso registrará el pedido en PostgreSQL 17 y activará la verificación
            real del pago (Webhook Wompi o validación de transferencia a la llave {BREB_KEY}).
          </div>
          <Button
            onClick={() => {
              setConfirmed(false);
              router.push('/tienda');
            }}
          >
            Volver a la tienda
            <Icon name="arrow" size={18} />
          </Button>
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

          <div className="demo-note">
            <Icon name="shield" size={18} />
            Vista de Checkout migrada en Fase 3. La persistencia transaccional y conexión en vivo
            con Wompi y Bre-B ({BREB_KEY}) se activan en las Fases 4 y 5.
          </div>

          <form
            className="checkout-layout"
            onSubmit={(e) => {
              e.preventDefault();
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                setConfirmed(true);
                clearCart();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 900);
            }}
          >
            <div className="checkout-fields">
              <section>
                <h3>
                  <span>01</span> Datos personales
                </h3>
                <div className="form-grid">
                  <Field label="Nombre" required autoComplete="given-name" />
                  <Field label="Apellidos" required autoComplete="family-name" />
                  <Field
                    label="Correo electrónico"
                    type="email"
                    required
                    autoComplete="email"
                  />
                  <Field
                    label="Teléfono"
                    type="tel"
                    required
                    pattern="[0-9+ ()-]{7,16}"
                    placeholder="300 123 4567"
                    autoComplete="tel"
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
                    <select required defaultValue="">
                      <option value="" disabled>
                        Selecciona un departamento
                      </option>
                      {colombiaDepartments.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <Field label="Ciudad / municipio" required autoComplete="address-level2" />
                  <Field
                    label="Dirección"
                    required
                    className="full-width"
                    placeholder="Calle, carrera, número, barrio"
                    autoComplete="street-address"
                  />
                  <label className="field full-width">
                    Información adicional{' '}
                    <textarea
                      placeholder="Apartamento, edificio o indicaciones para la entrega (opcional)"
                      rows={3}
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
                    onChange={() => setShipping(18000)}
                    checked={shipping === 18000}
                  />
                  <span>
                    <strong>Envío nacional estándar</strong>
                    <small>Tiempo de entrega por confirmar con la transportadora asignada</small>
                  </span>
                  <strong>{cop(18000)}</strong>
                </label>
                <p className="muted">
                  El módulo configurable de zonas y tarifas de envío por departamento se conecta en
                  la Fase 5.
                </p>
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
                        <button
                          type="button"
                          className="breb-copy-btn"
                          onClick={copyBrebKey}
                        >
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
                      Serás redirigido de forma segura a <strong>Wompi</strong> para completar tu
                      pago con PSE, tarjeta de crédito/débito u otro medio habilitado.
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
                        Procesando pedido...
                      </>
                    ) : (
                      <>
                        {payment === 'BREB'
                          ? `Confirmar pedido con Llave ${BREB_KEY}`
                          : 'Continuar al pago con Wompi'}
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
