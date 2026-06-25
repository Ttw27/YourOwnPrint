import React, { useEffect, useState } from "react";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchAllProductsAdmin, updateProductMeta, fetchBulkDefaults, updateBulkDefaults, ALL_PLACEMENTS, PLACEMENT_LABELS, fetchWorkforceTiers, updateWorkforceTiers } from "../lib/api";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Sparkles, Briefcase } from "lucide-react";

export default function AdminProductSettings() {
  const [products, setProducts] = useState([]);
  const [defaults, setDefaults] = useState({ tiers: [] });
  const [workforce, setWorkforce] = useState({ tiers: [], quote_threshold: 100 });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [ps, ds, wf] = await Promise.all([fetchAllProductsAdmin(), fetchBulkDefaults(), fetchWorkforceTiers().catch(() => null)]);
      setProducts(ps); setDefaults(ds);
      if (wf) setWorkforce({ tiers: wf.tiers || [], quote_threshold: wf.quote_threshold || 100 });
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

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

  const visible = products.filter(p => !filter.trim() || `${p.name} ${p.id} ${p.brand} ${p.sku}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="bg-white min-h-screen font-nunito text-[#1a1a1a]">
      <BoldNavbar />
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

        <input data-testid="aps-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter products…" className="mt-6 bg-white border border-[#dcfce7] rounded-full px-4 py-2 text-sm w-full sm:w-96" />

        {loading ? <div className="mt-10 text-center text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div> : (
          <div className="space-y-3 mt-6" data-testid="aps-list">
            {visible.map((p) => (
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
                      <div className="flex flex-wrap gap-1.5" data-testid={`aps-also-bought-${p.id}`}>
                        {products.filter(q => q.id !== p.id).map((q) => {
                          const list = Array.isArray(p.also_bought) ? p.also_bought : [];
                          const on = list.includes(q.id);
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => {
                                let next;
                                if (on) next = list.filter(x => x !== q.id);
                                else if (list.length >= 6) { toast.error("Max 6 cross-sells per product"); return; }
                                else next = [...list, q.id];
                                update(p.id, { also_bought: next });
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-nunito font-extrabold border transition ${on ? "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]" : "bg-white border-[#e5e7eb] text-[#4b5563] hover:border-[#7bc67e]"}`}
                              data-testid={`aps-also-bought-${p.id}-${q.id}`}
                            >
                              {on ? "✓ " : ""}{q.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">&quot;Match with&quot; (complete-the-look complementary items)</div>
                      <div className="text-[11px] text-[#4b5563] mb-2">Pick up to 4 complementary products (e.g. matching joggers, beanie). Hidden on PDP if empty (no auto-fallback).</div>
                      <div className="flex flex-wrap gap-1.5" data-testid={`aps-match-with-${p.id}`}>
                        {products.filter(q => q.id !== p.id).map((q) => {
                          const list = Array.isArray(p.match_with) ? p.match_with : [];
                          const on = list.includes(q.id);
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => {
                                let next;
                                if (on) next = list.filter(x => x !== q.id);
                                else if (list.length >= 4) { toast.error("Max 4 match-with items per product"); return; }
                                else next = [...list, q.id];
                                update(p.id, { match_with: next });
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-nunito font-extrabold border transition ${on ? "bg-amber-400 border-amber-400 text-[#1a1a1a]" : "bg-white border-[#e5e7eb] text-[#4b5563] hover:border-amber-400"}`}
                              data-testid={`aps-match-with-${p.id}-${q.id}`}
                            >
                              {on ? "✓ " : ""}{q.name}
                            </button>
                          );
                        })}
                      </div>
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
      </div>
      <BoldFooter />
    </div>
  );
}

const ic = "w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#7bc67e]";
function Lab({ label, children }) { return <div><div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">{label}</div>{children}</div>; }


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
