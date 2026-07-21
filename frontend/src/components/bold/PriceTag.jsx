import React from "react";

/**
 * PriceTag — one place that decides how a price is written on the site.
 *
 * The gross figure leads, because it's the one the customer actually pays and
 * it's the round number the catalogue was priced to — dividing it out gives
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

export function hasVatFields(p) {
  return p && p.price_ex_vat !== undefined && p.price_ex_vat !== null;
}

export default function PriceTag({
  product,
  size = "md",
  className = "",
  testid,
  tone = "dark",     // "brand" tints the headline figure green
  prefix,            // e.g. "from" — rendered small, above the figure
  suffix,            // e.g. " /player" — rendered small, beside the figure
  inline = false,    // one line, for pills and tight spaces
}) {
  if (!product) return null;

  const gross = Number(product.price_inc_vat ?? product.price ?? 0);
  const net = hasVatFields(product) ? Number(product.price_ex_vat) : null;
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

  // No VAT breakdown available — show the one figure we can stand behind.
  if (net === null) {
    return (
      <div className={className} data-testid={testid}>
        <Headline>{money(gross)}</Headline>
      </div>
    );
  }

  if (zeroRated) {
    if (inline) {
      return (
        <span className={className} data-testid={testid}>
          {prefix ? `${prefix} ` : ""}{money(gross)}
          <span className={`${subClass} text-[#4b5563] ml-1.5`}>no VAT</span>
        </span>
      );
    }
    return (
      <div className={className} data-testid={testid}>
        <Headline>{money(gross)}</Headline>
        <div className={`${subClass} text-[#4b5563] mt-0.5`}>No VAT &mdash; children&rsquo;s clothing</div>
      </div>
    );
  }

  if (inline) {
    return (
      <span className={className} data-testid={testid}>
        {prefix ? `${prefix} ` : ""}{money(gross)}
        <span className={`${subClass} text-[#4b5563] ml-1.5`}>{money(net)} ex. VAT</span>
      </span>
    );
  }

  return (
    <div className={className} data-testid={testid}>
      <Headline>{money(gross)}</Headline>
      <div className={`${subClass} text-[#4b5563] mt-0.5`}>{money(net)} ex. VAT</div>
    </div>
  );
}
