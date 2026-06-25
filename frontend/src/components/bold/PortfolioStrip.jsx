import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPortfolio } from "../../lib/api";
import { ArrowRight } from "lucide-react";

/** Compact horizontal strip showing featured portfolio pieces on the homepage. */
export default function PortfolioStrip() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetchPortfolio({ featured_only: true, limit: 8 })
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]));
  }, []);
  if (items.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-6 py-12" data-testid="portfolio-strip">
      <div className="flex items-end justify-between mb-5">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Recent work</span>
          <h2 className="font-black text-3xl mt-1">From the print room</h2>
        </div>
        <Link to="/portfolio" className="text-sm font-extrabold text-[#7bc67e] inline-flex items-center gap-1 hover:gap-2 transition-all" data-testid="portfolio-strip-all">
          See the full portfolio <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.slice(0, 8).map((it) => (
          <Link
            key={it.id}
            to="/portfolio"
            className="group relative aspect-square overflow-hidden rounded-3xl bg-[#f0fdf4] border-2 border-[#dcfce7] hover:border-[#7bc67e] transition"
            data-testid={`portfolio-strip-item-${it.id}`}
          >
            <img src={it.image_url} alt={it.alt_text || it.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent text-white text-xs font-extrabold">
              {it.title}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
