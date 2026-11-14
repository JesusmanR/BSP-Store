'use client';

import { useState } from 'react';
import {
  colombiaDepartments,
  cop,
  getCitiesByDepartment,
  isLocalDeliveryDestination,
} from '@/data/catalog';
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
  const [selectedDepartment, setSelectedDepartment] = useState('Santander');
  const [shippingNote, setShippingNote] = useState(
    'Envío gratis en pedidos desde $ 500.000 COP · Domicilio Local en Bucaramanga y envíos nacionales.'
  );

  const citiesForDept = getCitiesByDepartment(selectedDepartment);

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
    const targetCity = shippingCity || citiesForDept[0] || selectedDepartment;
    if (!targetCity) return;
    try {
      const discount = appliedCoupon?.discountCop ?? 0;
      const res = await fetch('/api/v1/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: selectedDepartment,
          city: targetCity,
          subtotalCop: Math.max(0, subtotal - discount),
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setShipping(payload.data.shippingCop);
        const modeLabel = payload.data.isLocalDelivery
          ? 'Domicilio Local'
          : 'Envío Nacional Asegurado';
        setShippingNote(
          payload.data.freeShippingApplied
            ? `¡Envío gratis aplicado a ${payload.data.city}! Modalidad: ${modeLabel} (${payload.data.estimatedDaysMin} a ${payload.data.estimatedDaysMax} días hábiles)`
            : `${modeLabel} a ${payload.data.city}: ${cop(payload.data.shippingCop)} (${payload.data.estimatedDaysMin} a ${payload.data.estimatedDaysMax} días hábiles)`
        );
      }
    } catch {
      const local = isLocalDeliveryDestination(selectedDepartment, targetCity);
      setShipping(local ? 12000 : 18000);
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
            Usa tu código promocional (ej. <strong>BSPWELCOME10</strong>) y cotiza tu entrega por{' '}
            <strong>Domicilio Local</strong> o <strong>Envío Nacional</strong> según tu ubicación.
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
                  <h3>Calcula tu entrega</h3>
                  <form
                    onSubmit={handleCalculateShipping}
                    style={{ display: 'grid', gap: '8px' }}
                  >
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        aria-label="Departamento de destino"
                        value={selectedDepartment}
                        onChange={(e) => {
                          const dept = e.target.value;
                          setSelectedDepartment(dept);
                          const deptCities = getCitiesByDepartment(dept);
                          setShippingCity(deptCities[0] ?? '');
                          setShipping(null);
                        }}
                        style={{ flex: 1, minWidth: '140px' }}
                      >
                        {colombiaDepartments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label="Ciudad de destino"
                        required
                        value={shippingCity || citiesForDept[0] || ''}
                        onChange={(e) => {
                          setShippingCity(e.target.value);
                          setShipping(null);
                        }}
                        style={{ flex: 1, minWidth: '140px' }}
                      >
                        {citiesForDept.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <Button secondary type="submit">
                        Calcular
                      </Button>
                    </div>
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
