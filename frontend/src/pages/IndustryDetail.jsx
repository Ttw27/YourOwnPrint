import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import ToolsShowcase from "../components/bold/ToolsShowcase";
import { fetchIndustry } from "../lib/api";
import { GENDER_FITS } from "../lib/data";
import { ArrowRight, ShieldCheck, Loader2 } from "lucide-react";

export default function IndustryDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [gender, setGender] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetchIndustry(slug).then(setData).catch(() => setErr(true)).finally(() => setLoading(false));
  }, [slug]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (gender === "all") return data.products;
    return data.products.filter((p) => (p.gender_fit || "unisex") === gender);
  }, [data, gender]);

  if (err) return <Navigate to="/industries" replace />;
  if (loading || !data) {
    return <div className="min-h-screen grid place-items-center bg-white" data-testid="industry-loading"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  }

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid={`industry-detail-${slug}`}>
      <BoldNavbar />
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25">
          <img src={data.hero_image} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/85 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <Link to="/industries" className="text-xs text-[#7bc67e] hover:underline" data-testid="industry-back">← All industries</Link>
          <h1 className="font-black text-5xl lg:text-6xl mt-3">{data.title}</h1>
          <div className="text-[#7bc67e] font-extrabold mt-1">{data.subtitle}</div>
          <p className="text-zinc-300 mt-3 max-w-xl">{data.blurb}</p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-300">
            <ShieldCheck size={14} className="text-[#7bc67e]" /> UK printed · free artwork proof · low minimums
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-10">
        {/* Gender filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="industry-gender-filter">
          <span className="text-xs uppercase tracking-[0.3em] text-[#4b5563] font-extrabold mr-2">Fit</span>
          {GENDER_FITS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGender(g.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition ${gender === g.id ? "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]" : "bg-white border-[#dcfce7] text-[#4b5563] hover:border-[#7bc67e]"}`}
              data-testid={`gender-filter-${g.id}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-5 text-sm" data-testid="industry-empty">
            Nothing in this fit yet — try a different filter or browse <Link to="/workwear" className="underline text-[#7bc67e]">all workwear</Link>.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="industry-products-grid">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                data-testid={`industry-product-${p.id}`}
              >
                <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#7bc67e]">{p.category}</div>
                  <div className="font-extrabold text-base mt-0.5">{p.name}</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-xl font-black">£{p.price.toFixed(2)}</div>
                    <span className="text-xs inline-flex items-center gap-1 text-[#7bc67e] font-extrabold group-hover:translate-x-0.5 transition-transform">View <ArrowRight size={12} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <ToolsShowcase variant="compact" />
      <BoldFooter />
    </div>
  );
}
