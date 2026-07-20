import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import ToolsShowcase from "../components/bold/ToolsShowcase";
import PortfolioStrip from "../components/bold/PortfolioStrip";
import PricePromise from "../components/bold/PricePromise";
import { SECTORS, REVIEWS as STATIC_REVIEWS, RATING } from "../lib/data";
import { fetchProducts, fetchReviewsAggregate, fetchRecentReviews, fetchBestSellers } from "../lib/api";
import usePageCopy from "../hooks/usePageCopy";
import SiteImage from "../components/bold/SiteImage";
import { Star, Sparkles, Heart, Smile, ArrowRight, Check, ShieldCheck, Camera } from "lucide-react";

export default function Home() {
  const [bestSellers, setBestSellers] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [recentReviews, setRecentReviews] = useState([]);

  useEffect(() => {
    fetchBestSellers(12).then((d) => setBestSellers(d.items || []));
    fetchReviewsAggregate().then(setAggregates);
    fetchRecentReviews(6).then(setRecentReviews).catch(() => {});
  }, []);

  const copy = usePageCopy("home", {
    title: "",
    subtitle: "Look every bit as professional as you feel — without the price tag to match. Proudly based in Leicester, printing and delivering workwear, teamwear and custom clothing to businesses and teams across the whole of the UK.",
    // Images now come from the CMS when set, falling back to these code
    // defaults when they haven't been changed in admin. Anything set in
    // /admin/page-copy lives in the database and survives every deploy.
    hero_image: "https://images.pexels.com/photos/8926904/pexels-photo-8926904.jpeg?auto=compress&cs=tinysrgb&w=1200",
    images: {},
  });
  // Sector tile images: admin override by name, else the code default.
  const sectorImage = (s) => (copy.images && copy.images[`sector:${s.name}`]) || s.image;

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      {/* Hero — playful blobs */}
      <div className="relative overflow-hidden">
        <div className="absolute -top-24 -left-20 w-[420px] h-[420px] rounded-full bg-[#7bc67e]/25 blur-2xl" />
        <div className="absolute top-20 -right-10 w-[360px] h-[360px] rounded-full bg-[#fde68a]/40 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-[300px] h-[300px] rounded-full bg-[#fbcfe8]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#f0fdf4] text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <Sparkles size={14} className="text-[#7bc67e]" /> Made for schools, sports, dance & teams
            </div>
            <h1 className="mt-5 font-nunito font-black text-5xl sm:text-6xl lg:text-7xl text-[#1a1a1a] leading-[1.02]" data-testid="home-hero-title">
              {copy.title ? copy.title : (<>
                Your Brand. <br /> Your Clothing. <br />
                <span className="relative inline-block">
                  <span className="relative z-10">Your Own Print.</span>
                  <span className="absolute left-0 right-0 bottom-1 h-3 bg-[#7bc67e] -z-0 rounded-full" />
                </span>
              </>)}
            </h1>
            <p className="mt-5 text-lg text-[#4b5563] max-w-lg" data-testid="home-hero-subtitle">{copy.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/workwear" data-testid="hero-cta-shop" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
                Shop Workwear <ArrowRight size={16} />
              </Link>
              <Link to="/design" data-testid="hero-cta-design" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">
                Design Your Own T-Shirt
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl rotate-2">
              <SiteImage src={copy.hero_image} className="w-full h-full object-cover" testid="home-hero-image" />
            </div>
            <div className="absolute -bottom-4 -left-6 bg-white rounded-2xl shadow-lg p-4 border border-[#e5e7eb] -rotate-3">
              <div className="flex items-center gap-2"><Heart className="text-rose-500" size={18} fill="currentColor" /><div className="font-nunito font-extrabold">404+ happy customers</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-[#f0fdf4] border-y border-[#dcfce7]">
        {/* Five items never divide evenly into two columns, which left one
            claim wrapping onto two lines and the rating orphaned on a row of
            its own. Mobile now leads with the rating on its own centred line,
            then a clean 2x2 of four SHORT claims. Desktop is unchanged. */}
        <div className="max-w-7xl mx-auto px-5 py-4 sm:py-5">
          <div className="lg:hidden">
            <div className="flex items-center justify-center gap-1.5 pb-3 mb-3 border-b border-[#dcfce7]">
              <Star size={15} className="text-amber-500 fill-amber-500 flex-shrink-0" />
              <span className="font-nunito font-extrabold text-sm">{RATING.value}★ from {RATING.count} reviews</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px] font-nunito font-bold text-[#1a1a1a]">
              {["UK-wide delivery", "No minimum orders", "No setup fees", "Free logo design"].map(t => (
                <div key={t} className="flex items-center gap-1.5 leading-snug">
                  <Check size={14} className="text-[#7bc67e] flex-shrink-0" />{t}
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-nunito font-bold text-[#1a1a1a]">
            {["Leicester, UK — Nationwide Delivery", "No Minimum Orders", "No Setup Fees", "Free Logo Design"].map(t => (
              <div key={t} className="flex items-center gap-2"><Check size={16} className="text-[#7bc67e]" />{t}</div>
            ))}
            <div className="flex items-center gap-2"><Star size={16} className="text-amber-500 fill-amber-500" />{RATING.value}★ from {RATING.count} reviews</div>
          </div>
        </div>
      </div>

      {/* Price Promise band — compact */}
      <PricePromise variant="band" />

      {/* Sectors */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-center font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">Shop by Sector</h2>
        <p className="text-center text-[#4b5563] mt-3">Find your crew's look in seconds.</p>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SECTORS.map((s, i) => {
            const accents = ["#7bc67e", "#D85A30", "#378ADD", "#D4537E", "#1D9E75", "#BA7517"];
            const accent = accents[i % accents.length];
            return (
              <Link key={s.name} to="/workwear" data-testid={`home-sector-${i}`} className="group relative aspect-[4/5] rounded-2xl overflow-hidden" style={{ boxShadow: `inset 0 0 0 3px ${accent}` }}>
                <SiteImage src={sectorImage(s)} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" testid={`home-sector-image-${i}`} />
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="w-8 h-1 rounded-full mb-1.5" style={{ background: accent }} />
                  <div className="font-nunito font-black text-white text-lg drop-shadow">{s.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Designer feature */}
      <div className="bg-[#f0fdf4] border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs">
              <Smile size={14} className="text-[#7bc67e]" /> So easy, anyone can do it
            </div>
            <h2 className="mt-3 font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">Design your tee in 60 seconds</h2>
            <p className="mt-4 text-[#4b5563]">Upload, drag, drop, done. Real preview on a real shirt. Order with one tap.</p>
            <Link to="/design" data-testid="home-design-cta" className="mt-7 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#333] text-white font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">
              Launch Designer <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {bestSellers.slice(0, 4).map((p) => {
              const agg = aggregates[p.id];
              return (
                <Link key={p.id} to={`/product/${p.id}`} className="bg-white rounded-2xl p-4 border border-[#dcfce7] shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-square rounded-xl overflow-hidden bg-[#f0fdf4]">
                    <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain" />
                  </div>
                  <div className="mt-3 font-nunito font-bold text-sm">{p.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[#7bc67e] font-nunito font-extrabold text-lg">£{p.price.toFixed(2)}</div>
                    {agg && <StarRating value={agg.average} size={12} />}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">Loved by 400+ teams</h2>
            <div className="mt-2 flex items-center gap-2"><Star className="text-amber-500 fill-amber-500" size={18} />{RATING.value} from {RATING.count} verified reviews</div>
          </div>
          <Link to="/reviews" data-testid="home-all-reviews" className="font-nunito font-extrabold text-sm bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#1a1a1a] px-5 py-2.5 rounded-full transition-colors">See all reviews →</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {(recentReviews.length > 0 ? recentReviews : STATIC_REVIEWS.map((r, i) => ({ id: `s-${i}`, rating: r.rating, title: r.title, body: r.body, reviewer_name: r.name, photos: [], verified: false, source: "native" }))).slice(0, 3).map((r) => (
            <div key={r.id} className="bg-[#f0fdf4] rounded-2xl p-6 border border-[#dcfce7]">
              <StarRating value={r.rating} />
              <h3 className="font-nunito font-extrabold text-lg mt-2">{r.title}</h3>
              <p className="text-[#4b5563] text-sm mt-2">"{r.body}"</p>
              {r.photos && r.photos.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                  {r.photos.slice(0, 3).map((src, i) => (
                    <img key={i} src={src} alt="" loading="lazy" className="w-12 h-12 object-cover rounded-lg" />
                  ))}
                  {r.photos.length > 3 && <div className="w-12 h-12 rounded-lg bg-white border border-[#dcfce7] grid place-items-center text-xs font-bold">+{r.photos.length - 3}</div>}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs font-nunito font-bold">
                <span className="text-[#7bc67e]">— {r.reviewer_name}</span>
                {r.verified && <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#7bc67e] text-[#1a1a1a] px-1.5 py-0.5 rounded-full"><ShieldCheck size={8} /> Verified</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center bg-[#f0fdf4] rounded-2xl p-6 border border-[#dcfce7]">
          <Camera className="mx-auto text-[#7bc67e]" size={28} />
          <h3 className="font-nunito font-extrabold text-xl mt-2">Got photos? Share them with your review!</h3>
          <p className="text-sm text-[#4b5563] mt-1">Help other customers see exactly what they're getting.</p>
          <Link to="/reviews" className="mt-4 inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-6 py-2.5 rounded-full transition-colors">Browse & review →</Link>
        </div>
      </div>

      {/* Full price promise hero */}
      <PricePromise variant="hero" />

      {/* Built-in tools showcase */}
      <ToolsShowcase />

      {/* Portfolio strip — only renders when admin has marked items as featured */}
      <PortfolioStrip />

      <BoldFooter />
    </div>
  );
}