import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { priceCart } from "../lib/api";

/**
 * Multi-product cart with localStorage persistence.
 *
 * Cart items are stored per-line — each line captures product + size_qtys +
 * placements + colour + optional design_meta (DYO artwork ref). The server is
 * the source of truth for pricing: every render we send the raw cart to
 * `/api/cart/price` and use its numbers. This means bulk-tier discounts and
 * print upcharges always match what Stripe will actually charge.
 */
const CartCtx = createContext(null);
const LS_KEY = "yop_cart_v1";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveToStorage(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* quota / disabled */ }
}

function makeLineId(product_id, color, placements, design_meta) {
  const p = [...(placements || [])].sort().join(",");
  const dm = design_meta ? JSON.stringify(design_meta) : "";
  return `${product_id}::${color || ""}::${p}::${dm}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadFromStorage);   // [{ line_id, product_id, size_qtys, color, placements, blank, design_meta }]
  const [priced, setPriced] = useState({ items: [], grand_total: 0, total_qty: 0 });
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [pricing, setPricing] = useState(false);

  // Persist on any change
  useEffect(() => { saveToStorage(items); }, [items]);

  // Reprice whenever the cart shape changes
  useEffect(() => {
    let cancelled = false;
    async function reprice() {
      if (items.length === 0) { setPriced({ items: [], grand_total: 0, total_qty: 0 }); return; }
      setPricing(true);
      try {
        const cartPayload = items.map(({ product_id, size_qtys, color, placements, blank, design_meta }) =>
          ({ product_id, size_qtys, color, placements, blank, design_meta }));
        const res = await priceCart(cartPayload);
        if (!cancelled) setPriced(res);
      } catch (e) {
        if (!cancelled) toast.error(e?.response?.data?.detail || "Couldn't reprice cart");
      } finally { if (!cancelled) setPricing(false); }
    }
    reprice();
    return () => { cancelled = true; };
  }, [items]);

  const addLine = useCallback((line) => {
    // { product_id, size_qtys, color, placements, blank, design_meta, name?: display hint }
    const line_id = makeLineId(line.product_id, line.color, line.placements, line.design_meta);
    setItems((prev) => {
      const existing = prev.findIndex((l) => l.line_id === line_id);
      if (existing >= 0) {
        // merge quantities
        const merged = { ...prev[existing] };
        const nextQtys = { ...(merged.size_qtys || {}) };
        Object.entries(line.size_qtys || {}).forEach(([sz, q]) => {
          nextQtys[sz] = (nextQtys[sz] || 0) + Number(q || 0);
        });
        merged.size_qtys = nextQtys;
        const copy = [...prev]; copy[existing] = merged; return copy;
      }
      return [...prev, { ...line, line_id }];
    });
    setDrawerOpen(true);
    toast.success(`Added to cart — ${line.name || line.product_id}`);
  }, []);

  const removeLine = useCallback((line_id) => {
    setItems((prev) => prev.filter((l) => l.line_id !== line_id));
  }, []);

  const setLineQty = useCallback((line_id, size, qty) => {
    setItems((prev) => prev.map((l) => {
      if (l.line_id !== line_id) return l;
      const next = { ...l, size_qtys: { ...(l.size_qtys || {}) } };
      const q = Math.max(0, Math.floor(Number(qty) || 0));
      if (q === 0) delete next.size_qtys[size]; else next.size_qtys[size] = q;
      return next;
    }).filter((l) => Object.keys(l.size_qtys || {}).length > 0));
  }, []);

  const clear = useCallback(() => { setItems([]); }, []);

  const totalQty = useMemo(() => priced?.total_qty || 0, [priced]);

  const value = {
    items, priced, totalQty, pricing,
    isDrawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false),
    addLine, removeLine, setLineQty, clear,
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
