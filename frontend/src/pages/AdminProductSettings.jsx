import React, { useEffect, useState } from "react";
import { fetchAllProductsAdmin, updateProductMeta, fetchBulkDefaults, updateBulkDefaults, ALL_PLACEMENTS, PLACEMENT_LABELS, fetchWorkforceTiers, updateWorkforceTiers, GENDER_FIT_VALUES, INDUSTRY_SLUGS, patchProductOverride, clearProductOverride, fetchProductOverride, suggestCrossSell } from "../lib/api";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Sparkles, Briefcase, Pencil, RotateCcw, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

const PAGE_SIZE = 25;
const CATEGORY_OPTIONS = [
  "t-shirts", "shirts", "hoodies", "polos", "sweatshirts", "jackets", "hi-vis",
  "shorts", "bottoms", "aprons", "hats", "footwear", "towels",
  "promotional", "kids-baby", "accessories",
];

export default function AdminProductSettings() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [allProductsLite, setAllProductsLite] = useState([]); // {id, name} across the WHOLE catalogue — for cross-sell pickers only, never rendered as one giant list
  const [defaults, setDefaults] = useState({ tiers: [] });
  const [workforce, setWorkforce] = useState({ tiers: [], quote_threshold: 100 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  // Debounce the search box so we're not firing a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 350);
    return () => clearTimeout(t);
  }, [filter]);

  const reload = async (opts = {}) => {
    const targetPage = opts.page ?? page;
    setLoading(true);
    try {
      const [ps, ds, wf] = await Promise.all([
        fetchAllProductsAdmin(targetPage * PAGE_SIZE, PAGE_SIZE, debouncedFilter),
        fetchBulkDefaults(),
        fetchWorkforceTiers().catch(() => null),
      ]);
      setProducts(ps.items || []);
      setTotal(ps.total || 0);
      setDefaults(ds);
      if (wf) setWorkforce({ tiers: wf.tiers || [], quote_threshold: wf.quote_threshold || 100 });
    } finally { setLoading(false); }
  };

  // Fetch the whole catalogue's id+name once, for the cross-sell search pickers
  // (id+name only is cheap even for thousands of products — it's rendering
  // them all as buttons that was slow, so that no longer happens).
  const loadAllLite = async () => {
    try {
      const d = await fetchAllProductsAdmin(0, 5000, "");
      setAllProductsLite((d.items || []).map(p => ({ id: p.id, name: p.name })));
    } catch { /* non-critical — pickers just show fewer suggestions */ }
  };

  useEffect(() => { loadAllLite(); }, []);
  useEffect(() => { setPage(0); reload({ page: 0 }); }, [debouncedFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload({ page }); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id, patch) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, ...patch } : p));

  const addRow = (id) => update(id, { size_guide_table: [...(products.find(p => p.id === id).size_guide_table || []), { size: "", chest: "", length: "" }] });
  const setRow = (id, i, k, v) => {
    const p = products.find(x => x.id === id);
    const t = [...(p.size_guide_table || [])];
    t[i] = { ...t[i], [k]: k === "size" ? v : (Number(v) || v) };
    update(id, { size_guide_table: t });
  };
  const delRow = (id, i) => update(id, { size_guide_table: (products.find(p => p.id === id).size_guide_table || []).filter((_, j) => j !== i) });

  const addOverride = (id) => update(id, { bulk_pricing_overrides: [...(products.find(p => p.id === id).bulk_pricing_overrides || []), { min_qty: 10, pct: 10 }] });
  const setOverride = (id, i, k, v) => {
    const p = products.find(x => x.id === id);
    const o = [...(p.bulk_pricing_overrides || [])];
    o[i] = { ...o[i], [k]: Number(v) || 0 };
    update(id, { bulk_pricing_overrides: o });
  };
  const delOverride = (id, i) => update(id, { bulk_pricing_overrides: (products.find(p => p.id === id).bulk_pricing_overrides || []).filter((_, j) => j !== i) });

  const save = async (p) => {
    setBusy(true);
    try {
      await updateProductMeta(p.id, {
        brand: p.brand || "",
        sku: p.sku || "",
        description_full: p.description_full || "",
        size_guide_image: p.size_guide_image || "",
        size_guide_table: p.size_guide_table || [],
        bulk_pricing_enabled: !!p.bulk_pricing_enabled,
        bulk_pricing_overrides: (p.bulk_pricing_overrides || []).length ? p.bulk_pricing_overrides : null,
        allowed_placements: Array.isArray(p.allowed_placements) ? p.allowed_placements : ALL_PLACEMENTS,
        workforce_eligible: !!p.workforce_eligible,
        specials_eligible: !!p.specials_eligible,
        also_bought: Array.isArray(p.also_bought) ? p.also_bought : [],
        match_with: Array.isArray(p.match_with) ? p.match_with : [],
        gender_fit: p.gender_fit || "unisex",
        industry_tags: Array.isArray(p.industry_tags) ? p.industry_tags : [],
      });
      toast.success(`${p.name} saved`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const saveDefaults = async () => {
    setBusy(true);
    try { await updateBulkDefaults({ tiers: defaults.tiers.map(t => ({ min_qty: Number(t.min_qty), pct: Number(t.pct) })) }); toast.success("Bulk defaults saved"); }
    catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const saveWorkforce = async () => {
    setBusy(true);
    try {
      await updateWorkforceTiers({
        tiers: (workforce.tiers || []).map(t => ({ min_qty: Number(t.min_qty), pct: Number(t.pct) })),
        quote_threshold: Number(workforce.quote_threshold) || 100,
      });
      toast.success("Workforce settings saved");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Admin</div>
        <h1 className="font-nunito font-black text-4xl lg:text-5xl mt-2">Product settings</h1>
        <p className="text-[#4b5563] mt-3 max-w-2xl">Set brand, SKU, full description, size guide and bulk pricing for every product.</p>

        {/* Global bulk defaults */}
        <div className="mt-6 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-3xl p-5" data-testid="aps-defaults">
          <h2 className="font-nunito font-extrabold inline-flex items-center gap-2"><Sparkles size={14} className="text-[#7bc67e]" /> Default bulk tiers (% off, snapped to £.99)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {(defaults.tiers || []).sort((a, b) => a.min_qty - b.min_qty).map((t, i) => (
              <div key={i} className="bg-white border border-[#dcfce7] rounded-xl p-2 text-xs flex items-center gap-1">
                <input data-testid={`aps-default-qty-${i}`} type="number" min={1} value={t.min_qty} onChange={(e) => setDefaults({ ...defaults, tiers: defaults.tiers.map((x, j) => i === j ? { ...x, min_qty: Number(e.target.value) } : x) })} className="w-12 bg-transparent text-right focus:outline-none font-extrabold" />
                <span>+</span>
                <span className="ml-auto">·</span>
                <input data-testid={`aps-default-pct-${i}`} type="number" min={0} max={90} value={t.pct} onChange={(e) => setDefaults({ ...defaults, tiers: defaults.tiers.map((x, j) => i === j ? { ...x, pct: Number(e.target.value) } : x) })} className="w-12 bg-transparent text-right focus:outline-none font-extrabold" />
                <span>%</span>
              </div>
            ))}
          </div>
          <button data-testid="aps-defaults-save" onClick={saveDefaults} disabled={busy} className="mt-3 inline-flex items-center gap-1 bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full"><Save size={11} /> Save defaults</button>
        </div>

        {/* Kit Your Workforce tiers */}
        <div className="mt-4 bg-[#fef3c7] border-2 border-[#fde68a] rounded-3xl p-5" data-testid="aps-workforce">
          <h2 className="font-nunito font-extrabold inline-flex items-center gap-2"><Briefcase size={14} className="text-amber-600" /> Kit Your Workforce tiers (% off total order)</h2>
          <p className="text-[11px] text-[#4b5563] mt-1">Applied across mixed garments in the workforce kit builder. Above the quote threshold, customers are routed to a quote-only flow.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {(workforce.tiers || []).slice().sort((a, b) => a.min_qty - b.min_qty).map((t, i) => (
              <div key={i} className="bg-white border border-[#fde68a] rounded-xl p-2 text-xs flex items-center gap-1">
                <input data-testid={`aps-wf-qty-${i}`} type="number" min={1} value={t.min_qty} onChange={(e) => setWorkforce({ ...workforce, tiers: workforce.tiers.map((x, j) => i === j ? { ...x, min_qty: Number(e.target.value) } : x) })} className="w-12 bg-transparent text-right focus:outline-none font-extrabold" />
                <span>+</span>
                <span className="ml-auto">·</span>
                <input data-testid={`aps-wf-pct-${i}`} type="number" min={0} max={90} value={t.pct} onChange={(e) => setWorkforce({ ...workforce, tiers: workforce.tiers.map((x, j) => i === j ? { ...x, pct: Number(e.target.value) } : x) })} className="w-12 bg-transparent text-right focus:outline-none font-extrabold" />
                <span>%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <label className="text-xs font-nunito font-extrabold inline-flex items-center gap-2">Quote-only threshold:
              <input data-testid="aps-wf-threshold" type="number" min={1} value={workforce.quote_threshold} onChange={(e) => setWorkforce({ ...workforce, quote_threshold: Number(e.target.value) })} className="w-20 bg-white border border-[#fde68a] rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500" />
              <span className="text-[#4b5563] font-normal">items+</span>
            </label>
            <button data-testid="aps-wf-save" onClick={saveWorkforce} disabled={busy} className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full"><Save size={11} /> Save workforce settings</button>
          </div>
        </div>

        <input data-testid="aps-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search products by name, brand, or SKU…" className="mt-6 bg-white border border-[#dcfce7] rounded-full px-4 py-2 text-sm w-full sm:w-96" />
        {total > 0 && <div className="text-[11px] text-[#4b5563] mt-2">{total} product{total === 1 ? "" : "s"}{debouncedFilter ? " matching" : " total"} · showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</div>}

        {loading ? <div className="mt-10 text-center text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div> : (
          <div className="space-y-3 mt-6" data-testid="aps-list">
            {products.map((p) => (
              <div key={p.id} data-testid={`aps-${p.id}`} className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4">
                <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="w-full flex items-center gap-3 text-left">
                  <img src={p.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-nunito font-extrabold truncate">{p.name}</div>
                    <div className="text-[10px] text-[#4b5563]">{p.category} · £{p.price.toFixed(2)}{p.brand && ` · ${p.brand}`}{p.sku && ` · ${p.sku}`}</div>
                  </div>
                  {p.bulk_pricing_enabled && <span className="text-[10px] bg-[#7bc67e] text-[#1a1a1a] font-nunito font-extrabold px-2 py-0.5 rounded-full">BULK</span>}
                </button>
                {openId === p.id && (
                  <div className="mt-4 space-y-3 border-t border-[#dcfce7] pt-4">
                    <ProductOverridePanel product={p} onSaved={reload} />
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Lab label="Brand"><input data-testid={`aps-brand-${p.id}`} value={p.brand || ""} onChange={(e) => update(p.id, { brand: e.target.value })} className={ic} /></Lab>
                      <Lab label="SKU"><input data-testid={`aps-sku-${p.id}`} value={p.sku || ""} onChange={(e) => update(p.id, { sku: e.target.value })} className={ic} /></Lab>
                    </div>
                    <Lab label="Full description"><textarea data-testid={`aps-desc-${p.id}`} value={p.description_full || ""} onChange={(e) => update(p.id, { description_full: e.target.value })} rows={3} className={ic + " resize-none"} /></Lab>
                    <Lab label="Size guide image URL (optional)"><input data-testid={`aps-sg-img-${p.id}`} value={p.size_guide_image || ""} onChange={(e) => update(p.id, { size_guide_image: e.target.value })} className={ic} placeholder="https://…" /></Lab>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Size guide table</div>
                      <div className="space-y-1.5">
                        {(p.size_guide_table || []).map((r, i) => (
                          <div key={i} className="grid grid-cols-12 gap-1 items-center" data-testid={`aps-sg-row-${p.id}-${i}`}>
                            <input value={r.size || ""} onChange={(e) => setRow(p.id, i, "size", e.target.value)} placeholder="Size" className={ic + " col-span-3"} />
                            <input value={r.chest || ""} onChange={(e) => setRow(p.id, i, "chest", e.target.value)} placeholder="Chest cm" className={ic + " col-span-4"} />
                            <input value={r.length || ""} onChange={(e) => setRow(p.id, i, "length", e.target.value)} placeholder="Length cm" className={ic + " col-span-4"} />
                            <button onClick={() => delRow(p.id, i)} className="col-span-1 grid place-items-center text-rose-500"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                      <button data-testid={`aps-sg-add-${p.id}`} onClick={() => addRow(p.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-[#7bc67e] hover:underline"><Plus size={11} /> Add size row</button>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Allowed print placements</div>
                      <div className="text-[11px] text-[#4b5563] mb-2">Tick which print locations are physically possible on this garment. Disallowed options are hidden from customers in the product page and designer.</div>
                      <div className="flex flex-wrap gap-2" data-testid={`aps-placements-${p.id}`}>
                        {ALL_PLACEMENTS.map((opt) => {
                          const list = Array.isArray(p.allowed_placements) ? p.allowed_placements : ALL_PLACEMENTS;
                          const on = list.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const next = on ? list.filter((x) => x !== opt) : [...list, opt];
                                update(p.id, { allowed_placements: next });
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-nunito font-extrabold border-2 transition ${on ? "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]" : "bg-white border-[#e5e7eb] text-[#4b5563] hover:border-[#7bc67e]"}`}
                              data-testid={`aps-placement-${p.id}-${opt}`}
                            >
                              {on ? "✓ " : ""}{PLACEMENT_LABELS[opt]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3" data-testid={`aps-fit-industry-row-${p.id}`}>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Gender / fit</div>
                        <select
                          value={p.gender_fit || "unisex"}
                          onChange={(e) => update(p.id, { gender_fit: e.target.value })}
                          className="w-full bg-white border border-[#e5e7eb] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#7bc67e]"
                          data-testid={`aps-gender-${p.id}`}
                        >
                          {GENDER_FIT_VALUES.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Industry tags</div>
                        <div className="flex flex-wrap gap-1.5">
                          {INDUSTRY_SLUGS.map((slug) => {
                            const list = Array.isArray(p.industry_tags) ? p.industry_tags : [];
                            const on = list.includes(slug);
                            return (
                              <button
                                key={slug}
                                type="button"
                                onClick={() => {
                                  const next = on ? list.filter((s) => s !== slug) : [...list, slug];
                                  update(p.id, { industry_tags: next });
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border transition ${on ? "bg-[#1a1a1a] border-[#1a1a1a] text-white" : "bg-white border-[#e5e7eb] text-[#4b5563] hover:border-[#1a1a1a]"}`}
                                data-testid={`aps-industry-${p.id}-${slug}`}
                              >
                                {on ? "✓ " : ""}{slug}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-[#fef3c7] border-2 border-[#fde68a] rounded-xl p-3" data-testid={`aps-workforce-row-${p.id}`}>
                      <label className="inline-flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={!!p.workforce_eligible} onChange={(e) => update(p.id, { workforce_eligible: e.target.checked })} className="w-4 h-4 accent-amber-500" data-testid={`aps-workforce-${p.id}`} />
                        <div>
                          <div className="text-sm font-nunito font-extrabold">Include in &quot;Kit Your Workforce&quot;</div>
                          <div className="text-[11px] text-[#4b5563]">Show this garment in the /workforce mixed-bulk builder.</div>
                        </div>
                      </label>
                      <Briefcase size={16} className="text-amber-600" />
                    </div>
                    <div className="flex items-center justify-between gap-3 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-xl p-3" data-testid={`aps-specials-row-${p.id}`}>
                      <label className="inline-flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={!!p.specials_eligible} onChange={(e) => update(p.id, { specials_eligible: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-specials-${p.id}`} />
                        <div>
                          <div className="text-sm font-nunito font-extrabold">Include in &quot;Your Own Print Specials&quot;</div>
                          <div className="text-[11px] text-[#4b5563]">Starter lineup, no MOQ, single breast-logo print. Shown on /specials.</div>
                        </div>
                      </label>
                      <Sparkles size={16} className="text-[#7bc67e]" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Image gallery (extra product photos — shown as thumbnails)</div>
                      <div className="text-[11px] text-[#4b5563] mb-2">Paste public image URLs (https://…) — up to 8. Main product image is always first; these are additional shots (back view, lifestyle, detail).</div>
                      <ImageGalleryEditor
                        productId={p.id}
                        urls={Array.isArray(p.image_gallery) ? p.image_gallery : []}
                        onChange={(next) => update(p.id, { image_gallery: next })}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">&quot;Customers also bought&quot; (cross-sells on this PDP)</div>
                      <div className="text-[11px] text-[#4b5563] mb-2">Pick up to 6 products to show on this PDP. Leave empty to auto-pick from the same category.</div>
                      <CrossSellPicker
                        selectedIds={Array.isArray(p.also_bought) ? p.also_bought : []}
                        allProducts={allProductsLite}
                        excludeId={p.id}
                        maxItems={6}
                        onChange={(next) => update(p.id, { also_bought: next })}
                        testid={`aps-also-bought-${p.id}`}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">&quot;Match with&quot; (complete-the-look complementary items)</div>
                      <div className="text-[11px] text-[#4b5563] mb-2">Pick up to 4 complementary products (e.g. matching joggers, beanie). Hidden on PDP if empty (no auto-fallback).</div>
                      <CrossSellPicker
                        selectedIds={Array.isArray(p.match_with) ? p.match_with : []}
                        allProducts={allProductsLite}
                        excludeId={p.id}
                        maxItems={4}
                        accent="amber"
                        onChange={(next) => update(p.id, { match_with: next })}
                        testid={`aps-match-with-${p.id}`}
                      />
                    </div>
                    <div>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!p.bulk_pricing_enabled} onChange={(e) => update(p.id, { bulk_pricing_enabled: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-bulk-${p.id}`} />
                        <span className="text-sm font-nunito font-extrabold">Enable bulk pricing on this product</span>
                      </label>
                      {p.bulk_pricing_enabled && (
                        <div className="mt-2 bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3">
                          <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-2">Per-product overrides (leave empty to use defaults)</div>
                          <div className="space-y-1">
                            {(p.bulk_pricing_overrides || []).map((o, i) => (
                              <div key={i} className="flex items-center gap-2" data-testid={`aps-bulk-row-${p.id}-${i}`}>
                                <input type="number" value={o.min_qty} onChange={(e) => setOverride(p.id, i, "min_qty", e.target.value)} className={ic + " w-20"} />
                                <span className="text-xs">+ ·</span>
                                <input type="number" value={o.pct} onChange={(e) => setOverride(p.id, i, "pct", e.target.value)} className={ic + " w-20"} />
                                <span className="text-xs">%</span>
                                <button onClick={() => delOverride(p.id, i)} className="ml-auto text-rose-500"><Trash2 size={12} /></button>
                              </div>
                            ))}
                          </div>
                          <button data-testid={`aps-bulk-add-${p.id}`} onClick={() => addOverride(p.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-nunito font-extrabold text-[#7bc67e] hover:underline"><Plus size={11} /> Add override</button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button data-testid={`aps-save-${p.id}`} onClick={() => save(p)} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 text-[#1a1a1a] font-nunito font-extrabold text-xs px-4 py-2 rounded-full"><Save size={11} /> Save</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-4 mt-6" data-testid="aps-pagination">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="aps-page-prev">
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-xs text-[#4b5563]">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
            <button onClick={() => setPage((p) => (p + 1) * PAGE_SIZE < total ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= total} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline" data-testid="aps-page-next">
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ic = "w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#7bc67e]";
function Lab({ label, children }) { return <div><div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">{label}</div>{children}</div>; }


/**
 * Search-to-add product picker for cross-sell fields (also_bought, match_with).
 * Renders only the CURRENTLY SELECTED items as chips, plus a search box that
 * shows up to 8 matching suggestions at a time — never renders the whole
 * catalogue as buttons, which is what made opening any product row slow once
 * the catalogue grew into the hundreds/thousands (e.g. after a PenCarrie import).
 */
function CrossSellPicker({ selectedIds, allProducts, excludeId, maxItems, onChange, testid, accent = "green" }) {
  const [query, setQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const accentClasses = accent === "amber"
    ? "bg-amber-400 border-amber-400 text-[#1a1a1a]"
    : "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]";

  const selectedProducts = selectedIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter(Boolean);

  const suggestions = query.trim()
    ? allProducts
        .filter((p) => p.id !== excludeId && !selectedIds.includes(p.id) && p.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const add = (id) => {
    if (selectedIds.length >= maxItems) { toast.error(`Max ${maxItems} per product`); return; }
    onChange([...selectedIds, id]);
    setQuery("");
  };
  const remove = (id) => onChange(selectedIds.filter((x) => x !== id));

  const suggestSameBrand = async () => {
    setSuggesting(true);
    try {
      const d = await suggestCrossSell(excludeId, maxItems);
      if (!d.suggestions?.length) {
        toast.error(d.reason || "No same-brand products in other categories found to suggest.");
        return;
      }
      const merged = [...new Set([...selectedIds, ...d.suggestions.map((s) => s.id)])].slice(0, maxItems);
      onChange(merged);
      toast.success(`Added ${d.suggestions.length} same-brand suggestion${d.suggestions.length === 1 ? "" : "s"} (${d.brand}).`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't fetch suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div data-testid={testid}>
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedProducts.map((p) => (
            <button key={p.id} type="button" onClick={() => remove(p.id)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-nunito font-extrabold border ${accentClasses}`} data-testid={`${testid}-chip-${p.id}`}>
              {p.name} <X size={11} />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selectedIds.length >= maxItems ? `Max ${maxItems} reached` : "Search products to add…"}
            disabled={selectedIds.length >= maxItems}
            className="w-full sm:w-80 bg-white border border-[#e5e7eb] rounded-full pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#7bc67e] disabled:opacity-50"
            data-testid={`${testid}-search`}
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 bg-white border border-[#dcfce7] rounded-2xl shadow-lg py-1 w-full sm:w-80 max-h-56 overflow-y-auto">
              {suggestions.map((p) => (
                <button key={p.id} type="button" onClick={() => add(p.id)} className="block w-full text-left px-4 py-2 text-xs hover:bg-[#f0fdf4]" data-testid={`${testid}-suggestion-${p.id}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={suggestSameBrand}
          disabled={suggesting || selectedIds.length >= maxItems}
          className="inline-flex items-center gap-1 text-[11px] font-nunito font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-3 py-1.5 hover:bg-[#f0fdf4] disabled:opacity-50 whitespace-nowrap"
          data-testid={`${testid}-suggest-brand`}
        >
          {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Same brand
        </button>
      </div>
    </div>
  );
}

function ImageGalleryEditor({ productId, urls, onChange }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const u = draft.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) { toast.error("URL must start with http:// or https://"); return; }
    if (urls.length >= 8) { toast.error("Max 8 extra images per product"); return; }
    onChange([...urls, u]);
    setDraft("");
  };
  const remove = (i) => onChange(urls.filter((_, idx) => idx !== i));
  return (
    <div data-testid={`aps-gallery-${productId}`}>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
        {urls.map((u, i) => (
          <div key={u + i} className="relative aspect-square bg-white rounded-lg border border-[#e5e7eb] overflow-hidden" data-testid={`aps-gallery-${productId}-thumb-${i}`}>
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-0.5 right-0.5 bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full font-extrabold leading-none"
              data-testid={`aps-gallery-${productId}-remove-${i}`}
              title="Remove"
            >×</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="https://images.example.com/product-back.jpg"
          className="flex-1 bg-white border border-[#e5e7eb] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#7bc67e]"
          data-testid={`aps-gallery-${productId}-input`}
        />
        <button
          type="button"
          onClick={add}
          className="bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full"
          data-testid={`aps-gallery-${productId}-add`}
        >+ Add</button>
      </div>
    </div>
  );
}

/**
 * Inline "edit the hardcoded catalogue" panel — sits at the top of every
 * expanded product row. Writes go to PATCH /admin/products/{pid}/override
 * (persisted in Mongo + hot-applied to the in-memory PRODUCTS registry).
 *
 * Revert (DELETE /admin/products/{pid}/override) removes the doc and restores
 * the pristine hardcoded values immediately — no restart needed.
 */
function ProductOverridePanel({ product, onSaved }) {
  const [draft, setDraft] = React.useState({
    name: product.name || "",
    price: product.price ?? 0,
    description: product.description || "",
    image: product.image || "",
    category: product.category || "",
    active: product._hidden ? false : true,
  });
  const [override, setOverride] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    fetchProductOverride(product.id).then((d) => {
      setOverride(d?.override || null);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [product.id]);

  const dirty = (
    draft.name !== product.name ||
    Number(draft.price) !== Number(product.price) ||
    draft.description !== (product.description || "") ||
    draft.image !== (product.image || "") ||
    draft.category !== (product.category || "") ||
    draft.active !== (product._hidden ? false : true)
  );

  const save = async () => {
    setBusy(true);
    try {
      await patchProductOverride(product.id, {
        name: draft.name?.trim() || null,
        price: Number(draft.price) || null,
        description: draft.description || null,
        image: draft.image || null,
        category: draft.category || null,
        active: draft.active,
      });
      toast.success(`${draft.name} — override saved`);
      onSaved && onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setBusy(false); }
  };

  const revert = async () => {
    if (!window.confirm(`Revert "${product.name}" to code defaults? This clears all custom name / price / description / image overrides.`)) return;
    setBusy(true);
    try {
      await clearProductOverride(product.id);
      toast.success("Reverted to code defaults");
      onSaved && onSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || "Revert failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-4 space-y-3" data-testid={`aps-override-${product.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold text-[#166534]">
          <Pencil size={12} /> Basic catalogue override
          {loaded && override && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#7bc67e] text-[#1a1a1a] text-[10px]" data-testid={`aps-override-badge-${product.id}`}>ACTIVE OVERRIDE</span>}
        </div>
        {loaded && override && (
          <button type="button" onClick={revert} disabled={busy} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1 disabled:opacity-50" data-testid={`aps-override-revert-${product.id}`}>
            <RotateCcw size={11} /> Revert to code defaults
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <Lab label="Product name (H1)">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={ic} data-testid={`aps-override-name-${product.id}`} />
        </Lab>
        <Lab label="Price (£)">
          <input type="number" step="0.01" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={ic} data-testid={`aps-override-price-${product.id}`} />
        </Lab>
      </div>
      <Lab label="Category (which shop collection this appears in)">
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={ic} data-testid={`aps-override-category-${product.id}`}>
          <option value="">Auto-detect from name</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Lab>
      <Lab label="Short description (shown on product cards + PDP intro)">
        <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={ic + " resize-none"} data-testid={`aps-override-desc-${product.id}`} />
      </Lab>
      <Lab label="Main image URL">
        <input value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} className={ic} placeholder="https://…" data-testid={`aps-override-image-${product.id}`} />
      </Lab>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-override-active-${product.id}`} />
          <span className="text-xs font-extrabold">Active (untick to hide from storefront)</span>
        </label>
        <button onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold text-xs px-4 py-2 rounded-full" data-testid={`aps-override-save-${product.id}`}>
          {busy ? <Loader2 className="animate-spin" size={11} /> : <Save size={11} />} Save override
        </button>
      </div>
    </div>
  );
}
