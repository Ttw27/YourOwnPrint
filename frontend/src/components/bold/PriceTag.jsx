import React from "react";
import { useAccountDiscount, discounted } from "../../context/CustomerAuthContext";

/**
 * PriceTag - one place that decides how a price is written on the site.
 *
 * The gross figure leads, because it's the one the customer actually pays and
 * it's the round number the catalogue was priced to - dividing it out gives
 * odd headline figures like £6.66. The ex-VAT figure sits underneath for
 * trade buyers, who need it but already know to look for it.
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

// "£X ex. VAT" line to sit under any total. Children's clothing is zero-rated,
// so it says so instead of taking VAT off.
export function ExVat({ amount, zeroRated = false, className = "text-[11px] text-[#4b5563]", testid }) {
  const n = Number(amount) || 0;
  return (
    <div className={className} data-testid={testid}>
      {zeroRated ? "No VAT - children\u2019s clothing" : `\u00a3${(n / 1.2).toFixed(2)} ex. VAT`}
    </div>
  );
}

export function hasVatFields(p) {
  return p && p.price_ex_vat !== undefined && p.price_ex_vat !== null;
}

export default function PriceTag({
  product,
  size = "md",
  className = "",
  testid,
  tone = "dark",     // "brand" tints the headline figure green
  prefix,            // e.g. "from" - rendered small, above the figure
  suffix,            // e.g. " /player" - rendered small, beside the figure
  inline = false,    // one line, for pills and tight spaces
}) {
  const pct = useAccountDiscount();
  if (!product) return null;

  // Signed-in regular with an account discount: their price leads, the normal
  // price is shown crossed out (bundles keep their own price).
  const fullGross = Number(product.price_inc_vat ?? product.price ?? 0);
  const gross = discounted(fullGross, pct, product);
  const hasDisc = gross < fullGross;
  const factor = fullGross ? gross / fullGross : 1;
  const net = hasVatFields(product) ? Math.round(Number(product.price_ex_vat) * factor * 100) / 100 : null;
  // Admin "Was price" offer (Product settings > Name, price & main photo).
  const wasOffer = Number(product.was_price || 0) > fullGross ? Number(product.was_price) : 0;
  const Was = () => hasDisc ? (
    <span className="block text-[11px] font-nunito font-bold text-[#4b5563] mt-0.5" data-testid="price-account-discount">
      <span className="line-through mr-1">{money(wasOffer || fullGross)}</span>
      <span className="text-[#166534]">Your {pct}% discount</span>
    </span>
  ) : wasOffer ? (
    <span className="block text-[11px] font-nunito font-bold text-[#4b5563] mt-0.5" data-testid="price-offer">
      <span className="line-through mr-1">{money(wasOffer)}</span>
      <span className="bg-[#f07c74] text-white rounded-full px-1.5 py-px text-[10px] font-extrabold">Offer</span>
    </span>
  ) : null;
  const WasInline = () => (hasDisc || wasOffer) ? (
    <span className={`text-[10px] text-[#4b5563] ml-1.5 line-through`}>{money(wasOffer || fullGross)}</span>
  ) : null;
  const zeroRated = Boolean(product.vat_zero_rated);

  const bigClass = size === "xl" ? "text-4xl" : size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  const subClass = size === "sm" ? "text-[10px]" : "text-[11px]";
  const toneClass = tone === "brand" ? "text-[#7bc67e]" : "text-[#1a1a1a]";

  const Headline = ({ children }) => (
    <>
      {prefix && <span className="text-xs font-nunito font-bold text-[#4b5563] block">{prefix}</span>}
      <div className={`${bigClass} font-black ${toneClass} leading-none`}>
        {children}
        {suffix && <span className="text-sm font-bold text-[#4b5563]">{suffix}</span>}
      </div>
    </>
  );

  // No VAT breakdown available - show the one figure we can stand behind.
  if (net === null) {
    return (
      <div className={className} data-testid={testid}>
        <Headline>{money(gross)}</Headline>
        <Was />
      </div>
    );
  }

  if (zeroRated) {
    if (inline) {
      return (
        <span className={className} data-testid={testid}>
          {prefix ? `${prefix} ` : ""}{money(gross)}<WasInline />
          <span className={`${subClass} text-[#4b5563] ml-1.5`}>no VAT</span>
        </span>
      );
    }
    return (
      <div className={className} data-testid={testid}>
        <Headline>{money(gross)}</Headline>
        <Was />
        <div className={`${subClass} text-[#4b5563] mt-0.5`}>No VAT - children&rsquo;s clothing</div>
      </div>
    );
  }

  if (inline) {
    return (
      <span className={className} data-testid={testid}>
        {prefix ? `${prefix} ` : ""}{money(gross)}<WasInline />
        <span className={`${subClass} text-[#4b5563] ml-1.5`}>{money(net)} ex. VAT</span>
      </span>
    );
  }

  return (
    <div className={className} data-testid={testid}>
      <Headline>{money(gross)}</Headline>
      <Was />
      <div className={`${subClass} text-[#4b5563] mt-0.5`}>{money(net)} ex. VAT</div>
    </div>
  );
}
