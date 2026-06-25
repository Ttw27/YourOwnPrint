import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NAV_MENU } from "../../lib/data";
import { Facebook, Instagram, Star, ChevronDown, Menu, X } from "lucide-react";

export function BoldNavbar() {
  const { pathname } = useLocation();
  const [openKey, setOpenKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpenKey(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <nav ref={rootRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e5e7eb]" data-testid="bold-navbar">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="font-nunito font-extrabold text-lg text-[#1a1a1a] flex-shrink-0">
          yourownprint<span className="text-[#7bc67e]">.co.uk</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 text-sm font-nunito font-bold" data-testid="nav-desktop">
          {NAV_MENU.map((item) => {
            if (!item.columns) {
              const active = pathname === item.to;
              const testid = `nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
              return item.cta ? (
                <Link key={item.key} to={item.to} data-testid={testid} className="ml-2 px-4 py-1.5 bg-[#7bc67e] text-[#1a1a1a] rounded-full hover:bg-[#5eb062] transition-colors">{item.label}</Link>
              ) : (
                <Link key={item.key} to={item.to} data-testid={testid} className={`px-3 py-1.5 rounded-full transition-colors ${active ? "text-[#7bc67e]" : "text-[#1a1a1a]"} hover:text-[#7bc67e]`}>{item.label}</Link>
              );
            }
            const isOpen = openKey === item.key;
            return (
              <div key={item.key} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : item.key)}
                  className={`px-3 py-1.5 inline-flex items-center gap-1 rounded-full transition-colors ${isOpen ? "text-[#7bc67e]" : "text-[#1a1a1a]"} hover:text-[#7bc67e]`}
                  data-testid={`nav-${item.key}-trigger`}
                  aria-expanded={isOpen}
                >
                  {item.label} <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-3 bg-white rounded-3xl shadow-2xl border border-[#dcfce7] p-8 grid gap-8"
                    style={{ gridTemplateColumns: item.columns.length === 1 ? "1fr" : `repeat(${item.columns.length}, minmax(190px, 1fr))`, minWidth: item.columns.length >= 3 ? 760 : (item.columns.length === 2 ? 560 : 320) }}
                    data-testid={`nav-${item.key}-panel`}
                  >
                    {item.columns.map((col, i) => (
                      <div key={i}>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold mb-3" dangerouslySetInnerHTML={{ __html: col.heading }} />
                        <ul className="space-y-2">
                          {col.links.map((lnk) => (
                            <li key={lnk.to}>
                              <Link
                                to={lnk.to}
                                onClick={() => setOpenKey(null)}
                                className="text-sm font-nunito font-extrabold text-[#1a1a1a] hover:text-[#7bc67e] inline-flex items-center gap-2"
                                data-testid={`nav-${item.key}-link-${lnk.to.replace(/\W+/g, "-")}`}
                              >
                                {lnk.label}
                                {lnk.badge && (
                                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#fde68a] text-[#1a1a1a]">{lnk.badge}</span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="md:hidden w-10 h-10 grid place-items-center rounded-full bg-[#f0fdf4] text-[#1a1a1a]"
          data-testid="nav-mobile-open"
        >
          <Menu size={18} />
        </button>

        <Link to="/themes" data-testid="nav-themes" className="hidden lg:inline text-xs font-nunito font-bold text-neutral-500 hover:text-[#7bc67e] ml-2">Themes</Link>
      </div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)} data-testid="nav-mobile-overlay">
          <div className="bg-white w-[88%] max-w-sm h-full p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-extrabold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="w-8 h-8 grid place-items-center rounded-full bg-[#f0fdf4]" data-testid="nav-mobile-close"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              {NAV_MENU.map((item) => (
                <div key={item.key}>
                  {item.columns ? (
                    <details className="group">
                      <summary className="font-extrabold py-2 cursor-pointer flex items-center justify-between" data-testid={`nav-mobile-group-${item.key}`}>
                        {item.label}
                        <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
                      </summary>
                      <ul className="pl-3 space-y-2 mt-1">
                        {item.columns.flatMap((c) => c.links).map((lnk) => (
                          <li key={lnk.to}>
                            <Link to={lnk.to} onClick={() => setMobileOpen(false)} className="text-sm text-[#1a1a1a] hover:text-[#7bc67e]" data-testid={`nav-mobile-link-${lnk.to.replace(/\W+/g, "-")}`}>{lnk.label}</Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Link to={item.to} onClick={() => setMobileOpen(false)} className={`block font-extrabold py-2 ${item.cta ? "text-[#7bc67e]" : "text-[#1a1a1a]"}`} data-testid={`nav-mobile-${item.key}`}>
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
