'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { cop, isLocalDeliveryDestination } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

type AdminTab = 'reports' | 'orders' | 'products' | 'inventory' | 'customers';

interface DashboardReport {
  metrics: {
    totalOrders: number;
    confirmedOrdersCount: number;
    totalRevenueCop: number;
    totalDiscountsCop: number;
    totalShippingCop: number;
    pendingBrebCount: number;
    pendingDispatchCount: number;
    totalCustomers: number;
    totalActiveProducts: number;
    lowStockCount: number;
  };
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    unitsSold: number;
    revenueCop: number;
  }>;
  inventoryAlerts: Array<{
    productId: string;
    sku: string;
    name: string;
    category: string;
    onHand: number;
    reserved: number;
    available: number;
    threshold: number;
    status: 'OUT_OF_STOCK' | 'LOW_STOCK';
  }>;
  coupons: Array<{
    id: string;
    code: string;
    description: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    usedCount: number;
    isActive: boolean;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actor?: { name: string; email: string } | null;
  }>;
}

interface AdminProductItem {
  id: string;
  legacyId: number | null;
  sku: string;
  slug: string;
  name: string;
  tag: string | null;
  description: string;
  price: number;
  compareAtPrice: number | null;
  discountPercent: number | null;
  badge: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isOffer: boolean;
  category: { id: string; name: string };
  brand: { id: string; name: string };
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  variants: Array<{ id: string; sku: string; name: string; optionValue: string }>;
  inventory: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    lowStockThreshold: number;
  } | null;
}

interface AdminOrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  department: string;
  city: string;
  streetAddress: string;
  subtotalCop: number;
  discountCop: number;
  shippingCop: number;
  totalCop: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    transferReceiptRef: string | null;
    brebKeyUsed: string | null;
    amountCop: number;
  }>;
  shipment: {
    id: string;
    status: string;
    trackingNumber: string | null;
    carrierId: string | null;
    carrier: { id: string; name: string; code: string } | null;
  } | null;
}

interface AdminCustomerItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  roleName: string;
  ordersCount: number;
  totalSpentCop: number;
  createdAt: string;
}

interface AdminContactInquiry {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { user, setUser, setToast, refreshCatalog } = useStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [loadingData, setLoadingData] = useState(false);

