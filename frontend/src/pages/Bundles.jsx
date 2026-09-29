import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import usePageTitle from "../hooks/usePageTitle";
import { api } from "../lib/api";
import { Loader2, BadgeCheck, Package, Users, MessageCircle } from "lucide-react";

/**
 * Public bundles page - bulk packs (e.g. 20 x tees, team packs) and per-person
 * sets, logo included. Lists whatever bundles are live (created in Admin >
 * Bundle builder and shown on site). Inspired by Penguin / Essential Workwear.
 */
const FILTERS = [
  { key: "all", label: "All bundles" },
  { key: "pack", label: "Bulk packs" },
  { key: "set", label: "Per-person sets" },
];
const INDUSTRY_FILTERS = [
  ["construction-trades", "Trades & construction"],
  ["hospitality-catering", "Hospitality"],
  ["corporate", "Office & corporate"],
  ["cleaning", "Cleaning"],
  ["education-schools", "Schools"],
  ["sports-fitness", "Sports & clubs"],
];

export default function Bundles() {
  usePageTitle("Bulk Bundles & Team Packs - Logo Included", {
    description: "Bulk clothing packs and team bundles with your logo included - tees, polos, hoodies, hi-vis, caps and workwear. The bigger the pack, the bigger the saving.",
  });
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState("all");
  const [industry, setIndustry] = useState("");

  useEffect(() => {
    api.get("/bundles").then(({ data }) => setBundles(data.bundles || [])).catch(() => setBundles([])).finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => bundles.filter((b) =>
    (kind === "all" || b.kind === kind) && (!industry || (b.industry_tags || []).includes(industry))
  ), [bundles, kind, industry]);

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <section className="bg-[#f0fdf4] border-b border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-12 sm:py-16">
          <div className="inline-flex items-center gap-2 bg-white text-[#166534] font-extrabold rounded-full px-3 py-1 text-xs"><BadgeCheck size={14} /> Your logo included on every item</div>
          <h1 className="font-black text-4xl sm:text-5xl mt-4 max-w-3xl leading-[1.05]">Bulk bundles &amp; team packs</h1>
          <p className="text-[#4b5563] mt-4 max-w-2xl text-lg">Everything your team needs in one pack - tees, polos, hoodies, hi-vis, caps and workwear, all branded with your logo. The bigger the pack, the bigger the saving.</p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl text-sm">
            {[[Package, "Logo printed on every item"], [Users, "Sizes split however you like"], [MessageCircle, "Need something different? Just ask"]].map(([Icon, t]) => (
              <div key={t} className="bg-white rounded-2xl px-4 py-3 border border-[#dcfce7] inline-flex items-center gap-2 font-bold"><Icon size={16} className="text-[#166534]" /> {t}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setKind(f.key)} className={`px-4 py-2 rounded-full text-sm font-extrabold border-2 ${kind === f.key ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white border-[#e5e7eb] hover:border-[#7bc67e]"}`}>{f.label}</button>
          ))}
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="ml-auto bg-white border-2 border-[#e5e7eb] rounded-full px-4 py-2 text-sm font-bold" data-testid="bundles-industry">
            <option value="">Any industry</option>
            {INDUSTRY_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={16} />Loading bundles…</div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#4b5563]">{bundles.length ? "No bundles match that filter." : "New bundles are coming soon."}</p>
            <Link to="/easy-ordering" className="inline-block mt-4 font-extrabold text-[#166534] hover:underline">Tell us what you need and we&rsquo;ll put a pack together →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8" data-testid="bundles-grid">
            {shown.map((b) => (
              <Link key={b.id} to={`/product/${b.id}`} className="group border-2 border-[#eef2f7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-colors" data-testid={`bundle-card-${b.id}`}>
                <div className="aspect-square bg-[#f0fdf4] overflow-hidden">
                  {b.image && <img src={b.image} alt={b.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />}
                </div>
                <div className="p-5">
                  <span className={`inline-block text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2 py-0.5 ${b.kind === "pack" ? "bg-[#1a1a1a] text-white" : "bg-[#eef2ff] text-[#4338ca]"}`}>{b.kind === "pack" ? `Pack · ${b.item_count} items` : "Per-person set"}</span>
                  <h2 className="font-black text-lg mt-2 leading-snug">{b.name}</h2>
                  <p className="text-xs text-[#4b5563] mt-1">{b.items.map((i) => `${i.qty > 1 ? `${i.qty} × ` : ""}${i.name}`).join(" · ")}</p>
                  <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                    <span className="font-black text-2xl text-[#166534]">£{b.price.toFixed(2)}</span>
                    <span className="text-xs text-[#4b5563]">per {b.kind === "pack" ? "pack" : "set"}</span>
                    {b.full_price ? <span className="text-xs text-[#9ca3af] line-through">£{Number(b.full_price).toFixed(2)}</span> : null}
                    {b.saving_pct ? <span className="text-[11px] font-extrabold bg-[#dcfce7] text-[#166534] rounded-full px-2 py-0.5">Save {b.saving_pct}%</span> : null}
                  </div>
                  {b.kind === "pack" && b.item_count ? <p className="text-[11px] text-[#4b5563] mt-1">That&rsquo;s £{(b.price / b.item_count).toFixed(2)} per item with your logo</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-14 bg-[#1a1a1a] text-white rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <h2 className="font-black text-2xl">Need a different mix or bigger quantities?</h2>
            <p className="text-neutral-300 mt-1">Tell us what your team needs and your account manager will put a custom pack together.</p>
          </div>
          <Link to="/business-enquiry" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-extrabold px-6 py-3 rounded-full flex-shrink-0">Get a custom pack quote</Link>
        </div>
      </section>

      <BoldFooter />
    </div>
  );
}
