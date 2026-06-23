import React from "react";
import { Link, useLocation } from "react-router-dom";
import { NAV_LINKS } from "../../lib/data";
import { Facebook, Instagram, Star } from "lucide-react";

export function BoldNavbar() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e5e7eb]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="font-nunito font-extrabold text-lg text-[#1a1a1a]">
          yourownprint<span className="text-[#7bc67e]">.co.uk</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-nunito font-bold">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.label}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={
                  l.highlight
                    ? "px-4 py-1.5 bg-[#7bc67e] text-[#1a1a1a] rounded-full hover:bg-[#5eb062] transition-colors"
                    : `${active ? "text-[#7bc67e]" : "text-[#1a1a1a]"} hover:text-[#7bc67e] transition-colors`
                }
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <Link to="/themes" data-testid="nav-themes" className="text-xs font-nunito font-bold text-neutral-500 hover:text-[#7bc67e]">Themes</Link>
      </div>
    </nav>
  );
}

export function BoldFooter() {
  return (
    <footer className="bg-[#1a1a1a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="font-nunito font-extrabold text-lg">
            yourownprint<span className="text-[#7bc67e]">.co.uk</span>
          </div>
          <p className="mt-3 text-sm text-neutral-300">Bright, friendly UK print & workwear.</p>
          <div className="flex gap-3 mt-4">
            <a href="#" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[#7bc67e] hover:text-black transition-colors"><Facebook size={16} /></a>
            <a href="#" className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[#7bc67e] hover:text-black transition-colors"><Instagram size={16} /></a>
          </div>
        </div>
        <FooterCol title="Shop" links={[["Workwear", "/workwear"], ["Teams & Schools", "/teams-schools"], ["Design Your Own", "/design"]]} />
        <FooterCol title="Help" links={[["Get a Quote", "/contact"], ["Contact", "/contact"], ["Reviews", "/reviews"]]} />
        <div>
          <div className="font-nunito font-bold text-sm text-neutral-400 mb-3">Payments</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Visa", "Mastercard", "Amex", "Apple Pay", "Stripe"].map(p => <span key={p} className="px-3 py-1.5 bg-white/10 rounded-full">{p}</span>)}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-400">© {new Date().getFullYear()} Your Own Print</div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <div className="font-nunito font-bold text-sm text-neutral-400 mb-3">{title}</div>
      <ul className="space-y-2 text-sm">
        {links.map(([label, to]) => <li key={label}><Link to={to} className="hover:text-[#7bc67e]">{label}</Link></li>)}
      </ul>
    </div>
  );
}

export function StarRating({ value = 0, size = 14, showNumber = false, className = "" }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className="flex">
        {[0, 1, 2, 3, 4].map(i => {
          const filled = i < full || (i === full && half);
          return <Star key={i} size={size} className={filled ? "text-amber-500 fill-amber-500" : "text-neutral-300 fill-neutral-300"} />;
        })}
      </div>
      {showNumber && <span className="text-xs font-nunito font-bold text-[#1a1a1a]">{value.toFixed(1)}</span>}
    </div>
  );
}
