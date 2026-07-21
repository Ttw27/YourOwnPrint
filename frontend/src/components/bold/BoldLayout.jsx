import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NAV_MENU } from "../../lib/data";
import { fetchNavigation } from "../../lib/api";
import { Facebook, Instagram, Youtube, Linkedin, Music2, Twitter, Star, ChevronDown, Menu, X, Search } from "lucide-react";
import CartIcon from "../CartIcon";
import AccountButton from "../AccountButton";
import usePageCopy from "../../hooks/usePageCopy";

export function BoldNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const [menu, setMenu] = useState(NAV_MENU);
  const rootRef = useRef(null);
  // The mega-menu panel is centred on its trigger. "Shop" sits near the left of
  // the bar, so on a narrower desktop window a 760px panel centred on it runs
  // off the left edge of the screen. This nudges it back inside the viewport.
  const panelRef = useRef(null);
  const [panelShift, setPanelShift] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchNavigation()
      .then((cfg) => { if (alive && cfg?.menu?.length) setMenu(cfg.menu); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Lock body scroll while mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) { setOpenKey(null); setSearchOpen(false); }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function submitSearch(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setSearchQuery("");
  }

  // Runs before paint, so the panel never appears in the wrong place first.
  useLayoutEffect(() => {
    if (!openKey) { setPanelShift(0); return; }
    const measure = () => {
      const el = panelRef.current;
      if (!el) return;
      const margin = 12;
      const rect = el.getBoundingClientRect();
      // Undo the shift already applied so we always measure the natural position.
      const left = rect.left - panelShift;
      const right = rect.right - panelShift;
      let next = 0;
      if (left < margin) next = margin - left;
      else if (right > window.innerWidth - margin) next = Math.min(0, window.innerWidth - margin - right);
      next = Math.round(next);
      if (next !== panelShift) setPanelShift(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [openKey, panelShift]);

  return (
    <nav ref={rootRef} className="sticky top-0 z-40 bg-white border-b border-[#e5e7eb]" data-testid="bold-navbar">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex-shrink-0 inline-flex items-center" aria-label="Your Own Print — home">
          <img src="/logo.png" alt="Your Own Print" className="h-10 w-auto md:h-11 select-none" draggable="false" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 text-sm font-nunito font-bold" data-testid="nav-desktop">
          {menu.map((item) => {
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
                    ref={panelRef}
                    className="absolute left-1/2 top-full mt-3 bg-white rounded-3xl shadow-2xl border border-[#dcfce7] p-6 sm:p-8 grid gap-6 sm:gap-8"
                    style={{
                      gridTemplateColumns: item.columns.length === 1 ? "1fr" : `repeat(${item.columns.length}, minmax(160px, 1fr))`,
                      // `width` rather than `minWidth`: a min-width beats a max-width in
                      // CSS, so a min-width panel stays too wide to fit a narrow window.
                      width: `min(${item.columns.length >= 3 ? 760 : (item.columns.length === 2 ? 560 : 320)}px, calc(100vw - 24px))`,
                      transform: `translateX(calc(-50% + ${panelShift}px))`,
                    }}
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

        <form onSubmit={submitSearch} className="flex items-center">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search"
            className="w-10 h-10 grid place-items-center rounded-full hover:bg-[#f0fdf4] text-[#1a1a1a] flex-shrink-0"
            data-testid="nav-search-trigger"
          >
            <Search size={18} />
          </button>
        </form>

        <AccountButton className="ml-2" />
        <CartIcon className="ml-1" />
      </div>

      {searchOpen && (
        <div className="border-t border-[#e5e7eb] bg-[#f9fafb]" data-testid="nav-search-panel">
          <form onSubmit={submitSearch} className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              className="flex-1 bg-white border border-[#dcfce7] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[#7bc67e]"
              data-testid="nav-search-input"
            />
            <button type="submit" className="text-xs font-nunito font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] rounded-full px-4 py-2.5 flex-shrink-0">Search</button>
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" className="w-8 h-8 grid place-items-center rounded-full hover:bg-[#f0fdf4] flex-shrink-0" data-testid="nav-search-close">
              <X size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Mobile slide-over — rendered into document.body via portal to escape backdrop-blur containing block */}
      {mobileOpen && typeof document !== "undefined" && createPortal(
        <div className="md:hidden fixed inset-0 z-[100] bg-black/60" onClick={() => setMobileOpen(false)} data-testid="nav-mobile-overlay">
          <div className="bg-white text-[#0a0a0a] w-[88%] max-w-sm h-full p-6 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ color: "#0a0a0a" }}>
            <div className="flex items-center justify-between mb-6">
              <Link to="/" onClick={() => setMobileOpen(false)} className="inline-flex items-center"><img src="/logo.png" alt="Your Own Print" className="h-9 w-auto" /></Link>
              <button onClick={() => setMobileOpen(false)} className="w-9 h-9 grid place-items-center rounded-full bg-[#f0fdf4] text-[#0a0a0a]" data-testid="nav-mobile-close" aria-label="Close menu"><X size={18} /></button>
            </div>
            <div className="space-y-1">
              {menu.map((item) => (
                <div key={item.key} className="border-b border-[#f0fdf4] last:border-b-0">
                  {item.columns ? (
                    <details className="group">
                      <summary className="font-extrabold text-base py-3 cursor-pointer flex items-center justify-between list-none text-[#0a0a0a]" data-testid={`nav-mobile-group-${item.key}`}>
                        <span className="text-[#0a0a0a]">{item.label}</span>
                        <ChevronDown size={18} className="text-[#7bc67e] group-open:rotate-180 transition-transform" />
                      </summary>
                      <ul className="pl-2 pb-3 space-y-1.5">
                        {item.columns.flatMap((c) => c.links.map((lnk) => ({ ...lnk, _heading: c.heading }))).map((lnk, i, arr) => (
                          <React.Fragment key={`${lnk.to}-${i}`}>
                            {(i === 0 || arr[i - 1]._heading !== lnk._heading) && (
                              <li className="pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-[#5eb062] font-extrabold">{lnk._heading}</li>
                            )}
                            <li>
                              <Link to={lnk.to} onClick={() => setMobileOpen(false)} className="block text-sm py-1.5 text-[#0a0a0a] hover:text-[#7bc67e] font-bold" style={{ color: "#0a0a0a" }} data-testid={`nav-mobile-link-${lnk.to.replace(/\W+/g, "-")}`}>
                                <span className="text-[#0a0a0a]">{lnk.label}</span>
                                {lnk.badge && <span className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-extrabold bg-[#fde68a] text-[#0a0a0a]">{lnk.badge}</span>}
                              </Link>
                            </li>
                          </React.Fragment>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Link to={item.to} onClick={() => setMobileOpen(false)} className={`block font-extrabold text-base py-3 ${item.cta ? "text-[#5eb062]" : "text-[#0a0a0a]"}`} style={{ color: item.cta ? "#5eb062" : "#0a0a0a" }} data-testid={`nav-mobile-${item.key}`}>
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}

// The logo is dark artwork on a light background, so on the black footer it had
// to sit in a white patch that read as a sticker stuck on the page. A wordmark
// set in the brand colours belongs there instead — same identity, no box.
const WORDMARK = [
  ["YOUR", "#D85A30"], ["OWN", "#378ADD"], ["PRINT", "#7bc67e"],
];

// Only platforms with a link saved in the admin are rendered, so an unused one
// never shows as a dead icon pointing at "#".
const SOCIALS = [
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "instagram", label: "Instagram", Icon: Instagram },
  { key: "tiktok", label: "TikTok", Icon: Music2 },
  { key: "youtube", label: "YouTube", Icon: Youtube },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { key: "x", label: "X", Icon: Twitter },
];

export function BoldFooter() {
  const footerCopy = usePageCopy("site-footer", {});
  const extras = footerCopy.extras || {};
  const links = SOCIALS.filter((sn) => (extras[sn.key] || "").trim());

  return (
    <footer className="bg-[#1a1a1a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-5 gap-8">
        <div>
          <Link to="/" className="inline-flex items-baseline font-nunito font-black text-2xl tracking-tight" aria-label="Your Own Print — home">
            {WORDMARK.map(([text, colour]) => (
              <span key={text} style={{ color: colour }}>{text}</span>
            ))}
            <span className="text-neutral-500 text-sm ml-1">.co.uk</span>
          </Link>
          <p className="mt-3 text-sm text-neutral-300">Custom print & workwear, based in Leicester — delivering across the whole of the UK.</p>
          {links.length > 0 && (
            <div className="flex gap-3 mt-4" data-testid="footer-socials">
              {links.map(({ key, label, Icon }) => (
                <a
                  key={key}
                  href={extras[key]}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  title={label}
                  data-testid={`footer-social-${key}`}
                  className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-[#7bc67e] hover:text-black transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol title="Shop" links={[["Workwear", "/workwear"], ["Teams & Schools", "/teams-schools"], ["Design Your Own", "/design"]]} />
        <FooterCol title="Help" links={[["Get a Quote", "/contact"], ["Contact", "/contact"], ["Reviews", "/reviews"]]} />
        <FooterCol title="Policies" links={[["Terms & Conditions", "/terms"], ["Privacy Policy", "/privacy"], ["Delivery & Returns", "/returns"]]} />
        <div>
          <div className="font-nunito font-bold text-sm text-neutral-400 mb-3">Payments</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {["Visa", "Mastercard", "Amex", "Apple Pay", "Stripe"].map(p => <span key={p} className="px-3 py-1.5 bg-white/10 rounded-full">{p}</span>)}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-400">
        <div>© {new Date().getFullYear()} Your Own Print</div>
        <div className="mt-1">
          Site made by{" "}
          <a
            href="https://www.weavixstudio.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-neutral-300 hover:text-[#7bc67e] underline underline-offset-2 transition-colors"
            data-testid="footer-credit"
          >
            Weavix Studio
          </a>
        </div>
      </div>
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
