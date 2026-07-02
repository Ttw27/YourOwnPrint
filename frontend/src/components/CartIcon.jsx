import React from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";

/**
 * Bag icon with a live count badge — designed for the navbar (any theme).
 * Clicking opens the CartDrawer.
 */
export default function CartIcon({ className = "" }) {
  const { totalQty, openDrawer } = useCart();
  return (
    <button
      type="button"
      onClick={openDrawer}
      className={`relative w-10 h-10 rounded-full bg-white hover:bg-[#f0fdf4] border-2 border-[#dcfce7] grid place-items-center transition-colors ${className}`}
      aria-label={`Open basket (${totalQty} items)`}
      data-testid="cart-icon"
    >
      <ShoppingBag size={16} className="text-[#1a1a1a]" />
      {totalQty > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#7bc67e] text-[#1a1a1a] text-[10px] font-black grid place-items-center border-2 border-white"
          data-testid="cart-icon-count"
        >{totalQty > 99 ? "99+" : totalQty}</span>
      )}
    </button>
  );
}
