import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Sparkles, SlidersHorizontal, X } from "lucide-react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import SiteImage from "../components/bold/SiteImage";
import { fetchDesignCategories, fetchDesignProducts } from "../lib/api";
import usePageTitle from "../hooks/usePageTitle";

/**
 * The Design Shop — a separate store for ready-made printed designs. It has its
 * OWN sidebar (themed collections) and OWN filters (garment, sort), deliberately
 * distinct from the workwear catalogue. Each design shows its print artwork as
 * the tile image.
 */
export default function DesignShop() {
  const { slug } = useParams();          // active category slug, if any
  const navigate = useNavigate();
  usePageTitle("The Design Shop — Ready-Made Printed Designs");

  const [cats, setCats] = useState([]);
  const [garments, setGarments] = useState([]);
  const [garment, setGarment] = useState("");
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);

  const activeCat = slug || "";

  useEffect(() => {
    fetchDesignCategories().then((d) => {
      setCats(d?.categories || []);
      setGarments(d?.garments || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDesignProducts({ category: activeCat, garment, sort, limit: 60 })
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [activeCat, garment, sort]);

  const activeTitle = activeCat ? (cats.find((c) => c.slug === activeCat)?.title || "Designs") : "All designs";

  const Sidebar = () => (
    <div className="space-y-1">
      <button
        onClick={() => { navigate("/design-shop"); setMobileFilters(false); }}
        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition ${!activeCat ? "bg-[#7bc67e] text-[#1a1a1a]" : "hover:bg-[#f0fdf4] text-[#4b5563]"}`}
        data-testid="design-cat-all"
      >
        All designs
      </button>
      {cats.map((c) => (
        <button
          key={c.slug}
          onClick={() => { navigate(`/design-shop/${c.slug}`); setMobileFilters(false); }}
          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition flex items-center justify-between gap-2 ${activeCat === c.slug ? "bg-[#7bc67e] text-[#1a1a1a]" : "hover:bg-[#f0fdf4] text-[#4b5563]"}`}
          data-testid={`design-cat-${c.slug}`}
        >
          <span>{c.title}{c.adult && <span className="ml-1 text-[9px] align-top text-rose-400 font-black">18+</span>}</span>
          {typeof c.count === "number" && <span className="text-[10px] opacity-60">{c.count}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white font-nunito text-[#1a1a1a]">
      <BoldNavbar />

      {/* Header */}
      <div className="bg-gradient-to-b from-[#faf5ff] to-white border-b border-[#f0e6ff]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em] text-[#a855f7]">
            <Sparkles size={14} /> The Design Shop
          </div>
          <h1 className="font-black text-3xl sm:text-5xl mt-3 leading-tight">Ready-made designs,<br className="hidden sm:block" /> printed to order</h1>
          <p className="text-[#4b5563] mt-3 max-w-2xl">Original artwork on your choice of tee, hoodie, sweater and more. Pick a design, pick your garment, done — no designing required.</p>

          {/* Visual category cards — quick colourful entry points */}
          {!activeCat && cats.length > 0 && (
            <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="design-cat-cards">
              {cats.slice(0, 10).map((c, i) => {
                const shades = ["from-[#a855f7] to-[#7c3aed]", "from-[#ec4899] to-[#db2777]", "from-[#f59e0b] to-[#d97706]", "from-[#10b981] to-[#059669]", "from-[#3b82f6] to-[#2563eb]", "from-[#ef4444] to-[#dc2626]", "from-[#8b5cf6] to-[#6d28d9]", "from-[#14b8a6] to-[#0d9488]", "from-[#f43f5e] to-[#e11d48]"];
                return (
                  <button key={c.slug} onClick={() => navigate(`/design-shop/${c.slug}`)} className={`bg-gradient-to-br ${shades[i % shades.length]} rounded-2xl px-4 py-5 text-white text-left hover:scale-[1.03] transition-transform`} data-testid={`design-cat-card-${c.slug}`}>
                    <div className="font-black text-sm leading-tight">{c.title}</div>
                    {typeof c.count === "number" && <div className="text-[11px] opacity-80 mt-1">{c.count} design{c.count === 1 ? "" : "s"}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[220px_1fr] gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#4b5563] mb-2 px-3">Collections</div>
          <Sidebar />
        </aside>

        {/* Main */}
        <div>
          {/* Filter bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileFilters(true)} className="lg:hidden inline-flex items-center gap-2 text-sm font-bold border-2 border-[#f0e6ff] rounded-full px-4 py-2" data-testid="design-mobile-filter-open">
                <SlidersHorizontal size={15} /> Collections
              </button>
              <h2 className="font-black text-xl">{activeTitle}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={garment} onChange={(e) => setGarment(e.target.value)} className="bg-white border-2 border-[#f0e6ff] rounded-full px-3 py-2 text-sm" data-testid="design-garment-filter">
                <option value="">All garments</option>
                {garments.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-white border-2 border-[#f0e6ff] rounded-full px-3 py-2 text-sm" data-testid="design-sort">
                <option value="newest">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-[#faf5ff] animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-[#faf5ff] border-2 border-[#f0e6ff] rounded-3xl p-10 text-center">
              <Sparkles className="mx-auto text-[#a855f7]" size={28} />
              <p className="font-extrabold text-lg mt-3">No designs here yet</p>
              <p className="text-sm text-[#4b5563] mt-1">New designs are added all the time — check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="design-grid">
              {items.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="group bg-white border-2 border-[#f0e6ff] hover:border-[#a855f7] rounded-2xl overflow-hidden transition-colors" data-testid={`design-item-${p.id}`}>
                  <div className="aspect-square bg-[#faf5ff] overflow-hidden grid place-items-center p-4">
                    <SiteImage src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" testid={`design-img-${p.id}`} />
                  </div>
                  <div className="p-3">
                    <div className="font-extrabold text-sm truncate">{p.name}</div>
                    <div className="text-sm font-black text-[#7c3aed] mt-0.5">from £{Number(p.price).toFixed(2)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFilters && (
        <div className="fixed inset-0 z-[100] lg:hidden" onClick={() => setMobileFilters(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-black">Collections</div>
              <button onClick={() => setMobileFilters(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      <BoldFooter />
    </div>
  );
}
