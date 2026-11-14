'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  colombiaDepartments,
  getCitiesByDepartment,
  isLocalDeliveryDestination,
} from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

type AuthTab = 'login' | 'register' | 'forgot';

export type SavedAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  department: string;
  city: string;
  neighborhood?: string | null;
  streetAddress: string;
  additionalInfo?: string | null;
  postalCode?: string | null;
  isDefault: boolean;
};

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser, refreshUser, setToast } = useStore();
  const [tab, setTab] = useState<AuthTab>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Forgot & reset states
  const [forgotEmail, setForgotEmail] = useState('');
  const [devResetToken, setDevResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Addresses state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState('Casa');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrDepartment, setAddrDepartment] = useState('Bogotá D. C.');
  const [addrCity, setAddrCity] = useState('Bogotá D. C.');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrAdditionalInfo, setAddrAdditionalInfo] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(true);
  const [addressBusyId, setAddressBusyId] = useState<string | null>(null);

  const availableCities = getCitiesByDepartment(addrDepartment);

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/v1/addresses', { cache: 'no-store' });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setAddresses(payload.data.addresses);
      }
    } catch {
      // Ignorar si no hay sesión
    }
  };

  useEffect(() => {
    if (user) {
      if (!editingAddressId) {
        setAddrRecipient(user.name);
        setAddrPhone(user.phone ?? '');
      }
      fetchAddresses();
    }
  }, [user, editingAddressId]);

  const handleDepartmentSelect = (newDept: string) => {
    setAddrDepartment(newDept);
    const deptCities = getCitiesByDepartment(newDept);
    setAddrCity(deptCities[0] ?? '');
  };

  const resetMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddrLabel('Casa');
    setAddrRecipient(user?.name ?? '');
    setAddrPhone(user?.phone ?? '');
    setAddrDepartment('Bogotá D. C.');
    setAddrCity('Bogotá D. C.');
    setAddrStreet('');
    setAddrAdditionalInfo('');
    setAddrIsDefault(addresses.length === 0);
  };

  const startEditAddress = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setAddrRecipient(addr.recipientName);
    setAddrPhone(addr.phone);
    setAddrDepartment(addr.department);
    const deptCities = getCitiesByDepartment(addr.department);
    if (deptCities.includes(addr.city)) {
      setAddrCity(addr.city);
    } else {
      setAddrCity(addr.city || (deptCities[0] ?? ''));
    }
    setAddrStreet(addr.streetAddress);
    setAddrAdditionalInfo(addr.additionalInfo ?? '');
    setAddrIsDefault(addr.isDefault);
    document.getElementById('address-form-card')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setErrorMsg(payload?.error?.message ?? 'No fue posible iniciar sesión.');
        return;
      }
      setUser(payload.data.user);
      setToast(`¡Bienvenido, ${payload.data.user.name}!`);
    } catch {
      setErrorMsg('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!acceptPrivacy || !acceptTerms) {
      setErrorMsg(
        'Para crear tu cuenta debes autorizar el tratamiento de datos personales (Ley 1581 de 2012) y aceptar los términos y condiciones.'
      );
      return;
    }
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
          acceptTerms,
          acceptPrivacyPolicy: acceptPrivacy,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        const firstIssue = payload?.error?.issues?.[0]?.message;
        setErrorMsg(firstIssue ?? payload?.error?.message ?? 'No fue posible crear la cuenta.');
        return;
      }
      setUser(payload.data.user);
      setToast(`¡Cuenta creada con éxito! Bienvenido, ${payload.data.user.name}.`);
    } catch {
      setErrorMsg('Error de conexión al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    resetMessages();
    setLoading(true);
    try {
      const googleEmail = loginEmail.trim() || 'google.gamer@bspstore.com.co';
      const googleName = regName.trim() || 'Gamer Google Colombia';
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
        setErrorMsg(payload?.error?.message ?? 'Error al autenticar con Google.');
        return;
      }
      setUser(payload.data.user);
      setToast(`Conectado con Google como ${payload.data.user.email}`);
    } catch {
      setErrorMsg('Error al conectar con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setErrorMsg(payload?.error?.message ?? 'No fue posible procesar la solicitud.');
        return;
      }
      setSuccessMsg(payload.data.message);
      if (payload.data.devResetToken) {
        setDevResetToken(payload.data.devResetToken);
      }
    } catch {
      setErrorMsg('Error al solicitar recuperación de contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: devResetToken, newPassword }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        const firstIssue = payload?.error?.issues?.[0]?.message;
        setErrorMsg(
          firstIssue ?? payload?.error?.message ?? 'No fue posible actualizar la contraseña.'
        );
        return;
      }
      setSuccessMsg('¡Contraseña actualizada! Ya puedes iniciar sesión.');
      setDevResetToken('');
      setNewPassword('');
      setTab('login');
    } catch {
      setErrorMsg('Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    try {
      const isEditing = Boolean(editingAddressId);
      const endpoint = isEditing
        ? `/api/v1/addresses/${editingAddressId}`
        : '/api/v1/addresses';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addrLabel,
          recipientName: addrRecipient,
          phone: addrPhone,
          department: addrDepartment,
          city: addrCity,
          streetAddress: addrStreet,
          additionalInfo: addrAdditionalInfo.trim() || undefined,
          isDefault: addrIsDefault,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        const firstIssue = payload?.error?.issues?.[0]?.message;
        setErrorMsg(
          firstIssue ?? payload?.error?.message ?? 'No fue posible guardar la dirección.'
        );
        return;
      }

      await fetchAddresses();
      resetAddressForm();
      setToast(
        isEditing
          ? 'Dirección actualizada correctamente.'
          : 'Dirección guardada en tu libreta de entregas.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    setAddressBusyId(addressId);
    resetMessages();
    try {
      const res = await fetch(`/api/v1/addresses/${addressId}`, {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setErrorMsg(payload?.error?.message ?? 'No fue posible eliminar la dirección.');
        return;
      }
      if (editingAddressId === addressId) {
        resetAddressForm();
      }
      await fetchAddresses();
      setToast('Dirección eliminada.');
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleMakeDefaultAddress = async (addr: SavedAddress) => {
    setAddressBusyId(addr.id);
    resetMessages();
    try {
      const res = await fetch(`/api/v1/addresses/${addr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addr.label,
          recipientName: addr.recipientName,
          phone: addr.phone,
          department: addr.department,
          city: addr.city,
          streetAddress: addr.streetAddress,
          additionalInfo: addr.additionalInfo ?? undefined,
          isDefault: true,
        }),
      });
      if (res.ok) {
        await fetchAddresses();
        setToast(`"${addr.label}" ahora es tu dirección principal.`);
      }
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleExportPersonalData = async () => {
    try {
      const res = await fetch('/api/v1/privacy/me');
      const payload = await res.json();
      if (res.ok && payload.ok) {
        const blob = new Blob([JSON.stringify(payload.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mis-datos-bsp-store-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setToast('Copia de tus datos personales descargada (Ley 1581 de 2012).');
      }
    } catch {
      setToast('No fue posible descargar el archivo en este momento.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    await refreshUser();
    setUser(null);
    setAddresses([]);
    setToast('Has cerrado sesión correctamente.');
  };

  return (
    <div className="container page">
      <Breadcrumb current="Mi cuenta" />

      <div className="page-heading">
        <span className="eyebrow blue">PERFIL, DIRECCIONES Y PRIVACIDAD</span>
        <h1>
          {user ? `Hola, ${user.name}` : 'Mi cuenta BSP Store'}
          <span className="blue">.</span>
        </h1>
        <p>
          {user
            ? 'Gestiona tu perfil, tu libreta de direcciones en toda Colombia y tus preferencias de privacidad.'
            : 'Inicia sesión, crea tu cuenta o conéctate con Google para guardar tus direcciones y agilizar tus compras.'}
        </p>
      </div>

      {user ? (
        <div style={{ display: 'grid', gap: '24px' }}>
          <div className="account-dashboard">
            <div className="account-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                <div>
                  <span className="eyebrow blue">CUENTA VERIFICADA</span>
                  <h3 style={{ marginTop: '4px' }}>{user.name}</h3>
                  <p className="muted">{user.email}</p>
                  {user.phone && <p className="muted">Tel: {user.phone}</p>}
                </div>
                <span className="role-badge">
                  {user.role === 'CUSTOMER' ? 'CLIENTE' : user.role}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button onClick={() => router.push('/tienda')}>
                  Explorar productos
                  <Icon name="arrow" size={18} />
                </Button>
                <Button secondary onClick={() => router.push('/checkout')}>
                  Ir a finalizar compra
                </Button>
                {(user.role === 'ADMIN' || user.role === 'STAFF') && (
                  <Button secondary onClick={() => router.push('/admin')}>
                    <Icon name="shield" size={16} />
                    Panel Administrativo
                  </Button>
                )}
                <Button secondary onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </div>

              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border, #e2e8f0)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <h4>Mis direcciones guardadas ({addresses.length})</h4>
                  {editingAddressId && (
                    <button
                      type="button"
                      onClick={resetAddressForm}
                      style={{
                        fontSize: '12px',
                        color: '#168BFF',
                        fontWeight: 700,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      + Crear nueva dirección
                    </button>
                  )}
                </div>

                {addresses.length === 0 ? (
                  <div
                    style={{
                      padding: '18px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      fontSize: '13px',
                      color: '#475569',
                    }}
                  >
                    Aún no tienes direcciones registradas. Agrega tu dirección principal en el
                    formulario para cargarla automáticamente cuando vayas a pagar.
                  </div>
                ) : (
                  <div className="address-list">
                    {addresses.map((a) => {
                      const isLocal = isLocalDeliveryDestination(a.department, a.city);
                      const isBeingEdited = editingAddressId === a.id;
                      return (
                        <div
                          key={a.id}
                          className="address-item"
                          style={{
                            border: isBeingEdited
                              ? '2px solid #168BFF'
                              : a.isDefault
                                ? '1px solid #93c5fd'
                                : undefined,
                            background: isBeingEdited ? '#f0f9ff' : undefined,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong>{a.label}</strong>
                              {a.isDefault && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    background: '#dbeafe',
                                    color: '#1d4ed8',
                                  }}
                                >
                                  Predeterminada
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: isLocal ? '#dcfce7' : '#f1f5f9',
                                  color: isLocal ? '#15803d' : '#475569',
                                }}
                              >
                                {isLocal ? 'Domicilio Local' : 'Envío Nacional'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {!a.isDefault && (
                                <button
                                  type="button"
                                  disabled={addressBusyId === a.id}
                                  onClick={() => handleMakeDefaultAddress(a)}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Usar como principal
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label={`Editar dirección ${a.label}`}
                                onClick={() => startEditAddress(a)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #bae6fd',
                                  background: '#f0f9ff',
                                  color: '#0284c7',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Icon name="edit" size={14} />
                                Editar
                              </button>
                              <button
                                type="button"
                                aria-label={`Eliminar dirección ${a.label}`}
                                disabled={addressBusyId === a.id}
                                onClick={() => handleDeleteAddress(a.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Icon name="trash" size={14} />
                                Eliminar
                              </button>
                            </div>
                          </div>

                          <span style={{ display: 'block', marginTop: '6px' }}>
                            {a.streetAddress}
                            {a.additionalInfo ? ` (${a.additionalInfo})` : ''} — {a.city},{' '}
                            {a.department}
                          </span>
                          <small>
                            Recibe: {a.recipientName} ({a.phone})
                          </small>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="account-card" id="address-form-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h3>
                  {editingAddressId ? 'Editar dirección de entrega' : 'Agregar dirección de entrega'}
                </h3>
                {editingAddressId && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '999px',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                    }}
                  >
                    Modo edición
                  </span>
                )}
              </div>

              {errorMsg && (
                <div className="auth-error" role="alert" style={{ marginBottom: '14px' }}>
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSaveAddress} className="auth-form">
                <div className="form-grid">
                  <Field
                    label="Etiqueta (Casa, Oficina, etc.)"
                    required
                    value={addrLabel}
                    onChange={setAddrLabel}
                  />
                  <Field
                    label="Persona que recibe"
                    required
                    value={addrRecipient}
                    onChange={setAddrRecipient}
                  />
                  <Field
                    label="Teléfono de contacto"
                    type="tel"
                    required
                    placeholder="300 123 4567"
                    value={addrPhone}
                    onChange={setAddrPhone}
                  />
                  <label className="field">
                    Departamento <span>*</span>
                    <select
                      aria-label="Departamento"
                      value={addrDepartment}
                      onChange={(e) => handleDepartmentSelect(e.target.value)}
                    >
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
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
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
                    placeholder="Calle, carrera, número, conjunto o barrio"
                    value={addrStreet}
                    onChange={setAddrStreet}
                  />
                  <Field
                    label="Indicaciones adicionales (opcional)"
                    className="full-width"
                    placeholder="Apartamento, torre, portería o punto de referencia"
                    value={addrAdditionalInfo}
                    onChange={setAddrAdditionalInfo}
                  />
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: isLocalDeliveryDestination(addrDepartment, addrCity)
                      ? '#f0fdf4'
                      : '#f8fafc',
                    border: isLocalDeliveryDestination(addrDepartment, addrCity)
                      ? '1px solid #bbf7d0'
                      : '1px solid #e2e8f0',
                    fontSize: '12px',
                    color: '#334155',
                  }}
                >
                  <Icon name="truck" size={14} />{' '}
                  {isLocalDeliveryDestination(addrDepartment, addrCity) ? (
                    <span>
                      Cobertura de <strong>Domicilio Local</strong> disponible para{' '}
                      <strong>{addrCity}</strong> (entrega directa sin transportadoras nacionales).
                    </span>
                  ) : (
                    <span>
                      Destino cubierto mediante <strong>Envío Nacional Asegurado</strong> hacia{' '}
                      <strong>
                        {addrCity}, {addrDepartment}
                      </strong>
                      .
                    </span>
                  )}
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={addrIsDefault}
                    onChange={(e) => setAddrIsDefault(e.target.checked)}
                  />
                  Usar como mi dirección predeterminada al ir a pagar
                </label>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Button type="submit" disabled={loading}>
                    {editingAddressId ? 'Actualizar dirección' : 'Guardar dirección'}
                    <Icon name="check" size={18} />
                  </Button>
                  {editingAddressId && (
                    <Button type="button" secondary onClick={resetAddressForm}>
                      Cancelar edición
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Tarjeta de Privacidad y Habeas Data (Ley 1581 de 2012) */}
          <div className="account-card">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div>
                <span className="eyebrow blue">HABEAS DATA COLOMBIA · LEY 1581 DE 2012</span>
                <h3 style={{ marginTop: '4px' }}>Privacidad y Manejo de tus Datos Personales</h3>
                <p className="muted" style={{ maxWidth: '680px', marginTop: '4px' }}>
                  De acuerdo con la legislación colombiana (Ley 1581 de 2012 y Estatuto del
                  Consumidor Ley 1480 de 2011), puedes consultar, actualizar o descargar en
                  cualquier momento los datos asociados a tu cuenta.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Button secondary onClick={handleExportPersonalData}>
                  Descargar mis datos (JSON)
                </Button>
                <Link href="/privacidad" className="btn btn-secondary">
                  Política de Datos
                </Link>
                <Link href="/terminos" className="btn btn-secondary">
                  Términos y Condiciones
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="auth-container">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={tab === 'login' ? 'active' : ''}
              onClick={() => {
                resetMessages();
                setTab('login');
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={tab === 'register' ? 'active' : ''}
              onClick={() => {
                resetMessages();
                setTab('register');
              }}
            >
              Crear cuenta
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'forgot'}
              className={tab === 'forgot' ? 'active' : ''}
              onClick={() => {
                resetMessages();
                setTab('forgot');
              }}
            >
              Recuperar clave
            </button>
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="auth-success" role="status">
              {successMsg}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <Field
                label="Correo electrónico"
                type="email"
                required
                placeholder="cliente@bspstore.com.co"
                value={loginEmail}
                onChange={setLoginEmail}
              />
              <Field
                label="Contraseña"
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={setLoginPassword}
              />
              <Button type="submit" disabled={loading}>
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
                <Icon name="arrow" size={18} />
              </Button>

              <div className="auth-divider">
                <span>o continúa con</span>
              </div>

              <button
                type="button"
                className="google-auth-btn"
                onClick={handleGoogleConnect}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continuar con Google
              </button>

              <div className="demo-credentials">
                <small>
                  <strong>Accesos rápidos de prueba:</strong>
                  <br />
                  Cliente: <code>cliente@bspstore.com.co</code> / <code>ClienteBsp2026*</code>
                  <br />
                  Admin: <code>admin@bspstore.com.co</code> / <code>BspAdmin2026*</code>
                </small>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="auth-form">
              <Field
                label="Nombre completo"
                required
                placeholder="Ej. Andrés Gómez"
                value={regName}
                onChange={setRegName}
              />
              <Field
                label="Correo electrónico"
                type="email"
                required
                placeholder="tu@correo.com"
                value={regEmail}
                onChange={setRegEmail}
              />
              <Field
                label="Teléfono celular (Colombia)"
                type="tel"
                placeholder="300 123 4567"
                value={regPhone}
                onChange={setRegPhone}
              />
              <Field
                label="Contraseña (mínimo 8 caracteres, letras y números)"
                type="password"
                required
                placeholder="••••••••"
                value={regPassword}
                onChange={setRegPassword}
              />

              {/* Consentimiento expreso según Ley 1581 de 2012 y Ley 1480 de 2011 */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  display: 'grid',
                  gap: '12px',
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                  color: '#334155',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                  <Icon name="shield" size={15} /> Protección de Datos y Condiciones Legales en
                  Colombia
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    required
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    Autorizo de manera previa, expresa e informada el tratamiento de mis datos
                    personales conforme a la{' '}
                    <Link
                      href="/privacidad"
                      target="_blank"
                      style={{ color: '#168BFF', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      Política de Tratamiento de Datos Personales (Ley 1581 de 2012 y Decreto 1377
                      de 2013)
                    </Link>{' '}
                    para la gestión de mi cuenta, entregas a domicilio o envíos nacionales y
                    facturación.
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    required
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    He leído y acepto los{' '}
                    <Link
                      href="/terminos"
                      target="_blank"
                      style={{ color: '#168BFF', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      Términos y Condiciones Comerciales (Estatuto del Consumidor — Ley 1480 de
                      2011)
                    </Link>
                    , incluyendo las políticas de garantía, derecho de retracto y reversión de pago.
                  </span>
                </label>
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
                <Icon name="arrow" size={18} />
              </Button>

              <button
                type="button"
                className="google-auth-btn"
                onClick={handleGoogleConnect}
                disabled={loading}
              >
                Registrarme rápido con Google
              </button>
            </form>
          )}

          {tab === 'forgot' && (
            <div className="auth-form">
              <form onSubmit={handleForgot} className="auth-form">
                <Field
                  label="Correo registrado"
                  type="email"
                  required
                  placeholder="cliente@bspstore.com.co"
                  value={forgotEmail}
                  onChange={setForgotEmail}
                />
                <Button type="submit" disabled={loading}>
                  Generar enlace de recuperación
                </Button>
              </form>

              {devResetToken && (
                <form
                  onSubmit={handleResetPassword}
                  className="auth-form"
                  style={{ marginTop: '18px' }}
                >
                  <Field
                    label="Código de verificación"
                    required
                    value={devResetToken}
                    onChange={setDevResetToken}
                  />
                  <Field
                    label="Nueva contraseña"
                    type="password"
                    required
                    placeholder="NuevaClave2026*"
                    value={newPassword}
                    onChange={setNewPassword}
                  />
                  <Button type="submit" disabled={loading}>
                    Guardar nueva contraseña
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
