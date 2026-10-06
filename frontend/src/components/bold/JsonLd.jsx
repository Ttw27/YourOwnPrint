import { useEffect } from "react";

/**
 * Structured data (schema.org JSON-LD) for Google - product details, price and
 * review stars in search results. Renders nothing; adds a <script> to <head>
 * while the page is open.
 */
export default function JsonLd({ id, data }) {
  const json = data ? JSON.stringify(data) : "";
  useEffect(() => {
    if (!json) return undefined;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-yop-ld", id);
    el.textContent = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, json]);
  return null;
}

const SITE = "https://www.yourownprint.co.uk";

/** Product + Offer (+ AggregateRating when it has reviews). */
export function productLd(p, { rating, count, path, image, colour } = {}) {
  if (!p) return null;
  const img = image || p.image;
  const out = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: [img, ...((p.image_gallery || []).filter((u) => typeof u === "string").slice(0, 4))].filter(Boolean),
    description: String(p.description_full || p.description || p.name).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 900),
    sku: (p.source_sku || p.id).toString().toUpperCase(),
    brand: { "@type": "Brand", name: p.brand || p._brand || "Your Own Print" },
    ...(colour ? { color: colour } : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE}${path || `/product/${p.id}`}`,
      priceCurrency: "GBP",
      price: Number(p.price || 0).toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Your Own Print" },
    },
  };
  if (count > 0 && rating > 0) {
    out.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(rating).toFixed(2), reviewCount: count, bestRating: 5, worstRating: 1 };
  }
  return out;
}
