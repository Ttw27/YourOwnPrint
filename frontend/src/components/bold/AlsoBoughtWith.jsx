import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAlsoBought } from "../../lib/api";

export default function AlsoBoughtWith({ productId, limit = 4 }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetchAlsoBought(productId, limit).then(setItems).catch(() => setItems([]));
  }, [productId, limit]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-12 max-w-6xl mx-auto" data-testid="pdp-also-bought">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-nunito font-black text-2xl sm:text-3xl">Customers also bought</h2>
        <span className="text-xs text-[#4b5563]">Hand-picked add-ons</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="pdp-also-bought-grid">
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            className="bg-white border-2 border-[#e5e7eb] hover:border-[#7bc67e] rounded-2xl p-3 transition group"
            data-testid={`pdp-also-bought-item-${p.id}`}
          >
            <div className="aspect-square overflow-hidden rounded-xl bg-[#f9fafb] mb-2">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
            </div>
            <div className="font-nunito font-extrabold text-sm leading-tight line-clamp-2">{p.name}</div>
            <div className="text-xs text-[#7bc67e] font-nunito font-extrabold mt-1">From £{p.price.toFixed(2)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
