import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Find My Kit promo block. Two looks:
 *  - variant="hero"    → big homepage banner
 *  - variant="inline"  → slim "stuck? let us build your kit" prompt for the
 *                        bottom of collection / industry pages
 * Optional `trade` pre-seeds the CTA link (e.g. an industry page can deep-link
 * straight into a kit for that trade).
 */
export default function FindMyKitPromo({ variant = "inline", trade = "", className = "", image = "" }) {
  const to = trade ? `/find-my-kit?trade=${encodeURIComponent(trade)}` : "/find-my-kit";

  if (variant === "hero") {
    return (
      <section className={`px-6 ${className}`} data-testid="fmk-promo-hero">
        <div className="max-w-6xl mx-auto bg-gradient-to-br from-[#7bc67e] to-[#5eb062] rounded-[2rem] overflow-hidden text-[#1a1a1a] grid md:grid-cols-[1.4fr_1fr]">
          <div className="px-8 py-12 sm:px-14 sm:py-14 relative">
            <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em] bg-white/25 rounded-full px-3 py-1.5">
                <Sparkles size={14} /> New · AI
              </div>
              <h2 className="font-black text-3xl sm:text-4xl mt-4 max-w-xl leading-tight">
                Not sure what you need? Tell us your trade.
              </h2>
              <p className="mt-3 text-[#14532d] max-w-lg font-bold">
                Pick your industry or type your job, and we'll build a complete, ready-to-brand kit from what we
                stock — no wading through pages.
              </p>
              <Link
                to={to}
                className="mt-6 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-6 py-3.5"
                data-testid="fmk-promo-hero-cta"
              >
                <Sparkles size={17} /> Build my kit <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          {/* Square image panel — admin-editable, falls back to a soft tint */}
          <div className="hidden md:block relative bg-[#6bb870] min-h-[220px]">
            {image
              ? <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              : <div className="absolute inset-0 grid place-items-center text-white/50"><Sparkles size={54} /></div>}
          </div>
        </div>
      </section>
    );
  }

  // inline / "stuck?" prompt
  return (
    <div className={`bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl px-6 py-6 sm:px-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 ${className}`} data-testid="fmk-promo-inline">
      <div className="w-12 h-12 rounded-2xl bg-[#7bc67e] grid place-items-center flex-shrink-0">
        <Sparkles size={22} className="text-[#1a1a1a]" />
      </div>
      <div className="flex-1 text-center sm:text-left">
        <div className="font-black text-lg">Can't find what you need?</div>
        <div className="text-sm text-[#4b5563]">Tell us your trade and we'll build a complete kit for you in seconds.</div>
      </div>
      <Link
        to={to}
        className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-extrabold rounded-full px-5 py-2.5 flex-shrink-0"
        data-testid="fmk-promo-inline-cta"
      >
        Find my kit <ArrowRight size={15} />
      </Link>
    </div>
  );
}
