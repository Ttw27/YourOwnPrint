import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { WhatsAppInline } from "../components/bold/WhatsAppFAB";
import PricePromise from "../components/bold/PricePromise";
import { api, fetchProducts, fetchReviewsAggregate } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import SiteImage from "../components/bold/SiteImage";
import { ArrowRight, Trophy, Users, MessageCircle, Sparkles, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import PriceTag from "../components/bold/PriceTag";
import { DEFAULT_HERO_IMAGES } from "../lib/defaultImages";

const PAGE_SIZE = 24;  // divides evenly by 2 / 3 / 4 - no orphan row on any screen size

const FEATURES = [
  { icon: BadgeCheck, label: "Club badge included" },
  { icon: BadgeCheck, label: "Names & numbers included" },
  { icon: BadgeCheck, label: "Free artwork proof" },
  { icon: BadgeCheck, label: "Price-match promise" },
];

// What the Team Kits page shows, in order. Other "team-kits" products (the
// configurators' set slots, gym items, old placeholder kits) aren't listed here.
const KIT_SECTIONS = [
  { key: "football", title: "Football & team kits", sub: "Real kits in the colours you pick - badge, names and numbers included. Adults and kids.", ids: ["kit-classic", "kit-contrast", "kit-training", "kit-tracksuit"] },
  { key: "rugby", title: "Rugby", sub: "Training, club and supporters wear - and proper match kits on request.", shop: true, quote: true,
    ids: ["kit-contrast", "fr100", "fr7"], labels: { "kit-contrast": "Training & touch rugby", fr100: "Club & supporters", fr7: "Club & supporters" } },
  { key: "other", title: "Other sports", sub: "Real sportswear from our range with your club badge or logo. Hockey, netball and touch rugby teams: the Contrast Football Kit works brilliantly.", shop: true,
    ids: ["sr278m", "sr279m", "cn155", "cn156", "jc007", "jc015"], labels: { sr278m: "Basketball", sr279m: "Basketball", cn155: "Cricket", cn156: "Cricket", jc007: "Athletics & running", jc015: "Athletics & running" } },
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
    // Kits come from the team-kits collection; "Other sports" are normal products picked by id.
    const extra = KIT_SECTIONS.filter((s) => s.shop).flatMap((s) => s.ids);
    Promise.all([fetchProducts("team-kits", 100, 0), fetchReviewsAggregate(),
      Promise.all(extra.map((id) => api.get(`/products/${id}`).then((r) => r.data).catch(() => null)))])
      .then(([p, a, more]) => {
        const all = [...(p.items || []), ...more.filter(Boolean)];
        setProducts(all.filter((x, i) => all.findIndex((y) => y.id === x.id) === i));
        setTotal(p.total || 0); setAggs(a);
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = Object.fromEntries(products.map((x) => [x.id, x]));

  // Declared before the JSX below uses it - a const referenced above its own
  // declaration line still compiles, then throws at runtime and blanks the page.
  const copy = usePageCopy("team-kits", {
    // Swap in /admin/page-copy → Team Kits → Pictures & video.
    hero_image: DEFAULT_HERO_IMAGES["team-kits"],
  });

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
              Pick a kit bundle, upload your badge, drop in your squad - done. <strong>Badge & names included in the price.</strong>
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
              <Link to="/business-enquiry" data-testid="team-kits-quote-cta" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">
                Get a club quote <ArrowRight size={16} />
              </Link>
              <WhatsAppInline preset="Hi! I need team kits for my club - can you advise?" label="WhatsApp the team" />
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl rotate-1">
              <SiteImage src={copy.hero_image} className="w-full h-full object-cover" testid="team-kits-hero-image" />
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
            {KIT_SECTIONS.map((sec) => {
              const list = sec.ids.map((id) => byId[id]).filter(Boolean);
              if (!list.length) return null;
              return (
                <div key={sec.key} className="mt-10" data-testid={`team-kit-section-${sec.key}`}>
                  <h3 className="font-nunito font-black text-2xl">{sec.title}</h3>
                  {sec.sub && <p className="text-sm text-[#4b5563] mt-1">{sec.sub}</p>}
                  <div className={`grid grid-cols-2 ${sec.key === "other" ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-3 sm:gap-5 mt-4`} data-testid={sec.key === "football" ? "team-kit-gallery" : undefined}>
                    {list.map((p, i) => {
                const agg = aggs[p.id];
                return (
                  <Link key={p.id} to={`/product/${p.id}`} data-testid={`team-kit-card-${p.id}`} className="group relative bg-white rounded-3xl border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-xl transition-all overflow-hidden flex flex-col">
                    <div className="aspect-[5/4] overflow-hidden bg-[#f0fdf4] relative">
                      <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
                      <span className="absolute top-3 left-3 bg-[#7bc67e] text-[#1a1a1a] text-[10px] font-nunito font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full">{sec.labels?.[p.id] || (p.category === "team-kits" ? "Kit Bundle" : "Sportswear")}</span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-nunito font-extrabold text-xl">{p.name}</h3>
                      <p className="text-sm text-[#4b5563] mt-1 flex-1 line-clamp-3">{p.description}</p>
                      <div className="mt-4 flex items-baseline justify-between">
                        <div>
                          <div className="text-xs font-nunito font-bold text-[#4b5563]">from</div>
                          <PriceTag product={p} size="lg" tone="brand" suffix={p.category === "team-kits" ? " /player" : ""} testid={`price-${p.id}`} />
                        </div>
                        {agg && <StarRating value={agg.average} size={12} />}
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-nunito font-extrabold text-[#1a1a1a] group-hover:text-[#7bc67e] transition-colors">
                        {p.category === "team-kits" ? "Configure your team" : "Add your logo"} <ArrowRight size={14} />
                      </div>
                    </div>
                  </Link>
                );
                    })}
                    {sec.quote && (
                      <Link to="/business-enquiry" data-testid="rugby-match-quote" className="group relative bg-[#1a1a1a] text-white rounded-3xl border-2 border-[#1a1a1a] hover:shadow-xl transition-all overflow-hidden flex flex-col p-6 justify-between">
                        <div>
                          <span className="inline-block bg-[#7bc67e] text-[#1a1a1a] text-[10px] font-nunito font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full">Match kits</span>
                          <h3 className="font-nunito font-extrabold text-xl mt-4">Match rugby kit</h3>
                          <p className="text-sm text-neutral-300 mt-2">Proper match shirts made for contact rugby, in your club colours with badge, sponsors, names and numbers. Tell us what you need and we&rsquo;ll send a free proof and quote.</p>
                        </div>
                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-nunito font-extrabold text-[#7bc67e]">Get a quote <ArrowRight size={14} /></div>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}

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
              Send us your rosters, badges and sponsors - we'll build a <strong className="text-[#7bc67e]">free artwork proof</strong> and email a tailored quote.</p>
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
              <li>Upload your club badge - optionally sponsor logos</li>
              <li>Drop in your roster (Name · Number · Size · Qty)</li>
              <li>Under 15 kits, single team → Stripe checkout straight away</li>
              <li>15+ or multi-team → free proof & tailored quote</li>
            </ol>
          </div>
        </div>
      </div>

      <PricePromise variant="hero" />
      <BoldFooter />
    </div>
  );
}
