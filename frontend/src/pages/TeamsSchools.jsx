import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchPortfolio, fetchReviewsAggregate } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import {
  GraduationCap, Dumbbell, Music2, Shirt, MessageSquare, ArrowRight,
  ShieldCheck, Truck, MessageCircle, Loader2, Sparkles, Star, Users, Trophy,
} from "lucide-react";

/**
 * /teams-schools — Audience-first hub. Big tiles per customer type each linking to the
 * right flow (Leavers, Full Squad, Sports Outfit, Kit Your Workforce, Contact). Below the
 * tiles: trust bar, recent group orders carousel (Portfolio backend), FAQ, contact CTA.
 */

const TILES = [
  {
    id: "leavers",
    to: "/leavers-hoodies",
    testid: "ts-tile-leavers",
    Icon: GraduationCap,
    accent: "bg-[#fde68a]",
    accentText: "text-[#78350f]",
    title: "Leavers hoodies",
    tagline: "Class of 2026 — primary, secondary or uni",
    bullets: ["Full back-print of names included", "Group order per pupil, no fuss for staff", "Proof in 2 working days"],
    cta: "Start a leavers order",
  },
  {
    id: "full-squad",
    to: "/full-squad-configurator",
    testid: "ts-tile-full-squad",
    Icon: Trophy,
    accent: "bg-[#7bc67e]",
    accentText: "text-[#052e16]",
    title: "Sports club — full squad",
    tagline: "Football, rugby & kit sports",
    bullets: ["Match day + training + tracksuit — one order", "Names on the back, kits labelled per player", "Optional printed gym bag per player"],
    cta: "Build your squad kit",
  },
  {
    id: "sports-outfit",
    to: "/sports-outfit-configurator",
    testid: "ts-tile-sports-outfit",
    Icon: Dumbbell,
    accent: "bg-[#fbcfe8]",
    accentText: "text-[#831843]",
    title: "Gym, PT, boxing & class",
    tagline: "Gyms, PTs, thai / kick / boxing gyms, dance studios",
    bullets: ["Top + shorts, hoodie + joggers — or both", "Breast logo, back print or full front", "Simple pricing — quote in a day"],
    cta: "Kit up your class",
  },
  {
    id: "group-hoodies",
    to: "/kit-your-workforce",
    testid: "ts-tile-groups",
    Icon: Users,
    accent: "bg-[#bfdbfe]",
    accentText: "text-[#1e3a8a]",
    title: "Group hoodies & tees",
    tagline: "Churches, cadets, youth clubs, uni societies, staff",
    bullets: ["Mix garments, colours & sizes in one order", "Breast logo included, add a back print", "Per-size steppers — no spreadsheet needed"],
    cta: "Build a group order",
  },
  {
    id: "dance",
    to: "/shop/t-shirts",
    testid: "ts-tile-dance",
    Icon: Music2,
    accent: "bg-[#e9d5ff]",
    accentText: "text-[#4c1d95]",
    title: "Dance & theatre",
    tagline: "Soft drape tees for troupes, cast & crew",
    bullets: ["Sublimation & DTF for photo-quality prints", "Kids & adult sizes in one order", "We stock breathable performance fabrics"],
    cta: "Browse dance tees",
  },
  {
    id: "bespoke",
    to: "/contact",
    testid: "ts-tile-bespoke",
    Icon: MessageSquare,
    accent: "bg-[#fecaca]",
    accentText: "text-[#7f1d1d]",
    title: "Bespoke enquiry",
    tagline: "Odd sizes, unusual garments, big volumes",
    bullets: ["Talk to a real human on WhatsApp or email", "Trade quotes & sample runs welcome", "One point of contact from proof to delivery"],
    cta: "Send us a message",
  },
];

const TRUST = [
  { Icon: ShieldCheck, label: "Proofs in 2 working days" },
  { Icon: Truck, label: "UK printed & delivered" },
  { Icon: MessageCircle, label: "One human, from proof to delivery" },
  { Icon: Sparkles, label: "Low minimums, no set-up fees" },
];

