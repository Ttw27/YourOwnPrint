import React from "react";
import { Link } from "react-router-dom";
import { ThemeLabel, SelectThemeBar } from "./Theme1Industrial";
import { selectTheme } from "../../lib/api";
import { toast } from "sonner";
import { SECTORS, BEST_SELLERS, REVIEWS, TRUST_ITEMS, RATING, NAV_LINKS } from "../../lib/data";
import { Star, ShieldCheck, Truck, Tag, PencilRuler, Facebook, Instagram, ArrowRight, Check } from "lucide-react";

export default function Theme2Clean({ inShowcase = true, themeNumber = 2 }) {
  const onSelect = async () => {
    try { await selectTheme("clean_professional", "Selected from showcase"); }
    catch {}
    localStorage.setItem("yop_theme", "clean_professional");
    toast.success("Clean Professional theme selected.");
  };
  return (
    <section data-testid="theme-2-clean" className="bg-white text-[#1a1a2e] font-roboto" id="theme-2">
      {inShowcase && <ThemeLabel number={themeNumber} name="Clean Professional" tagline="Corporate · Trustworthy · Whitespace" accentColor="#0066ff" />}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="t2-logo" className="font-jakarta font-bold text-lg">yourownprint<span className="text-[#0066ff]">.co.uk</span></Link>
          <div className="hidden md:flex items-center gap-8 font-jakarta text-sm">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} to={l.to} data-testid={`t2-nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`} className={l.highlight ? "text-[#0066ff] hover:text-white px-3 py-1.5 border border-[#0066ff] rounded-md" : "hover:text-[#0066ff] transition-colors"}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero — split layout */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#e6efff] text-[#0066ff] text-xs font-jakarta font-semibold rounded-full mb-5">
              <span className="w-1.5 h-1.5 bg-[#0066ff] rounded-full" /> Trusted by 400+ UK businesses
            </div>
            <h1 className="font-jakarta font-bold text-4xl sm:text-5xl lg:text-6xl text-[#1a1a2e] leading-[1.05]">
              Your Brand. Your Clothing.<br /><span className="text-[#0066ff]">Your Own Print.</span>
            </h1>
            <p className="mt-5 text-lg text-[#4a5568] max-w-lg">No minimums. No setup fees. Free logo design. UK based.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/workwear" data-testid="t2-cta-shop" className="inline-flex items-center gap-2 bg-[#0066ff] hover:bg-[#0052cc] text-white font-jakarta font-semibold px-6 py-3.5 rounded-md shadow-sm hover:shadow-md transition-all">
                Shop Workwear <ArrowRight size={16} />
              </Link>
              <Link to="/design" data-testid="t2-cta-design" className="inline-flex items-center gap-2 border border-[#0066ff] text-[#0066ff] hover:bg-blue-50 font-jakarta font-semibold px-6 py-3.5 rounded-md transition-colors">
                Design Your Own T-Shirt
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-[#4a5568]">
              <div className="flex items-center gap-1.5"><Star size={16} className="text-amber-500 fill-amber-500" />{RATING.value} · {RATING.count} reviews</div>
              <div className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-[#0066ff]" />UK Based</div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-xl">
              <img src="https://images.pexels.com/photos/18703556/pexels-photo-18703556.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-5 border border-[#e2e8f0] max-w-[260px]">
              <div className="text-xs font-jakarta uppercase tracking-wider text-[#4a5568]">Personalised tee from</div>
              <div className="font-jakarta text-2xl font-bold text-[#1a1a2e] mt-1">£6.99</div>
              <div className="text-xs text-[#4a5568] mt-1">Free logo design included</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-y border-[#e2e8f0] bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            { icon: Check, label: "No Minimum Orders" },
            { icon: Tag, label: "No Setup Fees" },
            { icon: PencilRuler, label: "Free Logo Design" },
            { icon: ShieldCheck, label: "UK Based" },
            { icon: Star, label: `${RATING.value}★ · ${RATING.count} reviews` },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-[#1a1a2e]">
              <span className="w-8 h-8 grid place-items-center bg-white rounded-md border border-[#e2e8f0]"><Icon size={14} className="text-[#0066ff]" /></span>
              <span className="font-jakarta font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sectors */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-[#0066ff] font-jakarta font-semibold text-sm tracking-wide">CATEGORIES</div>
          <h2 className="font-jakarta font-bold text-3xl lg:text-4xl text-[#1a1a2e] mt-2">Shop by Sector</h2>
          <p className="text-[#4a5568] mt-3 max-w-xl mx-auto">Tailored printing solutions for every UK industry.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {SECTORS.map((s, i) => (
            <Link key={s.name} to="/workwear" data-testid={`t2-sector-${i}`} className="group bg-white rounded-lg border border-[#e2e8f0] hover:border-[#0066ff] hover:shadow-md transition-all overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={s.image} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4">
                <div className="font-jakarta font-semibold text-[#1a1a2e]">{s.name}</div>
                <div className="text-xs text-[#0066ff] mt-1 group-hover:translate-x-1 transition-transform">View products →</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Designer feature */}
      <div className="bg-[#f8f9fa] border-y border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <img src="https://images.pexels.com/photos/12025472/pexels-photo-12025472.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="rounded-xl shadow-lg w-full" />
          </div>
          <div>
            <div className="text-[#0066ff] font-jakarta font-semibold text-sm tracking-wide">BUILT-IN DESIGNER</div>
            <h2 className="font-jakarta font-bold text-3xl lg:text-4xl text-[#1a1a2e] mt-2">Design in your browser. Order instantly.</h2>
            <p className="mt-4 text-[#4a5568]">Upload your logo, remove backgrounds, add text and preview live on a real t-shirt — then check out securely with Stripe.</p>
            <ul className="mt-6 space-y-3">
              {["Upload image · Remove background", "Add text — fonts & colours", "Live mockup preview", "Stripe secure checkout"].map((f) => (
                <li key={f} className="flex items-center gap-3 text-[#1a1a2e]"><Check size={18} className="text-[#0066ff]" />{f}</li>
              ))}
            </ul>
            <Link to="/design" data-testid="t2-design-cta" className="mt-8 inline-flex items-center gap-2 bg-[#0066ff] hover:bg-[#0052cc] text-white font-jakarta font-semibold px-6 py-3.5 rounded-md shadow-sm transition-colors">
              Open Designer <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Best Sellers */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="text-[#0066ff] font-jakarta font-semibold text-sm tracking-wide">BEST SELLERS</div>
          <h2 className="font-jakarta font-bold text-3xl lg:text-4xl text-[#1a1a2e] mt-2">Popular with UK businesses</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {BEST_SELLERS.map((p, i) => (
            <div key={p.id} data-testid={`t2-product-${i}`} className="bg-white rounded-lg border border-[#e2e8f0] hover:shadow-md transition-shadow overflow-hidden">
              <div className="aspect-square bg-[#f8f9fa] overflow-hidden">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4">
                <div className="font-jakarta font-semibold text-[#1a1a2e]">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-jakarta font-bold text-lg">{p.price}</span>
                  <Link to="/design" className="text-xs text-[#0066ff] font-jakarta font-semibold">Customise →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-[#f8f9fa] border-t border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <h2 className="font-jakarta font-bold text-3xl lg:text-4xl text-[#1a1a2e]">What our customers say</h2>
            <div className="mt-3 flex items-center justify-center gap-2 text-[#4a5568]"><Star className="text-amber-500 fill-amber-500" size={18} />{RATING.value} from {RATING.count} reviews</div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {REVIEWS.map((r, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-[#e2e8f0] shadow-sm">
                <div className="flex gap-1 mb-3">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={14} className="text-amber-500 fill-amber-500" />)}</div>
                <h3 className="font-jakarta font-bold text-lg text-[#1a1a2e]">{r.title}</h3>
                <p className="text-[#4a5568] text-sm mt-2 leading-relaxed">"{r.body}"</p>
                <div className="mt-4 text-xs text-[#4a5568] border-t border-[#e2e8f0] pt-3">— {r.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
          <div>
            <div className="font-jakarta font-bold text-lg">yourownprint<span className="text-[#0066ff]">.co.uk</span></div>
            <p className="mt-3 text-sm text-neutral-300">UK custom print & workwear. Helping UK businesses look the part since day one.</p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-9 h-9 grid place-items-center rounded-md bg-white/5 hover:bg-[#0066ff]"><Facebook size={16} /></a>
              <a href="#" className="w-9 h-9 grid place-items-center rounded-md bg-white/5 hover:bg-[#0066ff]"><Instagram size={16} /></a>
            </div>
          </div>
          <div><div className="font-jakarta font-semibold text-sm mb-3 text-neutral-400">Shop</div><ul className="space-y-2 text-sm text-neutral-200"><li><Link to="/workwear" className="hover:text-[#0066ff]">Workwear</Link></li><li><Link to="/teams-schools" className="hover:text-[#0066ff]">Teams & Schools</Link></li><li><Link to="/design" className="hover:text-[#0066ff]">Design Your Own</Link></li></ul></div>
          <div><div className="font-jakarta font-semibold text-sm mb-3 text-neutral-400">Help</div><ul className="space-y-2 text-sm text-neutral-200"><li><Link to="/contact" className="hover:text-[#0066ff]">Get a Quote</Link></li><li><Link to="/contact" className="hover:text-[#0066ff]">Contact</Link></li></ul></div>
          <div><div className="font-jakarta font-semibold text-sm mb-3 text-neutral-400">Payments</div><div className="flex flex-wrap gap-2 text-xs">{["Visa", "Mastercard", "Amex", "Stripe"].map(p => <span key={p} className="px-3 py-1.5 bg-white/5 rounded-md text-neutral-200">{p}</span>)}</div></div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-400">© {new Date().getFullYear()} Your Own Print</div>
      </footer>

      {inShowcase && <SelectThemeBar onSelect={onSelect} testId="theme-2-select-button" label="Select Theme 2 — Clean Professional" color="#0066ff" />}
    </section>
  );
}
