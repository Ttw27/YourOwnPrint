import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import PricePromise from "../components/bold/PricePromise";
import { fetchProducts, fetchReviewsAggregate } from "../lib/api";
import { ArrowRight, Trophy, Users, MessageCircle, Sparkles, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 24;  // divides evenly by 2 / 3 / 4 — no orphan row on any screen size

const FEATURES = [
  { icon: BadgeCheck, label: "Club badge included" },
  { icon: BadgeCheck, label: "Names & numbers included" },
  { icon: BadgeCheck, label: "Free artwork proof" },
  { icon: BadgeCheck, label: "Price-match promise" },
];

export default function TeamKits() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [aggs, setAggs] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = () => {
    setLoading(true); setErr(false);
    Promise.all([fetchProducts("team-kits", PAGE_SIZE, page * PAGE_SIZE), fetchReviewsAggregate()])
      .then(([p, a]) => { setProducts(p.items || []); setTotal(p.total || 0); setAggs(a); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-24 -right-20 w-[500px] h-[500px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 w-[420px] h-[420px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <Trophy size={14} className="text-[#7bc67e]" /> Football · Rugby · Training · Squad packs
            </div>
            <h1 className="font-nunito font-black text-5xl lg:text-7xl mt-3 leading-[1.02]">
              Team Kits.<br /><span className="relative inline-block"><span className="relative z-10">Sorted.</span><span className="absolute left-0 right-0 bottom-1 h-3 bg-[#7bc67e] -z-0 rounded-full" /></span>
            </h1>
            <p className="text-[#4b5563] mt-4 text-lg max-w-xl">
              Pick a kit bundle, upload your badge, drop in your squad — done. <strong>Badge & names included in the price.</strong>
              Bigger order or multiple teams? Tell us and we'll send a free proof and tailored quote.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2 max-w-md">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-nunito font-bold text-[#1a1a1a]">
                  <Icon size={16} className="text-[#7bc67e]" />{label}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#bundles" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md transition-transform hover:-translate-y-1">
                Browse kit bundles <ArrowRight size={16} />
              </a>
              <Link to="/full-squad-configurator" data-testid="team-kits-full-squad-cta" className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md transition-transform hover:-translate-y-1">
                Full Squad Configurator <ArrowRight size={16} />
              </Link>
              <WhatsAppInline preset="Hi! I need team kits for my club — can you advise?" label="WhatsApp the team" />
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl rotate-1">
              <img src="https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-lg p-4 border border-[#e5e7eb] -rotate-2 max-w-[240px]">
              <div className="flex items-center gap-2"><Users className="text-[#7bc67e]" size={18} /><div className="font-nunito font-extrabold text-sm">Single team or whole club</div></div>
              <div className="text-xs text-[#4b5563] mt-1">15+ kits or multiple teams → free proof + quote</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bundles gallery */}
      <div id="bundles" className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="font-nunito font-black text-4xl lg:text-5xl text-center">Pick a kit bundle</h2>
        <p className="text-center text-[#4b5563] mt-3 max-w-2xl mx-auto">Each bundle is priced per player and includes the club badge, names & numbers. Sponsor logos optional.</p>

        {loading ? (
          <div className="text-center text-[#4b5563] py-16">Loading bundles…</div>
        ) : err ? (
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm max-w-xl mx-auto mt-10" data-testid="team-kits-error">
            Couldn't load bundles right now. <button onClick={load} className="underline text-[#166534] font-extrabold">Try again</button>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm max-w-xl mx-auto mt-10" data-testid="team-kits-empty">
            Nothing here yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mt-10" data-testid="team-kit-gallery">
              {products.map((p, i) => {
                const agg = aggs[p.id];
                return (
                  <Link key={p.id} to={`/product/${p.id}`} data-testid={`team-kit-card-${p.id}`} className="group relative bg-white rounded-3xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-xl transition-all overflow-hidden flex flex-col">
                    <div className="aspect-[5/4] overflow-hidden bg-[#f0fdf4] relative">
                      <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
                      <span className="absolute top-3 left-3 bg-[#7bc67e] text-[#1a1a1a] text-[10px] font-nunito font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full">Kit Bundle</span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-nunito font-extrabold text-xl">{p.name}</h3>
                      <p className="text-sm text-[#4b5563] mt-1 flex-1">{p.description}</p>
                      <div className="mt-4 flex items-baseline justify-between">
                        <div>
                          <div className="text-xs font-nunito font-bold text-[#4b5563]">from</div>
                          <div className="text-[#7bc67e] font-nunito font-black text-3xl leading-tight">£{p.price.toFixed(2)}<span className="text-sm font-bold text-[#4b5563]"> /player</span></div>
                        </div>
                        {agg && <StarRating value={agg.average} size={12} />}
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-nunito font-extrabold text-[#1a1a1a] group-hover:text-[#7bc67e] transition-colors">
                        Configure your team <ArrowRight size={14} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-10" data-testid="team-kits-pagination">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="team-kits-page-prev">
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                <button onClick={() => setPage((p) => (p + 1) * PAGE_SIZE < total ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= total} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="team-kits-page-next">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Multi-team / big order helper card */}
      <div className="bg-[#1a1a1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <Sparkles size={14} /> Big order? Multiple teams?
            </div>
            <h2 className="font-nunito font-black text-3xl lg:text-4xl mt-3">Whole club? Academy? Multi-team setup?</h2>
            <p className="text-neutral-300 mt-3 text-lg">15+ kits or more than one squad and we'll take you out of the auto-checkout flow.
              Send us your rosters, badges and sponsors — we'll build a <strong className="text-[#7bc67e]">free artwork proof</strong> and email a tailored quote within 1 working day.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/contact" data-testid="big-order-contact" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-6 py-3 rounded-full transition-colors">
                Send a quote request <ArrowRight size={16} />
              </Link>
              <WhatsAppInline preset="Hi! I have multiple teams / a club-wide kit order. Can you advise?" label="WhatsApp us" />
            </div>
          </div>
          <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
            <div className="font-nunito font-extrabold text-lg">How it works</div>
            <ol className="mt-3 space-y-3 text-sm text-neutral-300 list-decimal pl-5">
              <li>Pick a kit bundle from the gallery above</li>
              <li>Upload your club badge — optionally sponsor logos</li>
              <li>Drop in your roster (Name · Number · Size · Qty)</li>
              <li>Under 15 kits, single team → Stripe checkout straight away</li>
              <li>15+ or multi-team → free proof & tailored quote within 1 working day</li>
            </ol>
          </div>
        </div>
      </div>

      <PricePromise variant="hero" />
      <BoldFooter />
    </div>
  );
}
