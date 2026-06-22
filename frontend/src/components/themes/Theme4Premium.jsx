import React from "react";
import { Link } from "react-router-dom";
import { ThemeLabel, SelectThemeBar } from "./Theme1Industrial";
import { selectTheme } from "../../lib/api";
import { toast } from "sonner";
import { SECTORS, BEST_SELLERS, REVIEWS, RATING, NAV_LINKS } from "../../lib/data";
import { Star, Sparkles, Facebook, Instagram, ArrowRight, Check } from "lucide-react";

export default function Theme4Premium({ inShowcase = true, themeNumber = 4 }) {
  const onSelect = async () => {
    try { await selectTheme("premium_dark", "Selected from showcase"); } catch {}
    localStorage.setItem("yop_theme", "premium_dark");
    toast.success("Premium Dark theme selected.");
  };

  return (
    <section data-testid="theme-4-premium" className="bg-[#1e1e2e] text-white font-manrope" id="theme-4">
      {inShowcase && <ThemeLabel number={themeNumber} name="Premium Dark" tagline="Refined · Luxurious · Cinematic" accentColor="#c9a84c" />}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#1e1e2e]/95 backdrop-blur border-b border-[#3d3d5c]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" data-testid="t4-logo" className="font-cormorant font-semibold text-2xl tracking-wider">
            yourownprint<span className="text-[#c9a84c]">.co.uk</span>
          </Link>
          <div className="hidden md:flex items-center gap-9 text-xs font-manrope uppercase tracking-[0.25em]">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} to={l.to} data-testid={`t4-nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`} className={l.highlight ? "text-[#c9a84c] hover:text-white transition-colors" : "hover:text-[#c9a84c] transition-colors"}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative min-h-[700px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.pexels.com/photos/30749329/pexels-photo-30749329.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" className="w-full h-full object-cover opacity-50 slow-zoom" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e2e] via-[#1e1e2e]/70 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 w-full fade-up">
          <div className="inline-flex items-center gap-3 mb-7">
            <span className="h-px w-12 bg-[#c9a84c]" />
            <span className="text-[#c9a84c] uppercase tracking-[0.4em] text-xs">Bespoke Workwear · Est. UK</span>
          </div>
          <h1 className="font-cormorant font-semibold text-5xl sm:text-6xl lg:text-8xl leading-[1.02] max-w-4xl">
            Your Brand.<br />Your Clothing.<br /><em className="text-[#c9a84c] not-italic">Your Own Print.</em>
          </h1>
          <p className="mt-8 text-lg text-neutral-300 max-w-lg font-light">No minimums. No setup fees. Free logo design. <span className="text-[#c9a84c]">UK based.</span></p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/workwear" data-testid="t4-cta-shop" className="inline-flex items-center gap-3 bg-[#c9a84c] hover:bg-[#b08f3a] text-[#1e1e2e] font-semibold uppercase tracking-[0.2em] text-xs px-8 py-4 transition-colors">
              Shop Workwear <ArrowRight size={14} />
            </Link>
            <Link to="/design" data-testid="t4-cta-design" className="inline-flex items-center gap-3 border border-[#c9a84c] text-[#c9a84c] hover:bg-[#c9a84c]/10 font-semibold uppercase tracking-[0.2em] text-xs px-8 py-4 transition-colors">
              Design Your Own T-Shirt
            </Link>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-y border-[#3d3d5c] bg-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs uppercase tracking-[0.25em] text-neutral-300 font-light">
          {["No Minimums", "No Setup Fees", "Free Logo Design", "UK Based", `${RATING.value}★ · ${RATING.count} reviews`].map(t => (
            <div key={t} className="flex items-center gap-3 justify-center md:justify-start">
              <span className="w-1 h-1 bg-[#c9a84c]" />{t}
            </div>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="text-[#c9a84c] uppercase tracking-[0.4em] text-xs">— Categories —</div>
          <h2 className="mt-3 font-cormorant font-semibold text-5xl lg:text-6xl">Shop by Sector</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {SECTORS.map((s, i) => (
            <Link key={s.name} to="/workwear" data-testid={`t4-sector-${i}`} className="group relative aspect-[3/4] overflow-hidden border border-transparent hover:border-[#c9a84c] transition-colors">
              <img src={s.image} alt={s.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e2e] via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#c9a84c]">Collection</div>
                <div className="font-cormorant text-xl font-semibold mt-1">{s.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Designer feature */}
      <div className="border-y border-[#3d3d5c] bg-[#2a2a3f]">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-[#c9a84c] uppercase tracking-[0.4em] text-xs">— Bespoke Designer —</div>
            <h2 className="mt-3 font-cormorant font-semibold text-4xl lg:text-5xl leading-tight">Craft your garment, frame by frame.</h2>
            <p className="mt-6 text-neutral-300 font-light max-w-lg">A refined design experience. Upload your artwork, remove backgrounds with one click, and command every detail on a hi-fidelity garment preview.</p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {["Upload artwork", "Remove background", "Type & font control", "Filters & finishes"].map(f => (
                <div key={f} className="flex items-center gap-3 text-sm text-neutral-200"><span className="w-1.5 h-1.5 bg-[#c9a84c]" />{f}</div>
              ))}
            </div>
            <Link to="/design" data-testid="t4-design-cta" className="mt-9 inline-flex items-center gap-3 bg-[#c9a84c] hover:bg-[#b08f3a] text-[#1e1e2e] font-semibold uppercase tracking-[0.2em] text-xs px-8 py-4 transition-colors">
              Open Designer <ArrowRight size={14} />
            </Link>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden border border-[#3d3d5c]">
              <img src="https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover slow-zoom" />
            </div>
            <Sparkles className="absolute -top-3 -right-3 text-[#c9a84c]" size={36} />
          </div>
        </div>
      </div>

      {/* Best Sellers */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <div className="text-[#c9a84c] uppercase tracking-[0.4em] text-xs">— Signature —</div>
          <h2 className="mt-3 font-cormorant font-semibold text-5xl">Best Sellers</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {BEST_SELLERS.map((p, i) => (
            <div key={p.id} data-testid={`t4-product-${i}`} className="group border border-[#3d3d5c] hover:border-[#c9a84c] transition-colors">
              <div className="aspect-square overflow-hidden">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105" />
              </div>
              <div className="p-5 bg-[#2a2a3f]">
                <div className="font-cormorant text-xl">{p.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[#c9a84c] font-manrope tracking-widest">{p.price}</span>
                  <Link to="/design" className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 hover:text-[#c9a84c]">Design →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="border-t border-[#3d3d5c] bg-[#2a2a3f]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[#c9a84c] uppercase tracking-[0.4em] text-xs">— Testimonials —</div>
            <h2 className="mt-3 font-cormorant font-semibold text-5xl">From our clientele</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {REVIEWS.map((r, i) => (
              <div key={i} className="border border-[#3d3d5c] p-7 bg-[#1e1e2e]">
                <div className="flex gap-1 mb-4">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={12} className="text-[#c9a84c] fill-[#c9a84c]" />)}</div>
                <h3 className="font-cormorant text-2xl">{r.title}</h3>
                <p className="text-neutral-300 text-sm mt-3 font-light leading-relaxed">"{r.body}"</p>
                <div className="mt-5 text-[10px] uppercase tracking-[0.3em] text-neutral-500">— {r.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1e1e2e] border-t border-[#3d3d5c]">
        <div className="max-w-7xl mx-auto px-6 py-14 grid md:grid-cols-4 gap-10">
          <div>
            <div className="font-cormorant text-2xl">yourownprint<span className="text-[#c9a84c]">.co.uk</span></div>
            <p className="mt-3 text-sm text-neutral-400 font-light">Bespoke UK print & workwear with cinematic attention to detail.</p>
            <div className="flex gap-3 mt-5">
              <a href="#" className="w-9 h-9 grid place-items-center border border-[#3d3d5c] hover:border-[#c9a84c] hover:text-[#c9a84c]"><Facebook size={14} /></a>
              <a href="#" className="w-9 h-9 grid place-items-center border border-[#3d3d5c] hover:border-[#c9a84c] hover:text-[#c9a84c]"><Instagram size={14} /></a>
            </div>
          </div>
          <div><div className="text-[10px] uppercase tracking-[0.3em] text-[#c9a84c] mb-4">Shop</div><ul className="space-y-2 text-sm text-neutral-300"><li><Link to="/workwear" className="hover:text-[#c9a84c]">Workwear</Link></li><li><Link to="/teams-schools" className="hover:text-[#c9a84c]">Teams & Schools</Link></li><li><Link to="/design" className="hover:text-[#c9a84c]">Design Your Own</Link></li></ul></div>
          <div><div className="text-[10px] uppercase tracking-[0.3em] text-[#c9a84c] mb-4">Help</div><ul className="space-y-2 text-sm text-neutral-300"><li><Link to="/contact" className="hover:text-[#c9a84c]">Get a Quote</Link></li><li><Link to="/contact" className="hover:text-[#c9a84c]">Contact</Link></li></ul></div>
          <div><div className="text-[10px] uppercase tracking-[0.3em] text-[#c9a84c] mb-4">Payments</div><div className="flex flex-wrap gap-2 text-xs text-neutral-300">{["Visa", "Mastercard", "Amex", "Stripe"].map(p => <span key={p} className="px-3 py-1.5 border border-[#3d3d5c] uppercase tracking-wider text-[10px]">{p}</span>)}</div></div>
        </div>
        <div className="border-t border-[#3d3d5c] py-5 text-center text-[10px] uppercase tracking-[0.3em] text-neutral-500">© {new Date().getFullYear()} Your Own Print</div>
      </footer>

      {inShowcase && <SelectThemeBar onSelect={onSelect} testId="theme-4-select-button" label="Select Theme 4 — Premium Dark" color="#c9a84c" textColor="#1e1e2e" />}
    </section>
  );
}
