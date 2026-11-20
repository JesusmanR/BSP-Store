'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { cop, isLocalDeliveryDestination } from '@/data/catalog';
import { useStore } from '@/context/StoreContext';
import { BrandMascot } from '@/components/ui/BrandMascot';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

type AdminSection =
  | 'overview'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'settings';

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

const navSections: Array<{ id: AdminSection; label: string; icon: string }> = [
  { id: 'overview', label: 'Resumen general', icon: 'grid' },
  { id: 'products', label: 'Productos', icon: 'box' },
  { id: 'categories', label: 'Categorías y Marcas', icon: 'layers' },
  { id: 'orders', label: 'Pedidos', icon: 'bag' },
  { id: 'customers', label: 'Clientes', icon: 'users' },
  { id: 'inventory', label: 'Inventario', icon: 'layers' },
  { id: 'settings', label: 'Configuración', icon: 'settings' },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, setUser, refreshUser, setToast, refreshCatalog, theme, toggleTheme } = useStore();
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [period, setPeriod] = useState('Últimos 30 días');
  const [loadingData, setLoadingData] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);

  // Datos cargados desde PostgreSQL
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [categories, setCategories] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      description?: string | null;
      imageUrl?: string | null;
      isActive?: boolean;
    }>
  >([]);
  const [brands, setBrands] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      description?: string | null;
      logoUrl?: string | null;
      isActive?: boolean;
    }>
  >([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [customers, setCustomers] = useState<AdminCustomerItem[]>([]);
  const [inquiries, setInquiries] = useState<AdminContactInquiry[]>([]);

  // ProductManager state (matching Account.tsx)
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatusFilter, setProdStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [prodSort, setProdSort] = useState<'recent' | 'name' | 'price'>('recent');

  // ProductEditor state (matching Account.tsx ProductEditor)
  const [editorMode, setEditorMode] = useState<'list' | 'new' | 'edit'>('list');
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [edName, setEdName] = useState('');
  const [edSku, setEdSku] = useState('');
  const [edCategoryId, setEdCategoryId] = useState('');
  const [edBrandId, setEdBrandId] = useState('');
  const [edPrice, setEdPrice] = useState('299900');
  const [edComparePrice, setEdComparePrice] = useState('');
  const [edStock, setEdStock] = useState('15');
  const [edVariantName, setEdVariantName] = useState('Negro');
  const [edDesc, setEdDesc] = useState('');
  const [edImage, setEdImage] = useState('/images/g502x-plus-gallery-1-black.png');
  const [edSpecs, setEdSpecs] = useState<[string, string][]>([
    ['Conexión', 'LIGHTSPEED / Bluetooth'],
    ['Garantía', '12 meses en Colombia'],
  ]);
  const [edDragging, setEdDragging] = useState(false);
  const [edSaving, setEdSaving] = useState(false);
  const [edError, setEdError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carga masiva Excel
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Categorías & Marcas state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryImage, setNewCategoryImage] = useState('/images/g502x-plus-gallery-1-black.png');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatImage, setEditCatImage] = useState('');

  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDesc, setNewBrandDesc] = useState('');
  const [newBrandLogo, setNewBrandLogo] = useState('/images/brands/logitech-g.svg');
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editBrandDesc, setEditBrandDesc] = useState('');
  const [editBrandLogo, setEditBrandLogo] = useState('');

  // Pedidos state
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderSearchFilter, setOrderSearchFilter] = useState('');
  const [dispatchDrafts, setDispatchDrafts] = useState<
    Record<string, { status: string; carrierId: string; trackingNumber: string }>
  >({});

  // Inventario & Cupones state
  const [inventorySearch, setInventorySearch] = useState('');
  const [invProductId, setInvProductId] = useState('');
  const [invType, setInvType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [invQuantity, setInvQuantity] = useState('5');
  const [invThreshold, setInvThreshold] = useState('5');
  const [invReason, setInvReason] = useState('Reabastecimiento de bodega principal');

  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDesc, setNewCouponDesc] = useState('');
  const [newCouponType, setNewCouponType] = useState<'PERCENTAGE' | 'FIXED_COP'>('PERCENTAGE');
  const [newCouponValue, setNewCouponValue] = useState('10');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState('200000');

  const isAuthorizedAdmin = Boolean(user && (user.role === 'ADMIN' || user.role === 'STAFF'));

  // Auto-authenticate admin session if visiting /admin without an active admin session
  useEffect(() => {
    if (isAuthorizedAdmin || autoConnecting) return;
    let active = true;
    setAutoConnecting(true);
    void (async () => {
      try {
        const res = await fetch('/api/v1/auth/demo-admin', { method: 'POST' });
        const payload = await res.json();
        if (active && res.ok && payload?.ok) {
          setUser(payload.data.user);
        }
      } catch {
        // Ignore network errors
      } finally {
        if (active) setAutoConnecting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthorizedAdmin, autoConnecting, setUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = (params.get('tab') ?? '').toLowerCase();
    if (tabParam === 'dashboard' || tabParam === 'reports' || tabParam === 'overview') {
      setSection('overview');
    } else if (tabParam === 'products') {
      setSection('products');
    } else if (tabParam === 'categories' || tabParam === 'brands') {
      setSection('categories');
    } else if (tabParam === 'offers' || tabParam === 'inventory') {
      setSection('inventory');
    } else if (tabParam === 'orders') {
      setSection('orders');
    } else if (tabParam === 'customers' || tabParam === 'contact') {
      setSection('customers');
    } else if (tabParam === 'settings' || tabParam === 'configuracion') {
      setSection('settings');
    }
  }, []);

  const loadAdminEverything = useCallback(async () => {
    if (!isAuthorizedAdmin) return;
    setLoadingData(true);
    try {
      const orderParams = new URLSearchParams();
      if (orderStatusFilter !== 'ALL') orderParams.set('status', orderStatusFilter);
      if (orderSearchFilter.trim()) orderParams.set('search', orderSearchFilter.trim());

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
        if (!edCategoryId && prodJson.data.categories[0]) {
          setEdCategoryId(prodJson.data.categories[0].id);
        }
        if (!edBrandId && prodJson.data.brands[0]) {
          setEdBrandId(prodJson.data.brands[0].id);
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
    edCategoryId,
    edBrandId,
    invProductId,
  ]);

  useEffect(() => {
    void loadAdminEverything();
  }, [loadAdminEverything]);

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors
    }
    setUser(null);
    await refreshUser();
    setToast('Has cerrado sesión correctamente.');
    router.push('/cuenta');
  };

  const handleImageFileToDataUrl = (file: File | null | undefined, onResult: (url: string) => void) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setEdError('Selecciona una imagen JPG, PNG, WebP o SVG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEdError('La imagen debe pesar como máximo 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onResult(reader.result);
        setEdError('');
        setToast(`Imagen "${file.name}" cargada.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const openNewProductEditor = () => {
    setSection('products');
    setEditorMode('new');
    setEditingProdId(null);
    setEdName('');
    setEdSku(`BSP-${String(products.length + 1).padStart(4, '0')}`);
    setEdCategoryId(categories[0]?.id ?? '');
    setEdBrandId(brands[0]?.id ?? '');
    setEdPrice('299900');
    setEdComparePrice('');
    setEdStock('15');
    setEdVariantName('Negro');
    setEdDesc('');
    setEdImage('/images/g502x-plus-gallery-1-black.png');
    setEdSpecs([
      ['Conexión', 'Inalámbrica / USB'],
      ['Garantía', '12 meses en Colombia'],
    ]);
    setEdError('');
    setGlobalSearch('');
  };

  const openEditProductEditor = (prod: AdminProductItem) => {
    setSection('products');
    setEditorMode('edit');
    setEditingProdId(prod.id);
    setEdName(prod.name);
    setEdSku(prod.sku);
    setEdCategoryId(prod.category.id);
    setEdBrandId(prod.brand.id);
    setEdPrice(String(prod.price));
    setEdComparePrice(prod.compareAtPrice ? String(prod.compareAtPrice) : '');
    setEdStock(String(prod.inventory?.quantityOnHand ?? 15));
    setEdVariantName(prod.variants[0]?.optionValue ?? 'Negro');
    setEdDesc(prod.description);
    const primaryImg = prod.images.find((i) => i.isPrimary)?.url ?? prod.images[0]?.url ?? '/images/g502x-plus-gallery-1-black.png';
    setEdImage(primaryImg);
    setEdError('');
    setGlobalSearch('');
  };

  const handleSaveProductEditor = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEdError('');
    const submitterValue = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const isDraft = submitterValue === 'draft';

    if (!edName.trim() || !edDesc.trim()) {
      setEdError('Completa el nombre y una descripción válida del producto.');
      return;
    }
    if (!edImage) {
      setEdError('Agrega una imagen principal para continuar.');
      return;
    }

    const priceNum = Number(edPrice);
    const compareNum = edComparePrice.trim() ? Number(edComparePrice) : null;
    const stockNum = Number(edStock) || 0;

    setEdSaving(true);
    try {
      if (editorMode === 'edit' && editingProdId) {
        const res = await fetch(`/api/v1/admin/products/${editingProdId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: edName.trim(),
            price: priceNum,
            compareAtPrice: compareNum,
            stockQuantity: stockNum,
            categoryId: edCategoryId,
            brandId: edBrandId,
            imageUrl: edImage.trim(),
            description: edDesc.trim(),
            isActive: !isDraft,
            isOffer: Boolean(compareNum && compareNum > priceNum),
          }),
        });
        const payload = await res.json();
        if (res.ok && payload?.ok) {
          setToast(
            isDraft
              ? `Borrador "${payload.data.product.name}" guardado.`
              : `Producto "${payload.data.product.name}" actualizado en el catálogo.`
          );
          setEditorMode('list');
          setEditingProdId(null);
          await loadAdminEverything();
          void refreshCatalog();
        } else {
          setEdError(payload?.error?.message ?? 'No se pudo actualizar el producto.');
        }
      } else {
        const res = await fetch('/api/v1/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: edSku.trim() || `BSP-${Date.now().toString().slice(-4)}`,
            name: edName.trim(),
            subtitle: edSpecs[0]?.[1] || 'Alto rendimiento BSP Store',
            description: edDesc.trim(),
            price: priceNum,
            compareAtPrice: compareNum,
            discountPercent:
              compareNum && compareNum > priceNum
                ? Math.round(((compareNum - priceNum) / compareNum) * 100)
                : undefined,
            categoryId: edCategoryId || categories[0]?.id,
            brandId: edBrandId || brands[0]?.id,
            imageUrl: edImage.trim(),
            initialStock: stockNum,
            isFeatured: !isDraft,
            isNew: true,
            isOffer: Boolean(compareNum && compareNum > priceNum),
            variants: [
              {
                name: edVariantName || 'Negro',
                sku: `${edSku.trim() || 'BSP'}-V1`,
                optionValue: edVariantName || 'Negro',
              },
            ],
          }),
        });
        const payload = await res.json();
        if (res.ok && payload?.ok) {
          if (isDraft) {
            await fetch(`/api/v1/admin/products/${payload.data.product.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: false }),
            });
          }
          setToast(
            isDraft
              ? `Borrador "${payload.data.product.name}" guardado.`
              : `Producto "${payload.data.product.name}" publicado en la tienda.`
          );
          setEditorMode('list');
          await loadAdminEverything();
          void refreshCatalog();
        } else {
          setEdError(payload?.error?.message ?? 'No se pudo crear el producto.');
        }
      }
    } finally {
      setEdSaving(false);
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
        `Producto ${prod.sku} ${!prod.isActive ? 'publicado en tienda' : 'pasado a borrador'}.`
      );
      await loadAdminEverything();
      void refreshCatalog();
    }
  };

  const handleExportCatalogCsv = () => {
    const header =
      'SKU;Nombre;Categoria;Marca;Precio_COP;Precio_Anterior_COP;Stock;Estado;Descripcion';
    const rows = products.map((p) =>
      [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category.name}"`,
        `"${p.brand.name}"`,
        p.price,
        p.compareAtPrice ?? '',
        p.inventory?.quantityOnHand ?? 0,
        p.isActive ? 'Publicado' : 'Borrador',
        `"${(p.description || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
      ].join(';')
    );
    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bsp-catalogo-productos.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('Catálogo exportado en CSV.');
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
      body: JSON.stringify({
        entityType: 'CATEGORY',
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || `Equipos y referencias de ${newCategoryName.trim()}`,
        imageUrl: newCategoryImage.trim() || null,
      }),
    });
    if (res.ok) {
      setNewCategoryName('');
      setNewCategoryDesc('');
      setToast('Categoría registrada con imagen y descripción.');
      await loadAdminEverything();
      void refreshCatalog();
    }
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
        imageUrl: editCatImage.trim() || null,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setToast(`Categoría "${payload.data.category.name}" actualizada.`);
      setEditingCatId(null);
      await loadAdminEverything();
      void refreshCatalog();
    }
  };

  const handleCreateBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const res = await fetch('/api/v1/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'BRAND',
        name: newBrandName.trim(),
        description: newBrandDesc.trim() || `Marca oficial ${newBrandName.trim()}`,
        logoUrl: newBrandLogo.trim() || null,
      }),
    });
    if (res.ok) {
      setNewBrandName('');
      setNewBrandDesc('');
      setToast('Marca registrada con su logo y descripción.');
      await loadAdminEverything();
      void refreshCatalog();
    }
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
        logoUrl: editBrandLogo.trim() || null,
      }),
    });
    const payload = await res.json();
    if (res.ok && payload?.ok) {
      setToast(`Marca "${payload.data.brand.name}" actualizada.`);
      setEditingBrandId(null);
      await loadAdminEverything();
      void refreshCatalog();
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
        `Cupón ${payload.data.coupon.code} ${!currentActive ? 'activado' : 'pausado'}.`
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
      setToast('Movimiento de inventario registrado.');
      await loadAdminEverything();
      void refreshCatalog();
    }
  };

  const handleBrebVerification = async (
    orderId: string,
    decision: 'VERIFY_BREB_PAYMENT' | 'REJECT_BREB_PAYMENT'
  ) => {
    const res = await fetch('/api/v1/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action: decision }),
    });
    const payload = await res.json();
    if (res.ok && payload.ok) {
      setToast(
        decision === 'VERIFY_BREB_PAYMENT'
          ? 'Pago con Llave Bre-B (@bbbsp) aprobado.'
          : 'Pago Bre-B rechazado y reserva liberada.'
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
    }
  };

  const publishedCount = products.filter((p) => p.isActive).length;
  const draftCount = products.length - publishedCount;
  const activeSectionMeta = navSections.find((s) => s.id === section) ?? navSections[0]!;

  const filteredProductsList = products
    .filter((p) => {
      const matchesQuery = `${p.name} ${p.brand.name} ${p.sku}`
        .toLowerCase()
        .includes(prodSearch.toLowerCase());
      const matchesStatus =
        prodStatusFilter === 'all' ||
        (prodStatusFilter === 'published' ? p.isActive : !p.isActive);
      return matchesQuery && matchesStatus;
    })
    .sort((a, b) =>
      prodSort === 'name'
        ? a.name.localeCompare(b.name, 'es')
        : prodSort === 'price'
          ? a.price - b.price
          : 0
    );

  const heading = (overline: string, title: string, text: string) => (
    <div className="dash-page-heading">
      <div>
        <span className="dash-overline">{overline}</span>
        <h1>
          {title}
          <span>.</span>
        </h1>
        <p>{text}</p>
      </div>
    </div>
  );

  return (
    <div className="dash">
      {mobileNav && (
        <button
          type="button"
          className="dash-scrim"
          aria-label="Cerrar menú"
          onClick={() => setMobileNav(false)}
        />
      )}

      <aside className={`dash-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Administración">
        {/* El logo de la empresa siempre dirige a la página de inicio (/) */}
        <Link className="dash-logo" href="/" aria-label="BSP STORE, ir a la página de inicio">
          <Logo light />
        </Link>

        <div className="dash-workspace">
          <span className="dash-store-icon">
            <Icon name="bag" size={19} />
          </span>
          <div>
            <strong>BSP STORE</strong>
            <small>Panel de administración</small>
          </div>
          <span className="dash-workspace-dot" />
        </div>

        <span className="dash-nav-label">PRINCIPAL</span>
        <nav aria-label="Navegación de administración">
          {navSections.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                setSection(item.id);
                setMobileNav(false);
                if (item.id === 'products') setEditorMode('list');
              }}
              className={`${section === item.id ? 'active' : ''} ${
                index === navSections.length - 1 ? 'dash-nav-separated' : ''
              }`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '13px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 450,
                width: '100%',
                textAlign: 'left',
                color: section === item.id ? '#73baff' : 'inherit',
                background: section === item.id ? '#18314e' : 'transparent',
                boxShadow: section === item.id ? 'inset 3px 0 #168bff' : 'none',
              }}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.id === 'products' && (
                <small
                  style={{
                    marginLeft: 'auto',
                    border: '1px solid #344154',
                    borderRadius: '4px',
                    padding: '0 6px',
                    fontSize: '10px',
                  }}
                >
                  {products.length}
                </small>
              )}
              {item.id === 'orders' && orders.length > 0 && (
                <small
                  style={{
                    marginLeft: 'auto',
                    border: '1px solid #344154',
                    borderRadius: '4px',
                    padding: '0 6px',
                    fontSize: '10px',
                  }}
                >
                  {orders.length}
                </small>
              )}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-bottom">
          <div className="dash-demo-card">
            <span>
              <Icon name="info" size={17} /> CENTRO DE CONTROL
            </span>
            <p>
              Tu tienda, bajo control.
              <br />
              Catálogo, pedidos y envíos en tiempo real.
            </p>
            <button
              type="button"
              onClick={() => setSection('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                fontSize: '10px',
                color: '#e5edf7',
              }}
            >
              Ver estado de integraciones <Icon name="arrow" size={15} />
            </button>
          </div>

          <Link className="dash-store-link" href="/">
            <Icon name="external" size={17} />
            Volver a la tienda
            <Icon name="arrow" size={16} />
          </Link>

          <div className="dash-sidebar-user">
            <span className="dash-avatar">
              {(user?.name || 'AD').slice(0, 2).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{user?.name || 'Administrador'}</strong>
              <small>{user?.email || 'admin@bspstore.com.co'}</small>
            </div>
            <button
              type="button"
              onClick={handleAdminLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              style={{
                color: '#f87171',
                padding: '6px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 600,
              }}
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="dash-main">
        <div className="dash-topbar">
          <button
            type="button"
            className="dash-menu dash-icon-button"
            aria-label={mobileNav ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Icon name={mobileNav ? 'close' : 'menu'} size={20} />
          </button>

          <div className="dash-breadcrumb">
            Administración <Icon name="chevron" size={12} />
            <strong>{activeSectionMeta.label}</strong>
          </div>

          <div className="dash-global-search">
            <Icon name="search" size={17} />
            <input
              aria-label="Buscar productos del catálogo"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Buscar un producto..."
            />
            {globalSearch && (
              <div className="dash-search-results">
                <span>PRODUCTOS DEL CATÁLOGO</span>
                {products
                  .filter((p) =>
                    `${p.name} ${p.sku}`.toLowerCase().includes(globalSearch.toLowerCase())
                  )
                  .slice(0, 5)
                  .map((p) => {
                    const img =
                      p.images.find((i) => i.isPrimary)?.url ??
                      p.images[0]?.url ??
                      '/images/g502x-plus-gallery-1-black.png';
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => openEditProductEditor(p)}
                      >
                        <img src={img} alt="" />
                        <span>{p.name}</span>
                        <Icon name="arrow" size={14} />
                      </button>
                    );
                  })}
                {!products.some((p) =>
                  `${p.name} ${p.sku}`.toLowerCase().includes(globalSearch.toLowerCase())
                ) && <p>Sin coincidencias. Prueba otro nombre o SKU.</p>}
              </div>
            )}
          </div>

          <button
            type="button"
            className="theme-toggle"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Modo oscuro"
            title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          <span className="dash-demo-badge">
            <i style={{ background: '#16a34a' }} />
            Panel activo
          </span>

          <div className="dash-notification-wrap">
            <button
              type="button"
              className={`dash-icon-button ${notifications ? 'selected' : ''}`}
              aria-label="Avisos del panel"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" size={20} />
            </button>
            {notifications && (
              <div className="dash-notifications">
                <strong>Avisos de tu tienda</strong>
                <p>
                  {report?.metrics.pendingBrebCount
                    ? `Tienes ${report.metrics.pendingBrebCount} pago(s) Bre-B por verificar.`
                    : 'Todos los pagos Bre-B están al día.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSection('products');
                    setNotifications(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '11px 0',
                    color: '#1674d0',
                    fontSize: '10px',
                    borderTop: '1px solid var(--dash-line)',
                  }}
                >
                  {publishedCount} productos publicados · {draftCount} borradores{' '}
                  <Icon name="arrow" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('orders');
                    setNotifications(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '11px 0',
                    color: '#1674d0',
                    fontSize: '10px',
                    borderTop: '1px solid var(--dash-line)',
                  }}
                >
                  Revisar {orders.length} pedidos registrados <Icon name="arrow" size={14} />
                </button>
              </div>
            )}
          </div>

          <span className="dash-topbar-divider" />

          <span className="dash-avatar dash-avatar-light" title={user?.name || 'Administrador'}>
            {(user?.name || 'AD').slice(0, 2).toUpperCase()}
          </span>

          <button
            type="button"
            className="dash-button dash-button-white"
            onClick={handleAdminLogout}
            style={{ padding: '7px 11px', fontSize: '10px' }}
          >
            <Icon name="logout" size={15} />
            Cerrar sesión
          </button>
        </div>

        <main className="dash-content">
          {loadingData && !report && (
            <div className="dash-demo-notice" role="status">
              <Icon name="info" size={16} />
              <p>Sincronizando información del panel administrativo...</p>
            </div>
          )}

          {/* SECCIÓN 1: RESUMEN GENERAL */}
          {section === 'overview' && (
            <>
              <div className="dash-page-heading">
                <div>
                  <span className="dash-overline">TODO EN UN SOLO LUGAR</span>
                  <h1>
                    Tu tienda, en perspectiva<span>.</span>
                  </h1>
                  <p>Bienvenido. Este es el pulso de BSP STORE.</p>
                </div>
                <div className="dash-heading-actions">
                  <button
                    type="button"
                    className="dash-button dash-button-white"
                    onClick={handleExportCatalogCsv}
                  >
                    <Icon name="download" size={16} />
                    Exportar catálogo
                  </button>
                  <button
                    type="button"
                    className="dash-button dash-button-white"
                    onClick={() => {
                      setSection('products');
                      setEditorMode('list');
                      setShowBulkUpload(true);
                    }}
                  >
                    <Icon name="upload" size={16} />
                    Carga masiva Excel
                  </button>
                  <button
                    type="button"
                    className="dash-button dash-button-blue"
                    onClick={openNewProductEditor}
                  >
                    <Icon name="plus" size={17} />
                    Agregar producto
                  </button>
                </div>
              </div>

              <section className="dash-brand-welcome" aria-label="Bienvenida BSP">
                <div>
                  <span className="dash-overline">EL ADN DE TU TIENDA</span>
                  <h2>
                    Gran tecnología.
                    <br />
                    Una identidad propia.
                  </h2>
                  <p>Tu catálogo, tus ideas y el próximo nivel de BSP.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSection('products');
                      setEditorMode('list');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: '#80c4ff',
                      fontSize: '10px',
                      marginTop: '15px',
                    }}
                  >
                    Gestionar catálogo <Icon name="arrow" size={15} />
                  </button>
                </div>
                <BrandMascot sizes="(max-width: 540px) 100vw, 420px" />
              </section>

              <div className="dash-section-toolbar">
                <div className="dash-overview-tab">
                  <Icon name="grid" size={15} />
                  Vista general
                </div>
                <label className="dash-period">
                  <Icon name="calendar" size={15} />
                  <select
                    aria-label="Período del resumen comercial"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option>Últimos 7 días</option>
                    <option>Últimos 30 días</option>
                    <option>Este año</option>
                  </select>
                </label>
              </div>

              <div className="dash-stats">
                {[
                  {
                    label: 'Ventas totales',
                    value: cop(report?.metrics.totalRevenueCop ?? 0),
                    icon: 'wallet',
                    foot: `${report?.metrics.confirmedOrdersCount ?? 0} pedidos pagados`,
                    badge: 'COP',
                    local: true,
                  },
                  {
                    label: 'Pedidos',
                    value: String(orders.length).padStart(2, '0'),
                    icon: 'bag',
                    foot: `${report?.metrics.pendingBrebCount ?? 0} Bre-B por verificar`,
                    badge: 'En tienda',
                    local: orders.length > 0,
                  },
                  {
                    label: 'Productos',
                    value: String(products.length).padStart(2, '0'),
                    icon: 'box',
                    foot: `${publishedCount} publicados · ${draftCount} borradores`,
                    badge: 'Catálogo activo',
                    local: true,
                  },
                  {
                    label: 'Clientes',
                    value: String(customers.length).padStart(2, '0'),
                    icon: 'users',
                    foot: `${inquiries.length} consultas en buzón de contacto`,
                    badge: 'Registrados',
                    local: true,
                  },
                ].map((stat) => (
                  <section
                    className={`dash-stat ${stat.local ? 'dash-stat-highlight' : ''}`}
                    key={stat.label}
                  >
                    <div className="dash-stat-top">
                      <span>{stat.label}</span>
                      <span className="dash-stat-icon">
                        <Icon name={stat.icon} size={20} />
                      </span>
                    </div>
                    <div className="dash-stat-value">
                      {stat.value}
                      <span>{stat.badge}</span>
                    </div>
                    <p>
                      {stat.local && <span className="dash-blue-dot" />}
                      {stat.foot}
                    </p>
                  </section>
                ))}
              </div>

              <div className="dash-middle-grid">
                <section className="dash-panel dash-sales">
                  <div className="dash-panel-heading">
                    <div>
                      <h2>Resumen de ventas</h2>
                      <p>{period} · Valores en pesos colombianos</p>
                    </div>
                    <span className="dash-chart-key">
                      <i />
                      Ventas
                    </span>
                  </div>

                  {report && report.topSellingProducts.length > 0 ? (
                    <div style={{ padding: '20px 23px', display: 'grid', gap: '14px' }}>
                      {(() => {
                        const maxRev = Math.max(
                          1,
                          ...report.topSellingProducts.map((i) => i.revenueCop)
                        );
                        return report.topSellingProducts.map((item) => {
                          const pct = Math.max(8, Math.round((item.revenueCop / maxRev) * 100));
                          return (
                            <div key={item.productId} style={{ display: 'grid', gap: '6px' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '11px',
                                }}
                              >
                                <span>
                                  <strong>{item.productName}</strong> ({item.sku})
                                </span>
                                <strong>
                                  {item.unitsSold} uds. · {cop(item.revenueCop)} COP
                                </strong>
                              </div>
                              <div className="dash-category-track" style={{ height: '6px' }}>
                                <span
                                  style={{
                                    display: 'block',
                                    width: `${pct}%`,
                                    background: '#168bff',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="dash-chart">
                      <div className="dash-chart-scale">
                        <span>COP</span>
                        <span>—</span>
                        <span>—</span>
                        <span>—</span>
                      </div>
                      <div className="dash-chart-canvas">
                        <div className="dash-chart-grid" />
                        <div className="dash-chart-empty">
                          <span className="dash-empty-icon">
                            <Icon name="chart" size={24} />
                          </span>
                          <h3>El próximo nivel empieza aquí</h3>
                          <p>
                            Aquí verás la evolución de ventas reales
                            <br />a medida que se confirmen pedidos en la tienda.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSection('orders')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              color: '#2780d9',
                              fontSize: '9px',
                              fontWeight: 500,
                            }}
                          >
                            Ver pedidos <Icon name="arrow" size={14} />
                          </button>
                        </div>
                        <div className="dash-chart-labels">
                          {(period === 'Últimos 7 días'
                            ? ['Hace 6 días', 'Hace 4 días', 'Hace 2 días', 'Hoy']
                            : period === 'Este año'
                              ? ['Ene', 'Abr', 'Jul', 'Oct', 'Dic']
                              : ['Hace 30 días', 'Hace 20 días', 'Hace 10 días', 'Hoy']
                          ).map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="dash-chart-footer">
                    <Icon name="info" size={14} />
                    Ingresos calculados sobre pedidos pagados vía Bre-B (@bbbsp) y Wompi.
                  </div>
                </section>

                <section className="dash-panel dash-categories">
                  <div className="dash-panel-heading">
                    <div>
                      <h2>Tu catálogo</h2>
                      <p>Distribución por categoría</p>
                    </div>
                    <Icon name="layers" size={19} />
                  </div>
                  <div className="dash-catalog-total">
                    <strong>{String(products.length).padStart(2, '0')}</strong>
                    <span>
                      productos en
                      <br />
                      catálogo
                    </span>
                    <span className="dash-mini-badge">{categories.length} categorías</span>
                  </div>
                  <div className="dash-category-list">
                    {categories.length ? (
                      categories.map((cat, index) => {
                        const count = products.filter((p) => p.category.id === cat.id).length;
                        const pct = products.length ? (count / products.length) * 100 : 0;
                        const colors = ['#168bff', '#6caeff', '#a6caff', '#c9dcf5'];
                        return (
                          <div key={cat.id}>
                            <div>
                              <span>
                                <i style={{ background: colors[index % 4] }} />
                                {cat.name}
                              </span>
                              <strong>{count}</strong>
                            </div>
                            <div className="dash-category-track">
                              <span
                                style={{
                                  display: 'block',
                                  width: `${pct}%`,
                                  background: colors[index % 4],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p>Agrega un producto para ver la distribución.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="dash-panel-bottom-link"
                    style={{ width: '100%' }}
                    onClick={() => setSection('categories')}
                  >
                    Gestionar categorías y marcas
                    <Icon name="arrow" size={16} />
                  </button>
                </section>
              </div>

              <div className="dash-bottom-grid">
                <section className="dash-panel dash-products-preview">
                  <div className="dash-panel-heading">
                    <div>
                      <h2>Productos del catálogo</h2>
                      <p>Edita precios, ofertas, imágenes o existencias con un clic</p>
                    </div>
                    <button
                      type="button"
                      className="dash-text-link"
                      onClick={() => {
                        setSection('products');
                        setEditorMode('list');
                      }}
                    >
                      Ver todos
                      <Icon name="arrow" size={14} />
                    </button>
                  </div>
                  <div className="dash-table-scroll">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>PRODUCTO</th>
                          <th>PRECIO · COP</th>
                          <th>STOCK</th>
                          <th>ESTADO</th>
                          <th>
                            <span className="sr-only">Acciones</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.slice(0, 6).map((p) => {
                          const img =
                            p.images.find((i) => i.isPrimary)?.url ??
                            p.images[0]?.url ??
                            '/images/g502x-plus-gallery-1-black.png';
                          const avail = Math.max(
                            0,
                            (p.inventory?.quantityOnHand ?? 0) -
                              (p.inventory?.quantityReserved ?? 0)
                          );
                          return (
                            <tr key={p.id}>
                              <td>
                                <div className="dash-product-info">
                                  <span>
                                    <img src={img} alt="" />
                                  </span>
                                  <div>
                                    <strong>{p.name}</strong>
                                    <small>
                                      {p.brand.name} · {p.category.name}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>{cop(p.price)}</td>
                              <td>{avail} uds.</td>
                              <td>
                                <span className={`dash-status ${!p.isActive ? 'is-draft' : ''}`}>
                                  <i />
                                  {p.isActive ? 'Publicado' : 'Borrador'}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="dash-icon-button"
                                  aria-label={`Editar ${p.name}`}
                                  title={`Editar ${p.name}`}
                                  onClick={() => openEditProductEditor(p)}
                                >
                                  <Icon name="edit" size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="dash-table-note">
                    Haz clic en el icono de lápiz para editar cualquier producto del catálogo.
                  </div>
                </section>

                <section className="dash-panel dash-quick">
                  <div className="dash-panel-heading">
                    <div>
                      <h2>Vamos al siguiente nivel</h2>
                      <p>Acciones rápidas de administración</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openNewProductEditor}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '19px 0',
                      margin: '0 23px',
                      borderBottom: '1px solid var(--dash-line)',
                      width: 'calc(100% - 46px)',
                      textAlign: 'left',
                    }}
                  >
                    <span className="dash-quick-icon">
                      <Icon name="plus" size={20} />
                    </span>
                    <div>
                      <strong>Agrega un producto</strong>
                      <small>Dale más posibilidades a tu catálogo.</small>
                    </div>
                    <Icon name="chevron" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('categories')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '19px 0',
                      margin: '0 23px',
                      borderBottom: '1px solid var(--dash-line)',
                      width: 'calc(100% - 46px)',
                      textAlign: 'left',
                    }}
                  >
                    <span className="dash-quick-icon">
                      <Icon name="layers" size={20} />
                    </span>
                    <div>
                      <strong>Categorías y Marcas</strong>
                      <small>
                        {categories.length} categorías con imagen · {brands.length} marcas con logo.
                      </small>
                    </div>
                    <Icon name="chevron" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('orders')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                      padding: '19px 0',
                      margin: '0 23px',
                      borderBottom: '1px solid var(--dash-line)',
                      width: 'calc(100% - 46px)',
                      textAlign: 'left',
                    }}
                  >
                    <span className="dash-quick-icon">
                      <Icon name="bag" size={20} />
                    </span>
                    <div>
                      <strong>Pedidos y Guías de Envío</strong>
                      <small>Asigna empresa transportadora y número de guía.</small>
                    </div>
                    <Icon name="chevron" size={16} />
                  </button>
                  <div className="dash-quick-footer">
                    <Icon name="help" size={17} />
                    <p>
                      Bucaramanga, Santander · Domicilio Local
                      <br />
                      <strong>y Envíos Nacionales a toda Colombia.</strong>
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* SECCIÓN 2: PRODUCTOS (ProductManager + ProductEditor + Carga Masiva Excel) */}
          {section === 'products' && (
            <div className="dash-product-manager">
              {editorMode !== 'list' ? (
                <>
                  <button
                    type="button"
                    className="editor-back"
                    onClick={() => setEditorMode('list')}
                  >
                    <Icon name="back" size={16} />
                    Volver a mis productos
                  </button>
                  <div className="account-heading">
                    <div>
                      <span className="eyebrow blue">
                        UN NUEVO PRODUCTO. NUEVAS POSIBILIDADES.
                      </span>
                      <h1>
                        {editorMode === 'edit' ? 'Editar producto' : 'Agrega tu próximo destacado'}
                      </h1>
                      <p>Una imagen, sus detalles y listo. Así de sencillo.</p>
                    </div>
                  </div>

                  <form className="product-editor" onSubmit={handleSaveProductEditor}>
                    <div className="editor-columns">
                      <div>
                        <section className="account-panel editor-section">
                          <h2>
                            <span>01</span>Información del producto
                          </h2>
                          <div className="form-grid">
                            <label className="field full-width">
                              Nombre del producto <span>*</span>
                              <input
                                required
                                minLength={3}
                                maxLength={140}
                                value={edName}
                                onChange={(e) => setEdName(e.target.value)}
                                placeholder="Ej. Mouse gamer inalámbrico Logitech G502 X Plus"
                              />
                            </label>
                            <label className="field">
                              Marca <span>*</span>
                              <select
                                required
                                value={edBrandId}
                                onChange={(e) => setEdBrandId(e.target.value)}
                              >
                                {brands.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              Categoría <span>*</span>
                              <select
                                required
                                value={edCategoryId}
                                onChange={(e) => setEdCategoryId(e.target.value)}
                              >
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              Referencia / SKU
                              <input
                                maxLength={60}
                                value={edSku}
                                onChange={(e) => setEdSku(e.target.value)}
                                placeholder="Ej. BSP-0001"
                              />
                            </label>
                            <label className="field">
                              Variante principal (con miniatura)
                              <input
                                maxLength={60}
                                value={edVariantName}
                                onChange={(e) => setEdVariantName(e.target.value)}
                                placeholder="Ej. Negro / Carbono / Blanco"
                              />
                            </label>
                            <label className="field full-width">
                              Descripción <span>*</span>
                              <textarea
                                required
                                minLength={10}
                                maxLength={4000}
                                rows={5}
                                value={edDesc}
                                onChange={(e) => setEdDesc(e.target.value)}
                                placeholder="Cuéntale a tu cliente qué hace especial a este producto: características, usos y compatibilidad."
                              />
                              <small>{edDesc.length}/4000 caracteres</small>
                            </label>
                          </div>
                        </section>

                        <section className="account-panel editor-section">
                          <h2>
                            <span>02</span>Precio, oferta e inventario
                          </h2>
                          <div className="form-grid">
                            <label className="field">
                              Precio actual en pesos colombianos <span>*</span>
                              <div className="price-input">
                                <span>$</span>
                                <input
                                  required
                                  type="number"
                                  min="1"
                                  max="999999999"
                                  step="1"
                                  value={edPrice}
                                  onChange={(e) => setEdPrice(e.target.value)}
                                  placeholder="249900"
                                />
                                <span>COP</span>
                              </div>
                            </label>
                            <label className="field">
                              Precio anterior (opcional, activa Oferta)
                              <div className="price-input">
                                <span>$</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="999999999"
                                  step="1"
                                  value={edComparePrice}
                                  onChange={(e) => setEdComparePrice(e.target.value)}
                                  placeholder="299900"
                                />
                                <span>COP</span>
                              </div>
                            </label>
                            <label className="field">
                              Unidades disponibles en inventario <span>*</span>
                              <input
                                type="number"
                                min="0"
                                max="999999"
                                step="1"
                                required
                                value={edStock}
                                onChange={(e) => setEdStock(e.target.value)}
                                placeholder="15"
                              />
                            </label>
                          </div>
                          <p className="editor-helper">
                            Si defines un Precio anterior mayor al Precio actual, el producto
                            aparecerá automáticamente en la sección de Ofertas con su porcentaje de
                            descuento.
                          </p>
                        </section>

                        <section className="account-panel editor-section">
                          <h2>
                            <span>03</span>Especificaciones <small>Opcional</small>
                          </h2>
                          <div className="spec-editor">
                            {edSpecs.map((spec, index) => (
                              <div key={index}>
                                <input
                                  aria-label={`Característica ${index + 1}`}
                                  value={spec[0]}
                                  maxLength={80}
                                  placeholder="Ej. Conexión"
                                  onChange={(e) =>
                                    setEdSpecs((prev) =>
                                      prev.map((s, i) => (i === index ? [e.target.value, s[1]] : s))
                                    )
                                  }
                                />
                                <input
                                  aria-label={`Valor ${index + 1}`}
                                  value={spec[1]}
                                  maxLength={200}
                                  placeholder="Ej. Bluetooth / USB"
                                  onChange={(e) =>
                                    setEdSpecs((prev) =>
                                      prev.map((s, i) => (i === index ? [s[0], e.target.value] : s))
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  aria-label={`Eliminar característica ${index + 1}`}
                                  onClick={() =>
                                    setEdSpecs((prev) => prev.filter((_, i) => i !== index))
                                  }
                                >
                                  <Icon name="close" size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            className="text-link blue"
                            type="button"
                            onClick={() => setEdSpecs((prev) => [...prev, ['', '']])}
                          >
                            <Icon name="plus" size={16} />
                            Agregar característica
                          </button>
                        </section>
                      </div>

                      <aside className="editor-preview-column">
                        <section className="account-panel editor-section image-upload-section">
                          <h2>
                            Imagen principal <span className="required-star">*</span>
                          </h2>
                          <div
                            className={`upload-zone ${edDragging ? 'dragging' : ''} ${
                              edImage ? 'has-image' : ''
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setEdDragging(true);
                            }}
                            onDragLeave={() => setEdDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setEdDragging(false);
                              handleImageFileToDataUrl(e.dataTransfer.files[0], setEdImage);
                            }}
                          >
                            {edImage ? (
                              <>
                                <img
                                  src={edImage}
                                  alt="Vista previa de la imagen del producto"
                                />
                                <button
                                  type="button"
                                  className="remove-upload"
                                  aria-label="Quitar imagen"
                                  onClick={() => {
                                    setEdImage('');
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                  }}
                                >
                                  <Icon name="close" size={17} />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="upload-icon">
                                  <Icon name="upload" size={26} />
                                </span>
                                <strong>Arrastra tu imagen aquí</strong>
                                <span>o selecciónala desde tu dispositivo</span>
                              </>
                            )}
                            <input
                              ref={fileInputRef}
                              className="image-file-input"
                              aria-label="Seleccionar imagen del producto"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) =>
                                handleImageFileToDataUrl(e.target.files?.[0], setEdImage)
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Icon name={edImage ? 'edit' : 'plus'} size={16} />
                              {edImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
                            </button>
                          </div>

                          <label className="field" style={{ marginTop: '12px' }}>
                            O elegir imagen de catálogo / URL
                            <select
                              value={edImage.startsWith('data:') ? '' : edImage}
                              onChange={(e) => {
                                if (e.target.value) setEdImage(e.target.value);
                              }}
                            >
                              <option value="/images/g502x-plus-gallery-1-black.png">
                                Mouse G502 X Plus
                              </option>
                              <option value="/images/pro-x-superlight-black-gallery-1.png">
                                Mouse PRO X Superlight
                              </option>
                              <option value="/images/g915-tkl-gallery-1-carbon.png">
                                Teclado G915 TKL
                              </option>
                              <option value="/images/us-pro-gaming-keyboard-gallery-topdown.png">
                                Teclado PRO Gaming
                              </option>
                              <option value="/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png">
                                Diadema PRO X 2
                              </option>
                              <option value="/images/g733-black-gallery-1.png">
                                Audífonos G733
                              </option>
                            </select>
                          </label>
                        </section>

                        <section className="account-panel live-preview">
                          <span className="eyebrow">ASÍ SE VERÁ EN TU TIENDA</span>
                          <div className="live-preview-image">
                            {edImage ? <img src={edImage} alt="" /> : <Icon name="box" size={48} />}
                          </div>
                          <span className="eyebrow blue">
                            {brands.find((b) => b.id === edBrandId)?.name || 'TU MARCA'}
                          </span>
                          <h3>{edName || 'Nombre de tu producto'}</h3>
                          <strong>
                            {cop(Number(edPrice) || 0)} <small>COP</small>
                          </strong>
                          <p>Vista previa en tiempo real</p>
                        </section>
                      </aside>
                    </div>

                    {edError && (
                      <div className="account-error" role="alert">
                        {edError}
                      </div>
                    )}

                    <div className="editor-actions">
                      <p>
                        <Icon name="shield" size={16} />
                        Los cambios se sincronizan de inmediato con el catálogo de BSP Store.
                      </p>
                      <div>
                        <button
                          type="button"
                          className="editor-cancel"
                          disabled={edSaving}
                          onClick={() => setEditorMode('list')}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          value="draft"
                          className="btn btn-secondary"
                          disabled={edSaving}
                        >
                          Guardar borrador
                        </button>
                        <button
                          type="submit"
                          value="published"
                          className="btn btn-primary"
                          disabled={edSaving}
                        >
                          <Icon name="check" size={17} />
                          {edSaving
                            ? 'Guardando...'
                            : editorMode === 'edit'
                              ? 'Guardar cambios en catálogo'
                              : 'Publicar en catálogo'}
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="account-heading">
                    <div>
                      <span className="eyebrow blue">MENOS COMPLICACIONES. MÁS CONTROL.</span>
                      <h1>Mis productos</h1>
                      <p>Tu catálogo, organizado y listo para tu próximo cliente.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowBulkUpload(!showBulkUpload)}
                      >
                        <Icon name="upload" size={17} />
                        {showBulkUpload ? 'Cerrar Carga Masiva' : 'Carga Masiva Excel'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={openNewProductEditor}
                      >
                        <Icon name="plus" size={18} />
                        Agregar producto
                      </button>
                    </div>
                  </div>

                  {showBulkUpload && (
                    <section
                      className="account-panel"
                      style={{ padding: '24px', marginBottom: '24px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          marginBottom: '14px',
                        }}
                      >
                        <div>
                          <span className="eyebrow blue">ESTÁNDAR EXCEL (.CSV / .TXT)</span>
                          <h2 style={{ fontSize: '18px', marginTop: '4px' }}>
                            Carga Masiva de Productos y Precios (con Descripción)
                          </h2>
                          <p style={{ fontSize: '11px', color: '#758092', marginTop: '4px' }}>
                            Columnas: SKU; Nombre; Categoria; Marca; Precio_COP;
                            Precio_Anterior_COP; Stock; Variante; Imagen_URL; Descripcion
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleDownloadExcelTemplate}
                        >
                          <Icon name="download" size={16} />
                          Descargar Plantilla Estándar Excel
                        </button>
                      </div>

                      <form onSubmit={handleProcessBulkUpload} style={{ display: 'grid', gap: '12px' }}>
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              void f.text().then((txt) => {
                                setBulkCsvText(txt);
                                setToast(`Archivo "${f.name}" listo para procesar.`);
                              });
                            }
                          }}
                        />
                        <textarea
                          rows={4}
                          value={bulkCsvText}
                          onChange={(e) => setBulkCsvText(e.target.value)}
                          placeholder="SKU;Nombre;Categoria;Marca;Precio_COP;Precio_Anterior_COP;Stock;Variante;Imagen_URL;Descripcion"
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid var(--dash-line)',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '11px',
                          }}
                        />
                        <div>
                          <button type="submit" className="btn btn-primary" disabled={bulkLoading}>
                            {bulkLoading ? 'Procesando...' : 'Procesar Carga Masiva'}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}

                  <div className="catalog-metrics">
                    {[
                      { label: 'Total de productos', value: products.length, icon: 'box' },
                      { label: 'Publicados en tienda', value: publishedCount, icon: 'eye' },
                      { label: 'Borradores / Ocultos', value: draftCount, icon: 'edit' },
                    ].map((m) => (
                      <div className="account-panel" key={m.label}>
                        <span>
                          <Icon name={m.icon} size={20} />
                        </span>
                        <strong>{m.value}</strong>
                        <p>{m.label}</p>
                      </div>
                    ))}
                  </div>

                  <section className="account-panel catalog-panel">
                    <div className="catalog-controls">
                      <div className="catalog-status-tabs">
                        {(
                          [
                            ['all', 'Todos'],
                            ['published', 'En catálogo'],
                            ['draft', 'Borradores'],
                          ] as const
                        ).map(([key, label]) => (
                          <button
                            type="button"
                            key={key}
                            className={prodStatusFilter === key ? 'selected' : ''}
                            onClick={() => setProdStatusFilter(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="admin-search">
                        <Icon name="search" size={17} />
                        <input
                          aria-label="Buscar mis productos"
                          placeholder="Buscar nombre, marca o referencia..."
                          value={prodSearch}
                          onChange={(e) => setProdSearch(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="Ordenar mis productos"
                        value={prodSort}
                        onChange={(e) =>
                          setProdSort(e.target.value as 'recent' | 'name' | 'price')
                        }
                      >
                        <option value="recent">Más recientes</option>
                        <option value="name">Nombre: A a Z</option>
                        <option value="price">Menor precio</option>
                      </select>
                    </div>

                    {filteredProductsList.length ? (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Precio · COP</th>
                              <th>Stock</th>
                              <th>Estado</th>
                              <th aria-label="Acciones" />
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProductsList.map((p) => {
                              const img =
                                p.images.find((i) => i.isPrimary)?.url ??
                                p.images[0]?.url ??
                                '/images/g502x-plus-gallery-1-black.png';
                              const avail = Math.max(
                                0,
                                (p.inventory?.quantityOnHand ?? 0) -
                                  (p.inventory?.quantityReserved ?? 0)
                              );
                              return (
                                <tr key={p.id}>
                                  <td>
                                    <div className="admin-product-cell">
                                      <img src={img} alt="" />
                                      <div>
                                        <strong>{p.name}</strong>
                                        <small>
                                          {p.brand.name} · {p.sku}
                                        </small>
                                        <span>{p.category.name}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <strong>{cop(p.price)}</strong>
                                    <small>
                                      COP{' '}
                                      {p.compareAtPrice && p.compareAtPrice > p.price
                                        ? `· Antes ${cop(p.compareAtPrice)}`
                                        : ''}
                                    </small>
                                  </td>
                                  <td>
                                    <strong>{avail} uds.</strong>
                                  </td>
                                  <td>
                                    <span
                                      className={`product-state ${!p.isActive ? 'draft' : ''}`}
                                    >
                                      <i />
                                      {p.isActive ? 'En catálogo' : 'Borrador'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="admin-row-actions">
                                      <button
                                        type="button"
                                        aria-label={`Editar ${p.name}`}
                                        title="Editar producto"
                                        onClick={() => openEditProductEditor(p)}
                                      >
                                        <Icon name="edit" size={17} />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Ver ${p.name}`}
                                        title="Ver en tienda"
                                        onClick={() =>
                                          router.push(`/producto/${p.legacyId ?? p.slug}`)
                                        }
                                      >
                                        <Icon name="eye" size={17} />
                                      </button>
                                      <button
                                        type="button"
                                        className="delete-action"
                                        aria-label={
                                          p.isActive ? `Ocultar ${p.name}` : `Publicar ${p.name}`
                                        }
                                        title={p.isActive ? 'Pasar a borrador' : 'Publicar'}
                                        onClick={() => void handleToggleProductActive(p)}
                                      >
                                        <Icon name={p.isActive ? 'close' : 'check'} size={17} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="account-empty">
                        <Icon name="search" size={38} />
                        <h2>No hay coincidencias</h2>
                        <p>Prueba otra búsqueda o cambia los filtros.</p>
                      </div>
                    )}
                    <div className="admin-table-footer">
                      <span>
                        {filteredProductsList.length} de {products.length} productos
                      </span>
                      <span>Catálogo conectado a BSP Store</span>
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* SECCIÓN 3: CATEGORÍAS Y MARCAS (Con Imágenes y Logos Oficiales) */}
          {section === 'categories' && (
            <>
              {heading(
                'ORGANIZACIÓN VISUAL DE LA TIENDA',
                'Categorías y Marcas',
                'Administra las categorías con su imagen y las marcas con sus logos oficiales.'
              )}

              <div className="dash-middle-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {/* Panel de Categorías */}
                <section className="dash-panel" style={{ padding: '23px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                    Categorías ({categories.length})
                  </h2>
                  <p style={{ fontSize: '11px', color: '#758092', marginBottom: '18px' }}>
                    Agrega o edita categorías incluyendo su imagen y descripción.
                  </p>

                  <form
                    onSubmit={handleCreateCategory}
                    style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}
                  >
                    <label className="field">
                      Nombre de la categoría <span>*</span>
                      <input
                        required
                        placeholder="Ej. Sillas Gamer"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Descripción
                      <input
                        placeholder="Ej. Ergonomía para largas sesiones"
                        value={newCategoryDesc}
                        onChange={(e) => setNewCategoryDesc(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Imagen de la categoría
                      <select
                        value={newCategoryImage.startsWith('data:') ? '' : newCategoryImage}
                        onChange={(e) => {
                          if (e.target.value) setNewCategoryImage(e.target.value);
                        }}
                      >
                        <option value="/images/g502x-plus-gallery-1-black.png">
                          Mouse G502 X Plus
                        </option>
                        <option value="/images/g915-tkl-gallery-1-carbon.png">
                          Teclado G915 TKL
                        </option>
                        <option value="/images/g733-black-gallery-1.png">Audífonos G733</option>
                        <option value="/images/pro-x-superlight-black-gallery-1.png">
                          Mouse PRO X Superlight
                        </option>
                      </select>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ marginTop: '6px' }}
                        onChange={(e) =>
                          handleImageFileToDataUrl(e.target.files?.[0], setNewCategoryImage)
                        }
                      />
                    </label>
                    <button type="submit" className="dash-button dash-button-blue">
                      <Icon name="plus" size={16} />
                      Crear categoría
                    </button>
                  </form>

                  {editingCatId && (
                    <form
                      onSubmit={handleUpdateCategory}
                      style={{
                        padding: '14px',
                        border: '1px solid #168bff',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'grid',
                        gap: '10px',
                      }}
                    >
                      <strong>Editar categoría</strong>
                      <input
                        required
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        placeholder="Nombre"
                        style={{ padding: '8px', border: '1px solid var(--dash-line)' }}
                      />
                      <input
                        value={editCatDesc}
                        onChange={(e) => setEditCatDesc(e.target.value)}
                        placeholder="Descripción"
                        style={{ padding: '8px', border: '1px solid var(--dash-line)' }}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageFileToDataUrl(e.target.files?.[0], setEditCatImage)
                        }
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="dash-button dash-button-blue">
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="dash-button dash-button-white"
                          onClick={() => setEditingCatId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {categories.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          border: '1px solid var(--dash-line)',
                          borderRadius: '7px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {c.imageUrl && (
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                            />
                          )}
                          <div>
                            <strong style={{ display: 'block', fontSize: '12px' }}>{c.name}</strong>
                            {c.description && (
                              <small style={{ color: '#758092', fontSize: '10px' }}>
                                {c.description}
                              </small>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="dash-text-link"
                          onClick={() => {
                            setEditingCatId(c.id);
                            setEditCatName(c.name);
                            setEditCatDesc(c.description ?? '');
                            setEditCatImage(
                              c.imageUrl ?? '/images/g502x-plus-gallery-1-black.png'
                            );
                          }}
                        >
                          Editar <Icon name="edit" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Panel de Marcas */}
                <section className="dash-panel" style={{ padding: '23px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                    Marcas Oficiales ({brands.length})
                  </h2>
                  <p style={{ fontSize: '11px', color: '#758092', marginBottom: '18px' }}>
                    Agrega o edita marcas con su logo oficial y descripción.
                  </p>

                  <form
                    onSubmit={handleCreateBrand}
                    style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}
                  >
                    <label className="field">
                      Nombre de la marca <span>*</span>
                      <input
                        required
                        placeholder="Ej. SteelSeries"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Descripción
                      <input
                        placeholder="Ej. Periféricos de competencia eSports"
                        value={newBrandDesc}
                        onChange={(e) => setNewBrandDesc(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Logo de la marca
                      <select
                        value={newBrandLogo.startsWith('data:') ? '' : newBrandLogo}
                        onChange={(e) => {
                          if (e.target.value) setNewBrandLogo(e.target.value);
                        }}
                      >
                        <option value="/images/brands/logitech-g.svg">Logo Logitech G</option>
                        <option value="/images/brands/razer.svg">Logo Razer</option>
                        <option value="/images/brands/hyperx.svg">Logo HyperX</option>
                        <option value="/images/brands/corsair.svg">Logo Corsair</option>
                        <option value="/images/brands/asus.svg">Logo ASUS ROG</option>
                        <option value="/images/brands/redragon.svg">Logo Redragon</option>
                      </select>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ marginTop: '6px' }}
                        onChange={(e) =>
                          handleImageFileToDataUrl(e.target.files?.[0], setNewBrandLogo)
                        }
                      />
                    </label>
                    <button type="submit" className="dash-button dash-button-blue">
                      <Icon name="plus" size={16} />
                      Crear marca
                    </button>
                  </form>

                  {editingBrandId && (
                    <form
                      onSubmit={handleUpdateBrand}
                      style={{
                        padding: '14px',
                        border: '1px solid #168bff',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        display: 'grid',
                        gap: '10px',
                      }}
                    >
                      <strong>Editar marca</strong>
                      <input
                        required
                        value={editBrandName}
                        onChange={(e) => setEditBrandName(e.target.value)}
                        placeholder="Nombre"
                        style={{ padding: '8px', border: '1px solid var(--dash-line)' }}
                      />
                      <input
                        value={editBrandDesc}
                        onChange={(e) => setEditBrandDesc(e.target.value)}
                        placeholder="Descripción"
                        style={{ padding: '8px', border: '1px solid var(--dash-line)' }}
                      />
                      <select
                        value={editBrandLogo.startsWith('data:') ? '' : editBrandLogo}
                        onChange={(e) => {
                          if (e.target.value) setEditBrandLogo(e.target.value);
                        }}
                        style={{ padding: '8px', border: '1px solid var(--dash-line)' }}
                      >
                        <option value="/images/brands/logitech-g.svg">Logo Logitech G</option>
                        <option value="/images/brands/razer.svg">Logo Razer</option>
                        <option value="/images/brands/hyperx.svg">Logo HyperX</option>
                        <option value="/images/brands/corsair.svg">Logo Corsair</option>
                        <option value="/images/brands/asus.svg">Logo ASUS ROG</option>
                        <option value="/images/brands/redragon.svg">Logo Redragon</option>
                      </select>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageFileToDataUrl(e.target.files?.[0], setEditBrandLogo)
                        }
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="dash-button dash-button-blue">
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="dash-button dash-button-white"
                          onClick={() => setEditingBrandId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {brands.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          border: '1px solid var(--dash-line)',
                          borderRadius: '7px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {b.logoUrl && (
                            <img
                              src={b.logoUrl}
                              alt={b.name}
                              style={{ width: '48px', height: '24px', objectFit: 'contain' }}
                            />
                          )}
                          <div>
                            <strong style={{ display: 'block', fontSize: '12px' }}>{b.name}</strong>
                            {b.description && (
                              <small style={{ color: '#758092', fontSize: '10px' }}>
                                {b.description}
                              </small>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="dash-text-link"
                          onClick={() => {
                            setEditingBrandId(b.id);
                            setEditBrandName(b.name);
                            setEditBrandDesc(b.description ?? '');
                            setEditBrandLogo(b.logoUrl ?? '/images/brands/logitech-g.svg');
                          }}
                        >
                          Editar <Icon name="edit" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* SECCIÓN 4: PEDIDOS, BRE-B Y GUÍAS DE ENVÍO */}
          {section === 'orders' && (
            <>
              {heading(
                'GESTIÓN DE VENTAS Y ENTREGAS',
                'Pedidos',
                'El espacio para acompañar cada compra, verificar pagos Bre-B (@bbbsp) y asignar guías de envío.'
              )}

              <section className="dash-panel" style={{ padding: '18px 23px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    aria-label="Filtrar por estado"
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--dash-line)',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="PENDING_BREB_VERIFICATION">Pendiente Bre-B (@bbbsp)</option>
                    <option value="PENDING_PAYMENT">Pendiente Pago</option>
                    <option value="PAID">Pagado</option>
                    <option value="PROCESSING">En alistamiento</option>
                    <option value="SHIPPED">Despachado</option>
                    <option value="DELIVERED">Entregado</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                  <label className="dash-inventory-search" style={{ flex: 1 }}>
                    <Icon name="search" size={16} />
                    <input
                      placeholder="Buscar por número de pedido, cliente o correo..."
                      value={orderSearchFilter}
                      onChange={(e) => setOrderSearchFilter(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              {orders.length === 0 ? (
                <section className="dash-panel dash-empty-section">
                  <span className="dash-large-empty-icon">
                    <Icon name="bag" size={34} />
                  </span>
                  <span className="dash-overline">SIN PEDIDOS EN ESTE FILTRO</span>
                  <h2>No encontramos pedidos con esos criterios</h2>
                  <p>
                    Los pedidos confirmados desde el checkout aparecerán aquí con sus datos de
                    entrega local o nacional.
                  </p>
                </section>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {orders.map((order) => {
                    const isLocal = isLocalDeliveryDestination(order.department, order.city);
                    const draft = dispatchDrafts[order.id] ?? {
                      status: order.status,
                      carrierId: order.shipment?.carrierId ?? carriers[0]?.id ?? '',
                      trackingNumber: order.shipment?.trackingNumber ?? '',
                    };
                    const brebPayment = order.payments.find(
                      (p) => p.provider === 'BREB_TRANSFER'
                    );

                    return (
                      <section key={order.id} className="dash-panel" style={{ padding: '22px' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                            marginBottom: '14px',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '15px' }}>{order.orderNumber}</strong> ·{' '}
                            <span className="dash-status">
                              <i />
                              {order.status}
                            </span>{' '}
                            <span className="dash-demo-badge">
                              {isLocal ? 'Domicilio Local (Bucaramanga)' : 'Envío Nacional'}
                            </span>
                          </div>
                          <strong style={{ fontSize: '15px' }}>{cop(order.totalCop)} COP</strong>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '12px',
                            fontSize: '11px',
                            marginBottom: '14px',
                          }}
                        >
                          <div>
                            <strong>Cliente:</strong> {order.customerName} ({order.customerEmail} ·{' '}
                            {order.customerPhone})
                          </div>
                          <div>
                            <strong>Destino:</strong> {order.streetAddress} — {order.city},{' '}
                            {order.department}
                          </div>
                          <div>
                            <strong>Productos:</strong>{' '}
                            {order.items
                              .map((it) => `${it.productName} (x${it.quantity})`)
                              .join(', ')}
                          </div>
                        </div>

                        {order.status === 'PENDING_BREB_VERIFICATION' && (
                          <div
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid #93c5fd',
                              marginBottom: '14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <span>
                              <strong>Transferencia Bre-B (@bbbsp):</strong> Comprobante:{' '}
                              <strong>{brebPayment?.transferReceiptRef || 'Pendiente'}</strong>
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="dash-button dash-button-blue"
                                onClick={() =>
                                  void handleBrebVerification(order.id, 'VERIFY_BREB_PAYMENT')
                                }
                              >
                                Aprobar pago Bre-B
                              </button>
                              <button
                                type="button"
                                className="dash-button dash-button-white"
                                onClick={() =>
                                  void handleBrebVerification(order.id, 'REJECT_BREB_PAYMENT')
                                }
                              >
                                Rechazar
                              </button>
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                            gap: '10px',
                            alignItems: 'end',
                            paddingTop: '12px',
                            borderTop: '1px solid var(--dash-line)',
                          }}
                        >
                          <label className="field">
                            Estado del pedido
                            <select
                              value={draft.status}
                              onChange={(e) =>
                                setDispatchDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: { ...draft, status: e.target.value },
                                }))
                              }
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
                            </select>
                          </label>
                          <label className="field">
                            Empresa de envío
                            <select
                              value={draft.carrierId}
                              onChange={(e) =>
                                setDispatchDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: { ...draft, carrierId: e.target.value },
                                }))
                              }
                            >
                              {carriers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            Número de guía
                            <input
                              placeholder="Ej. SERVI-99482716"
                              value={draft.trackingNumber}
                              onChange={(e) =>
                                setDispatchDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: { ...draft, trackingNumber: e.target.value },
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="dash-button dash-button-blue"
                            onClick={() => void handleSaveOrderDispatch(order)}
                          >
                            Guardar envío y guía
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* SECCIÓN 5: CLIENTES Y BUZÓN DE CONTACTO */}
          {section === 'customers' && (
            <>
              {heading(
                'COMUNIDAD Y SOPORTE',
                'Clientes y Contacto',
                'Una vista clara de las personas que eligen BSP STORE y sus mensajes de asesoría.'
              )}

              <section className="dash-panel" style={{ marginBottom: '22px' }}>
                <div className="dash-panel-heading">
                  <div>
                    <h2>Clientes registrados ({customers.length})</h2>
                    <p>Gestión de usuarios y permisos RBAC</p>
                  </div>
                </div>
                <div className="dash-table-scroll" style={{ marginTop: '16px' }}>
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>NOMBRE</th>
                        <th>CORREO</th>
                        <th>TELÉFONO</th>
                        <th>PEDIDOS</th>
                        <th>TOTAL COMPRADO</th>
                        <th>ROL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.fullName}</strong>
                          </td>
                          <td>{c.email}</td>
                          <td>{c.phone || '—'}</td>
                          <td>{c.ordersCount}</td>
                          <td>{cop(c.totalSpentCop)} COP</td>
                          <td>
                            <select
                              aria-label={`Rol de ${c.email}`}
                              value={c.role}
                              onChange={(e) =>
                                void handleRoleChange(
                                  c.id,
                                  e.target.value as 'CUSTOMER' | 'STAFF' | 'ADMIN'
                                )
                              }
                              style={{
                                padding: '5px 8px',
                                borderRadius: '5px',
                                border: '1px solid var(--dash-line)',
                                fontSize: '10px',
                              }}
                            >
                              <option value="CUSTOMER">CUSTOMER</option>
                              <option value="STAFF">STAFF</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="dash-panel">
                <div className="dash-panel-heading">
                  <div>
                    <h2>Buzón de consultas y asesorías ({inquiries.length})</h2>
                    <p>Mensajes recibidos desde el formulario de Contacto</p>
                  </div>
                </div>
                <div style={{ padding: '20px 23px', display: 'grid', gap: '12px' }}>
                  {inquiries.length === 0 ? (
                    <p style={{ color: '#758092' }}>No hay consultas pendientes.</p>
                  ) : (
                    inquiries.map((inq) => (
                      <div
                        key={inq.id}
                        style={{
                          padding: '14px',
                          borderRadius: '8px',
                          border: '1px solid var(--dash-line)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>
                            {inq.name} ({inq.email}) · {inq.topic}
                          </strong>
                          <small style={{ color: '#758092' }}>
                            {new Date(inq.createdAt).toLocaleString('es-CO')}
                          </small>
                        </div>
                        <p style={{ marginTop: '6px', fontSize: '11px' }}>{inq.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          {/* SECCIÓN 6: INVENTARIO Y CUPONES DE OFERTA */}
          {section === 'inventory' && (
            <>
              {heading(
                'CONTROL DE EXISTENCIAS Y PROMOCIONES',
                'Inventario, sin suposiciones',
                'Consulta y ajusta las cantidades disponibles y administra los cupones de descuento.'
              )}

              <section className="dash-panel" style={{ padding: '22px', marginBottom: '22px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>
                  Registrar movimiento de inventario (Kardex)
                </h2>
                <form
                  onSubmit={handleAdjustInventory}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '12px',
                    alignItems: 'end',
                  }}
                >
                  <label className="field">
                    Producto
                    <select
                      value={invProductId}
                      onChange={(e) => setInvProductId(e.target.value)}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Tipo de movimiento
                    <select
                      value={invType}
                      onChange={(e) => setInvType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')}
                    >
                      <option value="IN">Entrada (+)</option>
                      <option value="OUT">Salida (-)</option>
                      <option value="ADJUSTMENT">Ajuste exacto (=)</option>
                    </select>
                  </label>
                  <label className="field">
                    Cantidad
                    <input
                      type="number"
                      min="0"
                      required
                      value={invQuantity}
                      onChange={(e) => setInvQuantity(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Motivo
                    <input
                      required
                      value={invReason}
                      onChange={(e) => setInvReason(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="dash-button dash-button-blue">
                    Aplicar movimiento
                  </button>
                </form>
              </section>

              <section className="dash-panel" style={{ marginBottom: '22px' }}>
                <div className="dash-panel-heading">
                  <div>
                    <h2>Control de productos</h2>
                    <p>{products.length} referencias monitoreadas en inventario</p>
                  </div>
                  <label className="dash-inventory-search">
                    <Icon name="search" size={16} />
                    <input
                      aria-label="Buscar en inventario"
                      placeholder="Buscar producto o SKU..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="dash-table-scroll">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>PRODUCTO</th>
                        <th>SKU / REFERENCIA</th>
                        <th>FÍSICO / RESERVADO</th>
                        <th>DISPONIBLE</th>
                        <th>ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter((p) =>
                          `${p.name} ${p.sku}`
                            .toLowerCase()
                            .includes(inventorySearch.toLowerCase())
                        )
                        .map((p) => {
                          const img =
                            p.images.find((i) => i.isPrimary)?.url ??
                            p.images[0]?.url ??
                            '/images/g502x-plus-gallery-1-black.png';
                          const onHand = p.inventory?.quantityOnHand ?? 0;
                          const reserved = p.inventory?.quantityReserved ?? 0;
                          const avail = Math.max(0, onHand - reserved);
                          return (
                            <tr key={p.id}>
                              <td>
                                <div className="dash-product-info">
                                  <span>
                                    <img src={img} alt="" />
                                  </span>
                                  <strong>{p.name}</strong>
                                </div>
                              </td>
                              <td>{p.sku}</td>
                              <td>
                                {onHand} físico · {reserved} reservado
                              </td>
                              <td>
                                <strong>{avail} uds.</strong>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="dash-text-link"
                                  onClick={() => openEditProductEditor(p)}
                                >
                                  Editar
                                  <Icon name="edit" size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Cupones promocionales */}
              <section className="dash-panel" style={{ padding: '22px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Cupones promocionales activos (/ofertas y /carrito)
                </h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  {(report?.coupons ?? []).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--dash-line)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{c.code}</strong> ·{' '}
                        {c.discountType === 'PERCENTAGE'
                          ? `${c.discountValue}% OFF`
                          : `${cop(c.discountValue)} COP`}
                        <small style={{ display: 'block', color: '#758092' }}>
                          {c.isActive ? 'Activo' : 'Inactivo'} · Usos: {c.usedCount}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="dash-button dash-button-white"
                        onClick={() => void handleToggleCoupon(c.id, c.isActive)}
                      >
                        {c.isActive ? 'Pausar' : 'Activar'}
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={handleCreateCoupon}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '10px',
                    alignItems: 'end',
                  }}
                >
                  <label className="field">
                    Código
                    <input
                      required
                      placeholder="BUCARAMANGA15"
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Descripción
                    <input
                      required
                      placeholder="15% OFF en periféricos"
                      value={newCouponDesc}
                      onChange={(e) => setNewCouponDesc(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Tipo
                    <select
                      value={newCouponType}
                      onChange={(e) =>
                        setNewCouponType(e.target.value as 'PERCENTAGE' | 'FIXED_COP')
                      }
                    >
                      <option value="PERCENTAGE">Porcentaje (%)</option>
                      <option value="FIXED_COP">Valor fijo (COP)</option>
                    </select>
                  </label>
                  <label className="field">
                    Valor
                    <input
                      type="number"
                      required
                      value={newCouponValue}
                      onChange={(e) => setNewCouponValue(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="dash-button dash-button-blue">
                    Guardar cupón
                  </button>
                </form>
              </section>
            </>
          )}

          {/* SECCIÓN 7: CONFIGURACIÓN */}
          {section === 'settings' && (
            <>
              {heading(
                'ARQUITECTURA Y SERVICIOS ACTIVOS',
                'Lista para lo que viene',
                'Estado operativo de los módulos de tu tienda BSP STORE Colombia.'
              )}
              <section className="dash-panel dash-integration">
                <div className="dash-panel-heading">
                  <div>
                    <h2>Estado de la plataforma</h2>
                    <p>Módulos conectados y verificados</p>
                  </div>
                  <span className="dash-status">
                    <i />
                    Operativo
                  </span>
                </div>
                {[
                  {
                    title: 'Catálogo, Categorías, Marcas y Carga Masiva Excel',
                    text: 'Creación, edición, imágenes, logos vectoriales, borradores y carga masiva CSV/Excel con descripción.',
                    ready: true,
                  },
                  {
                    title: 'Pagos con Llave Bre-B (@bbbsp) y Wompi',
                    text: 'Transferencias inmediatas $0 COP comisión con Llave Bre-B @bbbsp y pasarela Wompi (PSE / Tarjetas).',
                    ready: true,
                  },
                  {
                    title: 'Envíos Locales (Bucaramanga) y Nacionales + Sigue tu pedido',
                    text: 'Domicilio Local en Bucaramanga y Área Metropolitana, transportadoras nacionales y consulta pública por número de pedido en /seguimiento.',
                    ready: true,
                  },
                  {
                    title: 'Compras como Invitado y Validación de Celular (10 dígitos)',
                    text: 'Checkout habilitado sin obligar a crear cuenta y validación numérica de teléfono móvil en tiempo real.',
                    ready: true,
                  },
                  {
                    title: 'Cumplimiento Legal Colombia (Ley 1581 y Ley 1480)',
                    text: 'Políticas de Habeas Data, descarga de datos personales y derecho de retracto integrados.',
                    ready: true,
                  },
                ].map((item) => (
                  <div className="dash-integration-row" key={item.title}>
                    <span className={`dash-integration-icon ${item.ready ? 'ready' : ''}`}>
                      <Icon name="check" size={20} />
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                    <span className={`dash-integration-state ${item.ready ? 'ready' : ''}`}>
                      Conectado
                    </span>
                  </div>
                ))}
              </section>
            </>
          )}

          <div className="dash-footer">
            <span>
              © {new Date().getFullYear()} BSP STORE <i /> Administración
            </span>
            <span>Diseñado para tu próximo nivel.</span>
          </div>
        </main>
      </div>
    </div>
  );
}
