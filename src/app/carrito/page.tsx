'use client';

import { useState } from 'react';
import { cop } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { CartRows, EmptyCartState, OrderSummaryCard } from '@/components/cart/CartContent';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function CartPage() {
  const {
    cart,
    count,
    subtotal,
    shippingCity,
    setShippingCity,
    setShipping,
    appliedCoupon,
    setAppliedCoupon,
  } = useStore();
  const [coupon, setCoupon] = useState(appliedCoupon?.code ?? '');
  const [couponMessage, setCouponMessage] = useState('');
  const [shippingNote, setShippingNote] = useState(
    'Envío gratis en pedidos desde $ 500.000 COP.'
  );

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupon.trim()) {
      setCouponMessage('Escribe un código para verificarlo.');
      return;
    }
    try {
      const res = await fetch('/api/v1/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon.trim(), subtotalCop: subtotal }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setAppliedCoupon(null);
        setCouponMessage(payload?.error?.message ?? 'Cupón no válido.');
        return;
      }
      setAppliedCoupon({
        code: payload.data.code,
        discountCop: payload.data.discountCop,
        description: payload.data.description,
      });
      setCouponMessage(
        `¡Cupón ${payload.data.code} aplicado! Descuento de ${cop(payload.data.discountCop)}.`
      );
    } catch {
      setCouponMessage('No fue posible verificar el cupón en este momento.');
    }
  };

  const handleCalculateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingCity) return;
    try {
      const discount = appliedCoupon?.discountCop ?? 0;
      const res = await fetch('/api/v1/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: shippingCity,
          city: shippingCity,
          subtotalCop: Math.max(0, subtotal - discount),
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setShipping(payload.data.shippingCop);
        setShippingNote(
          payload.data.freeShippingApplied
            ? `¡Envío gratis aplicado a ${payload.data.city}! (${payload.data.estimatedDaysMin} a ${payload.data.estimatedDaysMax} días hábiles)`
            : `Tarifa a ${payload.data.city}: ${cop(payload.data.shippingCop)} (${payload.data.estimatedDaysMin} a ${payload.data.estimatedDaysMax} días hábiles)`
        );
      }
    } catch {
      setShipping(shippingCity === 'Bogotá' ? 12000 : 18000);
    }
  };

  return (
    <div className="container page">
      <Breadcrumb current="Mi carrito" />
      <div className="page-heading">
        <span className="eyebrow blue">UN PASO MÁS CERCA DE TU SETUP</span>
        <h1>
          Mi carrito<span className="blue">.</span>
          <small>{count} productos</small>
        </h1>
      </div>

      {!cart.length ? (
        <EmptyCartState />
      ) : (
        <>
          <div className="demo-note">
            <Icon name="shield" size={18} />
            Precios, cupones (ej. <strong>BSPWELCOME10</strong>) y tarifas de envío validados en
            tiempo real contra PostgreSQL 17.
          </div>

          <div className="cart-layout">
            <div>
              <CartRows />
              <div className="cart-extras">
                <div>
                  <h3>¿Tienes un código de descuento?</h3>
                  <form onSubmit={handleApplyCoupon}>
                    <input
                      aria-label="Código de descuento"
                      placeholder="Ej. BSPWELCOME10"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value)}
                    />
                    <Button secondary type="submit">
                      Aplicar
                    </Button>
                  </form>
                  {couponMessage && (
                    <p className="field-message" role="status">
                      {couponMessage}
                    </p>
                  )}
                </div>

                <div>
                  <h3>Calcula tu envío</h3>
                  <form onSubmit={handleCalculateShipping}>
                    <select
                      aria-label="Ciudad de destino"
                      required
                      value={shippingCity}
                      onChange={(e) => {
                        setShippingCity(e.target.value);
                        setShipping(null);
                      }}
                    >
                      <option value="">Selecciona tu ciudad</option>
                      {['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Otra ciudad'].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <Button secondary type="submit">
                      Calcular
                    </Button>
                  </form>
                  <p className="muted">{shippingNote}</p>
                </div>
              </div>
            </div>

            <OrderSummaryCard />
          </div>
        </>
      )}
    </div>
  );
}
