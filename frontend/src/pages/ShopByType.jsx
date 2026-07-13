import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BoldNavbar, BoldFooter, StarRating } from "../components/bold/BoldLayout";
import ToolsShowcase from "../components/bold/ToolsShowcase";
import { fetchShopByType, fetchReviewsAggregate } from "../lib/api";
import { ArrowRight, Loader2, X, ChevronDown } from "lucide-react";

/**
 * /shop/:slug — Collection page.
 * Left sidebar auto-derives facets from the products in the collection (only shows a
 * facet if there's variance). SEO copy block at the bottom (admin-editable).
 */

const GENDER_LABEL = { mens: "Men's", womens: "Women's", unisex: "Unisex", kids: "Kids" };
const PAGE_SIZE = 25;

export default function ShopByType() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);
  const [aggregates, setAggregates] = useState({});

  useEffect(() => { fetchReviewsAggregate().then(setAggregates).catch(() => {}); }, []);

  // Read filter state from URL so it's shareable / back-forward friendly.
  const filters = useMemo(() => ({
    gender_fit: params.get("gender_fit") || "",
    colour: params.get("colour") || "",
    size: params.get("size") || "",
    industry: params.get("industry") || "",
    price_min: params.get("price_min") || "",
    price_max: params.get("price_max") || "",
  }), [params]);

  // Any filter change resets back to page 1.
  useEffect(() => { setPage(0); }, [filters]);

  const fetch = useCallback(() => {
    setLoading(true); setErr(false);
    const opts = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
    Object.entries(filters).forEach(([k, v]) => { if (v) opts[k] = v; });
    fetchShopByType(slug, opts).then(setData).catch(() => setErr(true)).finally(() => setLoading(false));
  }, [slug, filters, page]);

  useEffect(() => { fetch(); }, [fetch]);

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
  const activeCount = ["gender_fit", "colour", "size", "industry", "price_min", "price_max"]
    .reduce((n, k) => n + (params.get(k) ? 1 : 0), 0);

  if (err) return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6" data-testid="shop-type-error">
      <div className="text-center max-w-md">
        <BoldNavbar />
        <div className="mt-24 bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm">
          Couldn't load this collection right now. <button onClick={fetch} className="underline text-[#166534] font-extrabold">Try again</button>, or <Link to="/" className="underline text-[#166534] font-extrabold">go home</Link>.
        </div>
      </div>
    </div>
  );
  if (loading && !data) return <div className="min-h-screen grid place-items-center bg-white" data-testid="shop-type-loading"><Loader2 className="animate-spin text-[#7bc67e]" /></div>;
  if (!data) return null;

  const { title, image, products, facets = {}, seo = {}, total, matched_total } = data;

  return (
    <div className="bg-white min-h-screen text-[#1a1a1a] font-nunito" data-testid={`shop-type-${slug}`}>
      <BoldNavbar />

      {/* Hero */}
      <header className="relative overflow-hidden bg-[#1a1a1a] text-white">
        {image && <div className="absolute inset-0 opacity-25"><img src={image} alt="" className="w-full h-full object-cover" /></div>}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/85 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 py-14">
          <Link to="/" className="text-xs text-[#7bc67e] hover:underline" data-testid="shop-type-back">&larr; Home</Link>
          <h1 className="font-black text-5xl lg:text-6xl mt-3">{title}</h1>
          <div className="text-zinc-300 mt-2">
            {products.length} of {total} {total === 1 ? "option" : "options"}
            {activeCount > 0 && <span className="ml-2 inline-flex items-center gap-1 bg-white/10 rounded-full px-2 py-0.5 text-[10px] font-extrabold">{activeCount} filter{activeCount === 1 ? "" : "s"} active <button onClick={clearAll} className="ml-1 text-[#fbbf24] hover:underline">Clear</button></span>}
          </div>
          {seo.intro && (
            <p className="mt-4 text-zinc-300 max-w-2xl">{seo.intro}</p>
          )}
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-8 grid lg:grid-cols-12 gap-6">
        {/* Sidebar filters */}
        <aside className="lg:col-span-3" data-testid="shop-type-sidebar">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-extrabold">Filter</h3>
              {activeCount > 0 && <button onClick={clearAll} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1" data-testid="shop-clear-filters"><X size={11} /> Clear</button>}
            </div>

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

            {facets.industry && (
              <FacetBlock title="Industry" testid="facet-industry" collapsibleThreshold={5} items={facets.industry}>
                {(shown) => shown.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer capitalize" data-testid={`facet-industry-${f.value}`}>
                    <input type="checkbox" checked={isChecked("industry", f.value)} onChange={() => toggleMulti("industry", f.value)} className="accent-[#7bc67e]" />
                    <span className="flex-1">{String(f.value).replace(/-/g, " ")}</span>
                    <span className="text-[10px] text-[#4b5563]">{f.count}</span>
                  </label>
                ))}
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

        {/* Product grid */}
        <div className="lg:col-span-9" data-testid="shop-type-results">
          {products.length === 0 ? (
            <div className="bg-[#fff7ed] border-2 border-[#fed7aa] rounded-2xl p-6 text-sm" data-testid="shop-type-empty">
              Nothing matches those filters. Try clearing them or <button onClick={clearAll} className="underline text-[#166534] font-extrabold">reset all</button>.
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="shop-type-grid">
                {products.map((p) => {
                  const agg = aggregates[p.id];
                  return (
                  <Link key={p.id} to={`/product/${p.id}`} className="group bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-3xl overflow-hidden transition-shadow hover:shadow-md" data-testid={`shop-type-product-${p.id}`}>
                    <div className="aspect-square overflow-hidden bg-[#f0fdf4]">
                      <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] uppercase tracking-wider text-[#7bc67e] font-extrabold">{p.category}</div>
                      <div className="font-extrabold text-base mt-0.5">{p.name}</div>
                      {p.colors?.length > 0 && (
                        <div className="flex items-center gap-1 mt-2" data-testid={`shop-type-swatches-${p.id}`}>
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
                <div className="flex items-center justify-center gap-4 mt-8" data-testid="shop-type-pagination">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    <ChevronDown size={14} className="rotate-90" /> Prev
                  </button>
                  <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(matched_total / PAGE_SIZE)} · {matched_total} products</span>
                  <button onClick={() => setPage((p) => (p + 1) * PAGE_SIZE < matched_total ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= matched_total} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    Next <ChevronDown size={14} className="-rotate-90" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* SEO body & FAQ */}
      {(seo.body || (seo.faq && seo.faq.length)) && (
        <section className="border-t border-[#dcfce7] bg-[#f8fafc]">
          <div className="max-w-4xl mx-auto px-6 py-12" data-testid="shop-type-seo">
            {seo.body && (
              <div className="prose prose-sm max-w-none">
                <h2 className="font-black text-2xl mb-3">About our {title}</h2>
                {seo.body.split("\n\n").map((para, i) => (
                  <p key={i} className="text-[#374151] text-sm leading-relaxed mb-3">{para}</p>
                ))}
              </div>
            )}
            {seo.faq && seo.faq.length > 0 && (
              <div className="mt-8">
                <h3 className="font-black text-lg mb-3">Frequently asked</h3>
                <div className="space-y-2">
                  {seo.faq.map((f, i) => (
                    <details key={i} className="group bg-white border-2 border-[#dcfce7] rounded-2xl px-4 py-3">
                      <summary className="cursor-pointer font-extrabold text-sm flex items-center justify-between list-none">
                        <span>{f.q}</span>
                        <ArrowRight size={14} className="text-[#7bc67e] group-open:rotate-90 transition-transform" />
                      </summary>
                      <p className="mt-2 text-sm text-[#4b5563]">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <ToolsShowcase variant="compact" />
      <BoldFooter />
    </div>
  );
}

// ---------- Facet block wrapper with a "show more" affordance ----------
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
