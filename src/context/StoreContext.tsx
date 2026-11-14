'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { products, type Product } from '@/data/catalog';

export type CartItem = {
  id: number;
  quantity: number;
  variantId?: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  permissions: string[];
  connectedProviders?: string[];
};

export type AppliedCoupon = {
  code: string;
  discountCop: number;
  description: string | null;
};

type ApiCatalogItem = {
  id?: number;
  dbId?: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  compareAtPrice?: number | null;
  tag?: string | null;
  description: string;
  specs?: unknown;
  image: string;
  variants?: Array<{ id: string; sku: string; label: string }>;
  stockAvailable?: number;
  isOffer?: boolean;
  isNew?: boolean;
};

type StoreContextValue = {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  refreshUser: () => Promise<void>;
  catalogProducts: Product[];
  refreshCatalog: () => Promise<void>;
  cart: CartItem[];
  favorites: number[];
  count: number;
  subtotal: number;
  appliedCoupon: AppliedCoupon | null;
  setAppliedCoupon: (c: AppliedCoupon | null) => void;
  query: string;
  setQuery: (q: string) => void;
  category: string;
  setCategory: (c: string) => void;
  sort: string;
  setSort: (s: string) => void;
  maxPrice: number;
  setMaxPrice: (p: number) => void;
  brand: boolean;
  setBrand: (b: boolean) => void;
  stockFilter: boolean;
  setStockFilter: (s: boolean) => void;
  drawer: boolean;
  setDrawer: (open: boolean) => void;
  modal: string;
  setModal: (title: string) => void;
  toast: string;
  setToast: (msg: string) => void;
  shippingCity: string;
  setShippingCity: (city: string) => void;
  shipping: number | null;
  setShipping: (val: number | null) => void;
  add: (p: Product, quantity?: number, openDrawer?: boolean, variantId?: string) => void;
  changeQty: (id: number, quantity: number) => void;
  remove: (id: number) => void;
  clearCart: () => void;
  toggleFavorite: (id: number) => void;
  resetFilters: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_STORAGE_KEY = 'bsp_store_cart_v1';
const FAVORITES_STORAGE_KEY = 'bsp_store_favorites_v1';

function mapApiProductToCatalog(item: ApiCatalogItem, index: number): Product {
  const fallback = products.find((p) => p.slug === item.slug || p.id === item.id);
  const numericId = item.id && item.id > 0 ? item.id : (fallback?.id ?? 100 + index);

  let parsedSpecs: [string, string][] = fallback?.specs ?? [];
  if (Array.isArray(item.specs) && item.specs.length > 0) {
    parsedSpecs = item.specs
      .filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length >= 2)
      .map((entry) => [String(entry[0]), String(entry[1])]);
  }

  const mappedVariants =
    item.variants && item.variants.length > 0
      ? item.variants.map((v) => ({
          id: v.id,
          label: v.label,
          skuSuffix: v.sku.split('-').pop() ?? 'STD',
        }))
      : (fallback?.variants ?? []);

  return {
    id: numericId,
    slug: item.slug,
    sku: item.sku,
    name: item.name,
    brand: item.brand,
    category: item.category,
    price: item.price,
    compareAtPrice: item.compareAtPrice ?? fallback?.compareAtPrice,
    image: item.image || fallback?.image || '/images/g502x-plus-gallery-1-black.png',
    tag: item.tag ?? fallback?.tag,
    description: item.description,
    specs: parsedSpecs,
    variants: mappedVariants,
    stockAvailable: item.stockAvailable ?? fallback?.stockAvailable ?? 15,
    isOffer: item.isOffer ?? fallback?.isOffer ?? false,
    isNew: item.isNew ?? fallback?.isNew ?? false,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [sort, setSort] = useState('relevance');
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [brand, setBrand] = useState(false);
  const [stockFilter, setStockFilter] = useState(false);

  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState('');
  const [toast, setToast] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shipping, setShipping] = useState<number | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (!res.ok) return;
      const payload = await res.json();
      if (payload?.ok && payload?.data?.authenticated) {
        setUser(payload.data.user);
      } else {
        setUser(null);
      }
    } catch {
      // Ignore network errors during static/unit test render
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/products?pageSize=50');
      if (!res.ok) return;
      const payload = await res.json();
      if (payload?.ok && Array.isArray(payload?.data?.items) && payload.data.items.length > 0) {
        setCatalogProducts(
          (payload.data.items as ApiCatalogItem[]).map((item, idx) =>
            mapApiProductToCatalog(item, idx)
          )
        );
      }
    } catch {
      // Keep fallback static catalog
    }
  }, []);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartItem[];
        if (Array.isArray(parsed)) {
          setCart(
            parsed.filter(
              (item) =>
                typeof item?.id === 'number' &&
                typeof item?.quantity === 'number' &&
                item.quantity > 0
            )
          );
        }
      }
      const savedFavs = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (savedFavs) {
        const parsedFavs = JSON.parse(savedFavs) as number[];
        if (Array.isArray(parsedFavs)) {
          setFavorites(parsedFavs.filter((id) => typeof id === 'number'));
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      setHydrated(true);
    }

    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      void refreshUser();
      void refreshCatalog();
    }
  }, [refreshUser, refreshCatalog]);

  useEffect(() => {
    if (!user || typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch('/api/v1/favorites', { credentials: 'include' });
        if (!res.ok) return;
        const payload = await res.json();
        if (active && payload?.ok && Array.isArray(payload?.data?.favoriteIds)) {
          const serverIds = payload.data.favoriteIds as number[];
          setFavorites((prev) => Array.from(new Set([...prev, ...serverIds])));
        }
      } catch {
        // Ignore network errors
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage errors
    }
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage errors
    }
  }, [favorites, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const subtotal = cart.reduce((n, i) => {
    const prod = catalogProducts.find((p) => p.id === i.id) ?? products.find((p) => p.id === i.id);
    return n + (prod ? prod.price * i.quantity : 0);
  }, 0);

  const add = (p: Product, quantity = 1, openDrawer = true, variantId?: string) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === p.id);
      return exists
        ? prev.map((i) =>
            i.id === p.id
              ? {
                  ...i,
                  quantity: Math.min(20, i.quantity + quantity),
                  variantId: variantId ?? i.variantId,
                }
              : i
          )
        : [...prev, { id: p.id, quantity, variantId: variantId ?? p.variants[0]?.id }];
    });
    if (openDrawer) {
      setDrawer(true);
    }
  };

  const changeQty = (id: number, quantity: number) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  };

  const remove = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleFavorite = (id: number) => {
    const isCurrentlyFav = favorites.includes(id);
    setFavorites((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

    if (user && typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
      void fetch('/api/v1/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productIdOrLegacyId: id,
          action: isCurrentlyFav ? 'remove' : 'add',
        }),
      }).catch(() => undefined);
    }
  };

  const resetFilters = () => {
    setCategory('Todas');
    setMaxPrice(1000000);
    setBrand(false);
    setQuery('');
    setStockFilter(false);
  };

  return (
    <StoreContext.Provider
      value={{
        user,
        setUser,
        refreshUser,
        catalogProducts,
        refreshCatalog,
        cart,
        favorites,
        count,
        subtotal,
        appliedCoupon,
        setAppliedCoupon,
        query,
        setQuery,
        category,
        setCategory,
        sort,
        setSort,
        maxPrice,
        setMaxPrice,
        brand,
        setBrand,
        stockFilter,
        setStockFilter,
        drawer,
        setDrawer,
        modal,
        setModal,
        toast,
        setToast,
        shippingCity,
        setShippingCity,
        shipping,
        setShipping,
        add,
        changeQty,
        remove,
        clearCart,
        toggleFavorite,
        resetFilters,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe usarse dentro de <StoreProvider>');
  }
  return ctx;
}
