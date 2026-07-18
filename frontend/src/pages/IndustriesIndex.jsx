import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchIndustries } from "../lib/api";
import { ArrowRight, Briefcase } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

export default function IndustriesIndex() {
  usePageTitle("Shop by Industry");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchIndustries().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid="industries-index">
      <BoldNavbar />
      <header className="bg-[#1a1a1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#7bc67e]">By industry</span>
          <h1 className="font-black text-4xl lg:text-6xl mt-2">Workwear by the trade you're in</h1>
          <p className="text-zinc-300 mt-3 max-w-xl">Curated lineups for nine industries — every garment ready to print with your logo. UK printed, low minimums, smart pricing.</p>
        </div>
      </header>
      <section className="max-w-7xl mx-auto px-6 py-12">
        {loading ? <div className="text-sm text-[#4b5563]">Loading…</div> :
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5" data-testid="industries-grid">
            {items.map((ind, i) => {
              const accents = ["#7bc67e", "#D85A30", "#378ADD", "#D4537E", "#1D9E75", "#BA7517"];
              const accent = accents[i % accents.length];
              return (
              <Link
                key={ind.slug}
                to={`/industries/${ind.slug}`}
                className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                style={{ borderTopColor: accent, borderTopWidth: 3 }}
                data-testid={`industry-card-${ind.slug}`}
              >
                <div className="aspect-[5/3] overflow-hidden bg-[#f0fdf4]">
                  <img src={ind.hero_image} alt={ind.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-5">
                  <div className="text-xs uppercase tracking-wider font-extrabold" style={{ color: accent }}>{ind.subtitle}</div>
                  <div className="font-black text-xl mt-1">{ind.title}</div>
                  <p className="text-xs text-[#4b5563] mt-1 leading-relaxed">{ind.blurb}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-[#7bc67e]">
                    <Briefcase size={12} /> {ind.product_count} {ind.product_count === 1 ? "garment" : "garments"} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        }
      </section>
      <BoldFooter />
    </div>
  );
}
