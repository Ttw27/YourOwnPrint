import React, { useEffect, useState } from "react";
import { fetchAllProductsAdmin, updateProductMeta, fetchBulkDefaults, updateBulkDefaults, ALL_PLACEMENTS, PLACEMENT_LABELS, fetchWorkforceTiers, updateWorkforceTiers, GENDER_FIT_VALUES, INDUSTRY_SLUGS, patchProductOverride, clearProductOverride, fetchProductOverride, suggestCrossSell, unlockProducts, setProductsVisibility, duplicateProduct, setDesignerEnabled, uploadAdminImage, clearanceStatus, clearanceScan, clearanceHideEnding, clearanceRemoveEndingColours } from "../lib/api";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Sparkles, Briefcase, Pencil, RotateCcw, ChevronLeft, ChevronRight, Search, X, Eye, EyeOff, Copy, Upload } from "lucide-react";

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
  const [filter, setFilter] = useState(() => { try { return new URLSearchParams(window.location.search).get("q") || ""; } catch { return ""; } });
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [allProductsLite, setAllProductsLite] = useState([]); // {id, name} across the WHOLE catalogue - for cross-sell pickers only, never rendered as one giant list
  const [defaults, setDefaults] = useState({ tiers: [] });
  const [workforce, setWorkforce] = useState({ tiers: [], quote_threshold: 100 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set()); // product ids ticked for bulk actions (current page)
  const [catFilter, setCatFilter] = useState("");  // category dropdown
  const [srcFilter, setSrcFilter] = useState("");  // supplier/source dropdown
  const [lockedFilter, setLockedFilter] = useState("");  // "" | "locked" | "unlocked"
  const [visFilter, setVisFilter] = useState("");  // "" | "visible" | "hidden"
  const [designerFilter, setDesignerFilter] = useState("");  // "" | "in" | "out" | "only"
  const [clearanceFilter, setClearanceFilter] = useState("");  // "" | "ending" | "partial"
  const [facets, setFacets] = useState({ categories: [], sources: [] });

  // Debounce the search box so we're not firing a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 350);
    return () => clearTimeout(t);
  }, [filter]);

  // What each product looked like when loaded - Save sends only the fields that
  // differ from this, so it never overwrites settings changed elsewhere (bulk
  // passes, Smart Re-classify, another tab) or pins untouched defaults.
  const loadedRef = React.useRef({});

  const reload = async (opts = {}) => {
    const targetPage = opts.page ?? page;
    setLoading(true);
    try {
      const [ps, ds, wf] = await Promise.all([
        fetchAllProductsAdmin(targetPage * PAGE_SIZE, PAGE_SIZE, debouncedFilter, catFilter, srcFilter, lockedFilter, visFilter, designerFilter, false, clearanceFilter),
        fetchBulkDefaults(),
        fetchWorkforceTiers().catch(() => null),
      ]);
      setProducts(ps.items || []);
      loadedRef.current = Object.fromEntries((ps.items || []).map((x) => [x.id, x]));
      setSelected(new Set());
      setTotal(ps.total || 0);
      if (ps.categories || ps.sources) setFacets({ categories: ps.categories || [], sources: ps.sources || [] });
      setDefaults(ds);
      if (wf) setWorkforce({ tiers: wf.tiers || [], quote_threshold: wf.quote_threshold || 100 });
    } finally { setLoading(false); }
  };

  // Fetch the whole catalogue's id+name once, for the cross-sell search pickers
  // (id+name only is cheap even for thousands of products - it's rendering
  // them all as buttons that was slow, so that no longer happens).
  const loadAllLite = async () => {
    try {
      const d = await fetchAllProductsAdmin(0, 100000, "", "", "", "", "", "", true);
      setAllProductsLite((d.items || []).map(p => ({ id: p.id, name: p.name })));
    } catch { /* non-critical - pickers just show fewer suggestions */ }
  };

  useEffect(() => { loadAllLite(); }, []);
  useEffect(() => { setPage(0); reload({ page: 0 }); }, [debouncedFilter, catFilter, srcFilter, lockedFilter, visFilter, designerFilter, clearanceFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload({ page }); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id, patch) => setProducts((prev) => prev.map(p => p.id === id ? { ...p, ...patch } : p));

  const toggleHidden = async (p) => {
    const hide = !p.hidden;
    setBusy(true);
    try {
      await setProductsVisibility([p.id], hide);
      update(p.id, { hidden: hide });
      toast.success(hide ? `${p.name} is now hidden from the site` : `${p.name} is back on the site`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't change visibility"); }
    finally { setBusy(false); }
  };

  const toggleDesigner = async (p, enabled) => {
    setBusy(true);
    try {
      await setDesignerEnabled(p.id, enabled);
      update(p.id, { designer_enabled: enabled });
      toast.success(enabled ? `${p.name} is now in Design Your Own - set its photos and print area on Designer products` : `${p.name} removed from Design Your Own`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't change that"); }
    finally { setBusy(false); }
  };

  const duplicate = async (p) => {
    const name = window.prompt(
      `Make a copy of "${p.name}"?\n\nThe copy is a separate product - you can change its name, price, colours and photos without affecting the original. It starts hidden from the site.\n\nName for the copy:`,
      `${p.name} (copy)`,
    );
    if (!name || !name.trim()) return;
    setBusy(true);
    try {
      const r = await duplicateProduct(p.id, name.trim());
      toast.success(`Copy created: ${r.name} (hidden until you show it)`);
      // Jump to the new copy, opened ready to edit.
      setCatFilter(""); setSrcFilter(""); setLockedFilter(""); setVisFilter(""); setDesignerFilter("");
      setFilter(r.name);
      setOpenId(r.id);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't copy the product"); }
    finally { setBusy(false); }
  };

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allOnPageSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const toggleSelectAll = () => setSelected(allOnPageSelected ? new Set() : new Set(products.map((p) => p.id)));

  const bulkSetHidden = async (hide) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await setProductsVisibility(ids, hide);
      setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, hidden: hide } : p));
      setSelected(new Set());
      toast.success(`${r.changed} product${r.changed === 1 ? "" : "s"} ${hide ? "hidden from" : "shown on"} the site`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't change visibility"); }
    finally { setBusy(false); }
  };

  const bulkUnlock = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await unlockProducts({ product_ids: ids });
      setProducts((prev) => prev.map((p) => selected.has(p.id) ? { ...p, manual_edit: false } : p));
      setSelected(new Set());
      toast.success(`Unlocked ${r.unlocked} product${r.unlocked === 1 ? "" : "s"}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Unlock failed"); }
    finally { setBusy(false); }
  };

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

  // Each open product's "Name, price & main photo" box registers itself here, so
  // the main Save button saves it too. (It used to have its own separate button,
  // and clicking only the main Save silently dropped name/price changes.)
  const basicsSavers = React.useRef({});
  const registerBasicsSaver = React.useCallback((id, saver) => {
    if (saver) basicsSavers.current[id] = saver; else delete basicsSavers.current[id];
  }, []);

  const metaPayload = (p) => ({
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
    is_bestseller: !!p.is_bestseller,
    designer_only: !!p.designer_only,
    also_bought: Array.isArray(p.also_bought) ? p.also_bought : [],
    match_with: Array.isArray(p.match_with) ? p.match_with : [],
    image_gallery: Array.isArray(p.image_gallery) ? p.image_gallery : [],
    gender_fit: p.gender_fit || "unisex",
    industry_tags: Array.isArray(p.industry_tags) ? p.industry_tags : [],
  });

  const save = async (p) => {
    setBusy(true);
    try {
      const basics = basicsSavers.current[p.id];
      const savedName = basics && basics.isDirty() ? await basics.save({ quiet: true }) : null;
      const now = metaPayload(p);
      const before = metaPayload(loadedRef.current[p.id] || {});
      const changed = Object.fromEntries(Object.entries(now).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k])));
      if (Object.keys(changed).length) {
        await updateProductMeta(p.id, changed);
        loadedRef.current[p.id] = { ...(loadedRef.current[p.id] || {}), ...p };
      } else if (!savedName) {
        toast("Nothing to save - no changes");
        return;
      }
      toast.success(`${savedName || p.name} saved`);
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

        <ClearanceCheck onFilter={(v) => { setClearanceFilter(v); setVisFilter(""); }} onChanged={() => reload({ page: 0 })} />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input data-testid="aps-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search products by name, brand, or SKU…" className="bg-white border border-[#dcfce7] rounded-full px-4 py-2 text-sm w-full sm:w-72" />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="bg-white border border-[#dcfce7] rounded-full px-3 py-2 text-sm" data-testid="aps-cat-filter">
            <option value="">All categories</option>
            {facets.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {facets.sources.length > 1 && (
            <select value={srcFilter} onChange={(e) => setSrcFilter(e.target.value)} className="bg-white border border-[#dcfce7] rounded-full px-3 py-2 text-sm" data-testid="aps-src-filter">
              <option value="">All suppliers</option>
              {facets.sources.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
            </select>
          )}
          <select value={lockedFilter} onChange={(e) => setLockedFilter(e.target.value)} className="bg-white border border-[#dcfce7] rounded-full px-3 py-2 text-sm" data-testid="aps-locked-filter" title="Filter by manually-edited (locked) products">
            <option value="">All products</option>
            <option value="locked">🔒 Manually edited only</option>
            <option value="unlocked">Not manually edited</option>
          </select>
          <select value={visFilter} onChange={(e) => setVisFilter(e.target.value)} className="bg-white border border-[#dcfce7] rounded-full px-3 py-2 text-sm" data-testid="aps-vis-filter" title="Filter by whether customers can see the product">
            <option value="">Visible &amp; hidden</option>
            <option value="visible">Visible on the site</option>
            <option value="hidden">Hidden from the site</option>
          </select>
          <select value={designerFilter} onChange={(e) => setDesignerFilter(e.target.value)} className="bg-white border border-[#dcfce7] rounded-full px-3 py-2 text-sm" data-testid="aps-designer-filter" title="Filter by the Design Your Own tool">
            <option value="">Designer: all products</option>
            <option value="in">In the designer</option>
            <option value="out">Not in the designer</option>
            <option value="only">Only sold through the designer</option>
          </select>
          <select value={clearanceFilter} onChange={(e) => setClearanceFilter(e.target.value)} className="bg-white border border-[#dcfce7] rounded-full px-3 py-2 text-sm" data-testid="aps-clearance-filter" title="From the PenCarrie clearance check">
            <option value="">Clearance: any</option>
            <option value="ending">Clearance / discontinued</option>
            <option value="partial">Some colours ending</option>
          </select>
          {(catFilter || srcFilter || filter || lockedFilter || visFilter || designerFilter || clearanceFilter) && (
            <button onClick={() => { setFilter(""); setCatFilter(""); setSrcFilter(""); setLockedFilter(""); setVisFilter(""); setDesignerFilter(""); setClearanceFilter(""); }} className="text-xs font-bold text-rose-500 hover:underline px-2" data-testid="aps-clear-filters">Clear</button>
          )}
        </div>
        {total > 0 && <div className="text-[11px] text-[#4b5563] mt-2">{total} product{total === 1 ? "" : "s"}{debouncedFilter ? " matching" : " total"} · showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</div>}

        {lockedFilter === "locked" && total > 0 && (
          <div className="mt-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap" data-testid="aps-unlock-bar">
            <div className="text-sm text-amber-800">
              <span className="font-extrabold">{total} manually-edited product{total === 1 ? "" : "s"}.</span> These are protected - Smart Re-classify won't change them. Unlock any you want the AI to manage again.
            </div>
            <button
              onClick={async () => {
                if (!window.confirm(`Unlock all ${total} manually-edited products? Smart Re-classify will be able to change them again.`)) return;
                setBusy(true);
                try { const r = await unlockProducts({ all_locked: true }); alert(`Unlocked ${r.unlocked} product${r.unlocked === 1 ? "" : "s"}.`); reload({ page: 0 }); }
                finally { setBusy(false); }
              }}
              disabled={busy}
              className="text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white rounded-full px-4 py-2 disabled:opacity-50 flex-shrink-0"
              data-testid="aps-unlock-all"
            >
              Unlock all {total}
            </button>
          </div>
        )}

        {loading ? <div className="mt-10 text-center text-sm text-[#4b5563]"><Loader2 className="inline animate-spin mr-2" size={14} /> Loading…</div> : (
          <div className="mt-6 bg-white border-2 border-[#e5e7eb] rounded-2xl overflow-hidden" data-testid="aps-list">
            {/* Header row - or, when products are ticked, the bulk action bar (Shopify-style) */}
            {selected.size > 0 ? (
              <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 bg-[#f0fdf4] border-b-2 border-[#dcfce7]" data-testid="aps-bulk-bar">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-[#7bc67e]" aria-label="Select all on this page" />
                <span className="text-xs font-extrabold mr-2">{selected.size} selected</span>
                <button onClick={() => bulkSetHidden(true)} disabled={busy} className="text-xs font-extrabold bg-[#1a1a1a] hover:bg-black text-white rounded-full px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-50" data-testid="aps-bulk-hide"><EyeOff size={12} /> Hide from site</button>
                <button onClick={() => bulkSetHidden(false)} disabled={busy} className="text-xs font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a] rounded-full px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-50" data-testid="aps-bulk-show"><Eye size={12} /> Show on site</button>
                <button onClick={bulkUnlock} disabled={busy} className="text-xs font-extrabold bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full px-3 py-1.5 disabled:opacity-50" data-testid="aps-bulk-unlock" title="Let Smart Re-classify manage these products again">Unlock</button>
                <button onClick={() => setSelected(new Set())} className="ml-auto text-xs font-bold text-[#4b5563] hover:underline">Clear</button>
              </div>
            ) : (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_96px_130px_100px_72px] items-center gap-3 px-3 py-2.5 bg-[#f9fafb] border-b-2 border-[#e5e7eb] text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563]">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-[#7bc67e]" aria-label="Select all on this page" data-testid="aps-select-all" />
                <span>Product</span>
                <span className="hidden md:block">Status</span>
                <span className="hidden md:block">Category</span>
                <span className="hidden md:block">Supplier</span>
                <span className="hidden md:block text-right">Price</span>
              </div>
            )}
            {products.length === 0 && <div className="px-4 py-10 text-center text-sm text-[#4b5563]">No products match these filters.</div>}
            {products.map((p) => (
              <div key={p.id} data-testid={`aps-${p.id}`} className={`border-b border-[#f3f4f6] last:border-b-0 ${openId === p.id ? "bg-[#f9fafb]" : ""}`}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_96px_130px_100px_72px] items-center gap-3 px-3 py-2 hover:bg-[#f9fafb] cursor-pointer" onClick={() => setOpenId(openId === p.id ? null : p.id)} title="Click to edit" data-testid={`aps-row-${p.id}`}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 accent-[#7bc67e]" aria-label={`Select ${p.name}`} data-testid={`aps-select-${p.id}`} />
                  <>
                    <span className="flex items-center gap-3 min-w-0">
                      <img src={p.image} alt="" className={`w-10 h-10 rounded-lg border border-[#e5e7eb] object-cover flex-shrink-0 ${p.hidden ? "opacity-40" : ""}`} />
                      <span className="min-w-0">
                        <span className={`block font-nunito font-extrabold text-sm truncate ${p.hidden ? "text-[#6b7280]" : ""}`}>{p.name}</span>
                        <span className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {(p.brand || p.sku) && <span className="text-[10px] text-[#4b5563] truncate">{[p.brand, p.sku].filter(Boolean).join(" · ")}</span>}
                          {/* On phones the status/price columns are hidden, so show them inline here */}
                          <span className="md:hidden text-[10px] text-[#4b5563]">£{p.price.toFixed(2)}</span>
                          {p.hidden && <span className="md:hidden text-[9px] bg-[#e5e7eb] text-[#4b5563] font-nunito font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5" data-testid={`aps-hidden-badge-${p.id}`}><EyeOff size={9} /> HIDDEN</span>}
                          {(p.supplier_status === "ending" || p.supplier_status === "gone") && <span className="text-[9px] bg-rose-100 text-rose-700 font-nunito font-extrabold px-2 py-0.5 rounded-full" title={p.supplier_status === "gone" ? "No longer in PenCarrie's range" : "Clearance / discontinued at PenCarrie - won't be available for long"}>{p.supplier_status === "gone" ? "NO LONGER STOCKED" : "CLEARANCE"}</span>}
                          {p.supplier_status === "partial" && <span className="text-[9px] bg-orange-100 text-orange-700 font-nunito font-extrabold px-2 py-0.5 rounded-full" title={`Ending colours: ${(p.ending_colours || []).join(", ")}`}>{(p.ending_colours || []).length} COLOUR{(p.ending_colours || []).length === 1 ? "" : "S"} ENDING</span>}
                          {p.manual_edit && <span className="text-[9px] bg-amber-100 text-amber-700 font-nunito font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5" title="Manually edited - protected from Smart Re-classify">🔒 EDITED</span>}
                          {p.designer_enabled && <span className="text-[9px] bg-[#eef2ff] text-[#4338ca] font-nunito font-extrabold px-2 py-0.5 rounded-full" title="Available in the Design Your Own tool">DESIGNER</span>}
                          {p.bulk_pricing_enabled && <span className="text-[9px] bg-[#dcfce7] text-[#166534] font-nunito font-extrabold px-2 py-0.5 rounded-full" title="Bulk discounts switched on">BULK</span>}
                        </span>
                      </span>
                    </span>
                    <span className="hidden md:block">
                      {p.hidden
                        ? <span className="text-[10px] bg-[#e5e7eb] text-[#4b5563] font-nunito font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1" title="Customers can't see or buy this product"><EyeOff size={10} /> Hidden</span>
                        : <span className="text-[10px] bg-[#dcfce7] text-[#166534] font-nunito font-extrabold px-2.5 py-1 rounded-full">Active</span>}
                    </span>
                    <span className="hidden md:block text-xs text-[#4b5563] truncate capitalize">{(p.category || "").replace(/-/g, " ")}</span>
                    <span className="hidden md:block text-xs text-[#4b5563] truncate capitalize">{p.source && p.source !== "native" ? p.source : "Your Own Print"}</span>
                    <span className="hidden md:block text-sm font-extrabold text-right">£{p.price.toFixed(2)}</span>
                  </>
                </div>
                {openId === p.id && (
                  <div className="px-3 sm:px-4 pb-4 pt-3 space-y-3 border-t border-[#e5e7eb]">
                    <div className={`rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap border-2 ${p.hidden ? "bg-[#f3f4f6] border-[#e5e7eb]" : "bg-white border-[#dcfce7]"}`} data-testid={`aps-visibility-${p.id}`}>
                      <div className="text-sm">
                        <span className="font-extrabold">{p.hidden ? "Hidden from the site" : "Visible on the site"}</span>
                        <span className="block text-[11px] text-[#4b5563]">{p.hidden ? "Customers can't find, view or buy it. It stays here so you can bring it back any time." : "Hide it to take it off the shop, search and product pages without deleting it."}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => toggleHidden(p)} disabled={busy} className={`text-xs font-extrabold rounded-full px-4 py-2 inline-flex items-center gap-1.5 disabled:opacity-50 ${p.hidden ? "bg-[#7bc67e] hover:bg-[#5eb062] text-[#1a1a1a]" : "bg-[#1a1a1a] hover:bg-black text-white"}`} data-testid={`aps-toggle-hidden-${p.id}`}>
                        {p.hidden ? <><Eye size={12} /> Show on site</> : <><EyeOff size={12} /> Hide from site</>}
                      </button>
                      <button onClick={() => duplicate(p)} disabled={busy} className="text-xs font-extrabold rounded-full px-4 py-2 inline-flex items-center gap-1.5 disabled:opacity-50 bg-white border-2 border-[#e5e7eb] hover:border-[#7bc67e] text-[#1a1a1a]" title="Make a separate copy of this product" data-testid={`aps-duplicate-${p.id}`}>
                        <Copy size={12} /> Duplicate
                      </button>
                      </div>
                    </div>
                    {/* Basics - name, price, category, descriptions (in ProductOverridePanel) */}
                    <ProductOverridePanel key={`${p.id}-${p.hidden}`} product={p} onSaved={(changes) => update(p.id, changes)} onReverted={reload} registerSaver={registerBasicsSaver} />

                    {/* Product details */}
                    <Section title="Product details" hint="Brand, code and the full description shown on the product page.">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Lab label="Brand"><input data-testid={`aps-brand-${p.id}`} value={p.brand || ""} onChange={(e) => update(p.id, { brand: e.target.value })} className={ic} /></Lab>
                        <Lab label="Product code (SKU)"><input data-testid={`aps-sku-${p.id}`} value={p.sku || ""} onChange={(e) => update(p.id, { sku: e.target.value })} className={ic} /></Lab>
                      </div>
                      <Lab label="Full description"><textarea data-testid={`aps-desc-${p.id}`} value={p.description_full || ""} onChange={(e) => update(p.id, { description_full: e.target.value })} rows={3} className={ic + " resize-none"} /></Lab>
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
                    </Section>

                    {/* Photos */}
                    <Section title="Photos" hint="Extra product photos shown as thumbnails on the product page. The main image is set above; these are additional shots (back view, lifestyle, detail). Up to 8.">
                      <ImageGalleryEditor
                        productId={p.id}
                        urls={Array.isArray(p.image_gallery) ? p.image_gallery : []}
                        onChange={(next) => update(p.id, { image_gallery: next })}
                      />
                    </Section>

                    {/* Where it shows on the site */}
                    <Section title="Where it shows on the site" hint="Choose which industry pages this product appears on, and whether it features in special collections.">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Industry pages this appears on</div>
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
                      <label className="flex items-center justify-between gap-3 bg-[#fef3c7] border-2 border-[#fde68a] rounded-xl p-3 cursor-pointer" data-testid={`aps-workforce-row-${p.id}`}>
                        <span className="inline-flex items-center gap-2 flex-1">
                          <input type="checkbox" checked={!!p.workforce_eligible} onChange={(e) => update(p.id, { workforce_eligible: e.target.checked })} className="w-4 h-4 accent-amber-500" data-testid={`aps-workforce-${p.id}`} />
                          <span>
                            <span className="block text-sm font-nunito font-extrabold">Show in &quot;Kit Your Workforce&quot;</span>
                            <span className="block text-[11px] text-[#4b5563]">Appears in the /workforce mixed-bulk builder.</span>
                          </span>
                        </span>
                        <Briefcase size={16} className="text-amber-600" />
                      </label>
                      <label className="flex items-center justify-between gap-3 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-xl p-3 cursor-pointer" data-testid={`aps-specials-row-${p.id}`}>
                        <span className="inline-flex items-center gap-2 flex-1">
                          <input type="checkbox" checked={!!p.specials_eligible} onChange={(e) => update(p.id, { specials_eligible: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-specials-${p.id}`} />
                          <span>
                            <span className="block text-sm font-nunito font-extrabold">Show in &quot;Your Own Print Specials&quot;</span>
                            <span className="block text-[11px] text-[#4b5563]">Starter lineup, no minimum order. Shown on /specials.</span>
                          </span>
                        </span>
                        <Sparkles size={16} className="text-[#7bc67e]" />
                      </label>
                      <label className="flex items-center justify-between gap-3 bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-xl p-3 cursor-pointer" data-testid={`aps-bestseller-row-${p.id}`}>
                        <span className="inline-flex items-center gap-2 flex-1">
                          <input type="checkbox" checked={!!p.is_bestseller} onChange={(e) => update(p.id, { is_bestseller: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-bestseller-${p.id}`} />
                          <span>
                            <span className="block text-sm font-nunito font-extrabold">Show in Best Sellers on the homepage</span>
                            <span className="block text-[11px] text-[#4b5563]">Features in the homepage best-sellers strip.</span>
                          </span>
                        </span>
                      </label>
                      <div className="flex items-center justify-between gap-3 flex-wrap bg-[#eef2ff] border-2 border-[#c7d2fe] rounded-xl p-3" data-testid={`aps-designer-status-${p.id}`}>
                        <label className="inline-flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                          <input type="checkbox" checked={!!p.designer_enabled} disabled={busy} onChange={(e) => toggleDesigner(p, e.target.checked)} className="w-4 h-4 accent-[#4338ca]" data-testid={`aps-designer-toggle-${p.id}`} />
                          <span className="min-w-0">
                            <span className="block text-sm font-nunito font-extrabold">Available in the Design Your Own tool</span>
                            <span className="block text-[11px] text-[#4b5563]">
                              {p.designer_enabled
                                ? "Customers can pick this product in the designer. Saves straight away."
                                : "Tick to let customers personalise this product in the designer. Saves straight away."}
                            </span>
                          </span>
                        </label>
                        {p.designer_enabled && (
                          <a href={`/admin/designer-products?q=${encodeURIComponent(p.name)}`} className="text-xs font-extrabold text-[#4338ca] hover:underline flex-shrink-0" data-testid={`aps-designer-link-${p.id}`}>
                            Set up designer photos, colours &amp; print area →
                          </a>
                        )}
                      </div>
                      <label className="flex items-center justify-between gap-3 bg-[#eef2ff] border-2 border-[#c7d2fe] rounded-xl p-3 cursor-pointer" data-testid={`aps-designeronly-row-${p.id}`}>
                        <span className="inline-flex items-center gap-2 flex-1">
                          <input type="checkbox" checked={!!p.designer_only} onChange={(e) => update(p.id, { designer_only: e.target.checked })} className="w-4 h-4 accent-[#4338ca]" data-testid={`aps-designeronly-${p.id}`} />
                          <span>
                            <span className="block text-sm font-nunito font-extrabold">Only sell it through Design Your Own</span>
                            <span className="block text-[11px] text-[#4b5563]">Hidden from shop categories, industry pages and Find My Kit - appears only in the Design Your Own tool. Use for blank canvases sold for personalisation.</span>
                          </span>
                        </span>
                      </label>
                      {p.designer_only && !p.designer_enabled && (
                        <div className="flex items-center justify-between gap-3 flex-wrap bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-sm text-amber-800" data-testid={`aps-designer-warning-${p.id}`}>
                          <span><strong>This product won't appear anywhere.</strong> It's set to only sell through Design Your Own, but it isn't in the Design Your Own tool.</span>
                          <button type="button" onClick={() => toggleDesigner(p, true)} disabled={busy} className="text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white rounded-full px-3 py-1.5 disabled:opacity-50 flex-shrink-0">Add it to the designer</button>
                        </div>
                      )}
                    </Section>

                    {/* Printing */}
                    <Section title="Printing" hint="Tick which print locations are physically possible on this garment. Anything unticked is hidden from customers on the product page and in the designer.">
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
                    </Section>

                    {/* Size guide */}
                    <Section title="Size guide" hint="Optional. A size chart shown on the product page.">
                      <Lab label="Size guide image URL"><input data-testid={`aps-sg-img-${p.id}`} value={p.size_guide_image || ""} onChange={(e) => update(p.id, { size_guide_image: e.target.value })} className={ic} placeholder="https://…" /></Lab>
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
                    </Section>

                    {/* Related products */}
                    <Section title="Related products" hint="Suggest other products on this product's page.">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Customers also bought</div>
                        <div className="text-[11px] text-[#4b5563] mb-2">Up to 6. Leave empty to auto-pick from the same category.</div>
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
                        <div className="text-[10px] uppercase tracking-wider font-nunito font-extrabold text-[#4b5563] mb-1">Match with (complete the look)</div>
                        <div className="text-[11px] text-[#4b5563] mb-2">Up to 4 complementary items (e.g. matching joggers, beanie). Hidden if empty.</div>
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
                    </Section>

                    {/* Bulk pricing */}
                    <Section title="Bulk pricing" hint="Optional. Give discounts for larger quantities.">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!p.bulk_pricing_enabled} onChange={(e) => update(p.id, { bulk_pricing_enabled: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-bulk-${p.id}`} />
                        <span className="text-sm font-nunito font-extrabold">Give discounts for larger quantities</span>
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
                    </Section>
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
// Shopify-style section card - a titled group of related fields with breathing room.
function Section({ title, hint, children }) {
  return (
    <div className="bg-white border-2 border-[#eef2f7] rounded-2xl p-4 sm:p-5">
      <div className="font-nunito font-black text-sm text-[#1a1a1a]">{title}</div>
      {hint && <div className="text-[11px] text-[#4b5563] mt-0.5 mb-3">{hint}</div>}
      <div className={hint ? "space-y-3" : "space-y-3 mt-3"}>{children}</div>
    </div>
  );
}


/**
 * Search-to-add product picker for cross-sell fields (also_bought, match_with).
 * Renders only the CURRENTLY SELECTED items as chips, plus a search box that
 * shows up to 8 matching suggestions at a time - never renders the whole
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

// Upload one or more images to our storage (R2) and hand back their URLs.
function UploadImageButton({ onUploaded, multiple = false, label = "Upload", testid }) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef(null);
  const onFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusy(true);
    const urls = [];
    try {
      for (const file of list) {
        if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} is over 8MB - please make it smaller`); continue; }
        try {
          const { url } = await uploadAdminImage(file, "product-images");
          if (url) urls.push(url);
        } catch (e) { toast.error(e?.response?.data?.detail || `Couldn't upload ${file.name}`); }
      }
      if (urls.length) onUploaded(urls);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 border-2 border-[#7bc67e] text-[#166534] hover:bg-white font-nunito font-extrabold text-xs px-3 py-1.5 rounded-full whitespace-nowrap disabled:opacity-50" data-testid={testid}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {busy ? "Uploading…" : label}
      </button>
    </>
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
        <UploadImageButton
          multiple
          label="Upload photos"
          testid={`aps-gallery-${productId}-upload`}
          onUploaded={(newUrls) => {
            const room = Math.max(0, 8 - urls.length);
            if (newUrls.length > room) toast.error("Max 8 extra photos - some weren't added");
            if (room) onChange([...urls, ...newUrls.slice(0, room)]);
          }}
        />
      </div>
      <div className="text-[10px] text-[#4b5563] mt-1">Remember to click Save at the bottom.</div>
    </div>
  );
}

/**
 * Inline "edit the hardcoded catalogue" panel - sits at the top of every
 * expanded product row. Writes go to PATCH /admin/products/{pid}/override
 * (persisted in Mongo + hot-applied to the in-memory PRODUCTS registry).
 *
 * Revert (DELETE /admin/products/{pid}/override) removes the doc and restores
 * the pristine hardcoded values immediately - no restart needed.
 */
function ProductOverridePanel({ product, onSaved, onReverted, registerSaver }) {
  const [draft, setDraft] = React.useState({
    name: product.name || "",
    price: product.price ?? 0,
    description: product.description || "",
    image: product.image || "",
    category: product.category || "",
    active: !product.hidden,
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
    draft.active !== !product.hidden
  );

  // quiet: called from the main Save button, which shows its own message and
  // reloads; errors are re-thrown so it can report them. Returns the saved name.
  const save = async ({ quiet = false } = {}) => {
    // Send ONLY what changed. An emptied name/description/photo/category tells
    // the server to go back to the original for that field.
    const changes = {};
    const name = (draft.name || "").trim();
    if (name !== (product.name || "")) changes.name = name;
    const price = Number(draft.price);
    if (price !== Number(product.price)) {
      if (!Number.isFinite(price) || price <= 0) {
        const err = { response: { data: { detail: "Price must be a number above 0" } } };
        if (quiet) throw err;
        toast.error(err.response.data.detail);
        return null;
      }
      changes.price = price;
    }
    if ((draft.description || "") !== (product.description || "")) changes.description = draft.description || "";
    if ((draft.image || "").trim() !== (product.image || "")) changes.image = (draft.image || "").trim();
    if ((draft.category || "") !== (product.category || "")) changes.category = draft.category || "";
    if (draft.active !== !product.hidden) changes.active = draft.active;
    if (!Object.keys(changes).length) return null;
    setBusy(true);
    try {
      await patchProductOverride(product.id, changes);
      const cleared = ["name", "description", "image", "category"].some((k) => k in changes && !String(changes[k]).trim());
      if (cleared) {
        onReverted && onReverted();  // server went back to the original - fetch it
      } else if (onSaved) {
        const local = { ...changes };
        if ("active" in local) { local.hidden = !local.active; delete local.active; }
        onSaved(local);
      }
      if (!quiet) toast.success(`${name || product.name} saved`);
      return name || product.name;
    } catch (e) {
      if (quiet) throw e;
      toast.error(e?.response?.data?.detail || "Save failed");
    }
    finally { setBusy(false); }
  };

  // Let the main Save button see and save this box (latest values via a ref).
  const latest = React.useRef({ dirty, save });
  latest.current = { dirty, save };
  React.useEffect(() => {
    if (!registerSaver) return undefined;
    registerSaver(product.id, { isDirty: () => latest.current.dirty, save: (o) => latest.current.save(o) });
    return () => registerSaver(product.id, null);
  }, [product.id, registerSaver]);

  const revert = async () => {
    if (!window.confirm(`Revert "${product.name}" back to its original name, price, description and photo? Your changes in this box will be removed.`)) return;
    setBusy(true);
    try {
      await clearProductOverride(product.id);
      toast.success("Back to the original");
      onReverted && onReverted();
    } catch (e) { toast.error(e?.response?.data?.detail || "Revert failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-[#f0fdf4] border-2 border-[#dcfce7] rounded-2xl p-4 space-y-3" data-testid={`aps-override-${product.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold text-[#166534]">
          <Pencil size={12} /> Name, price &amp; main photo
          {loaded && override && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#7bc67e] text-[#1a1a1a] text-[10px]" data-testid={`aps-override-badge-${product.id}`}>Changed from the original</span>}
        </div>
        {loaded && override && (
          <button type="button" onClick={revert} disabled={busy} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1 disabled:opacity-50" data-testid={`aps-override-revert-${product.id}`}>
            <RotateCcw size={11} /> Undo changes - go back to the original
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <Lab label="Product name">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={ic} data-testid={`aps-override-name-${product.id}`} />
        </Lab>
        <Lab label="Price (£)">
          <input type="number" step="0.01" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={ic} data-testid={`aps-override-price-${product.id}`} />
        </Lab>
      </div>
      <Lab label="Category (which shop collection this appears in)">
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={ic} data-testid={`aps-override-category-${product.id}`}>
          <option value="">Work it out from the product name</option>
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Lab>
      <Lab label="Short description (shown on product cards + PDP intro)">
        <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={ic + " resize-none"} data-testid={`aps-override-desc-${product.id}`} />
      </Lab>
      <Lab label="Main photo">
        <div className="flex items-center gap-2">
          {draft.image
            ? <img src={draft.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#e5e7eb] bg-white flex-shrink-0" data-testid={`aps-override-image-preview-${product.id}`} />
            : <span className="w-12 h-12 rounded-lg border border-dashed border-[#d1d5db] bg-white flex-shrink-0" />}
          <input value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} className={ic} placeholder="Upload a photo, or paste a link https://…" data-testid={`aps-override-image-${product.id}`} />
          <UploadImageButton testid={`aps-override-image-upload-${product.id}`} onUploaded={(urls) => { setDraft((d) => ({ ...d, image: urls[0] })); toast("Photo uploaded - click Save to use it"); }} />
        </div>
      </Lab>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="w-4 h-4 accent-[#7bc67e]" data-testid={`aps-override-active-${product.id}`} />
          <span className="text-xs font-extrabold">Visible on the site (untick to hide it from customers)</span>
        </label>
        <button onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-50 text-[#1a1a1a] font-extrabold text-xs px-4 py-2 rounded-full" data-testid={`aps-override-save-${product.id}`}>
          {busy ? <Loader2 className="animate-spin" size={11} /> : <Save size={11} />} Save
        </button>
      </div>
    </div>
  );
}


// Clearance check - PenCarrie flags clearance / discontinued lines; this pulls
// today's data, marks products, and offers one-click tidy-ups. Nothing is
// deleted: products are hidden (reversible) and ending colours removed.
function ClearanceCheck({ onFilter, onChanged }) {
  const [info, setInfo] = React.useState(null);   // {checked_at, counts}
  const [busy, setBusy] = React.useState("");
  React.useEffect(() => { clearanceStatus().then(setInfo).catch(() => {}); }, []);
  const c = (info && info.counts) || {};
  const ending = (c.ending || 0) + (c.gone || 0);
  const run = async (label, fn, after) => {
    setBusy(label);
    try { const r = await fn(); after && after(r); onChanged && onChanged(); }
    catch (e) { toast.error(e?.response?.data?.detail || "That didn't work - try again"); }
    finally { setBusy(""); }
  };
  return (
    <div className="mt-6 bg-white border-2 border-[#fde2e2] rounded-2xl p-4" data-testid="aps-clearance-check">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-nunito font-black">Clearance check</div>
          <div className="text-[11px] text-[#4b5563] mt-0.5">
            Finds PenCarrie products that are on clearance or discontinued (they won&rsquo;t be available for long), using today&rsquo;s PenCarrie data.
            {info && info.checked_at ? ` Last checked ${new Date(info.checked_at).toLocaleString("en-GB")}.` : " Not checked yet."}
          </div>
        </div>
        <button onClick={() => run("Checking PenCarrie - this can take a minute…", clearanceScan, (r) => { setInfo({ checked_at: r.checked_at, counts: r.counts }); toast.success("Clearance check done"); })} disabled={!!busy} className="inline-flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-black disabled:opacity-50 text-white font-extrabold text-xs rounded-full px-4 py-2" data-testid="aps-clearance-scan">
          {busy ? <Loader2 size={12} className="animate-spin" /> : null} Check PenCarrie now
        </button>
      </div>
      {busy && <div className="text-xs text-[#166534] font-bold mt-2">{busy}</div>}
      {info && info.counts && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <div><strong>{ending}</strong> fully clearance, discontinued or no longer stocked</div>
            <div className="flex gap-3 mt-1.5 text-xs font-extrabold flex-wrap">
              <button onClick={() => onFilter("ending")} className="text-rose-700 hover:underline">Show them</button>
              {ending > 0 && <button disabled={!!busy} onClick={() => { if (window.confirm(`Hide all ${ending} fully clearance / discontinued / no-longer-stocked products from the site? You can show any of them again later.`)) run("Hiding…", clearanceHideEnding, (r) => toast.success(`${r.hidden} products hidden`)); }} className="text-rose-700 hover:underline disabled:opacity-40" data-testid="aps-clearance-hide">Hide them all</button>}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <div><strong>{c.partial || 0}</strong> with some colours ending</div>
            <div className="flex gap-3 mt-1.5 text-xs font-extrabold flex-wrap">
              <button onClick={() => onFilter("partial")} className="text-orange-700 hover:underline">Show them</button>
              {(c.partial || 0) > 0 && <button disabled={!!busy} onClick={() => { if (window.confirm(`Remove the ending colours from ${c.partial} products, so customers can't pick a colour that's about to run out? The rest of each product stays on sale.`)) run("Removing ending colours…", clearanceRemoveEndingColours, (r) => toast.success(`${r.colours_removed} colours removed from ${r.products_changed} products`)); }} className="text-orange-700 hover:underline disabled:opacity-40" data-testid="aps-clearance-colours">Remove ending colours</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
