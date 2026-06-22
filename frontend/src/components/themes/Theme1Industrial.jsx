import React from "react";
import { Link } from "react-router-dom";
import { selectTheme } from "../../lib/api";
import { toast } from "sonner";
import { SECTORS, BEST_SELLERS, REVIEWS, TRUST_ITEMS, RATING, NAV_LINKS } from "../../lib/data";
import { Star, Check, Upload, Type, Image as ImageIcon, ShoppingBag, Facebook, Instagram, ArrowRight } from "lucide-react";

export default function Theme1Industrial({ inShowcase = true, themeNumber = 1 }) {
  const onSelect = async () => {
    try {
      await selectTheme("industrial_dark", "Selected from showcase");
      localStorage.setItem("yop_theme", "industrial_dark");
      toast.success("Industrial Dark theme selected — inner pages now use this style.");
    } catch (e) {
      toast.error("Could not save selection, but theme is applied locally.");
      localStorage.setItem("yop_theme", "industrial_dark");
    }
  };

  return (
    <section data-testid="theme-1-industrial" className="bg-[#0d0d0d] text-white font-ibm relative overflow-hidden">
      {inShowcase && <ThemeLabel number={themeNumber} name="Industrial Dark" tagline="Tough · Trades-focused · Heavy uppercase" accentColor="#ff6b35" />}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#0d0d0d]/95 backdrop-blur border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="t1-logo" className="font-oswald font-bold text-xl uppercase tracking-wider">
            yourownprint<span className="text-[#ff6b35]">.co.uk</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 font-oswald uppercase text-sm tracking-wider">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                data-testid={`t1-nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={l.highlight ? "text-[#ff6b35] hover:text-white transition-colors" : "hover:text-[#ff6b35] transition-colors"}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative min-h-[640px] flex items-center">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1507497806295-753c4108560c?auto=format&fit=crop&w=1920&q=80" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-12 gap-8 items-center w-full">
          <div className="lg:col-span-8 fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#ff6b35] text-[#ff6b35] text-xs font-oswald uppercase tracking-[0.3em] mb-6">
              <span className="w-2 h-2 bg-[#ff6b35]" /> UK Custom Print & Workwear
            </div>
            <h1 className="font-oswald uppercase font-bold leading-[0.95] tracking-tight text-5xl sm:text-6xl lg:text-7xl">
              Your Brand.<br />Your Clothing.<br /><span className="text-[#ff6b35]">Your Own Print.</span>
            </h1>
            <p className="mt-6 text-lg text-neutral-300 max-w-xl">No minimums. No setup fees. Free logo design. UK based.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/workwear" data-testid="t1-cta-shop" className="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-oswald uppercase tracking-wider px-8 py-4 transition-transform hover:-translate-y-1">
                Shop Workwear <ArrowRight size={18} />
              </Link>
              <Link to="/design" data-testid="t1-cta-design" className="inline-flex items-center gap-2 border-2 border-white hover:border-[#ff6b35] hover:text-[#ff6b35] text-white font-oswald uppercase tracking-wider px-8 py-4 transition-colors">
                Design Your Own T-Shirt
              </Link>
            </div>
          </div>
          <div className="hidden lg:block lg:col-span-4">
            <div className="border-l-4 border-[#ff6b35] pl-6 space-y-4">
              <div>
                <div className="font-oswald uppercase text-4xl font-bold text-[#ff6b35]">404+</div>
                <div className="text-sm text-neutral-400 uppercase tracking-wider">Verified Reviews</div>
              </div>
              <div>
                <div className="font-oswald uppercase text-4xl font-bold">£6.99</div>
                <div className="text-sm text-neutral-400 uppercase tracking-wider">From — Personalised Tee</div>
              </div>
              <div>
                <div className="font-oswald uppercase text-4xl font-bold">0</div>
                <div className="text-sm text-neutral-400 uppercase tracking-wider">Minimum order</div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 slash-divider-thick" />
      </div>

      {/* Trust bar */}
      <div className="bg-[#111] border-y border-[#222] py-4 overflow-hidden">
        <div className="flex gap-12 marquee-track whitespace-nowrap font-oswald uppercase tracking-widest text-sm">
          {[...TRUST_ITEMS, `${RATING.value}★ from ${RATING.count} Reviews`, ...TRUST_ITEMS, `${RATING.value}★ from ${RATING.count} Reviews`].map((t, i) => (
            <div key={i} className="flex items-center gap-3 text-neutral-300">
              <Check size={16} className="text-[#ff6b35]" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shop by Sector */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="text-[#ff6b35] font-oswald uppercase text-sm tracking-[0.3em]">Built for every trade</div>
            <h2 className="font-oswald uppercase text-4xl lg:text-5xl font-bold mt-2">Shop by Sector</h2>
          </div>
          <Link to="/workwear" className="font-oswald uppercase text-sm tracking-widest text-neutral-300 hover:text-[#ff6b35]">View all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {SECTORS.map((s, i) => (
            <Link key={s.name} to="/workwear" data-testid={`t1-sector-${i}`} className="group relative aspect-square overflow-hidden bg-[#1a1a1a] border border-[#222]">
              <img src={s.image} alt={s.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="font-oswald uppercase font-bold text-white text-lg leading-tight">{s.name}</div>
                <div className="h-0.5 w-8 bg-[#ff6b35] mt-2 group-hover:w-full transition-all duration-300" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Design Your Own Feature */}
      <div className="bg-[#111] border-y border-[#222]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[#ff6b35] font-oswald uppercase text-sm tracking-[0.3em]">Built-in designer</div>
            <h2 className="font-oswald uppercase text-4xl lg:text-5xl font-bold mt-2 leading-tight">Design Your Own.<br />Live Preview.<br />Order Instantly.</h2>
            <p className="mt-5 text-neutral-300 max-w-lg">Upload your image, remove the background, add text, drag & resize on a real t-shirt mockup. Check out with Stripe — no minimums.</p>
            <ul className="mt-6 space-y-2 text-neutral-200">
              {[
                { icon: Upload, label: "Upload your image or logo" },
                { icon: ImageIcon, label: "Remove the background in one click" },
                { icon: Type, label: "Add text — fonts & colours" },
                { icon: ShoppingBag, label: "Checkout securely with Stripe" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="w-8 h-8 inline-flex items-center justify-center bg-[#ff6b35]/10 border border-[#ff6b35]/40 text-[#ff6b35]"><Icon size={16} /></span>
                  <span className="font-ibm">{label}</span>
                </li>
              ))}
            </ul>
            <Link to="/design" data-testid="t1-design-cta" className="mt-8 inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-oswald uppercase tracking-wider px-8 py-4 transition-transform hover:-translate-y-1">
              Launch Designer <ArrowRight size={18} />
            </Link>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] bg-[#1a1a1a] border border-[#222] grid place-items-center relative overflow-hidden">
              <img src="https://images.pexels.com/photos/9558716/pexels-photo-9558716.jpeg?auto=compress&cs=tinysrgb&w=900" alt="T-shirt mockup" className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 px-3 py-1 bg-[#ff6b35] text-white font-oswald uppercase text-xs tracking-wider">Live preview</div>
            </div>
          </div>
        </div>
      </div>

      {/* Best Sellers */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <div className="text-[#ff6b35] font-oswald uppercase text-sm tracking-[0.3em]">Top picks</div>
            <h2 className="font-oswald uppercase text-4xl lg:text-5xl font-bold mt-2">Best Sellers</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {BEST_SELLERS.map((p, i) => (
            <div key={p.id} data-testid={`t1-product-${i}`} className="group bg-[#111] border border-[#222] hover:border-[#ff6b35] transition-colors">
              <div className="aspect-square overflow-hidden bg-[#1a1a1a]">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4">
                <div className="font-oswald uppercase font-semibold text-white">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[#ff6b35] font-oswald text-xl font-bold">{p.price}</span>
                  <Link to="/design" className="text-xs uppercase tracking-widest text-neutral-300 hover:text-[#ff6b35]">Design →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-[#111] border-t border-[#222]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-center gap-3 mb-10">
            <Star size={20} className="text-[#ff6b35] fill-[#ff6b35]" />
            <span className="font-oswald uppercase tracking-widest text-sm text-neutral-300">{RATING.value}★ from {RATING.count} verified reviews</span>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <div key={i} className="border border-[#222] bg-[#0d0d0d] p-6">
                <div className="flex gap-1 mb-3">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={14} className="text-[#ff6b35] fill-[#ff6b35]" />)}</div>
                <h3 className="font-oswald uppercase text-lg font-bold mb-2">{r.title}</h3>
                <p className="text-neutral-300 text-sm leading-relaxed">"{r.body}"</p>
                <div className="mt-4 pt-4 border-t border-[#222] text-xs uppercase tracking-widest text-neutral-500">
                  {r.name} · {r.product}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0d0d0d] border-t border-[#222]">
        <div className="max-w-7xl mx-auto px-6 py-14 grid md:grid-cols-4 gap-8">
          <div>
            <div className="font-oswald uppercase text-lg font-bold">yourownprint<span className="text-[#ff6b35]">.co.uk</span></div>
            <p className="mt-3 text-sm text-neutral-400">UK-based custom print & workwear. Helping small businesses, trades, schools & teams wear their brand with pride.</p>
            <div className="flex gap-3 mt-4">
              <a href="#" data-testid="t1-fb" className="w-9 h-9 grid place-items-center border border-[#333] hover:border-[#ff6b35] hover:text-[#ff6b35] transition-colors"><Facebook size={16} /></a>
              <a href="#" data-testid="t1-ig" className="w-9 h-9 grid place-items-center border border-[#333] hover:border-[#ff6b35] hover:text-[#ff6b35] transition-colors"><Instagram size={16} /></a>
            </div>
          </div>
          <FooterCol title="Shop" links={[["Workwear", "/workwear"], ["Teams & Schools", "/teams-schools"], ["Design Your Own", "/design"]]} />
          <FooterCol title="Help" links={[["Get a Quote", "/contact"], ["Contact", "/contact"]]} />
          <div>
            <div className="font-oswald uppercase tracking-widest text-xs text-neutral-500 mb-3">We accept</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay", "Stripe"].map((p) => (
                <span key={p} className="px-3 py-1.5 border border-[#333] text-neutral-300 font-oswald uppercase tracking-wider">{p}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-[#222] py-5 text-center text-xs text-neutral-500 font-oswald uppercase tracking-widest">© {new Date().getFullYear()} Your Own Print — All rights reserved</div>
      </footer>

      {inShowcase && (
        <SelectThemeBar onSelect={onSelect} testId="theme-1-select-button" label="Select Theme 1 — Industrial Dark" color="#ff6b35" textColor="#fff" />
      )}
    </section>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div className="font-oswald uppercase tracking-widest text-xs text-neutral-500 mb-3">{title}</div>
      <ul className="space-y-2 text-sm text-neutral-300">
        {links.map(([label, to]) => <li key={label}><Link to={to} className="hover:text-[#ff6b35]">{label}</Link></li>)}
      </ul>
    </div>
  );
}

export function ThemeLabel({ number, name, tagline, accentColor }) {
  return (
    <div className="bg-black border-b border-neutral-800 py-6 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 grid place-items-center text-white font-bold text-lg" style={{ background: accentColor }}>0{number}</div>
          <div>
            <div className="font-oswald uppercase text-2xl text-white tracking-wider">Theme {number} — {name}</div>
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-500 mt-1">{tagline}</div>
          </div>
        </div>
        <a href={`#theme-${number + 1}`} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-white">Next theme ↓</a>
      </div>
    </div>
  );
}

export function SelectThemeBar({ onSelect, testId, label, color, textColor = "#fff" }) {
  return (
    <div className="bg-black py-8 text-center border-t border-neutral-800">
      <button
        data-testid={testId}
        onClick={onSelect}
        className="inline-flex items-center gap-3 px-10 py-4 font-oswald uppercase tracking-[0.2em] font-bold transition-transform hover:-translate-y-1"
        style={{ background: color, color: textColor }}
      >
        ✓ {label}
      </button>
    </div>
  );
}
