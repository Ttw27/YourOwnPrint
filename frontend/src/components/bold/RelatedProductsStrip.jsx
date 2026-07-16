import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Generic related-products strip — used by both "Customers also bought" and "Match with".
 * Pass a fetcher returning [{id,name,price,image,category}].
 */
export default function RelatedProductsStrip({ productId, title, subtitle, fetcher, accentColor = "#7bc67e", testidPrefix }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    fetcher(productId).then((d) => { if (alive) setItems(Array.isArray(d) ? d : []); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [productId, fetcher]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-12 max-w-6xl mx-auto" data-testid={`${testidPrefix}-section`}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-nunito font-black text-2xl sm:text-3xl">{title}</h2>
        {subtitle && <span className="text-xs text-[#4b5563]">{subtitle}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid={`${testidPrefix}-grid`}>
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            className="bg-white border-2 border-[#e5e7eb] rounded-2xl p-3 transition group"
            style={{ borderColor: undefined }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            data-testid={`${testidPrefix}-item-${p.id}`}
          >
            <div className="aspect-square overflow-hidden rounded-xl bg-[#f9fafb] mb-2">
              <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition" />
            </div>
            <div className="font-nunito font-extrabold text-sm leading-tight line-clamp-2">{p.name}</div>
            <div className="text-xs font-nunito font-extrabold mt-1" style={{ color: accentColor }}>From £{p.price.toFixed(2)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
