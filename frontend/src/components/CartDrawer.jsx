import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X, Trash2, Loader2, ShoppingBag, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "../context/CartContext";
import { createCartCheckout } from "../lib/api";
import { toast } from "sonner";

/**
 * Slide-out drawer showing every cart line with server-repriced totals.
 * Sits on top of the app; opens automatically after Add to Cart and via the
 * navbar bag icon. Checkout dispatches to /api/checkout/cart-session which
 * builds a single Stripe Session for the whole cart.
 */
export default function CartDrawer() {
  const { isDrawerOpen, closeDrawer, items, priced, pricing, setLineQty, removeLine, clear } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const navigate = useNavigate();

  if (!isDrawerOpen) return null;

  async function goCheckout() {
    if (items.length === 0) return;
    setCheckingOut(true);
    try {
      const payload = items.map(({ product_id, size_qtys, color, placements, blank, design_meta }) =>
        ({ product_id, size_qtys, color, placements, blank, design_meta }));
      const { url } = await createCartCheckout(payload);
      if (url) window.location.href = url;
    } catch (e) { toast.error(e?.response?.data?.detail || "Checkout failed"); }
    finally { setCheckingOut(false); }
  }

  const priceById = new Map(priced.items.map((p) => [p.product_id, p]));

  return (
    <div className="fixed inset-0 z-[80]" data-testid="cart-drawer">
      <button
        aria-label="Close cart"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeDrawer}
        data-testid="cart-drawer-backdrop"
      />
      <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white shadow-2xl flex flex-col font-nunito animate-slide-in">
        <header className="p-5 border-b-2 border-[#dcfce7] flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <ShoppingBag className="text-[#7bc67e]" size={18} />
            <h2 className="font-black text-xl">Your basket</h2>
            {pricing && <Loader2 className="animate-spin text-[#7bc67e]" size={14} />}
          </div>
          <button onClick={closeDrawer} className="w-9 h-9 rounded-full bg-[#f0fdf4] hover:bg-[#dcfce7] grid place-items-center" data-testid="cart-drawer-close">
            <X size={16} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex-1 grid place-items-center px-6 text-center">
            <div>
              <ShoppingBag size={44} className="text-[#7bc67e] mx-auto opacity-50" />
              <p className="mt-4 font-black text-xl">Your basket's empty</p>
              <p className="text-sm text-[#4b5563] mt-1">Add anything from the shop — we'll bulk-discount you as you add more.</p>
              <button onClick={() => { closeDrawer(); navigate("/"); }}
                className="mt-5 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full text-sm"
                data-testid="cart-drawer-shop"
              >Start shopping <ArrowRight size={14} /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((line) => {
                const pi = priceById.get(line.product_id);
                const name = pi?.product_name || line.product_id;
                const image = pi?.product_image;
                const lineTotal = pi?.line_total || 0;
                const unit = pi?.unit_hint || 0;
                return (
                  <div key={line.line_id} className="border-2 border-[#dcfce7] rounded-2xl p-3 flex gap-3" data-testid={`cart-line-${line.product_id}`}>
                    {image && <img src={image} alt={name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-black text-sm truncate">{name}</p>
                          <p className="text-[11px] text-[#4b5563]">
                            {line.color ? `${line.color} · ` : ""}
                            {line.blank ? "Blank" : ((line.placements || []).join(" + ") || "Print")}
                            {unit ? ` · £${unit.toFixed(2)} ea` : ""}
                          </p>
                        </div>
                        <button onClick={() => removeLine(line.line_id)} className="text-rose-500 hover:bg-rose-50 rounded p-1" title="Remove" data-testid={`cart-line-remove-${line.product_id}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(line.size_qtys || {}).map(([sz, q]) => (
                          <div key={sz} className="inline-flex items-center gap-1 bg-[#f0fdf4] rounded-full pl-2 pr-1 py-0.5" data-testid={`cart-line-size-${line.product_id}-${sz}`}>
                            <span className="text-[10px] font-extrabold">{sz}</span>
                            <button onClick={() => setLineQty(line.line_id, sz, q - 1)} className="w-5 h-5 grid place-items-center rounded-full bg-white hover:bg-[#dcfce7]" data-testid={`cart-line-decr-${line.product_id}-${sz}`}><Minus size={9} /></button>
                            <span className="text-[10px] font-extrabold min-w-[16px] text-center">{q}</span>
                            <button onClick={() => setLineQty(line.line_id, sz, q + 1)} className="w-5 h-5 grid place-items-center rounded-full bg-white hover:bg-[#dcfce7]" data-testid={`cart-line-incr-${line.product_id}-${sz}`}><Plus size={9} /></button>
                          </div>
                        ))}
                      </div>
                      <p className="text-right font-extrabold text-sm mt-1">£{lineTotal.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
              <button onClick={clear} className="text-[11px] text-rose-500 hover:underline font-extrabold" data-testid="cart-drawer-clear">Clear basket</button>
            </div>

            <footer className="border-t-2 border-[#dcfce7] p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4b5563]">Items ({priced.total_qty})</span>
                <span className="font-extrabold">£{priced.grand_total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-black text-lg">Total</span>
                <span className="font-black text-xl" data-testid="cart-drawer-total">£{priced.grand_total.toFixed(2)}</span>
              </div>
              <button
                onClick={goCheckout}
                disabled={checkingOut || pricing || items.length === 0}
                className="w-full py-3 rounded-full bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="cart-drawer-checkout"
              >
                {checkingOut ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />} Secure checkout
              </button>
              <p className="text-[10px] text-[#4b5563] text-center">Bulk discounts + print upcharges applied server-side. VAT calculated at checkout.</p>
            </footer>
          </>
        )}
      </aside>
      <style>{`@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } } .animate-slide-in { animation: slide-in 220ms ease-out; }`}</style>
    </div>
  );
}
