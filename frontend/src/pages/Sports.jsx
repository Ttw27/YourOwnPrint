import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import WhatsAppFAB, { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import { fetchProducts, fetchReviewsAggregate } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import { Trophy, Users, Zap, ArrowRight, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 24;  // divides evenly by 2 / 3 / 4 — no orphan row on any screen size

const SPORT_GROUPS = [
  { key: "football", label: "Football", icon: Trophy, accent: "bg-[#7bc67e]", desc: "Match jerseys, shorts, training kits", products: ["football-jersey", "football-shorts", "training-tracksuit", "training-tee"] },
  { key: "rugby", label: "Rugby", icon: Trophy, accent: "bg-[#fbcfe8]", desc: "Match shirts, training, tracksuits", products: ["rugby-shirt", "training-tracksuit", "training-tee"] },
  { key: "boxing", label: "Boxing & Fight Night", icon: Zap, accent: "bg-[#fde68a]", desc: "Walk-out tees, sponsor prints, free proofs", products: ["boxing-fight-tee"], cta: { label: "Fight Night Tee builder", to: "/fight-night-tee" } },
  { key: "muaythai", label: "Muay Thai / Kickboxing", icon: Zap, accent: "bg-[#fed7aa]", desc: "Traditional shorts, club apparel", products: ["muay-thai-shorts", "fight-shorts"] },
  { key: "mma", label: "MMA / BJJ", icon: Zap, accent: "bg-[#bfdbfe]", desc: "Fight shorts, gym gear, sponsor tees", products: ["fight-shorts", "boxing-fight-tee"] },
  { key: "training", label: "PT & Training", icon: Users, accent: "bg-[#dcfce7]", desc: "PTs, gyms, training squads", products: ["training-tracksuit", "training-tee"] },
];

export default function Sports() {
  // Curated lookups (sport-group tiles above) need specific named products regardless
  // of pagination, so they're kept on a separate, un-paginated-but-capped fetch.
  const [productsById, setProductsById] = useState({});
  // The "All sports products" grid below is properly paginated (25/page).
  const [gridProducts, setGridProducts] = useState([]);
  const [gridTotal, setGridTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [aggs, setAggs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts("sports", 500).then((d) => {
      setProductsById(Object.fromEntries((d.items || []).map(p => [p.id, p])));
    });
    fetchReviewsAggregate().then(setAggs);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts("sports", PAGE_SIZE, page * PAGE_SIZE)
      .then((d) => { setGridProducts(d.items || []); setGridTotal(d.total || 0); })
      .finally(() => setLoading(false));
  }, [page]);

  const copy = usePageCopy("sports", {
    title: "Kit out your crew.",
    subtitle: "Match-day jerseys, fight-night sponsor tees, training tracksuits — names, numbers, sponsors, badges. Big team or solo athlete, we've got you.",
    // Swap in /admin/page-copy → Sports & Fitness index → Pictures & video.
    hero_image: "https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg?auto=compress&cs=tinysrgb&w=1200",
  });

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />
      <WhatsAppFAB preset="Hi! I'd like to chat about sports kits / fight night tees." />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-20 -left-24 w-[500px] h-[500px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-[420px] h-[420px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <Sparkles size={14} className="text-[#7bc67e]" /> Football · Rugby · Boxing · MMA · PT
            </div>
            <h1 className="font-nunito font-black text-5xl lg:text-7xl mt-3 leading-[1.02]">
              {copy.title || <>Kit out your <span className="relative inline-block"><span className="relative z-10">crew.</span><span className="absolute left-0 right-0 bottom-1 h-3 bg-[#7bc67e] -z-0 rounded-full" /></span></>}
            </h1>
            <p className="text-[#4b5563] mt-4 text-lg max-w-lg">{copy.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/full-squad-configurator" data-testid="sports-full-squad-cta" className="inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-black text-white font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
                Full Squad Configurator <ArrowRight size={16} />
              </Link>
              <Link to="/team-kits" data-testid="sports-team-kit-cta" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
                Team Kits Gallery <ArrowRight size={16} />
              </Link>
              <Link to="/fight-night-tee" data-testid="sports-fight-night-cta" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">
                Fight Night Tee
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl">
              <img src={copy.hero_image} alt="" className="w-full h-full object-cover" data-testid="sports-hero-image" />
            </div>
          </div>
        </div>
      </div>

      {/* Sport groups */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="font-nunito font-black text-3xl lg:text-4xl text-center">Pick your sport</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-8" data-testid="sport-groups">
          {SPORT_GROUPS.map(({ key, label, icon: Icon, accent, desc, products: pids, cta }) => (
            <div key={key} data-testid={`sport-group-${key}`} className="bg-white rounded-3xl border-2 border-[#dcfce7] hover:border-[#7bc67e] transition-colors p-5">
              <div className={`w-12 h-12 rounded-2xl grid place-items-center ${accent} text-[#1a1a1a]`}><Icon size={22} /></div>
              <h3 className="mt-4 font-nunito font-extrabold text-2xl">{label}</h3>
              <p className="text-sm text-[#4b5563] mt-1">{desc}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pids.map((pid) => productsById[pid] && (
                  <Link key={pid} to={`/product/${pid}`} className="text-xs font-nunito font-bold bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] px-2.5 py-1 rounded-full transition-colors">
                    {productsById[pid].name}
                  </Link>
                ))}
              </div>
              {cta && (
                <Link to={cta.to} className="mt-4 inline-flex items-center gap-1 text-sm font-nunito font-extrabold text-[#7bc67e] hover:underline">{cta.label} <ArrowRight size={14} /></Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <h2 className="font-nunito font-black text-3xl lg:text-4xl">All sports products</h2>
          <WhatsAppInline preset="Hi! Question about your sports kit options." label="WhatsApp instant help" />
        </div>
        {loading ? (
          <div className="text-[#4b5563]">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {gridProducts.map((p, i) => {
                const agg = aggs[p.id];
                return (
                  <Link key={p.id} to={`/product/${p.id}`} data-testid={`sports-product-${i}`} className="group bg-white rounded-2xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md transition-all overflow-hidden">
                    <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                      <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="p-4">
                      <div className="font-nunito font-bold">{p.name}</div>
                      <div className="text-xs text-[#4b5563] mt-1 line-clamp-2">{p.description}</div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[#7bc67e] font-nunito font-extrabold text-xl">£{p.price.toFixed(2)}</span>
                        {agg && <StarRating value={agg.average} size={12} />}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {gridTotal > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-10" data-testid="sports-pagination">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="sports-page-prev">
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(gridTotal / PAGE_SIZE)}</span>
                <button onClick={() => setPage((p) => (p + 1) * PAGE_SIZE < gridTotal ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= gridTotal} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="sports-page-next">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BoldFooter />
    </div>
  );
}
