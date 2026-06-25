import React from "react";
import { Link } from "react-router-dom";
import { TOOLS_SHOWCASE } from "../../lib/data";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Showcase strip for the 5 hero tools.
 * `variant`:
 *   - "full"    (default) — large 5-card mosaic for the homepage / dedicated section
 *   - "compact" — single-row scroll for collection / industry pages
 */
export default function ToolsShowcase({ variant = "full", title = "Tools to make it yours", subtitle = "Five ways to get your kit looking the part — pick the one that fits how you order." }) {
  if (variant === "compact") {
    return (
      <section className="max-w-7xl mx-auto px-6 py-10" data-testid="tools-showcase-compact">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-nunito font-black text-2xl sm:text-3xl flex items-center gap-2"><Sparkles size={18} className="text-[#7bc67e]" /> {title}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TOOLS_SHOWCASE.map((t) => (
            <Link
              key={t.key}
              to={t.to}
              className="group relative aspect-[4/5] rounded-2xl overflow-hidden border-2 border-[#dcfce7] hover:border-[#7bc67e] transition shadow-sm hover:shadow-md"
              data-testid={`tool-card-${t.key}`}
            >
              <img src={t.image} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="text-white font-nunito font-black text-sm leading-tight">{t.title}</div>
                <div className="text-[10px] text-white/80 mt-1 group-hover:text-[#7bc67e] inline-flex items-center gap-1">
                  Open <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-16" data-testid="tools-showcase-full">
      <div className="mb-8 max-w-2xl">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Built-in tools</div>
        <h2 className="font-nunito font-black text-3xl lg:text-5xl mt-2">{title}</h2>
        <p className="text-[#4b5563] mt-3">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TOOLS_SHOWCASE.map((t, i) => (
          <Link
            key={t.key}
            to={t.to}
            className={`group relative overflow-hidden rounded-3xl border-2 border-transparent hover:-translate-y-1 transition ${i === 0 ? "sm:row-span-2 lg:col-span-2 lg:row-span-2 aspect-square sm:aspect-auto sm:min-h-[420px]" : "aspect-[4/3]"}`}
            style={{ background: t.colour }}
            data-testid={`tool-card-${t.key}`}
          >
            <img src={t.image} alt={t.title} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="relative h-full flex flex-col justify-between p-5">
              <div>
                <span className="inline-block text-[10px] uppercase tracking-[0.3em] font-extrabold px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.85)", color: "#1a1a1a" }}>Tool</span>
              </div>
              <div>
                <div className="font-nunito font-black text-white text-2xl sm:text-3xl leading-tight" style={{ color: t.accent === "#1a1a1a" ? "#fff" : t.accent }}>{t.title}</div>
                <div className="text-sm text-white/90 mt-2 max-w-xs">{t.tagline}</div>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-white group-hover:translate-x-1 transition-transform">
                  Open the tool <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
