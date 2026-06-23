import React from "react";
import { Link } from "react-router-dom";
import { ThemeLabel, SelectThemeBar } from "./Theme1Industrial";
import { selectTheme } from "../../lib/api";
import { toast } from "sonner";
import { SECTORS, BEST_SELLERS, REVIEWS, RATING, NAV_LINKS } from "../../lib/data";
import { Star, ShieldCheck, Tag, PencilRuler, Check, MessageCircle, ShoppingBag, Facebook, Instagram, ArrowRight } from "lucide-react";

// Theme 2B — uses real YOP brand palette: black + white + yellow highlighter accent.
// Adds two extra sections borrowed from yourownprint.co.uk:
//  - "Trusted By" logo strip
//  - "2 easy ways to order" (Online vs Chat & Account Management)

const ACCENT = "#FFD60A"; // brand highlighter yellow (matches "Print Inc Price" badge vibe)

export default function Theme2BBrand({ inShowcase = true, themeNumber = "2B" }) {
  const onSelect = async () => {
    try { await selectTheme("yop_brand", "Selected from showcase"); } catch {}
    localStorage.setItem("yop_theme", "yop_brand");
    toast.success("YOP Brand Edition selected.");
  };

  return (
    <section data-testid="theme-2b-brand" className="bg-white text-black font-jakarta" id="theme-2b">
      {inShowcase && <ThemeLabel number={themeNumber} name="YOP Brand Edition" tagline="Mono · Bold · True to the YOP logo" accentColor={ACCENT} />}

      {/* Navbar — pure black like the logo outline */}
      <nav className="sticky top-0 z-40 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="t2b-logo" className="font-jakarta font-extrabold text-lg tracking-tight">
            <span className="text-white" style={{ WebkitTextStroke: "1px white" }}>YOURownPRINT</span>
            <span className="text-white">.co.uk</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 font-jakarta text-sm font-semibold">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                data-testid={`t2b-nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={l.highlight
                  ? "bg-[#FFD60A] text-black px-3 py-1.5 rounded-sm hover:bg-yellow-400 transition-colors"
                  : "hover:text-[#FFD60A] transition-colors"}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-white border-b border-black">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-[#FFD60A] text-xs font-jakarta font-bold uppercase tracking-widest mb-5">
              <span className="w-1.5 h-1.5 bg-[#FFD60A]" /> Print Inc. Price · UK Based
            </div>
            <h1 className="font-jakarta font-extrabold text-5xl sm:text-6xl lg:text-7xl text-black leading-[0.98] tracking-tight">
              Your Brand.<br />Your Clothing.<br />
              <span className="relative inline-block">
                <span className="relative z-10">Your Own Print.</span>
                <span className="absolute left-0 right-0 bottom-2 h-4 bg-[#FFD60A] -z-0" />
              </span>
            </h1>
            <p className="mt-6 text-lg text-neutral-700 max-w-lg">No minimums. No setup fees. Free logo design. UK based.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/workwear" data-testid="t2b-cta-shop" className="inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white font-jakarta font-bold px-7 py-3.5 transition-transform hover:-translate-y-0.5">
                Shop Workwear <ArrowRight size={16} />
              </Link>
              <Link to="/design" data-testid="t2b-cta-design" className="inline-flex items-center gap-2 bg-[#FFD60A] hover:bg-yellow-400 text-black font-jakarta font-bold px-7 py-3.5 transition-transform hover:-translate-y-0.5">
                Design Your Own T-Shirt
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-neutral-600">
              <div className="flex items-center gap-1.5"><Star size={16} className="text-black fill-black" />{RATING.value} · {RATING.count} reviews</div>
              <div className="flex items-center gap-1.5"><ShieldCheck size={16} />UK Based</div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] overflow-hidden border-2 border-black">
              <img src="https://images.pexels.com/photos/18703556/pexels-photo-18703556.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover grayscale" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-[#FFD60A] p-5 max-w-[260px] border-2 border-black">
              <div className="text-xs font-jakarta uppercase tracking-wider font-bold text-black">Personalised tee from</div>
              <div className="font-jakarta text-3xl font-extrabold text-black mt-1">£6.99</div>
              <div className="text-xs text-black mt-1 font-semibold">Print included in price</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            { icon: Check, label: "No Minimum Orders" },
            { icon: Tag, label: "No Setup Fees" },
            { icon: PencilRuler, label: "Free Logo Design" },
            { icon: ShieldCheck, label: "UK Based" },
            { icon: Star, label: `${RATING.value}★ · ${RATING.count} reviews` },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon size={16} className="text-[#FFD60A]" />
              <span className="font-jakarta font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2"><span className="h-px w-10 bg-black" /><span className="font-jakarta font-bold text-xs uppercase tracking-[0.3em]">Categories</span><span className="h-px w-10 bg-black" /></div>
          <h2 className="font-jakarta font-extrabold text-4xl lg:text-5xl text-black mt-3">Shop by Sector</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SECTORS.map((s, i) => (
            <Link key={s.name} to="/workwear" data-testid={`t2b-sector-${i}`} className="group bg-white border-2 border-black hover:bg-black hover:text-white transition-colors overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden bg-black">
                <img src={s.image} alt={s.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" />
              </div>
              <div className="p-4 border-t-2 border-black">
                <div className="font-jakarta font-bold">{s.name}</div>
                <div className="text-xs mt-1 inline-flex items-center gap-1 font-semibold">View → <span className="group-hover:bg-[#FFD60A] group-hover:text-black px-1.5 rounded-sm transition-colors">products</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 2 ways to order — borrowed from your live site */}
      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[#FFD60A] font-jakarta font-bold text-xs uppercase tracking-[0.3em]">How it works</div>
            <h2 className="font-jakarta font-extrabold text-4xl lg:text-5xl mt-3">2 Easy Ways To Order</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: ShoppingBag, title: "Online", points: ["View 100s of products online", "Add to your basket", "Upload logo, design and checkout", "Use our app to design and preview"] },
              { icon: MessageCircle, title: "Chat & Account Management", points: ["Speak directly with us", "Tailored product and logo advice", "Logo design, branding & guidance", "Dedicated account manager for large orders"] },
            ].map(({ icon: Icon, title, points }) => (
              <div key={title} className="bg-white text-black p-8 border-2 border-[#FFD60A]">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-12 h-12 grid place-items-center bg-[#FFD60A]"><Icon size={22} /></span>
                  <h3 className="font-jakarta font-extrabold text-2xl">{title}</h3>
                </div>
                <ul className="space-y-2">
                  {points.map(p => <li key={p} className="flex items-start gap-2 text-sm"><Check size={16} className="text-black mt-0.5 flex-shrink-0" /><span>{p}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Designer feature */}
      <div className="bg-white border-y-2 border-black">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <img src="https://images.pexels.com/photos/12025472/pexels-photo-12025472.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full border-2 border-black" />
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-black text-[#FFD60A] font-jakarta font-bold text-xs uppercase tracking-widest">Live preview</div>
          </div>
          <div>
            <div className="font-jakarta font-bold text-xs uppercase tracking-[0.3em]">Built-in designer</div>
            <h2 className="font-jakarta font-extrabold text-4xl lg:text-5xl text-black mt-2">Design in your browser. Order instantly.</h2>
            <p className="mt-4 text-neutral-700">Upload your logo, remove the background, add text and preview live on a real t-shirt — then check out securely with Stripe.</p>
            <ul className="mt-6 space-y-3">
              {["Upload image · Remove background", "Add text — fonts & colours", "Live mockup preview", "Stripe secure checkout"].map((f) => (
                <li key={f} className="flex items-center gap-3 font-medium"><span className="w-5 h-5 grid place-items-center bg-[#FFD60A]"><Check size={12} /></span>{f}</li>
              ))}
            </ul>
            <Link to="/design" data-testid="t2b-design-cta" className="mt-8 inline-flex items-center gap-2 bg-black hover:bg-neutral-800 text-white font-jakarta font-bold px-7 py-3.5 transition-transform hover:-translate-y-0.5">
              Open Designer <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Best Sellers */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="font-jakarta font-bold text-xs uppercase tracking-[0.3em]">Best Sellers</div>
          <h2 className="font-jakarta font-extrabold text-4xl lg:text-5xl text-black mt-2">Popular with UK businesses</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {BEST_SELLERS.map((p, i) => (
            <div key={p.id} data-testid={`t2b-product-${i}`} className="bg-white border-2 border-black overflow-hidden group">
              <div className="aspect-square bg-neutral-100 overflow-hidden relative">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-3 left-3 bg-[#FFD60A] text-black text-[10px] font-jakarta font-bold uppercase tracking-wider px-2 py-1">Print Inc.</span>
              </div>
              <div className="p-4 border-t-2 border-black">
                <div className="font-jakarta font-bold">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-jakarta font-extrabold text-xl">{p.price}</span>
                  <Link to="/design" className="text-xs font-bold uppercase tracking-wider hover:bg-[#FFD60A] px-2 py-1 transition-colors">Customise →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trusted By logo strip */}
      <div className="bg-neutral-50 border-y-2 border-black">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-6 font-jakarta font-bold text-xs uppercase tracking-[0.3em]">Trusted by UK brands</div>
          <div className="overflow-hidden">
            <div className="flex gap-12 marquee-track items-center">
              {[...Array(2)].flatMap((_, k) =>
                ["The Flower Rooms", "Fitness Sweatbox", "Dreamscapes", "Beaumont Park", "The White Horse", "Cabaero", "Platinum Garden Design", "The Old Plough", "PepsiCo", "Highcliffe"].map((b, i) => (
                  <div key={`${k}-${i}`} className="whitespace-nowrap font-jakarta font-extrabold text-2xl text-neutral-400 hover:text-black transition-colors">{b}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="font-jakarta font-extrabold text-4xl lg:text-5xl text-black">Customers are saying</h2>
          <div className="mt-3 flex items-center justify-center gap-2"><Star className="text-black fill-black" size={18} />{RATING.value} from {RATING.count} verified reviews</div>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {REVIEWS.map((r, i) => (
            <div key={i} className="bg-white p-6 border-2 border-black">
              <div className="flex gap-1 mb-3">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={14} className="text-black fill-black" />)}</div>
              <h3 className="font-jakarta font-extrabold text-lg">{r.title}</h3>
              <p className="text-neutral-700 text-sm mt-2 leading-relaxed">"{r.body}"</p>
              <div className="mt-4 inline-block bg-[#FFD60A] px-2 py-0.5 text-xs font-bold">— {r.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
          <div>
            <div className="font-jakarta font-extrabold text-lg">yourownprint<span className="text-[#FFD60A]">.co.uk</span></div>
            <p className="mt-3 text-sm text-neutral-300">UK custom print & workwear. Helping UK businesses wear their brand with pride.</p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-9 h-9 grid place-items-center bg-white/10 hover:bg-[#FFD60A] hover:text-black transition-colors"><Facebook size={16} /></a>
              <a href="#" className="w-9 h-9 grid place-items-center bg-white/10 hover:bg-[#FFD60A] hover:text-black transition-colors"><Instagram size={16} /></a>
            </div>
          </div>
          <div><div className="font-jakarta font-bold text-sm mb-3 text-[#FFD60A]">Shop</div><ul className="space-y-2 text-sm text-neutral-200"><li><Link to="/workwear" className="hover:text-[#FFD60A]">Workwear</Link></li><li><Link to="/teams-schools" className="hover:text-[#FFD60A]">Teams & Schools</Link></li><li><Link to="/design" className="hover:text-[#FFD60A]">Design Your Own</Link></li></ul></div>
          <div><div className="font-jakarta font-bold text-sm mb-3 text-[#FFD60A]">Help</div><ul className="space-y-2 text-sm text-neutral-200"><li><Link to="/contact" className="hover:text-[#FFD60A]">Get a Quote</Link></li><li><Link to="/contact" className="hover:text-[#FFD60A]">Contact</Link></li></ul></div>
          <div><div className="font-jakarta font-bold text-sm mb-3 text-[#FFD60A]">Payments</div><div className="flex flex-wrap gap-2 text-xs">{["Visa", "Mastercard", "Amex", "Stripe"].map(p => <span key={p} className="px-3 py-1.5 bg-white/10 text-neutral-200">{p}</span>)}</div></div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-400">© {new Date().getFullYear()} Your Own Print</div>
      </footer>

      {inShowcase && <SelectThemeBar onSelect={onSelect} testId="theme-2b-select-button" label="Select Theme 2B — YOP Brand Edition" color={ACCENT} textColor="#000" />}
    </section>
  );
}
