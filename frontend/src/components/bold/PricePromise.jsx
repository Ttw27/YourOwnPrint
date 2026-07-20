import React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, HandshakeIcon, ArrowRight } from "lucide-react";
import { useSiteImages } from "../../hooks/usePageCopy";
import SiteImage from "./SiteImage";

/**
 * PricePromise — confident, warm price-match band.
 * Variants:
 *  - "hero" → full-bleed section with image + headline + CTA
 *  - "band" → compact 1-line band (good for headers / between sections)
 *  - "card" → boxed card (sidebar / product page)
 *
 * The photo in the "hero" variant is admin-editable — this band appears on the
 * homepage, product pages, Specials, Team Kits and Kit Your Workforce, so it
 * lives under /admin/page-copy → "Pictures used across the whole site" rather
 * than on any one page's record.
 */
const DEFAULT_PHOTO = "https://images.pexels.com/photos/8553861/pexels-photo-8553861.jpeg?auto=compress&cs=tinysrgb&w=900";

export default function PricePromise({ variant = "hero" }) {
  // Called before the early returns below — React requires every hook to run on
  // every render, in the same order.
  const site = useSiteImages();
  const photo = site.image("pricepromise", DEFAULT_PHOTO);

  if (variant === "band") {
    return (
      <div className="bg-[#1a1a1a] text-white" data-testid="price-promise-band">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-3 flex-wrap text-center">
          <span className="inline-flex items-center gap-2 text-[#7bc67e] font-nunito font-extrabold text-xs uppercase tracking-[0.25em]">
            <BadgeCheck size={16} /> Price Promise
          </span>
          <span className="font-nunito text-sm sm:text-base">
            Found it cheaper? <span className="font-extrabold text-[#7bc67e]">We'll beat any like-for-like UK quote.</span>
          </span>
          <Link to="/contact" data-testid="price-promise-band-cta" className="text-xs sm:text-sm font-nunito font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] px-4 py-1.5 rounded-full transition-colors">
            Send us a quote →
          </Link>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="bg-[#f0fdf4] rounded-2xl p-5 border-2 border-[#7bc67e]" data-testid="price-promise-card">
        <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-nunito font-extrabold">
          <BadgeCheck className="text-[#7bc67e]" size={18} /> Price Promise
        </div>
        <p className="text-sm text-[#1a1a1a] mt-2 leading-relaxed">
          Found the same garment cheaper elsewhere? <strong>Send us the quote — we'll match it or beat it.</strong>
          Looking professional shouldn't cost a fortune.
        </p>
        <Link to="/contact" data-testid="price-promise-card-cta" className="mt-3 inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-[#7bc67e] hover:underline">
          Get a quote check <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  // hero variant
  return (
    <section className="relative overflow-hidden bg-[#1a1a1a] text-white" data-testid="price-promise-hero">
      <div className="absolute -top-20 -right-20 w-[420px] h-[420px] rounded-full bg-[#7bc67e]/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 w-[400px] h-[400px] rounded-full bg-[#fde68a]/10 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs uppercase tracking-[0.25em]">
            <BadgeCheck size={14} /> Price Promise
          </div>
          <h2 className="mt-5 font-nunito font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">
            Looking professional shouldn't <span className="text-[#7bc67e]">cost a fortune</span>.
          </h2>
          <p className="mt-5 text-lg text-neutral-300 max-w-2xl leading-relaxed">
            We're a small UK team helping businesses, schools and teams kit out their people without blowing the budget.
            Found the same garment cheaper anywhere else? Send us the quote and{" "}
            <span className="font-extrabold text-white">we'll match it or beat it</span> — that's our promise.
          </p>
          <ul className="mt-6 grid sm:grid-cols-2 gap-3 max-w-xl">
            {[
              "No minimum order quantities",
              "No setup fees — ever",
              "Free logo design included",
              "Friendly UK-based account managers",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm">
                <BadgeCheck size={16} className="text-[#7bc67e] flex-shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/contact" data-testid="price-promise-cta" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
              Send us a quote to beat <ArrowRight size={16} />
            </Link>
            <Link to="/workwear" className="inline-flex items-center gap-2 border-2 border-white hover:bg-white hover:text-[#1a1a1a] text-white font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">
              Browse workwear
            </Link>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="relative">
            <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-[#7bc67e]">
              <SiteImage src={photo} className="w-full h-full object-cover" testid="price-promise-photo" placeholderClassName="bg-[#2a2a2a]" />
            </div>
            <div className="absolute -bottom-5 -left-5 bg-[#7bc67e] text-[#1a1a1a] rounded-2xl p-5 shadow-xl max-w-[220px]">
              <div className="font-nunito font-black text-2xl leading-tight">"We'll beat it."</div>
              <div className="text-xs mt-1 font-nunito font-bold">Send us any like-for-like UK quote.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
