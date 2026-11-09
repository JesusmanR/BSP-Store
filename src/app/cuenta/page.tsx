'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { colombiaDepartments, cop } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

type AuthMode = 'login' | 'register' | 'reset';

type AddressItem = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  department: string;
  city: string;
  streetAddress: string;
  additionalInfo?: string | null;
  isDefault: boolean;
};

type OrderHistoryItem = {
  id: string;
  orderNumber: string;
  totalCop: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
};

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, refreshUser, setToast } = useStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Reset password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Profile addresses & orders
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [addrLabel, setAddrLabel] = useState('Casa');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrDepartment, setAddrDepartment] = useState('Bogotá D. C.');
  const [addrCity, setAddrCity] = useState('Bogotá');
  const [addrStreet, setAddrStreet] = useState('');

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    setAddrRecipient(user.name);
    setAddrPhone(user.phone ?? '');
    fetch('/api/v1/addresses', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && Array.isArray(res.data?.addresses)) {
          setAddresses(res.data.addresses);
        }
      })
      .catch(() => undefined);

    fetch('/api/v1/orders', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && Array.isArray(res.data?.orders)) {
          setOrders(res.data.orders);
        }
      })
      .catch(() => undefined);
  }, [user]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload?.error?.message ?? 'No fue posible iniciar sesión.');
        return;
      }
      setUser(payload.data.user);
      setToast(`Bienvenido de nuevo, ${payload.data.user.name}`);
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone || undefined,
          password: regPassword,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        const firstIssue = payload?.error?.issues?.[0]?.message;
        setError(firstIssue ?? payload?.error?.message ?? 'No fue posible crear la cuenta.');
        return;
      }
      setUser(payload.data.user);
      setToast(`Cuenta creada exitosamente. ¡Bienvenido, ${payload.data.user.name}!`);
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const configRes = await fetch('/api/v1/auth/google');
      const configData = await configRes.json();

      if (configData?.data?.oauthConfigured && configData?.data?.authorizeUrl) {
        window.location.href = configData.data.authorizeUrl;
        return;
      }

      // En entorno local sin GOOGLE_CLIENT_ID externo, ejecutamos el flujo OAuth Google local contra PostgreSQL
      const googleEmail = loginEmail.trim() || regEmail.trim() || 'usuario.google@bspstore.com.co';
      const googleName = regName.trim() || 'Usuario Google BSP';

      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleEmail,
          name: googleName,
          googleId: `google-oauth-${googleEmail}`,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload?.error?.message ?? 'No fue posible conectar con Google.');
        return;
      }
      setUser(payload.data.user);
      setToast(`Conectado con Google como ${payload.data.user.email}`);
    } catch {
      setError('No fue posible conectar con Google OAuth.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload?.error?.message ?? 'Error al solicitar recuperación.');
        return;
      }
      if (payload.data?.devResetToken) {
        setResetToken(payload.data.devResetToken);
        setSuccessMsg(
          'Token de recuperación generado en modo local. Ahora ingresa tu nueva contraseña abajo.'
        );
      } else {
        setSuccessMsg(payload.data.message);
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/password-reset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        const firstIssue = payload?.error?.issues?.[0]?.message;
        setError(firstIssue ?? payload?.error?.message ?? 'No fue posible actualizar la contraseña.');
        return;
      }
      setSuccessMsg(payload.data.message);
      setResetToken('');
      setNewPassword('');
      setMode('login');
      setLoginEmail(resetEmail);
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    setUser(null);
    setAddresses([]);
    setToast('Has cerrado sesión correctamente.');
  };

  const handleAddAddress = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addrLabel,
          recipientName: addrRecipient,
          phone: addrPhone,
          department: addrDepartment,
          city: addrCity,
          streetAddress: addrStreet,
          isDefault: addresses.length === 0,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setAddresses((prev) => [payload.data.address, ...prev]);
        setAddrStreet('');
        setToast('Dirección guardada en tu perfil.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page">
      <Breadcrumb current="Mi cuenta" />

      <div className="page-heading">
        <span className="eyebrow blue">TU ESPACIO EN BSP STORE</span>
        <h1>
          {user ? `Hola, ${user.name}` : 'Accede o crea tu cuenta'}
          <span className="blue">.</span>
        </h1>
        <p>
          {user
            ? `Sesión activa (${user.email}) · Rol: ${user.role}`
            : 'Inicia sesión, regístrate o conéctate con Google para guardar tus direcciones, favoritos y pedidos.'}
        </p>
      </div>

      {user ? (
        <div className="profile-grid">
          <div className="auth-card">
            <span className="eyebrow blue">PERFIL VERIFICADO</span>
            <h2 style={{ fontSize: '22px', marginTop: '6px' }}>{user.name}</h2>
            <p className="muted" style={{ marginTop: '4px' }}>
              {user.email} · {user.phone || 'Teléfono pendiente'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <span className="variant-pill selected">Rol: {user.role}</span>
              {user.connectedProviders?.includes('google') && (
                <span className="variant-pill selected">Conectado con Google</span>
              )}
            </div>

            <div style={{ display: 'grid', gap: '10px', marginTop: '28px' }}>
              <Button onClick={() => router.push('/carrito')}>
                <Icon name="cart" size={18} />
                Ir a mi carrito
              </Button>
              <Button secondary onClick={() => router.push('/favoritos')}>
                <Icon name="heart" size={18} />
                Ver mis favoritos
              </Button>
              <Button secondary onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </div>

            <div style={{ marginTop: '28px', borderTop: '1px solid #e9ecf1', paddingTop: '20px' }}>
              <span className="eyebrow blue">HISTORIAL DE COMPRAS</span>
              <h3 style={{ fontSize: '18px', marginBlock: '6px 14px' }}>
                Mis pedidos ({orders.length})
              </h3>
              {orders.length === 0 ? (
                <p className="muted">Aún no tienes pedidos asociados a tu cuenta.</p>
              ) : (
                <div className="address-list">
                  {orders.map((o) => (
                    <div className="address-item" key={o.id}>
                      <div>
                        <strong>{o.orderNumber}</strong>
                        <p className="muted" style={{ marginTop: '3px' }}>
                          {cop(o.totalCop)} COP · {o.paymentMethod}
                        </p>
                      </div>
                      <span className="variant-pill selected">{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="auth-card">
            <span className="eyebrow blue">ENVÍOS EN COLOMBIA</span>
            <h3 style={{ fontSize: '20px', marginBlock: '6px 18px' }}>
              Mis direcciones de entrega ({addresses.length})
            </h3>

            {addresses.length > 0 && (
              <div className="address-list">
                {addresses.map((a) => (
                  <div className="address-item" key={a.id}>
                    <div>
                      <strong>
                        {a.label} — {a.department}, {a.city}
                      </strong>
                      <p className="muted" style={{ marginTop: '3px' }}>
                        {a.streetAddress} · Recibe: {a.recipientName} ({a.phone})
                      </p>
                    </div>
                    {a.isDefault && <span className="variant-pill selected">Principal</span>}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddAddress} className="form-grid">
              <label className="field">
                Etiqueta (Casa, Oficina)
                <input
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Teléfono de contacto *
                <input
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  placeholder="300 123 4567"
                  required
                />
              </label>
              <label className="field">
                Departamento *
                <select
                  value={addrDepartment}
                  onChange={(e) => setAddrDepartment(e.target.value)}
                >
                  {colombiaDepartments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Ciudad / Municipio *
                <input
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  required
                />
              </label>
              <label className="field full-width">
                Dirección exacta *
                <input
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder="Calle, carrera, número, apartamento, barrio"
                  required
                />
              </label>
              <div className="full-width">
                <Button type="submit" disabled={loading}>
                  Guardar dirección en PostgreSQL
                  <Icon name="arrow" size={18} />
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="auth-layout">
          <div className="auth-card">
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-tab ${mode === 'login' ? 'selected' : ''}`}
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`auth-tab ${mode === 'register' ? 'selected' : ''}`}
                onClick={() => {
                  setMode('register');
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'reset'}
                className={`auth-tab ${mode === 'reset' ? 'selected' : ''}`}
                onClick={() => {
                  setMode('reset');
                  setError('');
                  setSuccessMsg('');
                }}
              >
                Recuperar clave
              </button>
            </div>

            {mode !== 'reset' && (
              <>
                <button
                  type="button"
                  className="google-oauth-btn"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.23 0 10.06 0 12s.47 3.77 1.29 5.4l3.99-3.09Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94Z"
                    />
                  </svg>
                  Continuar con Google
                </button>

                <div className="auth-divider">o continúa con tu correo electrónico</div>
              </>
            )}

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="auth-success" role="status">
                {successMsg}
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="form-grid">
                <label className="field full-width">
                  Correo electrónico *
                  <input
                    type="email"
                    required
                    placeholder="tu@correo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="field full-width">
                  Contraseña *
                  <input
                    type="password"
                    required
                    placeholder="Ingresa tu contraseña"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <div className="full-width" style={{ display: 'grid', gap: '12px' }}>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Verificando...' : 'Iniciar sesión'}
                    <Icon name="arrow" size={18} />
                  </Button>
                </div>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="form-grid">
                <label className="field full-width">
                  Nombre completo *
                  <input
                    type="text"
                    required
                    placeholder="Nombre y apellidos"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  Correo electrónico *
                  <input
                    type="email"
                    required
                    placeholder="tu@correo.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="field">
                  Teléfono (Colombia)
                  <input
                    type="tel"
                    placeholder="300 123 4567"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </label>
                <label className="field full-width">
                  Contraseña (mín. 8 caracteres, letras y números) *
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Crea una contraseña segura"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <div className="full-width">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creando cuenta...' : 'Crear mi cuenta en BSP Store'}
                    <Icon name="arrow" size={18} />
                  </Button>
                </div>
              </form>
            )}

            {mode === 'reset' && (
              <div style={{ display: 'grid', gap: '20px' }}>
                <form onSubmit={handleRequestPasswordReset} className="form-grid">
                  <label className="field full-width">
                    Correo electrónico registrado *
                    <input
                      type="email"
                      required
                      placeholder="tu@correo.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </label>
                  <div className="full-width">
                    <Button type="submit" secondary disabled={loading}>
                      Generar enlace / token de recuperación
                    </Button>
                  </div>
                </form>

                {resetToken && (
                  <form onSubmit={handleConfirmPasswordReset} className="form-grid">
                    <label className="field full-width">
                      Token de recuperación
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                      />
                    </label>
                    <label className="field full-width">
                      Nueva contraseña (mín. 8 caracteres, letras y números) *
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </label>
                    <div className="full-width">
                      <Button type="submit" disabled={loading}>
                        Guardar nueva contraseña
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          <aside className="auth-benefits-panel">
            <span className="eyebrow" style={{ color: '#55b7ff' }}>
              CUENTA BSP STORE COLOMBIA
            </span>
            <h2>Todo tu setup, tus pedidos y tus garantías en un solo lugar.</h2>
            <p>
              Con tu cuenta en BSP Store disfrutas de una experiencia más ágil tanto en la web como
              en nuestra futura aplicación móvil en Flutter.
            </p>

            <div className="auth-benefit-list">
              <div className="auth-benefit-item">
                <Icon name="bolt" size={22} />
                <div>
                  <strong>Checkout rápido y pagos sin comisión</strong>
                  <span>
                    Guarda tus direcciones en Colombia y paga al instante con Llave Bre-B (@bbbsp) o
                    Wompi.
                  </span>
                </div>
              </div>
              <div className="auth-benefit-item">
                <Icon name="shield" size={22} />
                <div>
                  <strong>Seguridad de nivel bancario</strong>
                  <span>
                    Contraseñas protegidas con hash bcrypt, sesiones HttpOnly y conexión OAuth con
                    Google.
                  </span>
                </div>
              </div>
              <div className="auth-benefit-item">
                <Icon name="truck" size={22} />
                <div>
                  <strong>Seguimiento de compras y números de guía</strong>
                  <span>Consulta el estado de tus pedidos y despachos nacionales en tiempo real.</span>
                </div>
              </div>
            </div>

            <div className="demo-credentials-box">
              <strong>Cuentas locales precargadas en PostgreSQL 17 para pruebas:</strong>
              <div className="demo-credentials-actions">
                <button
                  type="button"
                  className="demo-cred-btn"
                  onClick={() => {
                    setMode('login');
                    setLoginEmail('cliente@bspstore.com.co');
                    setLoginPassword('BspCliente2026*');
                  }}
                >
                  Cargar Cliente Demo
                </button>
                <button
                  type="button"
                  className="demo-cred-btn"
                  onClick={() => {
                    setMode('login');
                    setLoginEmail('admin@bspstore.com.co');
                    setLoginPassword('BspAdmin2026*');
                  }}
                >
                  Cargar Admin Demo
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
