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

type StoreContextValue = {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  refreshUser: () => Promise<void>;
  cart: CartItem[];
  favorites: number[];
  count: number;
  subtotal: number;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
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
                item.quantity > 0 &&
                products.some((p) => p.id === item.id)
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
    }
  }, [refreshUser]);

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
    const prod = products.find((p) => p.id === i.id);
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
    setFavorites((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
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
        cart,
        favorites,
        count,
        subtotal,
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
