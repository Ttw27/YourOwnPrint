import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import ToolsShowcase from "../components/bold/ToolsShowcase";
import { fetchSportsTeam } from "../lib/api";
import { ArrowRight, ShieldCheck, Loader2, Truck, Package, CheckCircle2, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import FacetBlock from "../components/bold/FacetBlock";
import { useSiteImages } from "../hooks/usePageCopy";
import SiteImage from "../components/bold/SiteImage";

// 12 fills the 2 / 3 / 4-column grid evenly at every breakpoint, so no page
// ends with an orphan on a row of its own.
const PAGE_SIZE = 12;
const GENDER_LABEL = { mens: "Men's", womens: "Women's", unisex: "Unisex", kids: "Kids" };

export default function SportsTeamDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  // Header photo is admin-editable under
  // /admin/page-copy → "Pictures used across the whole site".
  const site = useSiteImages();

  const [page, setPage] = useState(0);
  const [params, setParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filters live in the URL rather than component state, so a filtered view
  // can be linked, bookmarked and survives the back button.
  const filters = useMemo(() => ({
    gender_fit: params.get("gender_fit") || "",
    colour: params.get("colour") || "",
    size: params.get("size") || "",
    category: params.get("category") || "",
    price_min: params.get("price_min") || "",
    price_max: params.get("price_max") || "",
  }), [params]);

  const load = useCallback(() => {
    setLoading(true); setErr(false);
    const opts = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
    Object.entries(filters).forEach(([k, v]) => { if (v) opts[k] = v; });
    fetchSportsTeam(slug, opts)
      .then(setData).catch(() => setErr(true)).finally(() => setLoading(false));
  }, [slug, page, filters]);

  useEffect(() => { load(); }, [load]);

  // Narrowing the filters can leave you past the end of the new result set,
  // which shows an empty grid rather than "nothing matches".
  useEffect(() => { setPage(0); }, [filters]);

  const patch = (patchObj) => {
    const next = new URLSearchParams(params);
    Object.entries(patchObj).forEach(([k, v]) => {
      if (v === null || v === "" || v === undefined) next.delete(k);
      else next.set(k, v);
    });
    setParams(next, { replace: true });
  };

  const toggleMulti = (key, value) => {
    const current = new Set((params.get(key) || "").split(",").filter(Boolean));
    if (current.has(value)) current.delete(value); else current.add(value);
    patch({ [key]: current.size ? [...current].join(",") : "" });
  };

  const isChecked = (key, value) => new Set((params.get(key) || "").split(",").filter(Boolean)).has(value);
  const clearAll = () => setParams({}, { replace: true });
  const activeCount = ["gender_fit", "colour", "size", "category", "price_min", "price_max"]
    .reduce((n, k) => n + (params.get(k) ? 1 : 0), 0);

  // Switching landing page has to reset the page number, or arriving on Gyms
  // from page 3 of Football shows an empty grid.
  useEffect(() => { setPage(0); }, [slug]);

  const facets = data?.facets || {};
  // matched_total is the count after filtering; total is the whole lineup.
  const totalProducts = data?.matched_total ?? data?.total ?? (data?.products?.length || 0);
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));

  // Windowed page numbers, so a long catalogue doesn't print 30 buttons.
  const pageNumbers = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalPages; i++) {
      if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2) out.push(i);
      else if (out[out.length - 1] !== "gap") out.push("gap");
    }
    return out;
  }, [totalPages, page]);

  // SEO: dynamic title + meta description + FAQ schema
  useEffect(() => {
    if (!data) return;
    document.title = `${data.title} | Your Own Print — UK Custom Print`;
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", data.intro);

    // Inject FAQPage schema (single instance per route)
    const SCHEMA_ID = `faq-schema-${slug}`;
    document.querySelectorAll("script[data-yop-schema]").forEach((n) => n.remove());
    if (data.faqs?.length) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-yop-schema", "1");
      script.setAttribute("id", SCHEMA_ID);
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": data.faqs.map((f) => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      });
      document.head.appendChild(script);
    }
    return () => {
      document.querySelectorAll("script[data-yop-schema]").forEach((n) => n.remove());
    };
  }, [data, slug]);

  if (err) return (
    <div className="bg-white min-h-screen" data-testid="sports-team-error">
      <BoldNavbar />
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm">
            Couldn't load this page right now. <button onClick={load} className="underline text-[#166534] font-extrabold">Try again</button>, or <Link to="/team-kits" className="underline text-[#166534] font-extrabold">see team kits</Link>.
          </div>
        </div>
      </div>
    </div>
  );
  if (loading || !data) {
    return <div className="min-h-screen grid place-items-center bg-white" data-testid="sports-team-loading"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  }

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid={`sports-team-${slug}`}>
      <BoldNavbar />

      {/* Hero */}
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0 opacity-30">
          <SiteImage src={site.image(`sportsteam:${data.slug || slug}`, data.hero_image)} className="w-full h-full object-cover" testid="sports-team-hero-image" placeholderClassName="bg-transparent" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/85 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-24">
          <Link to="/team-kits" className="text-xs text-[#7bc67e] hover:underline" data-testid="sports-team-back">← Back to Team Kits</Link>
          <div className="text-[#7bc67e] font-extrabold mt-3 text-xs uppercase tracking-[0.3em]">{data.subtitle}</div>
          <h1 className="font-black text-4xl lg:text-6xl mt-1 leading-tight max-w-3xl">{data.h1}</h1>
          <p className="text-zinc-300 mt-4 max-w-2xl leading-relaxed">{data.intro}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {(() => {
              // Football / Rugby (team sports) → Full Squad Configurator.
              // Gyms / PTs / Boxing / Thai / Kick / Dance → Sports Outfit Configurator (simpler).
              const teamSlugs = ["football", "rugby"];
              const cfgTo = teamSlugs.includes(slug) ? "/full-squad-configurator" : "/sports-outfit-configurator";
              const cfgLabel = teamSlugs.includes(slug) ? "Full Squad Configurator" : "Sports Outfit Configurator";
              return (
                <Link to={cfgTo} className="px-5 py-3 bg-[#7bc67e] text-[#1a1a1a] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-white transition" data-testid="sports-team-cta-configure">
                  {cfgLabel} <ArrowRight size={16} />
                </Link>
              );
            })()}
            <Link to="/contact" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-extrabold inline-flex items-center gap-2 transition" data-testid="sports-team-cta-quote">
              Get a free mock-up
            </Link>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-300">
            <ShieldCheck size={14} className="text-[#7bc67e]" /> UK printed · free artwork proof · low minimums
          </div>
        </div>
      </header>

      {/* Trust band */}
      <section className="bg-[#f0fdf4] border-y border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <TrustItem icon={<Truck size={16} />} label="UK printed & dispatched" />
          <TrustItem icon={<Package size={16} />} label="No minimum order" />
          <TrustItem icon={<CheckCircle2 size={16} />} label="Free artwork proof" />
          <TrustItem icon={<ShieldCheck size={16} />} label="Tested kit, washable hot" />
        </div>
      </section>

      {/* SEO content paragraph */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black mb-3">Why teams choose us for {data.title.toLowerCase()}</h2>
        <p className="text-[#4b5563] leading-relaxed">{data.seo_paragraph}</p>
      </section>

      {/* Products grid */}
      {(data.total ?? 0) > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
            <h2 className="text-2xl font-black">Shop the lineup</h2>
            {totalProducts > 0 && (
              <span className="text-xs text-[#4b5563]" data-testid="sports-team-product-count">
                Showing {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, totalProducts)} of {totalProducts}
                {activeCount > 0 && ` (filtered from ${data.total})`}
              </span>
            )}
          </div>

          <button
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="lg:hidden w-full mb-4 inline-flex items-center justify-center gap-2 border-2 border-[#dcfce7] rounded-full px-4 py-2.5 text-sm font-extrabold"
            data-testid="sports-team-mobile-filter-toggle"
          >
            <SlidersHorizontal size={14} /> {mobileFiltersOpen ? "Hide filters" : "Show filters"}
            {activeCount > 0 && <span className="bg-[#7bc67e] text-[#1a1a1a] rounded-full px-2 text-[10px]">{activeCount}</span>}
          </button>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Collapsed by default on mobile — expanded, the sidebar pushes the
                products off the bottom of the screen before anything is seen. */}
            <aside className={`lg:col-span-3 ${mobileFiltersOpen ? "" : "hidden lg:block"}`} data-testid="sports-team-sidebar">
              <div className="sticky top-24 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Filter</h3>
                  {activeCount > 0 && (
                    <button onClick={clearAll} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1" data-testid="sports-team-clear-filters">
                      <X size={11} /> Clear
                    </button>
                  )}
                </div>

                {facets.category && facets.category.length > 1 && (
                  <FacetBlock title="Product type" testid="facet-category" collapsibleThreshold={8} items={facets.category}>
                    {(shown) => shown.map((f) => (
                      <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer capitalize" data-testid={`facet-category-${f.value}`}>
                        <input type="radio" name="category" checked={filters.category === f.value} onChange={() => patch({ category: filters.category === f.value ? "" : f.value })} className="accent-[#7bc67e]" />
                        <span className="flex-1">{String(f.value).replace(/-/g, " ")}</span>
                        <span className="text-[10px] text-[#4b5563]">{f.count}</span>
                      </label>
                    ))}
                  </FacetBlock>
                )}

                {facets.gender_fit && (
                  <FacetBlock title="Fit" testid="facet-gender">
                    <label className="flex items-center gap-2 text-xs cursor-pointer" data-testid="facet-gender-all">
                      <input type="radio" name="gender_fit" checked={!filters.gender_fit} onChange={() => patch({ gender_fit: "" })} className="accent-[#7bc67e]" />
                      <span>All fits</span>
                    </label>
                    {facets.gender_fit.map((f) => (
                      <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer" data-testid={`facet-gender-${f.value}`}>
                        <input type="radio" name="gender_fit" checked={filters.gender_fit === f.value} onChange={() => patch({ gender_fit: f.value })} className="accent-[#7bc67e]" />
                        <span className="flex-1">{GENDER_LABEL[f.value] || f.value}</span>
                        <span className="text-[10px] text-[#4b5563]">{f.count}</span>
                      </label>
                    ))}
                  </FacetBlock>
                )}

                {facets.colour && (
                  <FacetBlock title="Colour" testid="facet-colour" collapsibleThreshold={8} items={facets.colour}>
                    {(shown) => shown.map((f) => (
                      <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer" data-testid={`facet-colour-${f.value}`}>
                        <input type="checkbox" checked={isChecked("colour", f.value)} onChange={() => toggleMulti("colour", f.value)} className="accent-[#7bc67e]" />
                        <span className="flex-1">{f.value}</span>
                        <span className="text-[10px] text-[#4b5563]">{f.count}</span>
                      </label>
                    ))}
                  </FacetBlock>
                )}

                {facets.size && (
                  <FacetBlock title="Size" testid="facet-size" collapsibleThreshold={8} items={facets.size}>
                    {(shown) => (
                      <div className="grid grid-cols-3 gap-1.5">
                        {shown.map((f) => {
                          const active = isChecked("size", f.value);
                          return (
                            <button key={f.value} type="button" onClick={() => toggleMulti("size", f.value)} className={`text-xs px-2 py-1 rounded-full border-2 font-extrabold transition ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`} data-testid={`facet-size-${f.value}`}>
                              {f.value}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </FacetBlock>
                )}

                {facets.price_range && (
                  <FacetBlock title={`Price (£${facets.price_range.min} - £${facets.price_range.max})`} testid="facet-price">
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={facets.price_range.min} max={facets.price_range.max} placeholder={`£${facets.price_range.min}`} defaultValue={filters.price_min} onBlur={(e) => patch({ price_min: e.target.value })} className="w-full text-xs px-2 py-1 rounded-lg border-2 border-[#dcfce7] focus:border-[#7bc67e] focus:outline-none" data-testid="facet-price-min" />
                      <span className="text-xs text-[#4b5563]">to</span>
                      <input type="number" min={facets.price_range.min} max={facets.price_range.max} placeholder={`£${facets.price_range.max}`} defaultValue={filters.price_max} onBlur={(e) => patch({ price_max: e.target.value })} className="w-full text-xs px-2 py-1 rounded-lg border-2 border-[#dcfce7] focus:border-[#7bc67e] focus:outline-none" data-testid="facet-price-max" />
                    </div>
                  </FacetBlock>
                )}
              </div>
            </aside>

            <div className="lg:col-span-9">
              {data.products?.length === 0 ? (
                <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-8 text-center" data-testid="sports-team-no-matches">
                  <div className="font-extrabold">Nothing matches those filters</div>
                  <p className="text-sm text-[#4b5563] mt-1">Try loosening one, or clear them to see the full lineup.</p>
                  {activeCount > 0 && (
                    <button onClick={clearAll} className="mt-3 text-sm font-extrabold text-[#166534] hover:underline">Clear filters</button>
                  )}
                </div>
              ) : (
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4" data-testid="sports-team-products">
            {data.products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md"
                data-testid={`sports-team-product-${p.id}`}
              >
                <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                  <SiteImage src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" testid={`sports-team-product-image-${p.id}`} />
                </div>
                <div className="p-4">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#7bc67e]">{p.category}</div>
                  <div className="font-extrabold text-base mt-0.5">{p.name}</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-xl font-black">£{p.price.toFixed(2)}</div>
                    <span className="text-xs inline-flex items-center gap-1 text-[#7bc67e] font-extrabold group-hover:translate-x-0.5 transition-transform">View <ArrowRight size={12} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
              )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap" data-testid="sports-team-pagination">
              <button
                type="button"
                onClick={() => setPage((n) => Math.max(0, n - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 px-2 py-1.5"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              {pageNumbers.map((n, i) =>
                n === "gap" ? (
                  <span key={`gap-${i}`} className="px-1.5 text-[#4b5563]">&hellip;</span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === page ? "page" : undefined}
                    data-testid={`sports-team-page-${n + 1}`}
                    className={`min-w-[36px] px-2.5 py-1.5 rounded-full text-sm font-extrabold transition-colors ${
                      n === page
                        ? "bg-[#7bc67e] text-[#1a1a1a]"
                        : "border-2 border-[#dcfce7] hover:border-[#7bc67e] text-[#1a1a1a]"
                    }`}
                  >
                    {n + 1}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((n) => Math.min(totalPages - 1, n + 1))}
                disabled={page + 1 >= totalPages}
                className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 px-2 py-1.5"
              >
              Next <ChevronRight size={15} />
              </button>
            </div>
          )}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {data.faqs?.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-16" data-testid="sports-team-faqs">
          <h2 className="text-2xl font-black mb-5">Frequently asked</h2>
          <div className="divide-y divide-[#e5e7eb] border-2 border-[#dcfce7] rounded-3xl bg-white">
            {data.faqs.map((f, i) => (
              <details key={i} className="group p-5">
                <summary className="cursor-pointer font-extrabold text-base flex items-center justify-between" data-testid={`sports-team-faq-${i}`}>
                  {f.q}
                  <span className="ml-3 text-[#7bc67e] group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-[#4b5563] mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <ToolsShowcase variant="compact" />
      <BoldFooter />
    </div>
  );
}

function TrustItem({ icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-extrabold">
      <span className="text-[#7bc67e]">{icon}</span>
      {label}
    </div>
  );
}
