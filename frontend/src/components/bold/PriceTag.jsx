import React from "react";

/**
 * PriceTag — one place that decides how a price is written on the site.
 *
 * Trade customers buying workwear think in ex-VAT figures, so that's the number
 * shown large; the gross figure sits underneath so nobody is surprised at
 * checkout.
 *
 * The two figures come from the server (`price_ex_vat`, `price_inc_vat`,
 * `vat_zero_rated`) rather than being worked out here. Children's clothing is
 * zero-rated in the UK, and a page that computed VAT itself would only need to
 * forget that once to start showing tax on kids' garments.
 *
 * `price` alone is still honoured, so a payload that predates those fields
 * renders the gross figure on its own rather than breaking.
 */

const money = (n) => `£${Number(n || 0).toFixed(2)}`;

export function hasVatFields(p) {
  return p && p.price_ex_vat !== undefined && p.price_ex_vat !== null;
}

export default function PriceTag({ product, size = "md", className = "", testid }) {
  if (!product) return null;

  const gross = Number(product.price_inc_vat ?? product.price ?? 0);
  const net = hasVatFields(product) ? Number(product.price_ex_vat) : null;
  const zeroRated = Boolean(product.vat_zero_rated);

  const bigClass = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const subClass = size === "sm" ? "text-[10px]" : "text-[11px]";

  // No VAT breakdown available — show the one figure we can stand behind.
  if (net === null) {
    return (
      <div className={className} data-testid={testid}>
        <div className={`${bigClass} font-black text-[#1a1a1a] leading-none`}>{money(gross)}</div>
      </div>
    );
  }

  if (zeroRated) {
    return (
      <div className={className} data-testid={testid}>
        <div className={`${bigClass} font-black text-[#1a1a1a] leading-none`}>{money(gross)}</div>
        <div className={`${subClass} text-[#4b5563] mt-0.5`}>No VAT &mdash; children&rsquo;s clothing</div>
      </div>
    );
  }

  return (
    <div className={className} data-testid={testid}>
      <div className={`${bigClass} font-black text-[#1a1a1a] leading-none`}>{money(net)}</div>
      <div className={`${subClass} text-[#4b5563] mt-0.5`}>{money(gross)} inc. VAT</div>
    </div>
  );
}
