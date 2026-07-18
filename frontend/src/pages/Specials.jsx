import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import PricePromise from "../components/bold/PricePromise";
import { fetchSpecialsProducts } from "../lib/api";
import { GENDER_FITS } from "../lib/data";
import usePageCopy from "../hooks/usePageCopy";
import { Sparkles, CheckCircle2, ShieldCheck, ArrowRight, Briefcase, Zap, Tag } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

export default function Specials() {
  usePageTitle("Specials");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState("all");

  useEffect(() => {
    fetchSpecialsProducts().then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  const copy = usePageCopy("specials", {
    title: "",
    subtitle: "A curated lineup for new businesses. One sharp logo on the breast pocket, printed in the UK, no minimum order and no big up-front costs. Order one, order ten — whatever you need to get going.",
  });

  const filtered = useMemo(() => {
    if (gender === "all") return products;
    return products.filter((p) => (p.gender_fit || "unisex") === gender);
  }, [products, gender]);

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen" data-testid="specials-page">
      <BoldNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute -top-32 -right-20 w-[520px] h-[520px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-[#fbbf24]/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-[#7bc67e] text-[#1a1a1a] text-xs font-extrabold uppercase tracking-[0.3em] px-3 py-1.5 rounded-full">
              <Sparkles size={12} /> Your Own Print Specials
            </span>
            <h1 className="font-black text-5xl lg:text-7xl mt-4 leading-[1.02]" data-testid="specials-hero-title">
              {copy.title ? copy.title : (<>Look the part<br /><span className="text-[#7bc67e]">from day one.</span></>)}
            </h1>
            <p className="text-zinc-300 mt-4 text-lg max-w-xl" data-testid="specials-hero-subtitle">{copy.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <Badge>No MOQ — order 1+</Badge>
              <Badge>Breast logo included</Badge>
              <Badge>UK printed · 7–10 days</Badge>
              <Badge>Stripe checkout</Badge>
            </div>
          </div>
          <div className="relative">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 grid grid-cols-3 gap-3">
              {products.slice(0, 6).map((p) => (
                <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-zinc-800">
                  <img src={p.image} alt="" loading="lazy" className="w-full h-full object-contain" />
                </div>
              ))}
              {products.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-zinc-800" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-3 gap-4" data-testid="specials-value-props">
        <Prop icon={<Tag size={18} />} title="No MOQ" body="Order a single piece, or a hundred — same per-unit price. Test the look before committing." />
        <Prop icon={<Briefcase size={18} />} title="Trade-ready in days" body="A clean breast-logo print is all most new clients need to take you seriously. We turn it around in 7–10 working days." />
        <Prop icon={<Zap size={18} />} title="No setup fees" body="No screen charges, no setup costs. Just the price you see — and Stripe to check out." />
      </section>

      {/* Product grid */}
      <section className="max-w-6xl mx-auto px-6 pb-16" data-testid="specials-grid-section">
        <h2 className="font-black text-3xl mb-2">The starter lineup</h2>
        <p className="text-[#4b5563] mb-6">Hand-picked staples that look smart with a single breast-logo print. Tap one to start your order.</p>

        <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="specials-gender-filter">
          <span className="text-xs uppercase tracking-[0.3em] text-[#4b5563] font-extrabold mr-2">Fit</span>
          {GENDER_FITS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGender(g.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition ${gender === g.id ? "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]" : "bg-white border-[#dcfce7] text-[#4b5563] hover:border-[#7bc67e]"}`}
              data-testid={`specials-gender-${g.id}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-[#4b5563]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-5 text-sm" data-testid="specials-empty">
            No items match this fit. Try a different filter, or admin can flag products via <strong>Product settings → Specials-eligible</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" data-testid="specials-grid">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                data-testid={`specials-product-${p.id}`}
              >
                <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                  <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <div className="font-extrabold text-base">{p.name}</div>
                  {p.description && <div className="text-xs text-[#4b5563] mt-1 line-clamp-2">{p.description}</div>}
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#7bc67e] font-extrabold">From</div>
                      <div className="text-2xl font-black text-[#1a1a1a] leading-none">£{p.price.toFixed(2)}</div>
                    </div>
                    <span className="text-xs inline-flex items-center gap-1 text-[#7bc67e] font-extrabold group-hover:translate-x-0.5 transition-transform">Pick this <ArrowRight size={14} /></span>
                  </div>
                  <div className="mt-3 text-[11px] text-[#4b5563] inline-flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-[#7bc67e]" /> Breast logo print included · No MOQ
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trust band */}
      <section className="bg-[#f0fdf4] border-y border-[#dcfce7] py-10">
        <div className="max-w-5xl mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <Trust icon={<ShieldCheck size={16} />} text="Free artwork proof before we print" />
          <Trust icon={<CheckCircle2 size={16} />} text="No setup fees or hidden costs" />
          <Trust icon={<Briefcase size={16} />} text="Reorder anytime — same price, same finish" />
          <Trust icon={<Sparkles size={16} />} text="Upgrade to bulk pricing as you grow" />
        </div>
      </section>

      <PricePromise variant="band" />
      <BoldFooter />
    </div>
  );
}

function Badge({ children }) {
  return <span className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-full font-extrabold text-zinc-200">{children}</span>;
}

function Prop({ icon, title, body }) {
  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-5">
      <div className="w-9 h-9 rounded-full bg-[#f0fdf4] grid place-items-center text-[#7bc67e]">{icon}</div>
      <div className="font-extrabold mt-3">{title}</div>
      <div className="text-xs text-[#4b5563] mt-1 leading-relaxed">{body}</div>
    </div>
  );
}

function Trust({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-[#1a1a1a]">
      <span className="text-[#7bc67e]">{icon}</span>
      <span className="font-extrabold text-xs sm:text-sm">{text}</span>
    </div>
  );
}
