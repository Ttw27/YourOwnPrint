import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import ToolsShowcase from "../components/bold/ToolsShowcase";
import { fetchSportsTeam } from "../lib/api";
import { ArrowRight, ShieldCheck, Loader2, Truck, Package, CheckCircle2 } from "lucide-react";

export default function SportsTeamDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = () => {
    setLoading(true); setErr(false);
    fetchSportsTeam(slug).then(setData).catch(() => setErr(true)).finally(() => setLoading(false));
  };
  useEffect(load, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // SEO: dynamic title + meta description + FAQ schema
  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} | Your Own Print — UK Custom Print`;
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", data.intro);

    // Inject FAQPage schema (single instance per route)
    const SCHEMA_ID = `faq-schema-${slug}`;
    document.querySelectorAll("script[data-yop-schema]").forEach((n) => n.remove());
    if (data.faqs?.length) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-yop-schema", "1");
      script.setAttribute("id", SCHEMA_ID);
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": data.faqs.map((f) => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      });
      document.head.appendChild(script);
    }
    return () => {
      document.querySelectorAll("script[data-yop-schema]").forEach((n) => n.remove());
    };
  }, [data, slug]);

  if (err) return (
    <div className="bg-white min-h-screen" data-testid="sports-team-error">
      <BoldNavbar />
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm">
            Couldn't load this page right now. <button onClick={load} className="underline text-[#166534] font-extrabold">Try again</button>, or <Link to="/team-kits" className="underline text-[#166534] font-extrabold">see team kits</Link>.
          </div>
        </div>
      </div>
    </div>
  );
  if (loading || !data) {
    return <div className="min-h-screen grid place-items-center bg-white" data-testid="sports-team-loading"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  }

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid={`sports-team-${slug}`}>
      <BoldNavbar />

      {/* Hero */}
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-30">
          <img src={data.hero_image} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/85 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-24">
          <Link to="/team-kits" className="text-xs text-[#7bc67e] hover:underline" data-testid="sports-team-back">← Back to Team Kits</Link>
          <div className="text-[#7bc67e] font-extrabold mt-3 text-xs uppercase tracking-[0.3em]">{data.subtitle}</div>
          <h1 className="font-black text-4xl lg:text-6xl mt-1 leading-tight max-w-3xl">{data.h1}</h1>
          <p className="text-zinc-300 mt-4 max-w-2xl leading-relaxed">{data.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {(() => {
              // Football / Rugby (team sports) → Full Squad Configurator.
              // Gyms / PTs / Boxing / Thai / Kick / Dance → Sports Outfit Configurator (simpler).
              const teamSlugs = ["football", "rugby"];
              const cfgTo = teamSlugs.includes(slug) ? "/full-squad-configurator" : "/sports-outfit-configurator";
              const cfgLabel = teamSlugs.includes(slug) ? "Full Squad Configurator" : "Sports Outfit Configurator";
              return (
                <Link to={cfgTo} className="px-5 py-3 bg-[#7bc67e] text-[#1a1a1a] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-white transition" data-testid="sports-team-cta-configure">
                  {cfgLabel} <ArrowRight size={16} />
                </Link>
              );
            })()}
            <Link to="/contact" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-extrabold inline-flex items-center gap-2 transition" data-testid="sports-team-cta-quote">
              Get a free mock-up
            </Link>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-300">
            <ShieldCheck size={14} className="text-[#7bc67e]" /> UK printed · free artwork proof · low minimums
          </div>
        </div>
      </header>

      {/* Trust band */}
      <section className="bg-[#f0fdf4] border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <TrustItem icon={<Truck size={16} />} label="UK printed & dispatched" />
          <TrustItem icon={<Package size={16} />} label="No minimum order" />
          <TrustItem icon={<CheckCircle2 size={16} />} label="Free artwork proof" />
          <TrustItem icon={<ShieldCheck size={16} />} label="Tested kit, washable hot" />
        </div>
      </section>

      {/* SEO content paragraph */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black mb-3">Why teams choose us for {data.title.toLowerCase()}</h2>
        <p className="text-[#4b5563] leading-relaxed">{data.seo_paragraph}</p>
      </section>

      {/* Products grid */}
      {data.products?.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <h2 className="text-2xl font-black mb-5">Shop the lineup</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" data-testid="sports-team-products">
            {data.products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                data-testid={`sports-team-product-${p.id}`}
              >
                <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
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
        </section>
      )}

      {/* FAQs */}
      {data.faqs?.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-16" data-testid="sports-team-faqs">
          <h2 className="text-2xl font-black mb-5">Frequently asked</h2>
          <div className="divide-y divide-[#e5e7eb] border-2 border-[#dcfce7] rounded-3xl bg-white">
            {data.faqs.map((f, i) => (
              <details key={i} className="group p-5">
                <summary className="cursor-pointer font-extrabold text-base flex items-center justify-between" data-testid={`sports-team-faq-${i}`}>
                  {f.q}
                  <span className="ml-3 text-[#7bc67e] group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-[#4b5563] mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <ToolsShowcase variant="compact" />
      <BoldFooter />
    </div>
  );
}

function TrustItem({ icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-extrabold">
      <span className="text-[#7bc67e]">{icon}</span>
      {label}
    </div>
  );
}
