'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { categories as defaultCategories, cop } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { CartRows, EmptyCartState } from '@/components/cart/CartContent';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

const navItems = [
  'Inicio',
  'Tienda',
  'Categorías',
  'Ofertas',
  'Marcas',
  'Contacto',
  'Sigue tu pedido',
] as const;

export function StoreShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    setUser,
    refreshUser,
    catalogProducts,
    cart,
    favorites,
    count,
    subtotal,
    query,
    setQuery,
    setCategory,
    setSelectedBrand,
    setStockFilter,
    theme,
    toggleTheme,
    drawer,
    setDrawer,
    modal,
    setModal,
    toast,
    setToast,
  } = useStore();

  const [menu, setMenu] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === '/';
  const isAdminRoute = pathname?.startsWith('/admin');
  const isAdminUser = Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

  const dropdownCategories = useMemo(() => {
    const map = new Map<string, { name: string; subtitle: string; icon: string }>();
    for (const c of defaultCategories) {
      map.set(c.name.toLowerCase(), {
        name: c.name,
        subtitle: c.subtitle,
        icon: c.icon,
      });
    }
    for (const p of catalogProducts) {
      if (p.category && !map.has(p.category.toLowerCase())) {
        map.set(p.category.toLowerCase(), {
          name: p.category,
          subtitle: 'Explorar referencias disponibles',
          icon: 'grid',
        });
      }
    }
    return Array.from(map.values());
  }, [catalogProducts]);

  useEffect(() => {
    setMenu(false);
    setDrawer(false);
    setCategoriesOpen(false);
  }, [pathname, setDrawer]);

  useEffect(() => {
    document.body.style.overflow = drawer || modal ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer, modal]);

  useEffect(() => {
    if (!categoriesOpen) return;
    const handleOutside = (event: PointerEvent) => {
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
        setCategoriesOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [categoriesOpen]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(false);
        setModal('');
        setCategoriesOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [setDrawer, setModal]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors
    }
    setUser(null);
    await refreshUser();
    setMenu(false);
    setToast('Has cerrado sesión correctamente.');
    router.push('/cuenta');
  };

  const handleNav = (name: (typeof navItems)[number]) => {
    setMenu(false);
    setCategoriesOpen(false);

    if (name === 'Inicio') {
      router.push('/');
    } else if (name === 'Categorías') {
      router.push('/categorias');
    } else if (name === 'Marcas') {
      router.push('/marcas');
    } else if (name === 'Sigue tu pedido') {
      router.push('/seguimiento');
    } else if (name === 'Tienda') {
      setCategory('Todas');
      setSelectedBrand('Todas');
      setQuery('');
      setStockFilter(false);
      router.push('/tienda');
    } else {
      router.push('/' + name.toLowerCase());
    }
  };

  const handleSelectDropdownCategory = (catName: string) => {
    setCategory(catName);
    setSelectedBrand('Todas');
    setQuery('');
    setStockFilter(false);
    setCategoriesOpen(false);
    setMenu(false);
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
            {isAdminUser && (
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

          <Link
            href="/"
            aria-label="BSP Store, inicio"
            onClick={() => {
              setCategory('Todas');
              setSelectedBrand('Todas');
              setQuery('');
              setStockFilter(false);
            }}
          >
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
            <button
              type="button"
              className="theme-toggle"
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label="Modo oscuro"
              title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>

            <Link
              href={isAdminUser ? '/admin' : '/cuenta'}
              className="account-button"
              aria-label={user ? 'Mi cuenta' : 'Ingresar o registrar'}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="header-user-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Icon name="user" />
              )}
              <span>
                {user ? `Hola, ${user.name.split(' ')[0]}` : 'Hola, bienvenido'}
                <strong>
                  {isAdminUser ? 'Panel Admin' : user ? 'Mi cuenta' : 'Ingresar / Registrar'}
                </strong>
              </span>
            </Link>

            {user && (
              <button
                type="button"
                className="icon-button header-logout-btn"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={handleLogout}
              >
                <Icon name="logout" size={16} />
                <span>Salir</span>
              </button>
            )}

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
              {navItems.map((n) => {
                const routeSlug =
                  n === 'Categorías'
                    ? '/categorias'
                    : n === 'Marcas'
                      ? '/marcas'
                      : n === 'Sigue tu pedido'
                        ? '/seguimiento'
                        : '/' + n.toLowerCase();

                if (n === 'Categorías') {
                  return (
                    <div
                      key={n}
                      ref={categoriesRef}
                      className={`nav-dropdown-wrap ${categoriesOpen ? 'is-open' : ''}`}
                      onMouseEnter={() => {
                        if (typeof window !== 'undefined' && window.innerWidth > 580) {
                          setCategoriesOpen(true);
                        }
                      }}
                      onMouseLeave={() => {
                        if (typeof window !== 'undefined' && window.innerWidth > 580) {
                          setCategoriesOpen(false);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className={pathname === '/categorias' || categoriesOpen ? 'active' : ''}
                        aria-expanded={categoriesOpen}
                        aria-haspopup="true"
                        aria-controls="nav-categories-menu"
                        onClick={() => setCategoriesOpen((prev) => !prev)}
                      >
                        <Icon name="grid" size={16} />
                        {n}
                        <Icon
                          name="down"
                          size={13}
                          className={`nav-chevron ${categoriesOpen ? 'is-rotated' : ''}`}
                        />
                      </button>

                      {categoriesOpen && (
                        <div
                          id="nav-categories-menu"
                          className="nav-categories-dropdown"
                          role="menu"
                          aria-label="Categorías de BSP Store"
                        >
                          <div className="nav-categories-grid">
                            {dropdownCategories.map((cat) => (
                              <Link
                                key={cat.name}
                                href="/tienda"
                                role="menuitem"
                                className="nav-category-item"
                                onClick={() => handleSelectDropdownCategory(cat.name)}
                              >
                                <span className="nav-category-icon">
                                  <Icon name={cat.icon} size={18} />
                                </span>
                                <span>
                                  <strong>{cat.name}</strong>
                                  <small>{cat.subtitle}</small>
                                </span>
                              </Link>
                            ))}
                          </div>
                          <Link
                            href="/categorias"
                            className="nav-categories-footer"
                            onClick={() => {
                              setCategoriesOpen(false);
                              setMenu(false);
                            }}
                          >
                            Ver todas las categorías
                            <Icon name="arrow" size={14} />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    key={n}
                    className={(isHome && n === 'Inicio') || pathname === routeSlug ? 'active' : ''}
                    onClick={() => handleNav(n)}
                  >
                    {n === 'Sigue tu pedido' && <Icon name="truck" size={15} />}
                    {n}
                    {n === 'Ofertas' && <span className="nav-dot" />}
                  </button>
                );
              })}
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
            <Link
              href="/"
              aria-label="BSP Store Inicio"
              onClick={() => {
                setCategory('Todas');
                setSelectedBrand('Todas');
                setQuery('');
                setStockFilter(false);
              }}
            >
              <Logo light />
            </Link>
            <p>
              Tecnología que impulsa tu experiencia.
              <br />
              Bucaramanga, Santander · WhatsApp: 302 800 0240
              <br />
              compras@bspstore.com.co
            </p>
            <div className="footer-socials">
              <a
                href="https://www.facebook.com/bspstore.co"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook BSP Store"
                className="social-link social-facebook"
              >
                <Icon name="facebook" size={19} />
              </a>
              <a
                href="https://www.instagram.com/bspstore.co"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram BSP Store"
                className="social-link social-instagram"
              >
                <Icon name="instagram" size={19} />
              </a>
              <a
                href="https://www.tiktok.com/@bspstore.co"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok BSP Store"
                className="social-link social-tiktok"
              >
                <Icon name="tiktok" size={19} />
              </a>
              <a
                href="https://wa.me/573028000240"
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp BSP Store"
                className="social-link social-whatsapp"
              >
                <Icon name="whatsapp" size={19} />
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
            <button type="button" onClick={() => router.push('/seguimiento')}>
              Sigue tu pedido
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
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  paddingInline: '8px',
                }}
                aria-label="Bre-B"
              >
                Bre-B
              </span>
              <span>VISA</span>
              <span className="mastercard">
                <i />
                <i />
              </span>
              <span>pse</span>
            </div>
            <span className="footer-secure">
              <Icon name="lock" size={13} />
              Pagos seguros vía Wompi y Bre-B
            </span>
          </div>
        </div>

        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} BSP STORE. Propuesta de experiencia digital.</span>
          <div>
            <button type="button" onClick={() => router.push('/privacidad')}>
              Privacidad y Datos (Ley 1581)
            </button>
            <button type="button" onClick={() => router.push('/terminos')}>
              Términos y condiciones (Ley 1480)
            </button>
            <span>Hecho para tu próximo nivel.</span>
          </div>
        </div>

        <div className="container prototype-note">
          BSP Store · Bucaramanga, Santander (Colombia) · Tel/WhatsApp: 302 800 0240 ·
          compras@bspstore.com.co · Pagos vía Bre-B y Wompi.
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
                <Link
                  href="/carrito"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => setDrawer(false)}
                >
                  Ver mi carrito
                  <Icon name="arrow" size={18} />
                </Link>
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
                ? 'Tratamiento de datos personales conforme a la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013 (Habeas Data Colombia).'
                : modal === 'Términos y condiciones' || modal === 'Garantías y devoluciones'
                  ? 'Operación sujeta al Estatuto del Consumidor en Colombia (Ley 1480 de 2011): Derecho de Retracto dentro de los 5 días hábiles siguientes a la entrega (Art. 47) y Reversión del Pago en transacciones electrónicas (Art. 51).'
                  : ['RAZER', 'HYPERX', 'CORSAIR', 'ASUS', 'Redragon'].includes(modal)
                    ? 'Consulta la disponibilidad actual de esta marca directamente en nuestra tienda o con un asesor.'
                    : modal === 'Redes sociales'
                      ? 'Síguenos en nuestros canales oficiales verificados: Instagram (@bspstore.co), Facebook (facebook.com/bspstore.co/) y WhatsApp (302 800 0240).'
                      : 'Entregas locales mediante Domicilio Local directo en Bucaramanga (y Área Metropolitana) y envíos nacionales asegurados a los 32 departamentos de Colombia.'}
            </p>
            <Button
              onClick={() => {
                const target =
                  modal === 'Política de privacidad'
                    ? '/privacidad'
                    : modal === 'Términos y condiciones' || modal === 'Garantías y devoluciones'
                      ? '/terminos'
                      : '/contacto';
                setModal('');
                router.push(target);
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
