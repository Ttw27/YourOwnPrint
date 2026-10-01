import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  customerRegister as apiRegister,
  customerLogin as apiLogin,
  customerLogout as apiLogout,
  customerMe as apiMe,
} from "../lib/api";

/**
 * Customer auth - email + password, JWT stored in localStorage.
 *
 * Coexists with the admin auth (which uses its own httpOnly cookie under a
 * different name). The customer token is `yop_customer_token` - the CartContext
 * subscribes to it to sync guest carts up to the server on login.
 */
const AuthCtx = createContext(null);
const TOKEN_KEY = "yop_customer_token";

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [customer, setCustomer] = useState(null);   // null = unknown, {} = signed-in obj, false = anon
  const [loading, setLoading] = useState(!!token);

  // Bootstrap: if we have a token, verify it against /me
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!token) { setCustomer(false); setLoading(false); return; }
      setLoading(true);
      try {
        const me = await apiMe(token);
        if (!cancelled) setCustomer(me);
      } catch {
        if (!cancelled) {
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
          setCustomer(false);
        }
      } finally { if (!cancelled) setLoading(false); }
    }
    boot();
    return () => { cancelled = true; };
  }, [token]);

  const login = useCallback(async ({ email, password }) => {
    const res = await apiLogin({ email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setCustomer(res);
    return res;
  }, []);

  const register = useCallback(async ({ email, password, name }) => {
    const res = await apiRegister({ email, password, name });
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setCustomer(res);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* non-blocking */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCustomer(false);
  }, []);

  const value = {
    token,
    customer,
    isAuthenticated: !!(customer && customer.id),
    loading,
    login, register, logout,
    // Lets the account page push an updated profile (e.g. after saving the
    // business logo) into context without a full re-login round-trip.
    updateCustomer: setCustomer,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// Regular-customer discount (% off garments, set in Admin > Customers). Safe to
// call anywhere - 0 for guests or outside the provider.
export function useAccountDiscount() {
  const ctx = useContext(AuthCtx);
  const pct = Number(ctx?.customer?.discount_pct) || 0;
  return pct > 0 ? pct : 0;
}

// Garment price after the account discount (never on bundles - they have their
// own fixed price). Rounded like the server does.
export function discounted(price, pct, product) {
  const n = Number(price) || 0;
  if (!pct || (product && (product.bundle_items?.length || product.bundle_kind))) return n;
  return Math.round(n * (1 - pct / 100) * 100) / 100;
}

export function useCustomerAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useCustomerAuth must be used inside <CustomerAuthProvider>");
  return ctx;
}
