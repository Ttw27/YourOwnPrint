import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import ToolsShowcase from "../components/bold/ToolsShowcase";
import { fetchAllPortfolio } from "../lib/api";
import { Loader2, Image as ImageIcon, ArrowRight } from "lucide-react";

const PRETTY = {
  workwear: "Workwear",
  "team-kits": "Team Kits",
  leavers: "Leavers'",
  sports: "Sports",
  fitness: "Fitness",
  hospitality: "Hospitality",
  schools: "Schools",
  events: "Events",
  beauty: "Beauty",
  barbering: "Barbering",
  other: "Other",
};

export default function Portfolio() {
  const [data, setData] = useState({ categories: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchAllPortfolio()
      .then(setData)
      .catch(() => setData({ categories: [], items: [] }))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (active === "all") return data.items;
    return data.items.filter((i) => i.category === active);
  }, [data.items, active]);

  const visibleCats = useMemo(() => {
    const used = new Set(data.items.map((i) => i.category));
    return (data.categories || []).filter((c) => used.has(c));
  }, [data.items, data.categories]);

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="portfolio-page">
      <BoldNavbar />

      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-[#7bc67e] via-[#fde68a] to-[#f87171]" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">Portfolio</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Real work, printed in the UK</h1>
          <p className="text-zinc-300 mt-3 max-w-2xl">
            A live gallery of jobs we've turned around — workwear, team kits, leavers' hoodies, fight nights and more. Tap any image to see it big.
          </p>
        </div>
      </header>

      {/* Filter pills */}
      <section className="max-w-7xl mx-auto px-6 pt-8">
        <div className="flex flex-wrap items-center gap-2" data-testid="portfolio-filter">
          <button
            onClick={() => setActive("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition ${active === "all" ? "bg-[#1a1a1a] border-[#1a1a1a] text-white" : "bg-white border-[#dcfce7] text-[#4b5563] hover:border-[#7bc67e]"}`}
            data-testid="portfolio-filter-all"
          >
            All work
          </button>
          {visibleCats.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition ${active === c ? "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]" : "bg-white border-[#dcfce7] text-[#4b5563] hover:border-[#7bc67e]"}`}
              data-testid={`portfolio-filter-${c}`}
            >
              {PRETTY[c] || c}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="py-20 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-8 text-center" data-testid="portfolio-empty">
            <ImageIcon className="mx-auto text-[#f59e0b]" size={28} />
            <p className="mt-3 text-sm text-[#4b5563]">
              {data.items.length === 0
                ? "Portfolio is being built — check back soon, or "
                : "Nothing in this category yet — try "}
              <Link to="/contact" className="underline font-extrabold text-[#7bc67e]">request a sample mock-up</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="portfolio-grid">
            {filtered.map((it) => (
              <button
                key={it.id}
                onClick={() => setLightbox(it)}
                className="group relative aspect-square overflow-hidden rounded-3xl bg-[#f0fdf4] border-2 border-[#dcfce7] hover:border-[#7bc67e] transition"
                data-testid={`portfolio-item-${it.id}`}
              >
                <img src={it.image_url} alt={it.alt_text || it.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent text-left">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#7bc67e]">{PRETTY[it.category] || it.category}</div>
                  <div className="text-white text-sm font-extrabold leading-tight line-clamp-2">{it.title}</div>
                </div>
                {it.featured && (
                  <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#fde68a] text-[#1a1a1a]">Featured</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-[#1a1a1a] text-white rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-[#7bc67e] text-xs uppercase tracking-[0.3em] font-extrabold">Like what you see?</div>
            <h3 className="text-2xl font-black mt-1">Get yours printed next.</h3>
            <p className="text-zinc-300 text-sm mt-1 max-w-md">Send your logo, idea or rough sketch — we'll mock it up free, no commitment.</p>
          </div>
          <Link to="/contact" className="px-5 py-3 bg-[#7bc67e] text-[#1a1a1a] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-white transition" data-testid="portfolio-cta-quote">
            Get a free mock-up <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <ToolsShowcase variant="compact" />
      <BoldFooter />

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={() => setLightbox(null)} data-testid="portfolio-lightbox">
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.image_url} alt={lightbox.alt_text || lightbox.title} className="w-full max-h-[80vh] object-contain rounded-2xl bg-white" />
            <div className="text-white mt-3">
              <div className="text-[#7bc67e] text-xs uppercase tracking-wider font-extrabold">{PRETTY[lightbox.category] || lightbox.category}</div>
              <div className="font-black text-xl">{lightbox.title}</div>
              {lightbox.caption && <p className="text-zinc-300 text-sm mt-1">{lightbox.caption}</p>}
              <button onClick={() => setLightbox(null)} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs" data-testid="portfolio-lightbox-close">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
