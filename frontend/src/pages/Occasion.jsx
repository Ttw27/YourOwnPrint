import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { api, mediaUrl } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import usePageTitle from "../hooks/usePageTitle";
import PriceTag from "../components/bold/PriceTag";
import JsonLd from "../components/bold/JsonLd";
import { OCCASIONS } from "../lib/occasions";
import { Check, ArrowRight } from "lucide-react";

/** Seasonal / occasion landing page - /occasions/:slug (see lib/occasions.js). */
export default function Occasion() {
  const { slug } = useParams();
  const def = OCCASIONS[slug];
  const copy = usePageCopy(`occasion-${slug}`, def ? {
    title: def.title, subtitle: def.subtitle, bullets: def.bullets, faq: def.faq, hero_image: "",
  } : {});
  usePageTitle(def ? `${def.kicker} - custom printed` : "Occasions", { description: copy.subtitle });
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!def) return;
    Promise.all(def.products.map((id) => api.get(`/products/${id}`).then((r) => r.data).catch(() => null)))
      .then((list) => setProducts(list.filter((p) => p && p.active !== false)));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return <Navigate to="/" replace />;
  const faq = (copy.faq || []).filter((f) => f.q && f.a);
  const hero = copy.hero_image ? mediaUrl(copy.hero_image) : "";

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen" data-testid={`occasion-${slug}`}>
      <BoldNavbar />
      {faq.length > 0 && <JsonLd id="occasion-faq" data={{ "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />}
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className={`absolute inset-0 opacity-40 bg-gradient-to-br ${def.accent}`} />
        <div className="relative max-w-7xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#bbf7d0]">{def.kicker}</span>
            <h1 className="font-black text-4xl lg:text-6xl mt-2 leading-tight">{copy.title}</h1>
            <p className="text-zinc-200 mt-4 max-w-xl leading-relaxed">{copy.subtitle}</p>
            <ul className="mt-5 space-y-1.5 text-sm">
              {(copy.bullets || []).map((b) => <li key={b} className="flex items-start gap-2"><Check size={16} className="text-[#7bc67e] mt-0.5 flex-shrink-0" /> {b}</li>)}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              {def.ctas.map((c, i) => (
                <Link key={c.to} to={c.to} className={`px-5 py-3 rounded-full font-extrabold inline-flex items-center gap-2 transition ${i === 0 ? "bg-[#7bc67e] text-[#1a1a1a] hover:bg-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
                  {c.label} {i === 0 && <ArrowRight size={16} />}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            {hero ? (
              <img src={hero} alt="" className="w-full aspect-[4/3] object-cover rounded-3xl shadow-2xl" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.slice(0, 4).map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl aspect-square overflow-hidden"><img src={p.image} alt={p.name} className="w-full h-full object-contain" /></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="font-black text-3xl">Popular picks</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {products.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-2xl overflow-hidden transition">
              <div className="aspect-square bg-[#f9fafb] overflow-hidden"><img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition" /></div>
              <div className="p-3">
                <div className="font-extrabold text-sm line-clamp-2">{p.name}</div>
                <div className="mt-1"><PriceTag product={p} /></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {faq.length > 0 && (
        <section className="bg-[#f0fdf4] border-y border-[#dcfce7]">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <h2 className="font-black text-3xl">Questions</h2>
            <div className="mt-5 space-y-3">
              {faq.map((f) => (
                <details key={f.q} className="bg-white rounded-2xl border border-[#dcfce7] p-4">
                  <summary className="font-extrabold cursor-pointer">{f.q}</summary>
                  <p className="text-sm text-[#4b5563] mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
      <BoldFooter />
    </div>
  );
}
