import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import { fetchWorkwearCollection, fetchReviewsAggregate } from "../lib/api";
import { SECTORS } from "../lib/data";
import usePageCopy from "../hooks/usePageCopy";
import { ArrowRight, ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";

const PAGE_SIZE = 24;  // divides evenly by 2 / 3 / 4 — no orphan row on any screen size
const EMPTY_FILTERS = { gender_fit: "", colour: [], size: [], industry: [], price_min: "", price_max: "" };

/**
 * /workwear — the Workwear umbrella collection.
 *
 * Previously this page had no filter sidebar at all (unlike every other
 * collection page) and fetched using stale industry slugs
 * ("trades,construction,logistics") that stopped matching anything once
 * tagging was canonicalised. Now uses /collections/workwear, which returns
 * the same shape as /shop/type/{slug}, so the sidebar is identical to the
 * rest of the site.
 */
export default function Workwear() {
  const [data, setData] = useState(null);
  const [aggregates, setAggregates] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const copy = usePageCopy("workwear", {
    title: "Workwear",
    subtitle: "Trade-tough garments branded with your logo. Free print included.",
  });

  const load = useCallback(() => {
    setLoading(true); setErr(false);
    const params = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      gender_fit: filters.gender_fit || undefined,
      colour: filters.colour.length ? filters.colour.join(",") : undefined,
      size: filters.size.length ? filters.size.join(",") : undefined,
      industry: filters.industry.length ? filters.industry.join(",") : undefined,
      price_min: filters.price_min || undefined,
      price_max: filters.price_max || undefined,
    };
    Promise.all([fetchWorkwearCollection(params), fetchReviewsAggregate()])
      .then(([d, a]) => { setData(d); setAggregates(a || {}); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const patch = (next) => { setFilters((f) => ({ ...f, ...next })); setPage(0); };
  const toggleMulti = (key, value) => {
    setFilters((f) => {
      const cur = f[key] || [];
      return { ...f, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
    setPage(0);
  };
  const clearAll = () => { setFilters(EMPTY_FILTERS); setPage(0); };

  const { products = [], facets = {}, matched_total = 0 } = data || {};

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <BoldNavbar />

      <div className="relative overflow-hidden border-b border-[#dcfce7]">
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-[#7bc67e]/25 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-[#fde68a]/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="text-[#7bc67e] font-nunito font-extrabold text-sm uppercase tracking-[0.3em]">Category</div>
          <h1 className="font-nunito font-black text-5xl lg:text-7xl mt-3" data-testid="workwear-hero-title">{copy.title}</h1>
          <p className="text-[#4b5563] mt-4 max-w-xl text-lg" data-testid="workwear-hero-subtitle">{copy.subtitle}</p>
        </div>
      </div>

      {/* Sector chips — real links (these used to be inert <span>s) */}
      <div className="border-b border-[#dcfce7]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex gap-2 overflow-x-auto no-scrollbar">
          {SECTORS.map((s, i) => (
            <Link
              key={s.name}
              to={s.href || "/industries"}
              data-testid={`workwear-chip-${i}`}
              className="whitespace-nowrap px-4 py-2 rounded-full bg-[#f0fdf4] border border-[#dcfce7] text-[#1a1a1a] font-nunito font-bold text-xs hover:bg-[#7bc67e] hover:border-[#7bc67e] cursor-pointer transition-colors"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-6">
        <button
          onClick={() => setMobileFiltersOpen((v) => !v)}
          className="lg:hidden inline-flex items-center justify-center gap-2 border-2 border-[#dcfce7] rounded-full px-4 py-2.5 text-sm font-extrabold"
          data-testid="workwear-mobile-filter-toggle"
        >
          <SlidersHorizontal size={14} /> {mobileFiltersOpen ? "Hide filters" : "Show filters"}
        </button>

        {/* Sidebar — same facets as every other collection page */}
        <aside className={`lg:col-span-3 ${mobileFiltersOpen ? "" : "hidden lg:block"}`} data-testid="workwear-sidebar">
          <div className="space-y-3 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Filter</h3>
              <button onClick={clearAll} className="text-[11px] font-extrabold text-[#166534] hover:underline" data-testid="workwear-clear-filters">Clear all</button>
            </div>

            {facets.gender_fit && (
              <FacetBlock title="Fit" testid="workwear-facet-gender">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" checked={!filters.gender_fit} onChange={() => patch({ gender_fit: "" })} />
                  <span>All</span>
                </label>
                {facets.gender_fit.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer capitalize" data-testid={`workwear-facet-gender-${f.value}`}>
                    <input type="radio" checked={filters.gender_fit === f.value} onChange={() => patch({ gender_fit: f.value })} />
                    <span>{f.value} <span className="text-[#9ca3af]">({f.count})</span></span>
                  </label>
                ))}
              </FacetBlock>
            )}

            {facets.colour && (
              <FacetBlock title="Colour" testid="workwear-facet-colour" collapsibleThreshold={8} items={facets.colour}>
                {(shown) => shown.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer" data-testid={`workwear-facet-colour-${f.value}`}>
                    <input type="checkbox" checked={filters.colour.includes(f.value)} onChange={() => toggleMulti("colour", f.value)} />
                    <span>{f.value} <span className="text-[#9ca3af]">({f.count})</span></span>
                  </label>
                ))}
              </FacetBlock>
            )}

            {facets.size && (
              <FacetBlock title="Size" testid="workwear-facet-size" collapsibleThreshold={8} items={facets.size}>
                {(shown) => (
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map((f) => {
                      const active = filters.size.includes(f.value);
                      return (
                        <button key={f.value} type="button" onClick={() => toggleMulti("size", f.value)} className={`text-xs px-2 py-1 rounded-full border-2 font-extrabold transition ${active ? "border-[#7bc67e] bg-[#f0fdf4]" : "border-[#dcfce7] hover:border-[#7bc67e]"}`} data-testid={`workwear-facet-size-${f.value}`}>
                          {f.value}
                        </button>
                      );
                    })}
                  </div>
                )}
              </FacetBlock>
            )}

            {facets.industry && (
              <FacetBlock title="Industry" testid="workwear-facet-industry" collapsibleThreshold={5} items={facets.industry}>
                {(shown) => shown.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer capitalize" data-testid={`workwear-facet-industry-${f.value}`}>
                    <input type="checkbox" checked={filters.industry.includes(f.value)} onChange={() => toggleMulti("industry", f.value)} />
                    <span>{f.value.replace(/-/g, " ")} <span className="text-[#9ca3af]">({f.count})</span></span>
                  </label>
                ))}
              </FacetBlock>
            )}

            {facets.price_range && (
              <FacetBlock title={`Price (£${facets.price_range.min} - £${facets.price_range.max})`} testid="workwear-facet-price">
                <div className="flex items-center gap-2">
                  <input type="number" min={facets.price_range.min} max={facets.price_range.max} placeholder={`£${facets.price_range.min}`} defaultValue={filters.price_min} onBlur={(e) => patch({ price_min: e.target.value })} className="w-full text-xs px-2 py-1 rounded-lg border-2 border-[#dcfce7] focus:border-[#7bc67e] focus:outline-none" data-testid="workwear-facet-price-min" />
                  <span className="text-xs text-[#9ca3af]">to</span>
                  <input type="number" min={facets.price_range.min} max={facets.price_range.max} placeholder={`£${facets.price_range.max}`} defaultValue={filters.price_max} onBlur={(e) => patch({ price_max: e.target.value })} className="w-full text-xs px-2 py-1 rounded-lg border-2 border-[#dcfce7] focus:border-[#7bc67e] focus:outline-none" data-testid="workwear-facet-price-max" />
                </div>
              </FacetBlock>
            )}
          </div>
        </aside>

        {/* Results */}
        <div className="lg:col-span-9" data-testid="workwear-results">
          {loading ? (
            <div className="text-[#4b5563] text-sm"><Loader2 size={15} className="inline animate-spin mr-2" /> Loading workwear…</div>
          ) : err ? (
            <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm" data-testid="workwear-error">
              Couldn&rsquo;t load these products. <button onClick={load} className="underline text-[#166534] font-extrabold">Try again</button>.
            </div>
          ) : products.length === 0 ? (
            <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm" data-testid="workwear-empty">
              Nothing matches those filters. Try clearing them or <button onClick={clearAll} className="underline text-[#166534] font-extrabold">reset all</button>.
            </div>
          ) : (
            <>
              <div className="text-xs text-[#4b5563] mb-4 font-bold">{matched_total} product{matched_total === 1 ? "" : "s"}</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" data-testid="workwear-grid">
                {products.map((p) => {
                  const agg = aggregates[p.id];
                  return (
                    <Link key={p.id} to={`/product/${p.id}`} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md" data-testid={`workwear-product-${p.id}`}>
                      <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                        <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      <div className="p-4">
                        <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold">{p.category}</div>
                        <div className="font-extrabold text-base mt-0.5">{p.name}</div>
                        {p.colors?.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {p.colors.slice(0, 6).map((c, i) => (
                              <span key={i} title={c.name} className="w-3.5 h-3.5 rounded-full border border-[#e5e7eb]" style={{ background: c.hex || "#ccc" }} />
                            ))}
                            {p.colors.length > 6 && <span className="text-[10px] text-[#4b5563] ml-0.5">+{p.colors.length - 6}</span>}
                          </div>
                        )}
                        {agg?.count > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <StarRating value={agg.average} size={11} />
                            <span className="text-[10px] text-[#4b5563]">{agg.count} review{agg.count === 1 ? "" : "s"}</span>
                          </div>
                        )}
                        <div className="mt-2 flex items-baseline justify-between">
                          <div className="text-xl font-black">£{p.price.toFixed(2)}</div>
                          <span className="text-xs inline-flex items-center gap-1 text-[#7bc67e] font-extrabold group-hover:translate-x-0.5 transition-transform">View <ArrowRight size={12} /></span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {matched_total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-4 mt-8" data-testid="workwear-pagination">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    <ChevronDown size={14} className="rotate-90" /> Prev
                  </button>
                  <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(matched_total / PAGE_SIZE)} · {matched_total} products</span>
                  <button onClick={() => setPage((p) => ((p + 1) * PAGE_SIZE < matched_total ? p + 1 : p))} disabled={(page + 1) * PAGE_SIZE >= matched_total} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    Next <ChevronDown size={14} className="-rotate-90" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BoldFooter />
    </div>
  );
}

function FacetBlock({ title, testid, children, collapsibleThreshold, items }) {
  const [expanded, setExpanded] = useState(false);
  const canCollapse = collapsibleThreshold && items && items.length > collapsibleThreshold;
  const shown = canCollapse && !expanded ? items.slice(0, collapsibleThreshold) : (items || null);
  return (
    <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-3" data-testid={testid}>
      <div className="text-xs font-extrabold mb-2">{title}</div>
      <div className="space-y-1.5">
        {typeof children === "function" ? children(shown) : children}
      </div>
      {canCollapse && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className="mt-2 text-[11px] font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1" data-testid={`${testid}-toggle`}>
          {expanded ? "Show less" : `Show all ${items.length}`} <ChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
