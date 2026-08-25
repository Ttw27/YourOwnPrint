import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPortfolio } from "../../lib/api";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

/** Scrollable carousel of featured portfolio pieces on the homepage. */
export default function PortfolioStrip() {
  const [items, setItems] = useState([]);
  const scroller = useRef(null);

  useEffect(() => {
    fetchPortfolio({ featured_only: true, limit: 16 })
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  const scrollBy = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <section className="max-w-7xl mx-auto px-6 py-12" data-testid="portfolio-strip">
      <div className="flex items-end justify-between mb-5">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Recent work</span>
          <h2 className="font-black text-3xl mt-1">From the print room</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* arrows — hidden on small screens where you just swipe */}
          <button onClick={() => scrollBy(-1)} aria-label="Scroll left" className="hidden sm:grid place-items-center w-9 h-9 rounded-full border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:bg-[#f0fdf4] transition" data-testid="portfolio-strip-prev">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => scrollBy(1)} aria-label="Scroll right" className="hidden sm:grid place-items-center w-9 h-9 rounded-full border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:bg-[#f0fdf4] transition" data-testid="portfolio-strip-next">
            <ChevronRight size={18} />
          </button>
          <Link to="/portfolio" className="ml-1 text-sm font-extrabold text-[#7bc67e] inline-flex items-center gap-1 hover:gap-2 transition-all" data-testid="portfolio-strip-all">
            See all <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        data-testid="portfolio-strip-scroller"
      >
        {items.map((it) => (
          <Link
            key={it.id}
            to="/portfolio"
            className="group relative flex-shrink-0 w-[46%] sm:w-[30%] md:w-[23%] aspect-square overflow-hidden rounded-3xl bg-[#f0fdf4] border-2 border-[#dcfce7] hover:border-[#7bc67e] transition snap-start"
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
