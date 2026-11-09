'use client';

import { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { CartRows, EmptyCartState, OrderSummaryCard } from '@/components/cart/CartContent';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export default function CartPage() {
  const { cart, count, shippingCity, setShippingCity, setShipping } = useStore();
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState('');

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
            Los precios, cupones y costos de envío por municipio se validarán en el servidor en las
            Fases 4 y 5.
          </div>

          <div className="cart-layout">
            <div>
              <CartRows />
              <div className="cart-extras">
                <div>
                  <h3>¿Tienes un código de descuento?</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setCouponMessage(
                        coupon.trim()
                          ? 'Este código no está disponible actualmente.'
                          : 'Escribe un código para verificarlo.'
                      );
                    }}
                  >
                    <input
                      aria-label="Código de descuento"
                      placeholder="Escribe tu código"
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
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setShipping(shippingCity === 'Bogotá' ? 12000 : 18000);
                    }}
                  >
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
                  <p className="muted">Tarifa estimada según destino nacional.</p>
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