  // Login de administrador si no hay sesión activa con rol ADMIN/STAFF
  const [loginEmail, setLoginEmail] = useState('admin@bspstore.com.co');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Datos de módulos
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; slug: string; description?: string | null; isActive?: boolean }>
  >([]);
  const [brands, setBrands] = useState<
    Array<{ id: string; name: string; slug: string; description?: string | null; isActive?: boolean }>
  >([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [customers, setCustomers] = useState<AdminCustomerItem[]>([]);
  const [inquiries, setInquiries] = useState<AdminContactInquiry[]>([]);

  // Filtros de pedidos
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderSearchFilter, setOrderSearchFilter] = useState('');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');

  // Formulario de creación de producto
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdSubtitle, setNewProdSubtitle] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('299900');
  const [newProdComparePrice, setNewProdComparePrice] = useState('');
  const [newProdCategoryId, setNewProdCategoryId] = useState('');
  const [newProdBrandId, setNewProdBrandId] = useState('');
  const [newProdImage, setNewProdImage] = useState(
    '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png'
  );
  const [newProdStock, setNewProdStock] = useState('15');
  const [newProdVariantName, setNewProdVariantName] = useState('Negro');

  // Formulario rápido de Categoría y Marca
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  // Edición de Producto existente (Precios, Oferta, Stock, Categoría, Marca, Imagen)
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdComparePrice, setEditProdComparePrice] = useState('');
  const [editProdStock, setEditProdStock] = useState('');
  const [editProdCategoryId, setEditProdCategoryId] = useState('');
  const [editProdBrandId, setEditProdBrandId] = useState('');
  const [editProdImage, setEditProdImage] = useState('');
  const [editProdDesc, setEditProdDesc] = useState('');

  // Edición de Categoría existente
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Edición de Marca existente
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editBrandDesc, setEditBrandDesc] = useState('');

  // Carga Masiva con Estándar Excel (.csv / .txt / pegado desde Excel)
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Formulario de Cupones Promocionales
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponType, setNewCouponType] = useState<'PERCENTAGE' | 'FIXED_COP'>('PERCENTAGE');
  const [newCouponValue, setNewCouponValue] = useState('10');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState('200000');

  // Formulario de ajuste de inventario
  const [invProductId, setInvProductId] = useState('');
  const [invType, setInvType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [invQuantity, setInvQuantity] = useState('5');
  const [invThreshold, setInvThreshold] = useState('5');
  const [invReason, setInvReason] = useState('Reabastecimiento de bodega principal');

  // Estado local de despacho por pedido
  const [dispatchDrafts, setDispatchDrafts] = useState<
    Record<
      string,
      {
        status: string;
        carrierId: string;
        trackingNumber: string;
      }
    >
  >({});

  const isAuthorizedAdmin = Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

  const loadAdminEverything = useCallback(async () => {
    if (!isAuthorizedAdmin) return;
    setLoadingData(true);
    try {
      const orderParams = new URLSearchParams();
      if (orderStatusFilter !== 'ALL') orderParams.set('status', orderStatusFilter);
      if (orderSearchFilter.trim()) orderParams.set('search', orderSearchFilter.trim());
      if (orderDateFrom) orderParams.set('from', orderDateFrom);
      if (orderDateTo) orderParams.set('to', orderDateTo);

      const [repRes, prodRes, ordRes, custRes, inqRes] = await Promise.all([
        fetch('/api/v1/admin/reports'),
        fetch('/api/v1/admin/products'),
        fetch(`/api/v1/admin/orders?${orderParams.toString()}`),
        fetch('/api/v1/admin/customers'),
        fetch('/api/v1/contact'),
      ]);

      const [repJson, prodJson, ordJson, custJson, inqJson] = await Promise.all([
        repRes.json(),
        prodRes.json(),
        ordRes.json(),
        custRes.json(),
        inqRes.json().catch(() => ({ ok: false })),
      ]);

      if (repRes.ok && repJson.ok) setReport(repJson.data);
      if (prodRes.ok && prodJson.ok) {
        setProducts(prodJson.data.products);
        setCategories(prodJson.data.categories);
        setBrands(prodJson.data.brands);
        if (!newProdCategoryId && prodJson.data.categories[0]) {
          setNewProdCategoryId(prodJson.data.categories[0].id);
        }
        if (!newProdBrandId && prodJson.data.brands[0]) {
          setNewProdBrandId(prodJson.data.brands[0].id);
        }
        if (!invProductId && prodJson.data.products[0]) {
          setInvProductId(prodJson.data.products[0].id);
        }
      }
      if (ordRes.ok && ordJson.ok) {
        setOrders(ordJson.data.orders);
        setCarriers(ordJson.data.carriers);
      }
      if (custRes.ok && custJson.ok) {
        setCustomers(custJson.data.customers);
      }
      if (inqRes.ok && inqJson?.ok) {
        setInquiries(inqJson.data.inquiries ?? []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [
    isAuthorizedAdmin,
    orderStatusFilter,
    orderSearchFilter,
    orderDateFrom,
    orderDateTo,
    newProdCategoryId,
    newProdBrandId,
    invProductId,
  ]);

  useEffect(() => {
    loadAdminEverything();
  }, [loadAdminEverything]);

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      setLoginError(payload?.error?.message ?? 'Credenciales inválidas.');
      return;
    }
    if (payload.data.user.role !== 'ADMIN' && payload.data.user.role !== 'STAFF') {
      setLoginError('Esta cuenta no tiene privilegios administrativos (ADMIN o STAFF).');
      return;
    }
    setUser(payload.data.user);
    setToast(`Bienvenido al Panel Administrativo, ${payload.data.user.name.split(' ')[0]}`);
  };

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    const priceNum = Number(newProdPrice);
    const compareNum = newProdComparePrice ? Number(newProdComparePrice) : null;
    const stockNum = Number(newProdStock);

    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: newProdSku,
        name: newProdName,
        subtitle: newProdSubtitle,
        description: newProdDesc,
        price: priceNum,
        compareAtPrice: compareNum,
        discountPercent:
          compareNum && compareNum > priceNum
            ? Math.round(((compareNum - priceNum) / compareNum) * 100)
            : undefined,
        categoryId: newProdCategoryId,
        brandId: newProdBrandId,
        imageUrl: newProdImage,
        initialStock: stockNum,
        isFeatured: true,
        isNew: true,
        isOffer: Boolean(compareNum && compareNum > priceNum),
        variants: [
          {
            name: newProdVariantName || 'Negro',
            sku: `${newProdSku}-V1`,
            optionValue: newProdVariantName || 'Negro',
          },
        ],
      }),
    });

    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast(`Producto ${payload.data.product.name} creado correctamente.`);
      setShowNewProductForm(false);
      setNewProdSku('');
      setNewProdName('');
      setNewProdSubtitle('');
      setNewProdDesc('');
      await loadAdminEverything();
      void refreshCatalog();
    } else {
      setToast(payload?.error?.message ?? 'Error al crear el producto.');
    }
  };

  const handleToggleProductActive = async (prod: AdminProductItem) => {
    const res = await fetch(`/api/v1/admin/products/${prod.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !prod.isActive }),
    });
    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast(
        `Producto ${prod.sku} ${!prod.isActive ? 'activado' : 'desactivado'} correctamente.`
      );
      await loadAdminEverything();
      void refreshCatalog();
    }
  };

  const handleStartEditProduct = (prod: AdminProductItem) => {
    setEditingProdId(prod.id);
    setEditProdName(prod.name);
    setEditProdPrice(String(prod.price));
    setEditProdComparePrice(prod.compareAtPrice ? String(prod.compareAtPrice) : '');
    setEditProdStock(String(prod.inventory?.quantityOnHand ?? 15));
    setEditProdCategoryId(prod.category.id);
    setEditProdBrandId(prod.brand.id);
    const primaryImg = prod.images.find((i) => i.isPrimary)?.url ?? prod.images[0]?.url ?? '';
    setEditProdImage(primaryImg);
    setEditProdDesc(prod.description);
    setShowNewProductForm(false);
  };

  const handleUpdateProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProdId) return;
    const priceNum = Number(editProdPrice);
    const compareNum = editProdComparePrice.trim() ? Number(editProdComparePrice) : null;
    const stockNum = Number(editProdStock);

    const res = await fetch(`/api/v1/admin/products/${editingProdId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editProdName.trim(),
        price: priceNum,
        compareAtPrice: compareNum,
        stockQuantity: stockNum,
        categoryId: editProdCategoryId,
        brandId: editProdBrandId,
        imageUrl: editProdImage.trim() || undefined,
        description: editProdDesc.trim(),
        isOffer: Boolean(compareNum && compareNum > priceNum),
      }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setToast(`Producto "${payload.data.product.name}" actualizado correctamente.`);
      setEditingProdId(null);
      await loadAdminEverything();
      void refreshCatalog();
    } else {
      setToast(payload?.error?.message ?? 'No se pudo actualizar el producto.');
    }
  };

  const handleStartEditCategory = (cat: {
    id: string;
    name: string;
    description?: string | null;
  }) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description ?? '');
  };

  const handleUpdateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCatId || !editCatName.trim()) return;
    const res = await fetch('/api/v1/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingCatId,
        name: editCatName.trim(),
        description: editCatDesc.trim() || undefined,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setToast(`Categoría "${payload.data.category.name}" actualizada.`);
      setEditingCatId(null);
      setEditCatName('');
      setEditCatDesc('');
      await loadAdminEverything();
      void refreshCatalog();
    } else {
      setToast(payload?.error?.message ?? 'No se pudo actualizar la categoría.');
    }
  };

  const handleStartEditBrand = (b: {
    id: string;
    name: string;
    description?: string | null;
  }) => {
    setEditingBrandId(b.id);
    setEditBrandName(b.name);
    setEditBrandDesc(b.description ?? '');
  };

  const handleUpdateBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBrandId || !editBrandName.trim()) return;
    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'UPDATE_BRAND',
        id: editingBrandId,
        name: editBrandName.trim(),
        description: editBrandDesc.trim() || undefined,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setToast(`Marca "${payload.data.brand.name}" actualizada.`);
      setEditingBrandId(null);
      setEditBrandName('');
      setEditBrandDesc('');
      await loadAdminEverything();
      void refreshCatalog();
    } else {
      setToast(payload?.error?.message ?? 'No se pudo actualizar la marca.');
    }
  };

  const handleDownloadExcelTemplate = () => {
    const header =
      'SKU;Nombre;Categoria;Marca;Precio_COP;Precio_Anterior_COP;Stock;Variante;Imagen_URL;Descripcion';
    const sample1 =
      'BSP-0001;Mouse Logitech G502 X Plus;Mouse gamer;Logitech G;649900;699900;18;Negro;/images/g502x-plus-gallery-1-black.png;Mouse inalambrico LIGHTSPEED con sensor HERO 25K e iluminacion RGB.';
    const sample2 =
      'BSP-0010;Audifonos HyperX Cloud III Wireless;Audífonos y audio;HYPERX;549900;;12;Negro;/images/g733-black-gallery-1.png;Audifonos inalambricos de alta autonomia y confort competitivo.';
    const csvContent = '\uFEFF' + [header, sample1, sample2].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_estandar_excel_bsp_store.csv';
    link.click();
    URL.revokeObjectURL(url);
    setToast('Plantilla estándar de Excel descargada.');
  };

  const handleExcelFileUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setBulkCsvText(text);
    setToast(`Archivo "${file.name}" cargado. Revisa los datos y presiona Procesar Carga Masiva.`);
  };

  const handleProcessBulkUpload = async (e: FormEvent) => {
    e.preventDefault();
    const lines = bulkCsvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setToast('Sube un archivo Excel (.csv) o pega las filas antes de procesar.');
      return;
    }

    const dataLines =
      lines[0]?.toLowerCase().includes('sku') && lines[0]?.toLowerCase().includes('nombre')
        ? lines.slice(1)
        : lines;

    const parsedRows = dataLines
      .map((line) => {
        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
        const sku = cols[0] ?? '';
        const name = cols[1] ?? '';
        const categoryName = cols[2] || 'Accesorios';
        const brandName = cols[3] || 'Logitech G';
        const price = Number((cols[4] ?? '0').replace(/[^\d]/g, ''));
        const compareAtRaw = (cols[5] ?? '').replace(/[^\d]/g, '');
        const compareAtPrice = compareAtRaw ? Number(compareAtRaw) : null;
        const stock = Number((cols[6] ?? '10').replace(/[^\d]/g, '')) || 10;
        const variantName = cols[7] || 'Estándar';
        const imageUrl =
          cols[8] || '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png';
        const description =
          cols[9] || `${name} original con garantía en Colombia y despacho asegurado.`;
        return {
          sku,
          name,
          categoryName,
          brandName,
          price,
          compareAtPrice,
          stock,
          variantName,
          imageUrl,
          description,
        };
      })
      .filter((r) => r.sku.length >= 2 && r.name.length >= 2 && r.price > 0);

    if (parsedRows.length === 0) {
      setToast('No se encontraron filas válidas (verifica SKU, Nombre y Precio_COP).');
      return;
    }

    setBulkLoading(true);
    try {
      const res = await fetch('/api/v1/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'BULK_EXCEL',
          rows: parsedRows,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload?.ok) {
        setToast(
          `Carga masiva completada: ${payload.data.createdCount} creados y ${payload.data.updatedCount} actualizados.`
        );
        setBulkCsvText('');
        setShowBulkUpload(false);
        await loadAdminEverything();
        void refreshCatalog();
      } else {
        setToast(payload?.error?.message ?? 'Error al procesar la carga masiva.');
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'CATEGORY', name: newCategoryName }),
    });
    if (res.ok) {
      setNewCategoryName('');
      setToast('Categoría registrada.');
      await loadAdminEverything();
    }
  };

  const handleCreateBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'BRAND', name: newBrandName }),
    });
    if (res.ok) {
      setNewBrandName('');
      setToast('Marca registrada.');
      await loadAdminEverything();
    }
  };

  const handleCreateCoupon = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim() || !newCouponDesc.trim()) return;
    const res = await fetch('/api/v1/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newCouponCode.trim().toUpperCase(),
        description: newCouponDesc.trim(),
        type: newCouponType,
        value: Number(newCouponValue),
        minOrderCop: Number(newCouponMinOrder) || 0,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setNewCouponCode('');
      setNewCouponDesc('');
      setToast(`Cupón ${payload.data.coupon.code} guardado y activado.`);
      await loadAdminEverything();
    } else {
      setToast(payload?.error?.message ?? 'No fue posible guardar el cupón.');
    }
  };

  const handleToggleCoupon = async (couponId: string, currentActive: boolean) => {
    const res = await fetch('/api/v1/coupons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: couponId, isActive: !currentActive }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setToast(
        `Cupón ${payload.data.coupon.code} ${!currentActive ? 'activado' : 'desactivado'}.`
      );
      await loadAdminEverything();
    }
  };

  const handleAdjustInventory = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/v1/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: invProductId,
        type: invType,
        quantity: Number(invQuantity),
        lowStockThreshold: Number(invThreshold),
        reason: invReason,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast('Movimiento de inventario registrado y auditado.');
      await loadAdminEverything();
      void refreshCatalog();
    } else {
      setToast(payload?.error?.message ?? 'No fue posible ajustar el inventario.');
    }
  };

  const handleBrebVerification = async (
    orderId: string,
    decision: 'VERIFY_BREB_PAYMENT' | 'REJECT_BREB_PAYMENT'
  ) => {
    const res = await fetch('/api/v1/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        action: decision,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast(
        decision === 'VERIFY_BREB_PAYMENT'
          ? 'Pago con Llave Bre-B (@bbbsp) aprobado e inventario descontado.'
          : 'Pago Bre-B rechazado y reserva de inventario liberada.'
      );
      await loadAdminEverything();
    }
  };

  const handleSaveOrderDispatch = async (order: AdminOrderItem) => {
    const draft = dispatchDrafts[order.id] ?? {
      status: order.status,
      carrierId: order.shipment?.carrierId ?? carriers[0]?.id ?? '',
      trackingNumber: order.shipment?.trackingNumber ?? '',
    };

    const res = await fetch('/api/v1/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        action: 'UPDATE_STATUS_AND_SHIPMENT',
        status: draft.status,
        carrierId: draft.carrierId || null,
        trackingNumber: draft.trackingNumber || null,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast(`Pedido ${order.orderNumber} actualizado.`);
      await loadAdminEverything();
    } else {
      setToast(payload?.error?.message ?? 'Error al actualizar el pedido.');
    }
  };

  const handleRoleChange = async (userId: string, role: 'CUSTOMER' | 'STAFF' | 'ADMIN') => {
    const res = await fetch('/api/v1/admin/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast(`Rol actualizado a ${role}.`);
      await loadAdminEverything();
    } else {
      setToast(payload?.error?.message ?? 'Solo un ADMIN puede cambiar roles.');
    }
  };

  if (!isAuthorizedAdmin) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0E1521',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: '#151E2E',
            border: '1px solid #253248',
            borderRadius: '14px',
            padding: '36px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo light />
            <span
              style={{
                background: 'rgba(22, 139, 255, 0.16)',
                color: '#55B7FF',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              ADMIN CONSOLE
            </span>
          </div>

          <h1 style={{ fontSize: '24px', marginTop: '24px', marginBottom: '8px' }}>
            Panel Administrativo Independiente
          </h1>
          <p style={{ fontSize: '13px', color: '#9BA9BE', marginBottom: '24px' }}>
            Acceso exclusivo y protegido por RBAC para administradores (<strong>ADMIN</strong> y{' '}
            <strong>STAFF</strong>) de BSP Store Colombia.
          </p>

          {loginError && (
            <div
              role="alert"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #EF4444',
                color: '#FCA5A5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label
                htmlFor="admin-email"
                style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px' }}
              >
                Correo Administrativo
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: '#0E1521',
                  border: '1px solid #2E3C56',
                  color: '#FFFFFF',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '6px' }}
              >
                Contraseña
              </label>
              <input
                id="admin-password"
                type="password"
                required
                placeholder="BspAdmin2026*"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: '#0E1521',
                  border: '1px solid #2E3C56',
                  color: '#FFFFFF',
                  fontSize: '14px',
                }}
              />
            </div>

            <Button type="submit">
              Ingresar al Panel Administrativo
              <Icon name="lock" size={16} />
            </Button>
          </form>

          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #253248',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#9BA9BE',
            }}
          >
            <span>Cuenta seed: admin@bspstore.com.co</span>
            <Link href="/" style={{ color: '#55B7FF', fontWeight: 600 }}>
              ← Volver a la tienda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', color: '#10151F' }}>
      {/* Topbar Administrativo Independiente */}
      <header
        style={{
          background: '#0E1521',
          color: '#FFFFFF',
          borderBottom: '1px solid #1E293B',
          padding: '14px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <Link href="/admin" aria-label="BSP Store Admin">
            <Logo light />
          </Link>
          <span
            style={{
              background: '#168BFF',
              color: '#FFFFFF',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            CENTRO DE OPERACIONES · {user?.role}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
          <span style={{ color: '#94A3B8' }}>
            Operador: <strong style={{ color: '#FFFFFF' }}>{user?.name}</strong>
          </span>
          <Link
            href="/"
            style={{
              background: '#1E293B',
              color: '#E2E8F0',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            Ver Tienda Pública →
          </Link>
        </div>
      </header>

      {/* Barra de Navegación de Módulos Administrativos */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 28px',
        }}
      >
        <nav
          aria-label="Módulos del panel administrativo"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '10px 0',
          }}
        >
          {(
            [
              { id: 'reports', label: '1. Reportes y Dashboard' },
              {
                id: 'orders',
                label: `2. Pedidos, Bre-B (@bbbsp) y Envíos (${orders.length})`,
              },
              { id: 'products', label: `3. Productos, Categorías y Marcas (${products.length})` },
              { id: 'inventory', label: '4. Inventario y Alertas' },
              { id: 'customers', label: `5. Clientes y Roles (${customers.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                background: activeTab === tab.id ? '#168BFF' : 'transparent',
                color: activeTab === tab.id ? '#FFFFFF' : '#334155',
                border: activeTab === tab.id ? 'none' : '1px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido Principal */}
      <div className="container" style={{ padding: '28px 16px 64px' }}>
        {loadingData && !report && <p>Cargando información operativa...</p>}

        {/* TAB 1: REPORTES Y DASHBOARD */}
        {activeTab === 'reports' && report && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '16px',
              }}
            >
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  INGRESOS CONFIRMADOS
                </span>
                <strong style={{ display: 'block', fontSize: '24px', marginTop: '6px' }}>
                  {cop(report.metrics.totalRevenueCop)} COP
                </strong>
                <small style={{ color: '#16A34A' }}>
                  {report.metrics.confirmedOrdersCount} pedidos pagados
                </small>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  POR VERIFICAR LLAVE BRE-B (@bbbsp)
                </span>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '24px',
                    marginTop: '6px',
                    color: '#168BFF',
                  }}
                >
                  {report.metrics.pendingBrebCount} pedidos
                </strong>
                <small style={{ color: '#64748B' }}>Comisión $0 COP · Transferencia inmediata</small>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  DESCUENTOS OTORGADOS
                </span>
                <strong style={{ display: 'block', fontSize: '24px', marginTop: '6px' }}>
                  {cop(report.metrics.totalDiscountsCop)} COP
                </strong>
                <small style={{ color: '#64748B' }}>
                  Envíos recaudados: {cop(report.metrics.totalShippingCop)} COP
                </small>
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                  ALERTAS DE BAJO STOCK
                </span>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '24px',
                    marginTop: '6px',
                    color: report.metrics.lowStockCount > 0 ? '#DC2626' : '#16A34A',
                  }}
                >
                  {report.metrics.lowStockCount} productos
                </strong>
                <small style={{ color: '#64748B' }}>
                  {report.metrics.totalActiveProducts} productos activos en catálogo
                </small>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Productos más vendidos */}
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '22px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <h2 style={{ fontSize: '17px', marginBottom: '14px' }}>
                  Productos Más Vendidos
                </h2>
                {report.topSellingProducts.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748B' }}>
                    Aún no hay unidades vendidas registradas.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {report.topSellingProducts.map((item) => (
                      <div
                        key={item.productId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: '#F8FAFC',
                          borderRadius: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <div>
                          <strong>{item.productName}</strong>
                          <div style={{ color: '#64748B', fontSize: '11px' }}>SKU: {item.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{item.unitsSold} uds.</strong>
                          <div style={{ color: '#168BFF', fontSize: '12px', fontWeight: 700 }}>
                            {cop(item.revenueCop)} COP
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alertas de inventario y bitácora */}
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '22px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <h2 style={{ fontSize: '17px', marginBottom: '14px' }}>
                  Alertas de Inventario y Auditoría Reciente
                </h2>
                {report.inventoryAlerts.length > 0 ? (
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                    {report.inventoryAlerts.map((alert) => (
                      <div
                        key={alert.productId}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background:
                            alert.status === 'OUT_OF_STOCK' ? '#FEF2F2' : '#FFFBEB',
                          border:
                            alert.status === 'OUT_OF_STOCK'
                              ? '1px solid #FECACA'
                              : '1px solid #FDE68A',
                          fontSize: '13px',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          <strong>{alert.name}</strong> ({alert.sku})
                        </span>
                        <strong>
                          {alert.available === 0
                            ? 'AGOTADO (0 disp.)'
                            : `BAJO STOCK (${alert.available} disp.)`}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: '#16A34A', marginBottom: '16px' }}>
                    ✓ Todos los productos superan el umbral mínimo de existencias.
                  </p>
                )}

                <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#475569' }}>
                  Últimos Eventos de Seguridad y Operación (`AuditLog`)
                </h3>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {report.recentAuditLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      style={{
                        fontSize: '12px',
                        padding: '8px 10px',
                        background: '#F8FAFC',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        <strong>{log.action}</strong> · {log.entity}
                      </span>
                      <span style={{ color: '#64748B' }}>
                        {new Date(log.createdAt).toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gestión de Cupones Promocionales */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '22px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gap: '16px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '17px', marginBottom: '4px' }}>
                  Cupones Promocionales Activos (`/ofertas` y `/carrito`)
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Crea códigos promocionales o activa/desactiva beneficios vigentes para la tienda.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                }}
              >
                {report.coupons.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{c.code}</strong>{' '}
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          background: c.isActive ? '#DCFCE7' : '#F1F5F9',
                          color: c.isActive ? '#15803D' : '#64748B',
                          fontWeight: 700,
                        }}
                      >
                        {c.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                        {c.discountType === 'PERCENTAGE'
                          ? `${c.discountValue}% OFF`
                          : `${cop(c.discountValue)} COP OFF`}{' '}
                        · Mín: {cop(c.minOrderAmount)} COP · Usos: {c.usedCount}
                      </div>
                    </div>
                    <Button
                      secondary
                      type="button"
                      onClick={() => void handleToggleCoupon(c.id, c.isActive)}
                    >
                      {c.isActive ? 'Pausar' : 'Activar'}
                    </Button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCreateCoupon}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                  alignItems: 'end',
                  paddingTop: '12px',
                  borderTop: '1px solid #E2E8F0',
                }}
              >
                <Field
                  label="Código (ej. BUCARAMANGA15)"
                  required
                  value={newCouponCode}
                  onChange={setNewCouponCode}
                />
                <Field
                  label="Descripción comercial"
                  required
                  value={newCouponDesc}
                  onChange={setNewCouponDesc}
                />
                <label className="field">
                  Tipo de beneficio
                  <select
                    value={newCouponType}
                    onChange={(e) =>
                      setNewCouponType(e.target.value as 'PERCENTAGE' | 'FIXED_COP')
                    }
                  >
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FIXED_COP">Valor fijo ($ COP)</option>
                  </select>
                </label>
                <Field
                  label="Valor descuento"
                  type="number"
                  required
                  value={newCouponValue}
                  onChange={setNewCouponValue}
                />
                <Field
                  label="Compra mínima (COP)"
                  type="number"
                  required
                  value={newCouponMinOrder}
                  onChange={setNewCouponMinOrder}
                />
                <Button type="submit">Guardar cupón</Button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: PEDIDOS, PAGOS BRE-B (@bbbsp) Y DESPACHOS */}
        {activeTab === 'orders' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  htmlFor="filter-order-status"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}
                >
                  Estado del Pedido
                </label>
                <select
                  id="filter-order-status"
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    marginTop: '4px',
                  }}
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="PENDING_BREB_VERIFICATION">
                    Pendiente Verificación Bre-B (@bbbsp)
                  </option>
                  <option value="PENDING_PAYMENT">Pendiente Pago Wompi</option>
                  <option value="PAID">Pagado (PAID)</option>
                  <option value="PROCESSING">En alistamiento (PROCESSING)</option>
                  <option value="SHIPPED">Despachado (SHIPPED)</option>
                  <option value="DELIVERED">Entregado (DELIVERED)</option>
                  <option value="CANCELLED">Cancelado (CANCELLED)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="filter-order-search"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}
                >
                  Buscar por N° Pedido o Cliente
                </label>
                <input
                  id="filter-order-search"
                  placeholder="Ej. BSP-2026 o correo"
                  value={orderSearchFilter}
                  onChange={(e) => setOrderSearchFilter(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    marginTop: '4px',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="filter-order-from"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}
                >
                  Desde
                </label>
                <input
                  id="filter-order-from"
                  type="date"
                  value={orderDateFrom}
                  onChange={(e) => setOrderDateFrom(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    marginTop: '4px',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="filter-order-to"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}
                >
                  Hasta
                </label>
                <input
                  id="filter-order-to"
                  type="date"
                  value={orderDateTo}
                  onChange={(e) => setOrderDateTo(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    marginTop: '4px',
                  }}
                />
              </div>
            </div>

            {orders.length === 0 ? (
              <div
                style={{
                  background: '#FFFFFF',
                  padding: '32px',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                No se encontraron pedidos con los filtros seleccionados.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {orders.map((order) => {
                  const brebPayment = order.payments.find(
                    (p) => p.provider === 'BREB_TRANSFER'
                  );
                  const draft = dispatchDrafts[order.id] ?? {
                    status: order.status,
                    carrierId: order.shipment?.carrierId ?? carriers[0]?.id ?? '',
                    trackingNumber: order.shipment?.trackingNumber ?? '',
                  };

                  return (
                    <div
                      key={order.id}
                      style={{
                        background: '#FFFFFF',
                        padding: '22px',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        display: 'grid',
                        gap: '14px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          gap: '12px',
                          borderBottom: '1px solid #F1F5F9',
                          paddingBottom: '12px',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '16px' }}>{order.orderNumber}</strong>
                          <span
                            style={{
                              marginLeft: '10px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                            }}
                          >
                            {order.status}
                          </span>
                          <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                            Cliente: <strong>{order.customerName}</strong> ({order.customerEmail} ·{' '}
                            {order.customerPhone}) — Destino: {order.streetAddress}, {order.city} (
                            {order.department})
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '18px' }}>
                            {cop(order.totalCop)} COP
                          </strong>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            Medio: {order.paymentMethod} ·{' '}
                            {new Date(order.createdAt).toLocaleString('es-CO')}
                          </div>
                        </div>
                      </div>

                      {/* Bloque de Verificación de Llave Bre-B (@bbbsp) */}
                      {brebPayment && (
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            background: '#F0F9FF',
                            border: '1px solid #BAE6FD',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div style={{ fontSize: '13px' }}>
                            <strong>Transferencia Llave Bre-B ({brebPayment.brebKeyUsed ?? '@bbbsp'})</strong>{' '}
                            · Estado Pago: <strong>{brebPayment.status}</strong> · Comprobante
                            reportado:{' '}
                            <strong>
                              {brebPayment.transferReceiptRef ?? 'Pendiente de envío por cliente'}
                            </strong>
                          </div>

                          {order.status === 'PENDING_BREB_VERIFICATION' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  handleBrebVerification(order.id, 'VERIFY_BREB_PAYMENT')
                                }
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  background: '#16A34A',
                                  color: '#FFFFFF',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                ✓ Aprobar Pago Bre-B (@bbbsp)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleBrebVerification(order.id, 'REJECT_BREB_PAYMENT')
                                }
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  background: '#DC2626',
                                  color: '#FFFFFF',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                ✕ Rechazar y Liberar Stock
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Controles de Estado, Transportadora y Guía de Despacho */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                          gap: '12px',
                          alignItems: 'end',
                          background: '#F8FAFC',
                          padding: '14px',
                          borderRadius: '10px',
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700 }}>
                            Estado del Pedido
                          </label>
                          <select
                            aria-label={`Estado pedido ${order.orderNumber}`}
                            value={draft.status}
                            onChange={(e) =>
                              setDispatchDrafts((prev) => ({
                                ...prev,
                                [order.id]: { ...draft, status: e.target.value },
                              }))
                            }
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              marginTop: '4px',
                            }}
                          >
                            <option value="PENDING_BREB_VERIFICATION">
                              PENDING_BREB_VERIFICATION
                            </option>
                            <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                            <option value="PAID">PAID</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="REFUNDED">REFUNDED</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700 }}>
                            {isLocalDeliveryDestination(order.department, order.city)
                              ? 'Modalidad de Entrega Local'
                              : 'Transportadora Nacional'}
                          </label>
                          <select
                            aria-label={`Transportadora ${order.orderNumber}`}
                            value={draft.carrierId}
                            onChange={(e) =>
                              setDispatchDrafts((prev) => ({
                                ...prev,
                                [order.id]: { ...draft, carrierId: e.target.value },
                              }))
                            }
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              marginTop: '4px',
                            }}
                          >
                            {isLocalDeliveryDestination(order.department, order.city) ? (
                              <>
                                {carriers
                                  .filter((c) => c.code === 'DOMICILIO_LOCAL')
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                {!carriers.some((c) => c.code === 'DOMICILIO_LOCAL') && (
                                  <option value="">Domicilio Local</option>
                                )}
                              </>
                            ) : (
                              <>
                                <option value="">Seleccionar transportadora nacional...</option>
                                {carriers
                                  .filter((c) => c.code !== 'DOMICILIO_LOCAL')
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700 }}>
                            Número de Guía
                          </label>
                          <input
                            aria-label={`Número de guía ${order.orderNumber}`}
                            placeholder="Ej. SERV-99887766"
                            value={draft.trackingNumber}
                            onChange={(e) =>
                              setDispatchDrafts((prev) => ({
                                ...prev,
                                [order.id]: { ...draft, trackingNumber: e.target.value },
                              }))
                            }
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              marginTop: '4px',
                            }}
                          />
                        </div>

                        <Button
                          secondary
                          onClick={() => handleSaveOrderDispatch(order)}
                        >
                          Guardar Despacho / Estado
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PRODUCTOS, CATEGORÍAS Y MARCAS */}
        {activeTab === 'products' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <h2 style={{ fontSize: '20px' }}>Gestión de Catálogo Comercial</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Button
                  secondary
                  onClick={() => {
                    setShowBulkUpload(!showBulkUpload);
                    setShowNewProductForm(false);
                  }}
                >
                  <Icon name="upload" size={16} />
                  {showBulkUpload ? 'Cerrar Carga Masiva' : 'Carga Masiva (Estándar Excel)'}
                </Button>
                <Button
                  onClick={() => {
                    setShowNewProductForm(!showNewProductForm);
                    setShowBulkUpload(false);
                    setEditingProdId(null);
                  }}
                >
                  {showNewProductForm ? 'Cerrar Formulario' : '+ Crear Nuevo Producto'}
                </Button>
              </div>
            </div>

            {showBulkUpload && (
              <form
                onSubmit={handleProcessBulkUpload}
                style={{
                  background: '#FFFFFF',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '2px solid #168BFF',
                  display: 'grid',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '16px', color: '#0F172A' }}>
                      Carga Masiva de Productos y Precios (Estándar Excel)
                    </h3>
                    <p style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>
                      Descarga la plantilla estándar compatible con Microsoft Excel (`.csv`),
                      ajústala con tus nuevos productos o actualizaciones de precios/stock y súbela
                      o pega las filas aquí.
                    </p>
                  </div>
                  <Button type="button" secondary onClick={handleDownloadExcelTemplate}>
                    <Icon name="download" size={16} />
                    Descargar Plantilla Estándar Excel
                  </Button>
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    color: '#334155',
                  }}
                >
                  <strong>Columnas del estándar Excel:</strong>{' '}
                  <code>
                    SKU ; Nombre ; Categoria ; Marca ; Precio_COP ; Precio_Anterior_COP ; Stock ;
                    Variante ; Imagen_URL ; Descripcion
                  </code>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#F1F5F9',
                      border: '1px dashed #64748B',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="upload" size={16} />
                    Seleccionar archivo Excel (.csv / .txt)
                    <input
                      type="file"
                      accept=".csv,.txt"
                      style={{ display: 'none' }}
                      onChange={(e) => void handleExcelFileUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    o pega directamente las celdas copiadas desde Excel en el recuadro inferior:
                  </span>
                </div>

                <textarea
                  rows={5}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  placeholder={
                    'SKU;Nombre;Categoria;Marca;Precio_COP;Precio_Anterior_COP;Stock;Variante;Imagen_URL;Descripcion\nBSP-0001;Mouse Logitech G502 X Plus;Mouse gamer;Logitech G;649900;699900;18;Negro;/images/g502x-plus-gallery-1-black.png;Mouse inalámbrico LIGHTSPEED'
                  }
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button type="submit" disabled={bulkLoading}>
                    <Icon name="check" size={16} />
                    {bulkLoading ? 'Procesando carga...' : 'Procesar Carga Masiva'}
                  </Button>
                  <Button
                    type="button"
                    secondary
                    onClick={() => {
                      setShowBulkUpload(false);
                      setBulkCsvText('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            {editingProdId && (
              <form
                onSubmit={handleUpdateProduct}
                style={{
                  background: '#F0F9FF',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '2px solid #168BFF',
                  display: 'grid',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h3 style={{ fontSize: '16px', color: '#0F172A' }}>
                    Editar Producto (Actualizar Precio, Oferta, Stock o Categoría)
                  </h3>
                  <Button type="button" secondary onClick={() => setEditingProdId(null)}>
                    Cancelar edición
                  </Button>
                </div>

                <div className="form-grid">
                  <Field
                    label="Nombre del Producto"
                    required
                    value={editProdName}
                    onChange={setEditProdName}
                  />
                  <Field
                    label="Precio Venta Actual (COP)"
                    type="number"
                    required
                    value={editProdPrice}
                    onChange={setEditProdPrice}
                  />
                  <Field
                    label="Precio Anterior / Sin Descuento (COP - Opcional)"
                    type="number"
                    value={editProdComparePrice}
                    onChange={setEditProdComparePrice}
                  />
                  <Field
                    label="Stock Físico en Bodega (Unidades)"
                    type="number"
                    required
                    value={editProdStock}
                    onChange={setEditProdStock}
                  />
                  <label className="field">
                    <span>Categoría</span>
                    <select
                      value={editProdCategoryId}
                      onChange={(e) => setEditProdCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Marca</span>
                    <select
                      value={editProdBrandId}
                      onChange={(e) => setEditProdBrandId(e.target.value)}
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    className="full"
                    label="URL Fotografía Principal"
                    required
                    value={editProdImage}
                    onChange={setEditProdImage}
                  />
                  <div
                    className="full"
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      Imágenes genéricas de prueba:
                    </span>
                    {[
                      { label: 'Mouse G502 X', url: '/images/g502x-plus-gallery-1-black.png' },
                      { label: 'Mouse Superlight', url: '/images/pro-x-superlight-black-gallery-1.png' },
                      { label: 'Teclado G915 TKL', url: '/images/g915-tkl-gallery-1-carbon.png' },
                      { label: 'Teclado G PRO', url: '/images/us-pro-gaming-keyboard-gallery-topdown.png' },
                      { label: 'Audífonos G733', url: '/images/g733-black-gallery-1.png' },
                      {
                        label: 'Audífonos G PRO X 2',
                        url: '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png',
                      },
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setEditProdImage(preset.url)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: editProdImage === preset.url ? '#168BFF' : '#FFFFFF',
                          color: editProdImage === preset.url ? '#FFFFFF' : '#334155',
                          border: '1px solid #CBD5E1',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Field
                    className="full"
                    label="Descripción Técnica y Comercial"
                    required
                    value={editProdDesc}
                    onChange={setEditProdDesc}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button type="submit">
                    <Icon name="check" size={16} />
                    Guardar Cambios del Producto
                  </Button>
                </div>
              </form>
            )}

            {showNewProductForm && (
              <form
                onSubmit={handleCreateProduct}
                style={{
                  background: '#FFFFFF',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'grid',
                  gap: '16px',
                }}
              >
                <h3 style={{ fontSize: '16px' }}>Registrar Nuevo Producto</h3>
                <div className="form-grid">
                  <Field
                    label="SKU Único"
                    required
                    value={newProdSku}
                    onChange={(val) => setNewProdSku(val)}
                    placeholder="LOG-G-PRO-X2"
                  />
                  <Field
                    label="Nombre del Producto"
                    required
                    value={newProdName}
                    onChange={(val) => setNewProdName(val)}
                    placeholder="Logitech G PRO X 2 Lightspeed"
                  />
                  <Field
                    label="Subtítulo Comercial"
                    required
                    value={newProdSubtitle}
                    onChange={(val) => setNewProdSubtitle(val)}
                    placeholder="Inalámbrico · Drivers de Grafeno 50mm"
                  />
                  <Field
                    label="Precio Venta (COP)"
                    type="number"
                    required
                    value={newProdPrice}
                    onChange={(val) => setNewProdPrice(val)}
                  />
                  <Field
                    label="Precio Anterior (COP - Opcional)"
                    type="number"
                    value={newProdComparePrice}
                    onChange={(val) => setNewProdComparePrice(val)}
                  />
                  <Field
                    label="Stock Inicial"
                    type="number"
                    required
                    value={newProdStock}
                    onChange={(val) => setNewProdStock(val)}
                  />

                  <label className="field">
                    <span>Categoría</span>
                    <select
                      value={newProdCategoryId}
                      onChange={(e) => setNewProdCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Marca</span>
                    <select
                      value={newProdBrandId}
                      onChange={(e) => setNewProdBrandId(e.target.value)}
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Field
                    label="URL Fotografía Principal"
                    required
                    value={newProdImage}
                    onChange={(val) => setNewProdImage(val)}
                  />
                  <div className="full" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                      Imágenes genéricas de prueba:
                    </span>
                    {[
                      { label: 'Mouse G502 X', url: '/images/g502x-plus-gallery-1-black.png' },
                      { label: 'Mouse Superlight', url: '/images/pro-x-superlight-black-gallery-1.png' },
                      { label: 'Teclado G915 TKL', url: '/images/g915-tkl-gallery-1-carbon.png' },
                      { label: 'Teclado G PRO', url: '/images/us-pro-gaming-keyboard-gallery-topdown.png' },
                      { label: 'Audífonos G733', url: '/images/g733-black-gallery-1.png' },
                      {
                        label: 'Audífonos G PRO X 2',
                        url: '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png',
                      },
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setNewProdImage(preset.url)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: newProdImage === preset.url ? '#168BFF' : '#F1F5F9',
                          color: newProdImage === preset.url ? '#FFFFFF' : '#334155',
                          border: '1px solid #CBD5E1',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Field
                    label="Variante Inicial (Color / Edición)"
                    required
                    value={newProdVariantName}
                    onChange={(val) => setNewProdVariantName(val)}
                  />
                  <Field
                    className="full"
                    label="Descripción Técnica y Comercial"
                    required
                    value={newProdDesc}
                    onChange={(val) => setNewProdDesc(val)}
                    placeholder="Descripción completa del periférico..."
                  />
                </div>
                <div>
                  <Button type="submit">Guardar Producto</Button>
                </div>
              </form>
            )}

            {/* Creación rápida de Categorías y Marcas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              <form
                onSubmit={handleCreateCategory}
                style={{
                  background: '#FFFFFF',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'end',
                }}
              >
                <div style={{ flex: 1 }}>
                  <Field
                    label="Nueva Categoría"
                    value={newCategoryName}
                    onChange={(val) => setNewCategoryName(val)}
                    placeholder="Ej. Sillas Gamer"
                  />
                </div>
                <Button type="submit" secondary>
                  Agregar
                </Button>
              </form>

              <form
                onSubmit={handleCreateBrand}
                style={{
                  background: '#FFFFFF',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'end',
                }}
              >
                <div style={{ flex: 1 }}>
                  <Field
                    label="Nueva Marca"
                    value={newBrandName}
                    onChange={(val) => setNewBrandName(val)}
                    placeholder="Ej. SteelSeries"
                  />
                </div>
                <Button type="submit" secondary>
                  Agregar
                </Button>
              </form>
            </div>

            {/* Gestión y Edición de Categorías Registradas */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px 20px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px' }}>
                  Categorías del Catálogo ({categories.length})
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Haz clic en Editar para cambiar el nombre o descripción de una categoría
                </span>
              </div>

              {editingCatId && (
                <form
                  onSubmit={handleUpdateCategory}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#F0F9FF',
                    border: '1px solid #93C5FD',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'end',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <Field
                      label="Nombre de la Categoría"
                      required
                      value={editCatName}
                      onChange={setEditCatName}
                    />
                  </div>
                  <div style={{ flex: 2, minWidth: '240px' }}>
                    <Field
                      label="Descripción comercial"
                      value={editCatDesc}
                      onChange={setEditCatDesc}
                      placeholder="Subtítulo o descripción de la categoría"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button type="submit">Guardar Categoría</Button>
                    <Button type="button" secondary onClick={() => setEditingCatId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                    }}
                  >
                    <strong>{cat.name}</strong>
                    <button
                      type="button"
                      onClick={() => handleStartEditCategory(cat)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        border: '1px solid #BFDBFE',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name="edit" size={12} />
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Gestión y Edición de Marcas Registradas */}
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px 20px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px' }}>
                  Marcas del Catálogo ({brands.length})
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Haz clic en Editar para cambiar el nombre o descripción de una marca
                </span>
              </div>

              {editingBrandId && (
                <form
                  onSubmit={handleUpdateBrand}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#F0F9FF',
                    border: '1px solid #93C5FD',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'end',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <Field
                      label="Nombre de la Marca"
                      required
                      value={editBrandName}
                      onChange={setEditBrandName}
                    />
                  </div>
                  <div style={{ flex: 2, minWidth: '240px' }}>
                    <Field
                      label="Descripción comercial"
                      value={editBrandDesc}
                      onChange={setEditBrandDesc}
                      placeholder="Descripción de la marca"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button type="submit">Guardar Marca</Button>
                    <Button type="button" secondary onClick={() => setEditingBrandId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {brands.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                    }}
                  >
                    <strong>{b.name}</strong>
                    <button
                      type="button"
                      onClick={() => handleStartEditBrand(b)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        border: '1px solid #BFDBFE',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name="edit" size={12} />
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabla de Productos */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Producto / SKU</th>
                    <th style={{ padding: '12px 16px' }}>Categoría / Marca</th>
                    <th style={{ padding: '12px 16px' }}>Precio COP</th>
                    <th style={{ padding: '12px 16px' }}>Stock Disponible</th>
                    <th style={{ padding: '12px 16px' }}>Estado</th>
                    <th style={{ padding: '12px 16px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const avail = Math.max(
                      0,
                      (p.inventory?.quantityOnHand ?? 0) -
                        (p.inventory?.quantityReserved ?? 0)
                    );
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            SKU: {p.sku} · Variantes: {p.variants.length}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {p.category.name} · <strong>{p.brand.name}</strong>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{cop(p.price)} COP</strong>
                          {p.compareAtPrice && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#94A3B8',
                                textDecoration: 'line-through',
                              }}
                            >
                              {cop(p.compareAtPrice)} COP
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{avail} uds.</strong> (Físico: {p.inventory?.quantityOnHand ?? 0}{' '}
                          / Res: {p.inventory?.quantityReserved ?? 0})
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: p.isActive ? '#DCFCE7' : '#FEE2E2',
                              color: p.isActive ? '#166534' : '#991B1B',
                            }}
                          >
                            {p.isActive ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleStartEditProduct(p)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: '#EFF6FF',
                                color: '#1D4ED8',
                                border: '1px solid #BFDBFE',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Icon name="edit" size={13} />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleProductActive(p)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {p.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: INVENTARIO Y MOVIMIENTOS */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <form
              onSubmit={handleAdjustInventory}
              style={{
                background: '#FFFFFF',
                padding: '22px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gap: '16px',
              }}
            >
              <h2 style={{ fontSize: '18px' }}>
                Registrar Movimiento o Ajuste de Inventario Auditado
              </h2>
              <div className="form-grid">
                <label className="field">
                  <span>Producto</span>
                  <select
                    value={invProductId}
                    onChange={(e) => setInvProductId(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — Físico: {p.inventory?.quantityOnHand ?? 0}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Tipo de Movimiento</span>
                  <select
                    value={invType}
                    onChange={(e) =>
                      setInvType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')
                    }
                  >
                    <option value="IN">ENTRADA (IN) — Sumar unidades</option>
                    <option value="OUT">SALIDA (OUT) — Descontar unidades</option>
                    <option value="ADJUSTMENT">
                      CONTEO FÍSICO (ADJUSTMENT) — Fijar stock exacto
                    </option>
                  </select>
                </label>

                <Field
                  label="Cantidad de Unidades"
                  type="number"
                  required
                  value={invQuantity}
                  onChange={(val) => setInvQuantity(val)}
                />
                <Field
                  label="Umbral de Alerta Bajo Stock"
                  type="number"
                  required
                  value={invThreshold}
                  onChange={(val) => setInvThreshold(val)}
                />
                <Field
                  className="full"
                  label="Motivo Auditado del Movimiento"
                  required
                  value={invReason}
                  onChange={(val) => setInvReason(val)}
                />
              </div>
              <div>
                <Button type="submit">Aplicar Movimiento en Inventario</Button>
              </div>
            </form>

            <div
              style={{
                background: '#FFFFFF',
                padding: '22px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
              }}
            >
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
                Estado Actual de Existencias en Bodega
              </h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {products.map((p) => {
                  const onHand = p.inventory?.quantityOnHand ?? 0;
                  const reserved = p.inventory?.quantityReserved ?? 0;
                  const avail = Math.max(0, onHand - reserved);
                  const threshold = p.inventory?.lowStockThreshold ?? 5;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: avail <= threshold ? '#FFFBEB' : '#F8FAFC',
                        fontSize: '13px',
                      }}
                    >
                      <span>
                        <strong>{p.name}</strong> ({p.sku})
                      </span>
                      <span>
                        En mano: <strong>{onHand}</strong> · Reservado:{' '}
                        <strong>{reserved}</strong> · Disponible:{' '}
                        <strong style={{ color: avail === 0 ? '#DC2626' : '#168BFF' }}>
                          {avail}
                        </strong>{' '}
                        (Umbral: {threshold})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CLIENTES, ROLES Y CONSULTAS */}
        {activeTab === 'customers' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Nombre / Correo</th>
                    <th style={{ padding: '12px 16px' }}>Teléfono</th>
                    <th style={{ padding: '12px 16px' }}>Pedidos / Total Comprado</th>
                    <th style={{ padding: '12px 16px' }}>Rol RBAC</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{c.fullName}</strong>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{c.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{c.phone ?? 'No registrado'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{c.ordersCount} pedidos</strong> · {cop(c.totalSpentCop)} COP
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          aria-label={`Rol de ${c.email}`}
                          value={c.role}
                          onChange={(e) =>
                            handleRoleChange(
                              c.id,
                              e.target.value as 'CUSTOMER' | 'STAFF' | 'ADMIN'
                            )
                          }
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            fontWeight: 600,
                          }}
                        >
                          <option value="CUSTOMER">CUSTOMER (Cliente)</option>
                          <option value="STAFF">STAFF (Operador)</option>
                          <option value="ADMIN">ADMIN (Administrador)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                padding: '22px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '17px', marginBottom: '4px' }}>
                  Bandeja de Consultas y Solicitudes de Asesoría (`/contacto`)
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                  Mensajes enviados por los clientes desde el formulario de contacto.
                </p>
              </div>

              {inquiries.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#64748B' }}>
                  Aún no hay consultas registradas en la bandeja de entrada.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 320px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <strong style={{ fontSize: '14px', color: '#0F172A' }}>
                            {inq.name}
                          </strong>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: '#DBEAFE',
                              color: '#1D4ED8',
                              fontWeight: 700,
                            }}
                          >
                            {inq.topic}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>
                          {inq.email} · {new Date(inq.createdAt).toLocaleString('es-CO')}
                        </div>
                        <p style={{ fontSize: '13px', color: '#334155', margin: 0 }}>
                          {inq.message}
                        </p>
                      </div>
                      <a
                        href={`mailto:${inq.email}?subject=${encodeURIComponent(`BSP Store - Respuesta a tu consulta: ${inq.topic}`)}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px' }}
                      >
                        Responder por correo
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
