import React from "react";
import { Link, useLocation } from "react-router-dom";
import { NAV_LINKS } from "../lib/data";
import { Facebook, Instagram } from "lucide-react";

export function IndustrialNavbar() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky top-0 z-40 bg-[#0d0d0d]/95 backdrop-blur border-b border-[#222]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="font-oswald font-bold text-xl uppercase tracking-wider text-white">
          yourownprint<span className="text-[#ff6b35]">.co.uk</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 font-oswald uppercase text-sm tracking-wider">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.label}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={`${l.highlight ? "text-[#ff6b35]" : active ? "text-[#ff6b35]" : "text-white"} hover:text-[#ff6b35] transition-colors`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <Link to="/" data-testid="nav-themes" className="text-xs uppercase tracking-widest text-neutral-400 hover:text-[#ff6b35]">← Themes</Link>
      </div>
    </nav>
  );
}

export function IndustrialFooter() {
  return (
    <footer className="bg-[#0d0d0d] border-t border-[#222] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="font-oswald uppercase text-lg font-bold">yourownprint<span className="text-[#ff6b35]">.co.uk</span></div>
          <p className="mt-3 text-sm text-neutral-400">UK-based custom print & workwear.</p>
          <div className="flex gap-3 mt-4">
            <a href="#" className="w-9 h-9 grid place-items-center border border-[#333] hover:border-[#ff6b35] hover:text-[#ff6b35] transition-colors"><Facebook size={16} /></a>
            <a href="#" className="w-9 h-9 grid place-items-center border border-[#333] hover:border-[#ff6b35] hover:text-[#ff6b35] transition-colors"><Instagram size={16} /></a>
          </div>
        </div>
        <div>
          <div className="font-oswald uppercase tracking-widest text-xs text-neutral-500 mb-3">Shop</div>
          <ul className="space-y-2 text-sm text-neutral-300">
            <li><Link to="/workwear" className="hover:text-[#ff6b35]">Workwear</Link></li>
            <li><Link to="/teams-schools" className="hover:text-[#ff6b35]">Teams & Schools</Link></li>
            <li><Link to="/design" className="hover:text-[#ff6b35]">Design Your Own</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-oswald uppercase tracking-widest text-xs text-neutral-500 mb-3">Help</div>
          <ul className="space-y-2 text-sm text-neutral-300">
            <li><Link to="/contact" className="hover:text-[#ff6b35]">Get a Quote</Link></li>
            <li><Link to="/contact" className="hover:text-[#ff6b35]">Contact</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-oswald uppercase tracking-widest text-xs text-neutral-500 mb-3">We accept</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Visa", "Mastercard", "Amex", "Apple Pay", "Stripe"].map((p) => (
              <span key={p} className="px-3 py-1.5 border border-[#333] text-neutral-300 font-oswald uppercase tracking-wider">{p}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-[#222] py-5 text-center text-xs text-neutral-500 font-oswald uppercase tracking-widest">© {new Date().getFullYear()} Your Own Print</div>
    </footer>
  );
}
