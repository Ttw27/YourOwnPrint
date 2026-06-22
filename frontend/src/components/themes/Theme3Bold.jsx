import React from "react";
import { Link } from "react-router-dom";
import { ThemeLabel, SelectThemeBar } from "./Theme1Industrial";
import { selectTheme } from "../../lib/api";
import { toast } from "sonner";
import { SECTORS, BEST_SELLERS, REVIEWS, RATING, NAV_LINKS } from "../../lib/data";
import { Star, Sparkles, Heart, Smile, Facebook, Instagram, ArrowRight, Check } from "lucide-react";

export default function Theme3Bold({ inShowcase = true, themeNumber = 3 }) {
  const onSelect = async () => {
    try { await selectTheme("bold_bright", "Selected from showcase"); } catch {}
    localStorage.setItem("yop_theme", "bold_bright");
    toast.success("Bold & Bright theme selected.");
  };

  return (
    <section data-testid="theme-3-bold" className="bg-white text-[#1a1a1a] font-nunito" id="theme-3">
      {inShowcase && <ThemeLabel number={themeNumber} name="Bold & Bright" tagline="Energetic · Playful · Rounded" accentColor="#7bc67e" />}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e5e7eb]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" data-testid="t3-logo" className="font-nunito font-extrabold text-lg">
            yourownprint<span className="text-[#7bc67e]">.co.uk</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm font-nunito font-bold">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} to={l.to} data-testid={`t3-nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`} className={l.highlight ? "px-4 py-1.5 bg-[#7bc67e] text-[#1a1a1a] rounded-full hover:bg-[#5eb062] transition-colors" : "hover:text-[#7bc67e] transition-colors"}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

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
            <h1 className="mt-5 font-nunito font-black text-5xl sm:text-6xl lg:text-7xl text-[#1a1a1a] leading-[1.02]">
              Your Brand. <br /> Your Clothing. <br />
              <span className="relative inline-block">
                <span className="relative z-10">Your Own Print.</span>
                <span className="absolute left-0 right-0 bottom-1 h-3 bg-[#7bc67e] -z-0 rounded-full" />
              </span>
            </h1>
            <p className="mt-5 text-lg text-[#4b5563] max-w-lg">No minimums. No setup fees. Free logo design. UK based & friendly.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/workwear" data-testid="t3-cta-shop" className="inline-flex items-center gap-2 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full shadow-md hover:-translate-y-1 transition-transform">
                Shop Workwear <ArrowRight size={16} />
              </Link>
              <Link to="/design" data-testid="t3-cta-design" className="inline-flex items-center gap-2 border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">
                Design Your Own T-Shirt
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl rotate-2">
              <img src="https://images.pexels.com/photos/8926904/pexels-photo-8926904.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-4 -left-6 bg-white rounded-2xl shadow-lg p-4 border border-[#e5e7eb] -rotate-3">
              <div className="flex items-center gap-2"><Heart className="text-rose-500" size={18} fill="currentColor" /><div className="font-nunito font-extrabold">404+ happy customers</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-[#f0fdf4] border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-nunito font-bold text-[#1a1a1a]">
          {["No Minimum Orders", "No Setup Fees", "Free Logo Design", "UK Based"].map(t => (
            <div key={t} className="flex items-center gap-2"><Check size={16} className="text-[#7bc67e]" />{t}</div>
          ))}
          <div className="flex items-center gap-2"><Star size={16} className="text-amber-500 fill-amber-500" />{RATING.value}★ from {RATING.count} reviews</div>
        </div>
      </div>

      {/* Sectors — colourful tiles */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-center font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">Shop by Sector</h2>
        <p className="text-center text-[#4b5563] mt-3">Find your crew’s look in seconds.</p>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SECTORS.map((s, i) => {
            const colors = ["bg-[#7bc67e]", "bg-[#fde68a]", "bg-[#fbcfe8]", "bg-[#bfdbfe]", "bg-[#fed7aa]"];
            return (
              <Link key={s.name} to="/workwear" data-testid={`t3-sector-${i}`} className="group relative aspect-[4/5] rounded-2xl overflow-hidden">
                <img src={s.image} alt={s.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className={`absolute inset-0 ${colors[i % colors.length]} mix-blend-multiply opacity-50 group-hover:opacity-30 transition-opacity`} />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="font-nunito font-black text-white text-lg drop-shadow">{s.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Designer feature */}
      <div className="bg-[#f0fdf4] border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-[#1a1a1a] font-nunito font-extrabold rounded-full text-xs"><Smile size={14} className="text-[#7bc67e]" /> So easy, anyone can do it</div>
            <h2 className="mt-3 font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">Design your tee in 60 seconds</h2>
            <p className="mt-4 text-[#4b5563]">Upload, drag, drop, done. Real preview on a real shirt. Order with one tap.</p>
            <Link to="/design" data-testid="t3-design-cta" className="mt-7 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#333] text-white font-nunito font-extrabold px-7 py-3.5 rounded-full transition-colors">Launch Designer <ArrowRight size={16} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {BEST_SELLERS.map((p, i) => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-[#dcfce7] shadow-sm">
                <div className="aspect-square rounded-xl overflow-hidden bg-[#f0fdf4]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="mt-3 font-nunito font-bold text-sm">{p.name}</div>
                <div className="text-[#7bc67e] font-nunito font-extrabold text-lg">{p.price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-center font-nunito font-black text-4xl lg:text-5xl text-[#1a1a1a]">Loved by 400+ teams</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {REVIEWS.map((r, i) => (
            <div key={i} className="bg-[#f0fdf4] rounded-2xl p-6 border border-[#dcfce7]">
              <div className="flex gap-1 mb-3">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={14} className="text-amber-500 fill-amber-500" />)}</div>
              <h3 className="font-nunito font-extrabold text-lg">{r.title}</h3>
              <p className="text-[#4b5563] text-sm mt-2">"{r.body}"</p>
              <div className="mt-4 text-xs font-nunito font-bold text-[#7bc67e]">— {r.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
          <div>
            <div className="font-nunito font-extrabold text-lg">yourownprint<span className="text-[#7bc67e]">.co.uk</span></div>
            <p className="mt-3 text-sm text-neutral-300">Bright, friendly UK print & workwear.</p>
            <div className="flex gap-3 mt-4"><a href="#" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[#7bc67e] hover:text-black"><Facebook size={16} /></a><a href="#" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[#7bc67e] hover:text-black"><Instagram size={16} /></a></div>
          </div>
          <div><div className="font-nunito font-bold text-sm text-neutral-400 mb-3">Shop</div><ul className="space-y-2 text-sm"><li><Link to="/workwear" className="hover:text-[#7bc67e]">Workwear</Link></li><li><Link to="/teams-schools" className="hover:text-[#7bc67e]">Teams & Schools</Link></li><li><Link to="/design" className="hover:text-[#7bc67e]">Design Your Own</Link></li></ul></div>
          <div><div className="font-nunito font-bold text-sm text-neutral-400 mb-3">Help</div><ul className="space-y-2 text-sm"><li><Link to="/contact" className="hover:text-[#7bc67e]">Get a Quote</Link></li><li><Link to="/contact" className="hover:text-[#7bc67e]">Contact</Link></li></ul></div>
          <div><div className="font-nunito font-bold text-sm text-neutral-400 mb-3">Payments</div><div className="flex flex-wrap gap-2 text-xs">{["Visa", "Mastercard", "Amex", "Stripe"].map(p => <span key={p} className="px-3 py-1.5 bg-white/10 rounded-full">{p}</span>)}</div></div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-400">© {new Date().getFullYear()} Your Own Print</div>
      </footer>

      {inShowcase && <SelectThemeBar onSelect={onSelect} testId="theme-3-select-button" label="Select Theme 3 — Bold & Bright" color="#7bc67e" textColor="#1a1a1a" />}
    </section>
  );
}
