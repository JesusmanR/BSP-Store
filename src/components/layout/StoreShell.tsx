'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { cop } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { CartRows, EmptyCartState } from '@/components/cart/CartContent';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

const navItems = ['Inicio', 'Tienda', 'Categorías', 'Ofertas', 'Marcas', 'Contacto'] as const;

export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    cart,
    favorites,
    count,
    subtotal,
    query,
    setQuery,
    setCategory,
    setStockFilter,
    drawer,
    setDrawer,
    modal,
    setModal,
    toast,
  } = useStore();

  const [menu, setMenu] = useState(false);

  const isHome = pathname === '/';
  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    setMenu(false);
    setDrawer(false);
  }, [pathname, setDrawer]);

  useEffect(() => {
    document.body.style.overflow = drawer || modal ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer, modal]);

  useEffect(() => {
    if (!drawer && !modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]'
        ) || []
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();

    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [drawer, modal]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(false);
        setModal('');
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [setDrawer, setModal]);

  const handleNav = (name: (typeof navItems)[number]) => {
    setMenu(false);
    if (name === 'Inicio') {
      router.push('/');
    } else if (name === 'Categorías') {
      if (!isHome) {
        router.push('/#categorias');
      } else {
        document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (name === 'Marcas') {
      if (!isHome) {
        router.push('/#marcas');
      } else {
        document.getElementById('marcas')?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (name === 'Tienda') {
      setCategory('Todas');
      setQuery('');
      setStockFilter(false);
      router.push('/tienda');
    } else {
      router.push('/' + name.toLowerCase());
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setCategory('Todas');
    setStockFilter(false);
    router.push('/tienda');
  };

  if (isAdminRoute) {
    return (
      <div className="app admin-app-shell">
        {children}
        {toast && (
          <div className="toast" role="status">
            <Icon name="check" size={18} />
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="announcement">
        <div className="container">
          <span>
            <Icon name="truck" size={15} /> Tecnología que llega a todo Colombia
          </span>
          <span className="announcement-right">
            {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
              <>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1"
                  style={{ color: '#55b7ff', fontWeight: 700 }}
                >
                  <Icon name="shield" size={13} /> Panel Admin
                </Link>
                <span className="announcement-divider">|</span>
              </>
            )}
            El siguiente nivel empieza aquí <span className="announcement-divider">|</span>
            <Link href="/contacto" className="inline-flex items-center gap-2">
              ¿Necesitas ayuda? <Icon name="arrow" size={13} />
            </Link>
          </span>
        </div>
      </div>

      <header>
        <div className="main-header container">
          <button
            type="button"
            className="mobile-menu icon-button"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? 'close' : 'menu'} />
          </button>

          <Link href="/" aria-label="BSP Store, inicio">
            <Logo />
          </Link>

          <form className="header-search" onSubmit={handleSearch}>
            <input
              aria-label="Buscar productos"
              placeholder="¿Qué le falta a tu setup?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" aria-label="Buscar">
              <Icon name="search" size={21} />
            </button>
          </form>

          <div className="header-actions">
            <Link href="/cuenta" className="account-button" aria-label="Mi cuenta">
              <Icon name="user" />
              <span>
                {user ? `Hola, ${user.name.split(' ')[0]}` : 'Hola, bienvenido'}
                <strong>{user ? 'Mi perfil' : 'Iniciar sesión'}</strong>
              </span>
            </Link>

            <Link
              href="/favoritos"
              className="icon-button heart-header"
              aria-label="Mis favoritos"
            >
              <Icon name="heart" />
              {favorites.length > 0 && <span className="counter">{favorites.length}</span>}
            </Link>

            <span className="header-action-line" />

            <button
              type="button"
              className="cart-header"
              aria-label={`Abrir carrito, ${count} productos`}
              onClick={() => setDrawer(true)}
            >
              <span className="cart-icon">
                <Icon name="cart" />
                <span className="counter">{count}</span>
              </span>
              <span>
                Mi carrito<strong>{cop(subtotal)}</strong>
              </span>
            </button>
          </div>
        </div>

        <div className={`nav-border ${menu ? 'menu-open' : ''}`}>
          <nav className="container navigation" aria-label="Navegación principal">
            <div className="nav-links">
              {navItems.map((n) => (
                <button
                  type="button"
                  key={n}
                  className={
                    (isHome && n === 'Inicio') || pathname === '/' + n.toLowerCase()
                      ? 'active'
                      : ''
                  }
                  onClick={() => handleNav(n)}
                >
                  {n === 'Categorías' && <Icon name="grid" size={16} />}
                  {n}
                  {n === 'Categorías' && <Icon name="down" size={13} />}
                  {n === 'Ofertas' && <span className="nav-dot" />}
                </button>
              ))}
            </div>
            <Link href="/contacto" className="nav-advice">
              <Icon name="chat" size={17} />
              Asesoría para tu setup
              <Icon name="arrow" size={15} />
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <section className="prefooter">
        <div className="container">
          <div className="prefooter-icon">
            <Icon name="headphones" size={31} />
          </div>
          <div>
            <h3>¿Listo para dar el siguiente paso?</h3>
            <p>Encuentra la tecnología ideal con una asesoría a tu medida.</p>
          </div>
          <button type="button" onClick={() => router.push('/contacto')}>
            Hablemos de tu setup
            <Icon name="arrow" size={20} />
          </button>
        </div>
      </section>

      <footer>
        <div className="container footer-main">
          <div className="footer-about">
            <Link href="/" aria-label="BSP Store Inicio">
              <Logo light />
            </Link>
            <p>
              Tecnología que impulsa tu experiencia.
              <br />
              Tu próximo nivel empieza con nosotros.
            </p>
            <div className="footer-socials">
              <button
                type="button"
                aria-label="Canales sociales"
                onClick={() => setModal('Redes sociales')}
              >
                <Icon name="instagram" size={19} />
              </button>
              <button
                type="button"
                aria-label="Contacto"
                onClick={() => router.push('/contacto')}
              >
                <Icon name="chat" size={19} />
              </button>
              <a
                href="https://bspstore.com.co/inicio/"
                target="_blank"
                rel="noreferrer"
                aria-label="Visitar BSP Store"
              >
                <Icon name="arrow" size={19} />
              </a>
            </div>
          </div>

          <div>
            <h4>Explora BSP STORE</h4>
            <button type="button" onClick={() => handleNav('Tienda')}>
              Todos los productos
            </button>
            <button type="button" onClick={() => handleNav('Categorías')}>
              Categorías
            </button>
            <button type="button" onClick={() => router.push('/ofertas')}>
              Ofertas y novedades
            </button>
            <button type="button" onClick={() => handleNav('Marcas')}>
              Nuestras marcas
            </button>
          </div>

          <div>
            <h4>Estamos para ayudarte</h4>
            <button type="button" onClick={() => router.push('/contacto')}>
              Contacto y asesoría
            </button>
            <button type="button" onClick={() => router.push('/contacto')}>
              Preguntas frecuentes
            </button>
            <button type="button" onClick={() => setModal('Envíos y entregas')}>
              Envíos y entregas
            </button>
            <button type="button" onClick={() => setModal('Garantías y devoluciones')}>
              Garantías y devoluciones
            </button>
          </div>

          <div>
            <h4>Compra con tranquilidad</h4>
            <p>
              Una experiencia pensada para ti.
              <br />
              Información clara, de principio a fin.
            </p>
            <div className="footer-payments">
              <span>Bre-B @bbbsp</span>
              <span>VISA</span>
              <span className="mastercard">
                <i />
                <i />
              </span>
              <span>pse</span>
            </div>
            <span className="footer-secure">
              <Icon name="lock" size={13} />
              Pagos seguros vía Wompi y Llave Bre-B (@bbbsp)
            </span>
          </div>
        </div>

        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} BSP STORE. Propuesta de experiencia digital.</span>
          <div>
            <button type="button" onClick={() => setModal('Política de privacidad')}>
              Privacidad
            </button>
            <button type="button" onClick={() => setModal('Términos y condiciones')}>
              Términos y condiciones
            </button>
            <span>Hecho para tu próximo nivel.</span>
          </div>
        </div>

        <div className="container prototype-note">
          BSP Store Colombia · Precios en COP · Pasarela Wompi (PSE / Tarjetas) y Transferencia
          Inmediata Bre-B (@bbbsp).
        </div>
      </footer>

      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}

      {drawer && (
        <div className="overlay" onClick={() => setDrawer(false)}>
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Tu carrito"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <span className="eyebrow blue">TU PRÓXIMO NIVEL</span>
                <h2>
                  Mi carrito <small>({count})</small>
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Cerrar carrito"
                onClick={() => setDrawer(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer-body">
              {cart.length ? (
                <CartRows compact onNavigate={() => setDrawer(false)} />
              ) : (
                <EmptyCartState onExplore={() => setDrawer(false)} />
              )}
            </div>
            {cart.length > 0 && (
              <div className="drawer-footer">
                <div>
                  <span>Subtotal</span>
                  <strong>
                    {cop(subtotal)} <small>COP</small>
                  </strong>
                </div>
                <p>Envío por calcular · Pagos con Bre-B (@bbbsp) o Wompi</p>
                <Button
                  onClick={() => {
                    setDrawer(false);
                    router.push('/carrito');
                  }}
                >
                  Ver mi carrito
                  <Icon name="arrow" size={18} />
                </Button>
                <button
                  type="button"
                  className="continue-link"
                  onClick={() => setDrawer(false)}
                >
                  Seguir explorando
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {modal && (
        <div className="overlay modal-overlay" onClick={() => setModal('')}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close icon-button"
              aria-label="Cerrar"
              onClick={() => setModal('')}
            >
              <Icon name="close" />
            </button>
            <div className="modal-icon">
              <Icon name={modal === 'Mi cuenta' ? 'user' : 'shield'} size={31} />
            </div>
            <span className="eyebrow blue">TRANSPARENCIA BSP STORE</span>
            <h2>{modal}</h2>
            <p>
              {modal === 'Política de privacidad'
                ? 'Tratamiento de datos personales conforme a la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013 (Habeas Data Colombia). Los titulares pueden conocer, actualizar, exportar y solicitar la supresión de sus datos desde /cuenta o mediante /api/v1/privacy/me.'
                : modal === 'Términos y condiciones' || modal === 'Garantías y devoluciones'
                  ? 'Operación sujeta al Estatuto del Consumidor en Colombia (Ley 1480 de 2011): Derecho de Retracto dentro de los 5 días hábiles siguientes a la entrega (Art. 47) y Reversión del Pago en transacciones electrónicas (Art. 51).'
                  : ['RAZER', 'HYPERX', 'CORSAIR', 'ASUS', 'Redragon'].includes(modal)
                    ? 'Esta marca puede administrarse e activarse directamente desde el panel administrativo (/admin) cuando haya inventario verificado.'
                    : modal === 'Redes sociales'
                      ? 'Los enlaces de redes oficiales se configuran desde los ajustes de la tienda en el panel administrativo.'
                      : 'Envíos asegurados a los 32 departamentos de Colombia vía Servientrega, Coordinadora, Inter Rapidísimo y Envía.'}
            </p>
            <Button
              onClick={() => {
                setModal('');
                router.push('/contacto');
              }}
            >
              Consultar canales oficiales
              <Icon name="arrow" size={18} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
