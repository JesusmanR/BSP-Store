'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  colombiaDepartments,
  cop,
  getCitiesByDepartment,
  isLocalDeliveryDestination,
} from '@/data/catalog';
import {
  downloadClientDataCardPng,
  type ClientCardExportData,
} from '@/lib/client-data-card';
import { getRoleLabelEs } from '@/lib/roles';
import { useStore } from '@/context/StoreContext';
import { BrandMascot } from '@/components/ui/BrandMascot';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

type AuthTab = 'login' | 'register' | 'forgot';
type AccountSection = 'overview' | 'orders' | 'profile';

export type CustomerOrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  totalCop: number;
  shippingCop: number;
  department: string;
  city: string;
  streetAddress: string;
  createdAt: string;
  items: CustomerOrderItem[];
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    transferReceiptRef?: string | null;
    brebKeyUsed?: string | null;
  }>;
  shipment?: {
    status: string;
    trackingNumber?: string | null;
    carrier?: {
      code: string;
      name: string;
      trackingUrlTemplate?: string | null;
    } | null;
  } | null;
};

const ORDER_STATUS_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  PENDING_BREB_VERIFICATION: {
    label: 'Verificando transferencia Bre-B (@bbbsp)',
    bg: '#e0f2fe',
    color: '#0369a1',
  },
  PENDING_PAYMENT: {
    label: 'Pendiente de pago',
    bg: '#fef3c7',
    color: '#b45309',
  },
  PAID: {
    label: 'Pagado',
    bg: '#dcfce7',
    color: '#15803d',
  },
  PROCESSING: {
    label: 'En alistamiento',
    bg: '#dbeafe',
    color: '#1d4ed8',
  },
  SHIPPED: {
    label: 'En camino / Despachado',
    bg: '#ede9fe',
    color: '#6d28d9',
  },
  DELIVERED: {
    label: 'Entregado',
    bg: '#dcfce7',
    color: '#166534',
  },
  CANCELLED: {
    label: 'Cancelado',
    bg: '#fee2e2',
    color: '#b91c1c',
  },
};

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

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.8 4.8 0 0 1-2.1 3.2v2.6h3.3c1.9-1.8 3.1-4.4 3.1-7.7Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1a6 6 0 0 1-5.7-4.1H2.9v2.7A10 10 0 0 0 12 22Z"
      />
      <path fill="#FBBC05" d="M6.3 13.9a6 6 0 0 1 0-3.8V7.4H2.9a10 10 0 0 0 0 9.2l3.4-2.7Z" />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.4l3.4 2.7A6 6 0 0 1 12 6Z"
      />
    </svg>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, authLoading, setUser, refreshUser, setToast, favorites } = useStore();
  const [tab, setTab] = useState<AuthTab>('login');
  const [accountSection, setAccountSection] = useState<AccountSection>('overview');
  const [loading, setLoading] = useState(false);
  const [redirectingAdmin, setRedirectingAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  // Profile & Avatar edit state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Addresses state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState('Casa');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrDepartment, setAddrDepartment] = useState('Santander');
  const [addrCity, setAddrCity] = useState('Bucaramanga');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrAdditionalInfo, setAddrAdditionalInfo] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(true);
  const [addressBusyId, setAddressBusyId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [receiptInputs, setReceiptInputs] = useState<Record<string, string>>({});

  const availableCities = getCitiesByDepartment(addrDepartment);
  const isAdminSession = Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

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

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/v1/orders', { cache: 'no-store' });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setOrders(payload.data.orders ?? []);
      }
    } catch {
      // Ignorar si no hay sesión
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    const urlToken = params.get('token');
    const oauthErr = params.get('oauth_error');
    if (urlTab === 'forgot' || urlTab === 'reset') {
      setTab('forgot');
      if (urlToken) {
        setDevResetToken(urlToken);
      }
    } else if (urlTab === 'register') {
      setTab('register');
    }
    if (oauthErr) {
      setErrorMsg(
        oauthErr === 'cancelled'
          ? 'Inicio de sesión con Google cancelado.'
          : 'No se pudo completar el inicio de sesión con Google. Intenta nuevamente o usa tu correo y contraseña.'
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'ADMIN' || user.role === 'STAFF') {
      setRedirectingAdmin(true);
      router.replace('/admin');
      return;
    }
    setProfileName(user.name);
    setProfilePhone(user.phone ?? '');
    if (!editingAddressId) {
      setAddrRecipient(user.name);
      setAddrPhone(user.phone ?? '');
    }
    void fetchAddresses();
    void fetchOrders();
  }, [user, editingAddressId, router]);

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
    setAddrDepartment('Santander');
    setAddrCity('Bucaramanga');
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
      const loggedUser = payload.data.user;
      if (loggedUser.role === 'ADMIN' || loggedUser.role === 'STAFF') {
        // Evitar por completo mostrar el perfil de cliente durante la redirección al panel admin
        setRedirectingAdmin(true);
        setUser(loggedUser);
        setToast(`Bienvenido al panel administrativo, ${loggedUser.name.split(' ')[0]}.`);
        router.replace('/admin');
        return;
      }
      setUser(loggedUser);
      setToast(`¡Bienvenido, ${loggedUser.name}!`);
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
      const res = await fetch('/api/v1/auth/google', { cache: 'no-store' });
      const payload = await res.json();
      if (res.ok && payload?.ok && payload.data?.oauthConfigured && payload.data?.authorizeUrl) {
        window.location.href = payload.data.authorizeUrl as string;
        return;
      }
      setErrorMsg(
        'El acceso con Google requiere configurar GOOGLE_CLIENT_ID en el servidor (el modo simulado fue desactivado por seguridad). Inicia sesión con tu correo y contraseña.'
      );
    } catch {
      setErrorMsg('No fue posible verificar la configuración de Google OAuth.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/password-reset', {
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
      const res = await fetch('/api/v1/auth/password-reset', {
        method: 'PUT',
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

  const GAMING_AVATAR_PRESETS = [
    { label: 'Cyber Blue', url: '/images/avatars/cyber-blue.png' },
    { label: 'Neon Violet', url: '/images/avatars/neon-violet.png' },
    { label: 'Emerald Pro', url: '/images/avatars/emerald-pro.png' },
    { label: 'Crimson eSports', url: '/images/avatars/crimson-esports.png' },
    { label: 'Gold Elite', url: '/images/avatars/gold-elite.png' },
    { label: 'Arctic Steel', url: '/images/avatars/arctic-steel.png' },
  ];

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file) return;
    resetMessages();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Por seguridad solo se permiten imágenes JPG, PNG o WebP (sin SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('La imagen debe pesar como máximo 2 MB.');
      return;
    }
    setAvatarBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/auth/me/avatar', {
        method: 'POST',
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        setErrorMsg(payload?.error?.message ?? 'No fue posible guardar tu foto de perfil.');
        return;
      }
      if (user) {
        setUser({ ...user, avatarUrl: payload.data.avatarUrl });
      }
      setToast('Tu foto de perfil fue actualizada de forma segura.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No fue posible procesar la imagen.');
    } finally {
      setAvatarBusy(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  const handleSelectAvatarPreset = async (presetUrl: string) => {
    resetMessages();
    setAvatarBusy(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: presetUrl }),
      });
      const payload = await res.json();
      if (res.ok && payload?.ok) {
        setUser(payload.data.user);
        setToast('Avatar BSP aplicado a tu perfil.');
      } else {
        setErrorMsg(payload?.error?.message ?? 'No fue posible aplicar el avatar.');
      }
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    resetMessages();
    setAvatarBusy(true);
    try {
      const res = await fetch('/api/v1/auth/me/avatar', {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (res.ok && payload?.ok) {
        if (user) {
          setUser({ ...user, avatarUrl: null });
        }
        setToast('Foto de perfil restaurada a iniciales.');
      }
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          phone: profilePhone.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setErrorMsg(payload?.error?.message ?? 'No fue posible actualizar tus datos.');
        return;
      }
      setUser(payload.data.user);
      setToast('Tus datos personales fueron actualizados correctamente.');
    } catch {
      setErrorMsg('Error de conexión al actualizar el perfil.');
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

  const handleExportPersonalDataImage = async () => {
    try {
      const res = await fetch('/api/v1/privacy/me');
      const payload = await res.json();
      if (res.ok && payload.ok) {
        await downloadClientDataCardPng(payload.data as ClientCardExportData);
        setToast('Tarjeta personalizada con tus datos descargada como imagen PNG.');
      } else {
        setToast('No fue posible generar tu tarjeta de datos en este momento.');
      }
    } catch {
      setToast('No fue posible generar tu tarjeta de datos en este momento.');
    }
  };

  const handleSubmitOrderBrebReceipt = async (orderNumber: string) => {
    const refValue = (receiptInputs[orderNumber] ?? '').trim();
    if (refValue.length < 4) {
      setToast('Ingresa un número de comprobante válido (mínimo 4 caracteres).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferReceiptRef: refValue,
          customerEmail: user?.email || undefined,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setToast(`Comprobante ${refValue} registrado en el pedido ${orderNumber}.`);
        await fetchOrders();
      } else {
        setToast(payload?.error?.message ?? 'No fue posible registrar el comprobante.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderNumber: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          customerEmail: user?.email || undefined,
          reason: 'Cancelado desde el panel Mi Cuenta',
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setToast(`El pedido ${orderNumber} ha sido cancelado y las unidades fueron liberadas.`);
        await fetchOrders();
      } else {
        setToast(payload?.error?.message ?? 'No fue posible cancelar el pedido.');
      }
    } catch {
      setToast('Error de red al cancelar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setUser(null);
    setAddresses([]);
    setOrders([]);
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    await refreshUser();
    setToast('Has cerrado sesión correctamente.');
  };

  // Nunca mostrar el perfil de cliente si está cargando sesión o redirigiendo a administrador
  if (authLoading || redirectingAdmin || isAdminSession) {
    return (
      <div className="empty-state" role="status" style={{ minHeight: '60vh' }}>
        <span className="spinner" style={{ borderTopColor: '#168bff', borderColor: '#168bff33' }} />
        <p>{redirectingAdmin || isAdminSession ? 'Abriendo panel administrativo...' : 'Verificando tu sesión...'}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="auth-section">
        <div className="container">
          <Link className="auth-back" href="/">
            <Icon name="back" size={16} />
            Volver a la tienda
          </Link>

          <div className="auth-layout">
            {tab === 'login' ? (
              <aside className="auth-story auth-story-artwork" aria-label="Bienvenido a BSP Store">
                <Link
                  href="/"
                  aria-label="BSP Store, ir a la página de inicio"
                  style={{ display: 'block', width: '100%' }}
                >
                  <img
                    src="/brand/bsp-login-panel.webp"
                    width={512}
                    height={661}
                    alt="BSP Store. Tu próximo nivel. Un solo lugar. Todo tu setup. Tu espacio para descubrir, crear y llevar tu experiencia más lejos."
                    decoding="async"
                  />
                </Link>
              </aside>
            ) : (
              <aside className="auth-story">
                <Link className="auth-brand" aria-label="BSP STORE, volver al inicio" href="/">
                  <Logo light />
                </Link>
                <span className="eyebrow">TU PRÓXIMO NIVEL</span>
                <h2>
                  Un solo lugar.
                  <br />
                  Todo <span>tu setup.</span>
                </h2>
                <p>Tu espacio para descubrir, crear y llevar tu experiencia más lejos.</p>
                <figure className="auth-mascot">
                  <BrandMascot sizes="(max-width: 580px) 90vw, 480px" />
                  <figcaption>TECNOLOGÍA CON CARÁCTER. ADN BSP.</figcaption>
                </figure>
                <div className="auth-story-footer">
                  <Icon name="shield" size={20} />
                  <span>
                    Una experiencia diseñada alrededor de ti.<small>Simple. Clara. A tu ritmo.</small>
                  </span>
                </div>
              </aside>
            )}

            <div className="auth-card">
              <span className="eyebrow blue">
                {tab === 'register'
                  ? 'BIENVENIDO A BSP STORE'
                  : tab === 'forgot'
                    ? 'RECUPERA TU ACCESO'
                    : 'TU ESPACIO TE ESPERA'}
              </span>
              <h1>
                {tab === 'register'
                  ? 'Crea tu cuenta.'
                  : tab === 'forgot'
                    ? '¿Olvidaste tu contraseña?'
                    : 'Qué bueno verte de nuevo.'}
              </h1>
              <p className="auth-description">
                {tab === 'register'
                  ? 'Crea tu espacio y empieza a construir lo que sigue.'
                  : tab === 'forgot'
                    ? 'Escribe tu correo para recuperar el acceso a tu cuenta.'
                    : 'Ingresa a tu cuenta y continúa donde lo dejaste.'}
              </p>

              {errorMsg && (
                <p className="account-error" role="alert" style={{ marginBottom: '16px' }}>
                  {errorMsg}
                </p>
              )}
              {successMsg && (
                <div className="account-notice" role="status" style={{ marginBottom: '16px' }}>
                  <Icon name="check" size={17} />
                  <span>{successMsg}</span>
                </div>
              )}

              {tab !== 'forgot' && (
                <>
                  <button
                    type="button"
                    className="google-button"
                    onClick={handleGoogleConnect}
                    disabled={loading}
                  >
                    <GoogleMark />
                    Continuar con Google
                    <Icon name="arrow" size={15} />
                  </button>
                  <div className="auth-divider">
                    <span />o continúa con tu correo
                    <span />
                  </div>
                </>
              )}

              {tab === 'login' && (
                <form className="auth-form" onSubmit={handleLogin}>
                  <label className="field">
                    Correo electrónico <span>*</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="tu@correo.com"
                      required
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    Contraseña <span>*</span>
                    <div className="password-input">
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        maxLength={100}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={showPassword}
                      >
                        <Icon name="eye" size={18} />
                      </button>
                    </div>
                  </label>

                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => {
                      resetMessages();
                      setTab('forgot');
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>

                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner" />
                        Validando...
                      </>
                    ) : (
                      <>
                        Iniciar sesión
                        <Icon name="arrow" size={17} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {tab === 'register' && (
                <form className="auth-form" onSubmit={handleRegister}>
                  <label className="field">
                    Nombre completo <span>*</span>
                    <input
                      name="name"
                      placeholder="¿Cómo te llamas?"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    Correo electrónico <span>*</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="tu@correo.com"
                      required
                      autoComplete="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    Teléfono celular (10 dígitos)
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="3028000240"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    />
                  </label>

                  <label className="field">
                    Contraseña <span>*</span>
                    <div className="password-input">
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        maxLength={100}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={showPassword}
                      >
                        <Icon name="eye" size={18} />
                      </button>
                    </div>
                  </label>

                  <label className="auth-terms">
                    <input
                      type="checkbox"
                      required
                      checked={acceptPrivacy && acceptTerms}
                      onChange={(e) => {
                        setAcceptPrivacy(e.target.checked);
                        setAcceptTerms(e.target.checked);
                      }}
                    />
                    <span>
                      Autorizo el tratamiento de datos personales (
                      <Link href="/privacidad" style={{ color: '#168bff' }}>
                        Ley 1581
                      </Link>
                      ) y acepto los{' '}
                      <Link href="/terminos" style={{ color: '#168bff' }}>
                        Términos y Condiciones (Ley 1480)
                      </Link>
                      .
                    </span>
                  </label>

                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner" />
                        Creando cuenta...
                      </>
                    ) : (
                      <>
                        Crear mi cuenta
                        <Icon name="arrow" size={17} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {tab === 'forgot' && (
                <>
                  <form className="auth-form" onSubmit={handleForgot}>
                    <label className="field">
                      Correo electrónico <span>*</span>
                      <input
                        name="email"
                        type="email"
                        placeholder="tu@correo.com"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                      />
                    </label>
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                      Generar enlace de recuperación
                      <Icon name="arrow" size={17} />
                    </button>
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
                </>
              )}

              <div className="auth-switch">
                {tab === 'forgot' ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setTab('login');
                    }}
                  >
                    <Icon name="back" size={14} />
                    Volver al inicio de sesión
                  </button>
                ) : (
                  <>
                    {tab === 'register' ? '¿Ya tienes una cuenta?' : '¿Es tu primera vez aquí?'}
                    <button
                      type="button"
                      onClick={() => {
                        resetMessages();
                        setTab(tab === 'register' ? 'login' : 'register');
                      }}
                    >
                      {tab === 'register' ? 'Inicia sesión' : 'Crea tu cuenta'}
                      <Icon name="arrow" size={14} />
                    </button>
                  </>
                )}
              </div>

              <div className="auth-demo-footer">
                <Icon name="lock" size={15} />
                <p>
                  También puedes finalizar tu compra en la tienda como invitado sin necesidad de
                  crear una cuenta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="account-background">
      <div className="container account-container">
        <div className="account-breadcrumb">
          <button type="button" onClick={() => router.push('/')}>
            Inicio
          </button>
          <span>/</span>
          <button type="button" onClick={() => setAccountSection('overview')}>
            Mi cuenta
          </button>
          {accountSection !== 'overview' && (
            <>
              <span>/</span>
              <span>{accountSection === 'orders' ? 'Mis pedidos' : 'Datos personales'}</span>
            </>
          )}
        </div>

        <div className="account-shell">
          <aside className="account-sidebar">
            <div className="account-person">
              <span className="account-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" />
                ) : (
                  user.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <span className="session-tag">{getRoleLabelEs(user.role)}</span>
            </div>

            <span className="sidebar-label">MI ESPACIO</span>
            <nav aria-label="Navegación de mi cuenta">
              {(
                [
                  { id: 'overview', label: 'Resumen', icon: 'grid' },
                  { id: 'orders', label: 'Mis pedidos', icon: 'box' },
                  { id: 'profile', label: 'Datos personales', icon: 'user' },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={accountSection === item.id ? 'selected' : ''}
                  onClick={() => setAccountSection(item.id)}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}
            </nav>

            <span className="sidebar-label">ACCESOS RÁPIDOS</span>
            <button
              type="button"
              className="sidebar-products"
              onClick={() => router.push('/favoritos')}
            >
              <Icon name="heart" size={18} />
              Mis favoritos
              {favorites.length > 0 && <span>{favorites.length}</span>}
            </button>
            <button
              type="button"
              className="sidebar-products"
              onClick={() => router.push('/seguimiento')}
            >
              <Icon name="truck" size={18} />
              Sigue tu pedido
            </button>

            <div className="sidebar-help">
              <Icon name="shield" size={23} />
              <strong>Compra con respaldo BSP.</strong>
              <p>
                Gestiona tus pedidos, tu foto de perfil y tus direcciones de envío en Colombia
                desde un solo lugar.
              </p>
            </div>

            <button type="button" className="logout-button" onClick={handleLogout}>
              <Icon name="logout" size={17} />
              Cerrar sesión
            </button>
          </aside>

          <div className="account-main">
            {accountSection === 'overview' && (
              <>
                <div className="account-heading">
                  <div>
                    <span className="eyebrow blue">BIENVENIDO A TU ESPACIO</span>
                    <h1>Hola, {user.name.split(' ')[0]}.</h1>
                    <p>Tu cuenta, tus compras y todo lo que viene para tu setup.</p>
                  </div>
                </div>

                <div className="account-welcome">
                  <div>
                    <span className="eyebrow">EL SIGUIENTE NIVEL LO ELIGES TÚ</span>
                    <h2>
                      Todo tu universo BSP.
                      <br />
                      En un solo lugar.
                    </h2>
                    <p>
                      Consulta el seguimiento de tus pedidos, personaliza tu foto de perfil y guarda
                      tus direcciones de entrega en toda Colombia.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => router.push('/tienda')}
                      >
                        Explorar productos
                        <Icon name="arrow" size={17} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAccountSection('profile')}
                      >
                        Personalizar mi perfil
                        <Icon name="user" size={17} />
                      </button>
                    </div>
                  </div>
                  <BrandMascot
                    className="account-mascot-image"
                    sizes="(max-width: 580px) 90vw, 260px"
                  />
                </div>

                <div className="account-shortcuts">
                  <button
                    type="button"
                    className="account-panel"
                    onClick={() => setAccountSection('orders')}
                  >
                    <Icon name="box" size={23} />
                    <strong>Mis pedidos ({orders.length})</strong>
                    <p>Consulta el estado y guía de tus compras.</p>
                    <Icon name="arrow" size={17} />
                  </button>
                  <button
                    type="button"
                    className="account-panel"
                    onClick={() => setAccountSection('profile')}
                  >
                    <Icon name="user" size={23} />
                    <strong>Mi perfil ({addresses.length} dir.)</strong>
                    <p>Foto de usuario, datos y direcciones al día.</p>
                    <Icon name="arrow" size={17} />
                  </button>
                  <button
                    type="button"
                    className="account-panel"
                    onClick={() => router.push('/favoritos')}
                  >
                    <Icon name="heart" size={23} />
                    <strong>Mis favoritos ({favorites.length})</strong>
                    <p>Tus periféricos guardados para tu próximo upgrade.</p>
                    <Icon name="arrow" size={17} />
                  </button>
                </div>

                <div className="account-profile-strip">
                  <span className="gate-icon">
                    <Icon name="shield" size={24} />
                  </span>
                  <div>
                    <strong>Privacidad y Habeas Data Colombia (Ley 1581 de 2012)</strong>
                    <p>
                      Descarga tu tarjeta personalizada con el resumen oficial de tus datos en BSP
                      Store.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-link blue"
                    onClick={() => void handleExportPersonalDataImage()}
                  >
                    Descargar mis datos
                    <Icon name="download" size={16} />
                  </button>
                </div>
              </>
            )}

            {accountSection === 'orders' && (
              <>
                <div className="account-heading">
                  <div>
                    <span className="eyebrow blue">CADA UPGRADE TIENE UNA HISTORIA</span>
                    <h1>Mis pedidos</h1>
                    <p>Todos los detalles de tus compras y despachos, en un mismo lugar.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => router.push('/seguimiento')}
                  >
                    <Icon name="truck" size={16} />
                    Sigue tu pedido por N°
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="account-panel account-empty">
                    <span className="gate-icon">
                      <Icon name="box" size={34} />
                    </span>
                    <h2>Aún no hay pedidos para mostrar</h2>
                    <p>
                      Cuando confirmes tu compra, aquí podrás ver el estado del pago, tu domicilio
                      local en Bucaramanga o el número de guía de tu envío nacional.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => router.push('/tienda')}
                    >
                      Explorar la tienda
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {orders.map((ord) => {
                      const statusInfo = ORDER_STATUS_BADGES[ord.status] ?? {
                        label: ord.status,
                        bg: '#f1f5f9',
                        color: '#334155',
                      };
                      const localOrder = isLocalDeliveryDestination(ord.department, ord.city);
                      const brebPay = ord.payments?.find((p) => p.provider === 'BREB_TRANSFER');
                      const trackingNum = ord.shipment?.trackingNumber;
                      const carrierName =
                        ord.shipment?.carrier?.name ??
                        (localOrder ? 'Domicilio Local (Bucaramanga)' : 'Transportadora Nacional');

                      return (
                        <div
                          key={ord.id}
                          className="account-panel"
                          style={{
                            padding: '20px 22px',
                            display: 'grid',
                            gap: '12px',
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <strong style={{ fontSize: '15px' }}>{ord.orderNumber}</strong>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '3px 10px',
                                  borderRadius: '999px',
                                  background: statusInfo.bg,
                                  color: statusInfo.color,
                                }}
                              >
                                {statusInfo.label}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px' }}>
                              Total: <strong>{cop(ord.totalCop)} COP</strong> ·{' '}
                              <span className="muted" style={{ fontSize: '12px' }}>
                                {new Date(ord.createdAt).toLocaleDateString('es-CO')}
                              </span>
                            </div>
                          </div>

                          <div style={{ fontSize: '13px' }}>
                            <strong>Productos:</strong>{' '}
                            {ord.items
                              .map((it) => `${it.productName} (x${it.quantity})`)
                              .join(', ')}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              justifyContent: 'space-between',
                              gap: '8px',
                              fontSize: '12px',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--line)',
                            }}
                          >
                            <span>
                              <strong>Destino:</strong> {ord.streetAddress} — {ord.city},{' '}
                              {ord.department}
                            </span>
                            <span>
                              <strong>Modalidad:</strong>{' '}
                              {localOrder ? 'Envío Local' : 'Envío Nacional'} ·{' '}
                              <strong>Empresa:</strong> {carrierName} ·{' '}
                              <strong>N° de guía:</strong>{' '}
                              {trackingNum || (localOrder ? 'Mensajería local directa' : 'En asignación')}
                            </span>
                          </div>

                          {brebPay && (
                            <div
                              style={{
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #bae6fd',
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '12px',
                              }}
                            >
                              <span>
                                <strong>Llave Bre-B (@bbbsp):</strong>{' '}
                                {brebPay.transferReceiptRef
                                  ? `Comprobante registrado: ${brebPay.transferReceiptRef}`
                                  : 'Pendiente de adjuntar número de comprobante'}
                              </span>
                              {ord.status === 'PENDING_BREB_VERIFICATION' && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    placeholder="N° comprobante Bre-B"
                                    className="breb-receipt-input"
                                    value={
                                      receiptInputs[ord.orderNumber] ??
                                      brebPay.transferReceiptRef ??
                                      ''
                                    }
                                    onChange={(e) =>
                                      setReceiptInputs((prev) => ({
                                        ...prev,
                                        [ord.orderNumber]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => void handleSubmitOrderBrebReceipt(ord.orderNumber)}
                                    className="btn btn-primary"
                                    style={{ minHeight: '34px', padding: '6px 12px', fontSize: '11px' }}
                                  >
                                    Guardar comprobante
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {(ord.status === 'PENDING_PAYMENT' ||
                              ord.status === 'PENDING_BREB_VERIFICATION') && (
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => void handleCancelOrder(ord.orderNumber)}
                                className="btn danger-button"
                                style={{ minHeight: '34px', padding: '6px 12px', fontSize: '11px' }}
                              >
                                Cancelar pedido
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {accountSection === 'profile' && (
              <>
                <div className="account-heading">
                  <div>
                    <span className="eyebrow blue">TU INFORMACIÓN, SIEMPRE A MANO</span>
                    <h1>Datos personales</h1>
                    <p>Personaliza tu foto de perfil, tus datos y tus direcciones de entrega.</p>
                  </div>
                </div>

                {errorMsg && (
                  <p className="account-error" role="alert" style={{ marginBottom: '16px' }}>
                    {errorMsg}
                  </p>
                )}

                <form className="account-panel profile-form" onSubmit={handleUpdateProfile}>
                  <h2>Información de tu perfil</h2>

                  {/* Personalización de imagen de usuario (Avatar) */}
                  <div className="avatar-editor-row">
                    <div className="avatar-preview-ring">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" />
                      ) : (
                        user.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <strong style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                        Foto de perfil personalizada
                      </strong>
                      <p style={{ fontSize: '11px', color: 'var(--theme-muted, #758090)', marginBottom: '10px' }}>
                        Sube una imagen JPG, PNG o WebP para personalizar tu cuenta BSP Store.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input
                          ref={avatarFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => void handleAvatarUpload(e.target.files?.[0])}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={avatarBusy}
                          style={{ minHeight: '36px', padding: '7px 14px', fontSize: '11px' }}
                          onClick={() => avatarFileInputRef.current?.click()}
                        >
                          <Icon name="upload" size={15} />
                          {avatarBusy
                            ? 'Subiendo...'
                            : user.avatarUrl
                              ? 'Cambiar foto'
                              : 'Subir foto de perfil'}
                        </button>
                        {user.avatarUrl && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={avatarBusy}
                            style={{ minHeight: '36px', padding: '7px 12px', fontSize: '11px' }}
                            onClick={() => void handleRemoveAvatar()}
                          >
                            Quitar foto
                          </button>
                        )}
                      </div>
                      <div className="avatar-presets-wrap">
                        <span>O elige un avatar gaming BSP:</span>
                        <div className="avatar-presets-grid">
                          {GAMING_AVATAR_PRESETS.map((preset) => (
                            <button
                              key={preset.url}
                              type="button"
                              disabled={avatarBusy}
                              className={`avatar-preset-btn ${
                                user.avatarUrl === preset.url ? 'is-selected' : ''
                              }`}
                              title={preset.label}
                              aria-label={`Elegir avatar ${preset.label}`}
                              onClick={() => void handleSelectAvatarPreset(preset.url)}
                            >
                              <img src={preset.url} alt={preset.label} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label className="field full-width">
                      Nombre completo <span>*</span>
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Correo electrónico
                      <input type="email" value={user.email} disabled />
                    </label>
                    <label className="field">
                      Teléfono celular (10 dígitos)
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={profilePhone}
                        onChange={(e) =>
                          setProfilePhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                        }
                        placeholder="3028000240"
                      />
                    </label>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    Guardar perfil
                    <Icon name="check" size={17} />
                  </button>
                </form>

                {/* Libreta de Direcciones en Colombia */}
                <div
                  className="account-panel profile-form"
                  style={{ marginTop: '22px' }}
                  id="address-form-card"
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '18px',
                    }}
                  >
                    <h2 style={{ marginBottom: 0 }}>
                      Mis direcciones de entrega ({addresses.length})
                    </h2>
                    {editingAddressId && (
                      <button
                        type="button"
                        className="text-link blue"
                        onClick={resetAddressForm}
                      >
                        + Crear nueva dirección
                      </button>
                    )}
                  </div>

                  {addresses.length > 0 && (
                    <div className="address-list" style={{ marginBottom: '22px' }}>
                      {addresses.map((a) => {
                        const isLocal = isLocalDeliveryDestination(a.department, a.city);
                        return (
                          <div key={a.id} className="address-item">
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
                                  <span className="session-tag" style={{ marginTop: 0 }}>
                                    Predeterminada
                                  </span>
                                )}
                                <span className="session-tag" style={{ marginTop: 0 }}>
                                  {isLocal ? 'Domicilio Local' : 'Envío Nacional'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {!a.isDefault && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ minHeight: '30px', padding: '4px 10px', fontSize: '10px' }}
                                    disabled={addressBusyId === a.id}
                                    onClick={() => void handleMakeDefaultAddress(a)}
                                  >
                                    Usar como principal
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ minHeight: '30px', padding: '4px 10px', fontSize: '10px' }}
                                  onClick={() => startEditAddress(a)}
                                >
                                  <Icon name="edit" size={14} />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn danger-button"
                                  style={{ minHeight: '30px', padding: '4px 10px', fontSize: '10px' }}
                                  disabled={addressBusyId === a.id}
                                  onClick={() => void handleDeleteAddress(a.id)}
                                >
                                  <Icon name="trash" size={14} />
                                  Eliminar
                                </button>
                              </div>
                            </div>
                            <span style={{ fontSize: '12px' }}>
                              {a.streetAddress}
                              {a.additionalInfo ? ` (${a.additionalInfo})` : ''} — {a.city},{' '}
                              {a.department}
                            </span>
                            <small style={{ fontSize: '11px', color: '#8c99ac' }}>
                              Recibe: {a.recipientName} ({a.phone})
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <form onSubmit={handleSaveAddress}>
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
                      <label className="field">
                        Teléfono de contacto (10 dígitos) <span>*</span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          required
                          maxLength={10}
                          placeholder="3028000240"
                          value={addrPhone}
                          onChange={(e) =>
                            setAddrPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                          }
                        />
                      </label>
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
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={loading}
                      style={{ marginTop: '20px' }}
                    >
                      {editingAddressId ? 'Actualizar dirección' : 'Guardar dirección'}
                      <Icon name="check" size={17} />
                    </button>
                  </form>
                </div>

                <section className="account-panel profile-security">
                  <span className="gate-icon">
                    <Icon name="shield" size={23} />
                  </span>
                  <div>
                    <h3>Privacidad y Habeas Data (Ley 1581 de 2012)</h3>
                    <p>
                      Descarga una imagen personalizada de BSP Store con el resumen oficial de tus
                      datos personales, direcciones y pedidos.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleExportPersonalDataImage()}
                  >
                    Descargar mis datos
                    <Icon name="download" size={16} />
                  </button>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