const FAQ = [
  {
    q: "Can we order a mix of sizes across kids and adults?",
    a: "Yes — the configurators and Kit Your Workforce all let you mix children's and adult sizes in the same order at no extra cost.",
  },
  {
    q: "Do you match colours to our club / school branding?",
    a: "We stock a wide colour palette on all core garments. Send us a hex or a Pantone reference on your proof reply and we'll match as close as the fabric dye allows.",
  },
  {
    q: "How long does a typical order take?",
    a: "Proof within 2 working days, printed & dispatched within 7–10 working days from proof approval. Rush service available on request — ask for it in the notes.",
  },
  {
    q: "Can we pay per pupil / per player instead of one lump sum?",
    a: "Yes — for Leavers Hoodies we run per-pupil checkouts so parents pay individually. For sports clubs we can invoice the club and let you collect from your players.",
  },
  {
    q: "Do you supply a proof / mockup before printing?",
    a: "Always. You'll get a digital proof showing your artwork on the garment with placement and dimensions before we print a thing.",
  },
];

export default function TeamsSchools() {
  const [portfolio, setPortfolio] = useState([]);
  const [aggs, setAggs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // `featured_only` is the parameter the endpoint actually reads. This said
      // `featured`, which FastAPI quietly ignored — so the strip was showing the
      // first 8 photos in the gallery rather than the featured ones.
      fetchPortfolio({ featured_only: true, limit: 8 }).catch(() => ({ items: [] })),
      fetchReviewsAggregate().catch(() => ({})),
    ]).then(([p, a]) => {
      setPortfolio((p?.items || []).slice(0, 8));
      setAggs(a || {});
    }).finally(() => setLoading(false));
  }, []);

  const overallAvg = Object.values(aggs || {}).reduce((sum, r) => sum + (r?.average || 0) * (r?.count || 0), 0);
  const overallCount = Object.values(aggs || {}).reduce((sum, r) => sum + (r?.count || 0), 0);
  const avg = overallCount > 0 ? overallAvg / overallCount : null;

  // CMS-editable hero copy (falls back to code defaults when admin hasn't overridden).
  const copy = usePageCopy("teams-schools", {
    title: "Whatever you're kitting out, we've got a flow for it.",
    subtitle: "Leavers hoodies, sports squads, gym crews, dance troupes, church youth groups — each with a tailored builder so you don't have to fight a spreadsheet. Pick your world below.",
  });

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen" data-testid="teams-schools-page">
      <BoldNavbar />

      {/* Hero */}
      <div className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-25 bg-gradient-to-br from-[#7bc67e] via-[#fbcfe8] to-[#fbbf24]" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-20">
          <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Teams, Schools &amp; Clubs</div>
          <h1 className="font-black text-4xl lg:text-6xl mt-3">{copy.title}</h1>
          <p className="text-zinc-300 mt-4 max-w-2xl text-lg">{copy.subtitle}</p>
          {avg && (
            <div className="mt-5 inline-flex items-center gap-2 text-xs bg-white/10 rounded-full px-3 py-1.5">
              <Star size={12} className="fill-[#fbbf24] text-[#fbbf24]" />
              <span className="font-extrabold">{avg.toFixed(1)}/5</span>
              <span className="text-zinc-400">from {overallCount} verified reviews</span>
            </div>
          )}
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-b border-[#dcfce7] bg-[#f0fdf4]">
        <div className="max-w-7xl mx-auto px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-extrabold text-[#4b5563]" data-testid="ts-trust-bar">
          {TRUST.map(({ Icon, label }) => (
            <div key={label} className="inline-flex items-center gap-1.5">
              <Icon size={13} className="text-[#7bc67e]" />
              <span dangerouslySetInnerHTML={{ __html: label }} />
            </div>
          ))}
        </div>
      </div>

      {/* Audience tiles */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold mb-2">Pick your world</div>
        <h2 className="font-black text-3xl lg:text-4xl mb-6">Which group are you kitting out?</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" data-testid="ts-tiles">
          {TILES.map(({ id, to, testid, Icon, accent, accentText, title, tagline, bullets, cta }) => (
            <Link key={id} to={to} data-testid={testid} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:shadow-md rounded-3xl overflow-hidden transition-all flex flex-col">
              <div className={`${accent} px-5 pt-5 pb-4 flex items-start justify-between`}>
                <Icon size={28} className={accentText} />
                <span className={`text-[10px] uppercase tracking-wider font-extrabold ${accentText} opacity-70 group-hover:opacity-100`}>Configure &rarr;</span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="font-black text-xl">{title}</div>
                <div className="text-xs text-[#4b5563] mt-0.5">{tagline}</div>
                <ul className="mt-3 space-y-1 text-xs text-[#4b5563] flex-1">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full bg-[#7bc67e] flex-shrink-0" />
                      <span dangerouslySetInnerHTML={{ __html: b }} />
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold text-[#1a1a1a] group-hover:text-[#166534]">
                  {cta} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent group orders — portfolio carousel */}
      <section className="max-w-7xl mx-auto px-6 pb-12" data-testid="ts-portfolio">
        {portfolio.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold mb-1">Real orders</div>
                <h2 className="font-black text-2xl lg:text-3xl">Recent group orders</h2>
              </div>
              <Link to="/portfolio" className="text-xs font-extrabold text-[#166534] hover:underline">See more &rarr;</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="ts-portfolio-grid">
              {portfolio.map((it) => (
                <div key={it.id} className="group rounded-2xl overflow-hidden bg-white border-2 border-[#dcfce7]">
                  <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                    <img src={it.image_url} alt={it.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold">{it.category}</div>
                    <div className="text-xs font-extrabold truncate">{it.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          !loading && (
            <div className="text-xs text-[#4b5563] italic border-2 border-dashed border-[#dcfce7] rounded-2xl px-4 py-6 text-center">
              Add featured items in <Link to="/admin/portfolio" className="underline text-[#166534] font-extrabold">Admin → Portfolio</Link> to showcase recent group orders here.
            </div>
          )
        )}
      </section>

      {/* Popular garments — quick jump */}
      <section className="max-w-7xl mx-auto px-6 pb-12" data-testid="ts-popular-garments">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold mb-2">Popular for groups</div>
        <h2 className="font-black text-2xl lg:text-3xl mb-4">Or browse by garment</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {["hoodies", "t-shirts", "polos", "sweatshirts", "bottoms", "aprons"].map((slug) => (
            <Link key={slug} to={`/shop/${slug}`} data-testid={`ts-garment-${slug}`} className="rounded-full border-2 border-[#dcfce7] hover:border-[#7bc67e] hover:bg-[#f0fdf4] text-center px-4 py-2 text-xs font-extrabold capitalize transition">
              <Shirt size={11} className="inline mr-1 text-[#7bc67e]" /> {slug.replace("-", " ")}
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 pb-14" data-testid="ts-faq">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold mb-2">Answers</div>
        <h2 className="font-black text-2xl lg:text-3xl mb-4">Group order questions we get asked</h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <details key={i} className="group bg-white border-2 border-[#dcfce7] rounded-2xl px-4 py-3">
              <summary className="cursor-pointer font-extrabold text-sm flex items-center justify-between list-none">
                <span dangerouslySetInnerHTML={{ __html: f.q }} />
                <ArrowRight size={14} className="text-[#7bc67e] group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-2 text-sm text-[#4b5563]" dangerouslySetInnerHTML={{ __html: f.a }} />
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="border-t border-[#dcfce7] bg-[#f0fdf4]">
        <div className="max-w-4xl mx-auto px-6 py-10 text-center" data-testid="ts-bottom-cta">
          <h2 className="font-black text-2xl">Not sure which flow is right for you?</h2>
          <p className="text-sm text-[#4b5563] mt-2 max-w-xl mx-auto">Message us with your rough numbers and what you&apos;re after &mdash; we&apos;ll point you at the right builder or spec it up for you.</p>
          <Link to="/contact" className="mt-4 inline-flex items-center gap-2 bg-[#1a1a1a] text-white hover:bg-black rounded-full font-extrabold px-6 py-3 text-sm">
            Contact the team <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-full shadow border-2 border-[#dcfce7] p-2">
          <Loader2 size={14} className="animate-spin text-[#7bc67e]" />
        </div>
      )}

      <BoldFooter />
    </div>
  );
}
