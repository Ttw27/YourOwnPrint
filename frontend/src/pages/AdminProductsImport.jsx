import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchImportedProducts, bulkImportProducts, patchImportedProduct, deleteImportedProduct,
  pencarrieFetchCatalogue, bulkUpdateImported,
} from "../lib/api";
import {
  Upload, Plus, Trash2, Save, Loader2, Download, FileText, X, Info, ExternalLink, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";

/**
 * /admin/products-import — One-off bulk import for PenCarrie (or any) products.
 *
 * Three input methods:
 *   1. CSV upload (drag-drop or click)
 *   2. JSON paste
 *   3. Add a single row manually
 *
 * Then: preview table with auto-categorisation + auto-priced markup, edit inline,
 * save. Already-imported products list below with delete / re-edit.
 *
 * CSV columns expected (any subset, case-insensitive):
 *   name, source_sku, source_price, price, image, description, colours (pipe-sep),
 *   sizes (pipe-sep), gender_fit, brand, category
 */

const GARMENT_TYPES = [
  "t-shirts", "shirts", "hoodies", "polos", "sweatshirts", "aprons", "bottoms",
  "shorts", "jackets", "hi-vis", "hats", "footwear", "towels",
  "promotional", "kids-baby", "accessories", "bags", "socks",
];
const GENDER_OPTIONS = ["unisex", "mens", "womens", "kids"];

const SAMPLE_CSV = `name,source_sku,source_price,image,description,colours,sizes,gender_fit,brand
AWDis College Hoodie,JH001,8.99,https://images.pexels.com/photos/8532610/pexels-photo-8532610.jpeg,Classic 280gsm pullover hoodie,Black|Navy|Grey Marl,S|M|L|XL|XXL,unisex,AWDis
AWDis Just Polos Polo Shirt,JP001,6.50,https://images.pexels.com/photos/8532614/pexels-photo-8532614.jpeg,Slim-fit pique polo,White|Bottle Green|Navy,S|M|L|XL,unisex,AWDis
`;

// Minimal RFC-4180-ish CSV parser (handles quoted values + escaped quotes).
function parseCsv(text) {
  const rows = [];
  let cur = [];
  let val = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { val += '"'; i++; }
      else if (c === '"') inQuote = false;
      else val += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { cur.push(val); val = ""; }
      else if (c === "\n") { cur.push(val); rows.push(cur); cur = []; val = ""; }
      else if (c === "\r") { /* skip */ }
      else val += c;
    }
  }
  if (val.length > 0 || cur.length > 0) { cur.push(val); rows.push(cur); }
  if (!rows.length) return [];
  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim().toLowerCase());
  return body
    .filter((r) => r.some((v) => (v || "").trim()))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])));
}

// Normalise a raw CSV/JSON row into the shape our bulk-import endpoint expects.
function normaliseRow(raw) {
  const pick = (...keys) => {
    for (const k of keys) if (raw[k] != null && raw[k] !== "") return raw[k];
    return "";
  };
  const coloursRaw = pick("colours", "colors", "colour", "color");
  const sizesRaw = pick("sizes", "size");
  let colours;
  if (Array.isArray(coloursRaw)) {
    // Already structured (e.g. from a JSON paste with per-colour images) — keep as-is,
    // just make sure every entry has the shape we need.
    colours = coloursRaw.map((c) =>
      typeof c === "object" && c !== null
        ? { name: String(c.name || "").trim(), hex: c.hex || "#cccccc", image: c.image || "" }
        : { name: String(c).trim(), hex: "#cccccc" }
    ).filter((c) => c.name);
  } else {
    colours = String(coloursRaw || "")
      .split(/[|,;]/).map((s) => s.trim()).filter(Boolean)
      .map((name) => ({ name, hex: "#cccccc" }));
  }
  const sizes = String(sizesRaw || "").split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
  return {
    name: pick("name", "title", "product_name", "style_name", "description_short"),
    source_sku: pick("source_sku", "sku", "style", "code", "style_code", "product_code"),
    source_price: parseFloat(pick("source_price", "trade_price", "cost", "price_net", "net_price", "unit_cost")) || undefined,
    price: parseFloat(pick("price", "retail_price", "rrp")) || undefined,
    image: pick("image", "image_url", "img", "picture", "image_1", "primary_image"),
    additional_images: String(pick("additional_images", "gallery", "image_2", "image_3") || "").split(/[|;]/).map((s) => s.trim()).filter(Boolean),
    description: pick("description", "desc", "summary", "description_long"),
    colors: colours,
    sizes,
    gender_fit: (pick("gender_fit", "gender", "fit") || "unisex").toLowerCase(),
    brand: pick("brand", "brand_name"),
    category: pick("category", "garment_type", "product_type"),
    industry_tags: String(pick("industry_tags", "tags") || "").split(/[|,;]/).map((s) => s.trim()).filter(Boolean),
  };
}

const EMPTY_ROW = {
  name: "", source_sku: "", source_price: "", price: "", image: "", description: "",
  colors: [], sizes: [], gender_fit: "unisex", brand: "", category: "",
};

export default function AdminProductsImport() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [imported, setImported] = useState([]);
  const [importedTotal, setImportedTotal] = useState(0);
  const [importedPage, setImportedPage] = useState(0);
  const [importedSearch, setImportedSearch] = useState("");
  const IMPORTED_PAGE_SIZE = 25;

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    scope: "all", // "all" or "search" (uses the search box above)
    reprice: true,
    markup_pct: 40,
    apply_vat: true,
    vat_rate_pct: 20,
    charm_price_99: true,
    set_bulk_pricing_enabled: "unchanged", // "unchanged" | "on" | "off"
  });

  async function runBulkUpdate(dryRun) {
    setBulkBusy(true);
    try {
      const payload = {
        q: bulkForm.scope === "search" ? importedSearch : "",
        reprice: bulkForm.reprice,
        markup_pct: Number(bulkForm.markup_pct) || 0,
        apply_vat: bulkForm.apply_vat,
        vat_rate_pct: Number(bulkForm.vat_rate_pct) || 20,
        charm_price_99: bulkForm.charm_price_99,
        set_bulk_pricing_enabled: bulkForm.set_bulk_pricing_enabled === "unchanged" ? null : bulkForm.set_bulk_pricing_enabled === "on",
        dry_run: dryRun,
      };
      const d = await bulkUpdateImported(payload);
      if (dryRun) {
        toast.success(`Would match ${d.matched} product(s) — ${d.repriced} would be repriced${d.skipped_no_cost ? `, ${d.skipped_no_cost} skipped (no saved trade cost)` : ""}.`);
      } else {
        toast.success(`Updated ${d.matched} product(s) — ${d.repriced} repriced${d.skipped_no_cost ? `, ${d.skipped_no_cost} skipped (no saved trade cost)` : ""}.`);
        refresh();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [defaults, setDefaults] = useState({
    default_source: "pencarrie",
    default_brand: "",
    default_gender_fit: "unisex",
    default_markup_pct: 40,
    apply_vat: true,
    vat_rate_pct: 20,
    charm_price_99: true,
  });

  async function refresh(page = importedPage) {
    setLoading(true);
    try {
      const d = await fetchImportedProducts(page * IMPORTED_PAGE_SIZE, IMPORTED_PAGE_SIZE, importedSearch);
      setImported(d.items || []);
      setImportedTotal(d.total || 0);
    }
    catch { toast.error("Failed to load imported products"); }
    finally { setLoading(false); }
  }
  useEffect(() => { setImportedPage(0); refresh(0); }, [importedSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(importedPage); }, [importedPage]); // eslint-disable-line react-hooks/exhaustive-deps

  function pushRows(list) {
    const normalised = list.map(normaliseRow).filter((r) => r.name);
    setRows((prev) => [...prev, ...normalised]);
    setSelected(new Set());
    toast.success(`${normalised.length} row${normalised.length === 1 ? "" : "s"} loaded — review below then save.`);
  }

  function onCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { pushRows(parseCsv(String(r.result || ""))); }
      catch { toast.error("CSV parse failed — check the file format."); }
    };
    r.readAsText(file);
    e.target.value = "";
  }

  function onJsonParse() {
    try {
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.products || []);
      if (!Array.isArray(list)) throw new Error("Not an array");
      pushRows(list);
      setJsonText("");
    } catch { toast.error("JSON must be an array of products or {items: [...]}"); }
  }

  function onJsonFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result || ""));
        const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.products || []);
        if (!Array.isArray(list)) throw new Error("Not an array");
        pushRows(list);
      } catch { toast.error("Couldn't read that file — make sure it's a JSON array of products."); }
    };
    r.readAsText(file);
    e.target.value = "";
  }

  const [pencarrieLoading, setPencarrieLoading] = useState(false);
  const [pencarrieOffset, setPencarrieOffset] = useState(0);
  const [pencarrieTotal, setPencarrieTotal] = useState(null);
  const [pencarrieMatching, setPencarrieMatching] = useState(null);
  const [pencarrieBrands, setPencarrieBrands] = useState([]);
  const [pencarrieBrand, setPencarrieBrand] = useState("");
  const [pencarrieSearch, setPencarrieSearch] = useState("");

  async function onPencarrieFetch(resetPaging) {
    const nextOffset = resetPaging ? 0 : pencarrieOffset;
    setPencarrieLoading(true);
    try {
      const d = await pencarrieFetchCatalogue(nextOffset, 500, pencarrieBrand, pencarrieSearch);
      pushRows(d.rows || []);
      setPencarrieTotal(d.total_available ?? null);
      setPencarrieMatching(d.total_matching ?? null);
      setPencarrieBrands(d.available_brands || []);
      setPencarrieOffset(nextOffset + (d.returned || 0));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't fetch from PenCarrie — check your API token in /admin/integrations.");
    } finally {
      setPencarrieLoading(false);
    }
  }

  function onPencarrieFilterChange() {
    setPencarrieOffset(0);
    onPencarrieFetch(true);
  }

  const patchRow = (i, p) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...p } : r));
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const toggleSelect = (i) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  const toggleSelectAll = () => setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((_, i) => i)));
  const removeSelected = () => {
    const count = selected.size;
    setRows((rs) => rs.filter((_, idx) => !selected.has(idx)));
    setSelected(new Set());
    toast.success(`Removed ${count} row${count === 1 ? "" : "s"}.`);
  };
  const keepOnlySelected = () => {
    const count = rows.length - selected.size;
    setRows((rs) => rs.filter((_, idx) => selected.has(idx)));
    setSelected(new Set());
    toast.success(`Removed ${count} row${count === 1 ? "" : "s"}, kept the rest.`);
  };
  const clearAll = () => { setRows([]); setSelected(new Set()); };
  const addManualRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);

  const [saveProgress, setSaveProgress] = useState(null); // {done, total} while saving

  async function saveAll() {
    const filtered = rows.filter((r) => r.name?.trim());
    if (!filtered.length) { toast.error("Nothing to save."); return; }

    const CHUNK_SIZE = 100; // keeps each request well clear of any platform timeout, even with many images per product
    const chunks = [];
    for (let i = 0; i < filtered.length; i += CHUNK_SIZE) chunks.push(filtered.slice(i, i + CHUNK_SIZE));

    setSaving(true);
    setSaveProgress({ done: 0, total: chunks.length });
    let totalCreated = 0, totalSkipped = 0, totalMirrored = 0, totalFailed = 0;
    const savedRows = new Set();

    try {
      for (let i = 0; i < chunks.length; i++) {
        try {
          const d = await bulkImportProducts({ ...defaults, items: chunks[i] });
          totalCreated += d.created?.length || 0;
          totalSkipped += d.skipped?.length || 0;
          totalMirrored += d.images_mirrored_to_r2 || 0;
          totalFailed += d.images_failed_to_mirror || 0;
          chunks[i].forEach((r) => savedRows.add(r));
          setSaveProgress({ done: i + 1, total: chunks.length });
        } catch (e) {
          // Stop here — remove only what actually saved, so nothing's lost or double-saved on retry.
          setRows((prev) => prev.filter((r) => !savedRows.has(r)));
          toast.error(
            `Saved ${totalCreated} product(s) across ${i} of ${chunks.length} batches, then hit an error: `
            + (e?.response?.data?.detail || "Import failed")
            + ". The rest are still in the preview below — safe to just click Save again to continue from here."
          );
          return;
        }
      }
      const imgNote = totalMirrored || totalFailed
        ? ` ${totalMirrored} image(s) saved to R2${totalFailed ? `, ${totalFailed} couldn't be fetched (kept original link)` : ""}.`
        : "";
      toast.success(`Imported ${totalCreated} products${totalSkipped ? `, ${totalSkipped} skipped` : ""}.${imgNote}`);
      setRows([]);
      refresh();
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  }

  async function removeImported(id) {
    if (!window.confirm("Delete this imported product? It will disappear from the site immediately.")) return;
    try { await deleteImportedProduct(id); toast.success("Deleted"); refresh(); }
    catch { toast.error("Delete failed"); }
  }

  async function toggleActive(row) {
    try { await patchImportedProduct(row.id, { active: !row.active }); refresh(); }
    catch { toast.error("Update failed"); }
  }

  const previewCount = useMemo(() => rows.filter((r) => r.name?.trim()).length, [rows]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-products-import">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Import products</h1>
        <p className="text-sm text-[#4b5563] mb-6">One-off bulk import for supplier catalogues (PenCarrie, House of Uniforms, etc.). Rows are auto-categorised (hoodies / polos / t-shirts / …), auto-priced from trade cost × markup, and appear on the site instantly under the right collection with sidebar facets working out-of-the-box.</p>

        {/* Defaults */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 mb-4" data-testid="apx-defaults">
          <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold mb-3">Defaults (applied to every row unless overridden)</div>
          <div className="grid sm:grid-cols-4 gap-3">
            <label className="block">
              <div className="text-[10px] font-extrabold mb-1">Source</div>
              <select value={defaults.default_source} onChange={(e) => setDefaults({ ...defaults, default_source: e.target.value })} className="input" data-testid="apx-default-source">
                <option value="pencarrie">PenCarrie</option>
                <option value="manual">Manual</option>
                <option value="other">Other supplier</option>
              </select>
            </label>
            <label className="block">
              <div className="text-[10px] font-extrabold mb-1">Brand</div>
              <input value={defaults.default_brand} onChange={(e) => setDefaults({ ...defaults, default_brand: e.target.value })} className="input" placeholder="e.g. AWDis" data-testid="apx-default-brand" />
            </label>
            <label className="block">
              <div className="text-[10px] font-extrabold mb-1">Default fit</div>
              <select value={defaults.default_gender_fit} onChange={(e) => setDefaults({ ...defaults, default_gender_fit: e.target.value })} className="input" data-testid="apx-default-fit">
                {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-[10px] font-extrabold mb-1">Markup % (on ex-VAT trade cost)</div>
              <input type="number" step="1" value={defaults.default_markup_pct} onChange={(e) => setDefaults({ ...defaults, default_markup_pct: parseFloat(e.target.value) || 0 })} className="input" data-testid="apx-default-markup" />
            </label>
            <label className="flex items-center gap-2 mt-5">
              <input type="checkbox" checked={defaults.apply_vat} onChange={(e) => setDefaults({ ...defaults, apply_vat: e.target.checked })} data-testid="apx-apply-vat" />
              <span className="text-[10px] font-extrabold">Add VAT ({defaults.vat_rate_pct}%)</span>
            </label>
            <label className="flex items-center gap-2 mt-5">
              <input type="checkbox" checked={defaults.charm_price_99} onChange={(e) => setDefaults({ ...defaults, charm_price_99: e.target.checked })} data-testid="apx-charm-price" />
              <span className="text-[10px] font-extrabold">Round up to nearest £X.99</span>
            </label>
          </div>
          <p className="text-[11px] text-[#4b5563] mt-2 inline-flex items-start gap-1.5"><Info size={11} className="mt-0.5 text-[#7bc67e]" />If a row has an explicit <code>price</code>, that&apos;s used as-is, untouched. Otherwise: retail price = (source_price × (1 + markup%)) {defaults.apply_vat ? `× (1 + ${defaults.vat_rate_pct}% VAT)` : ""} {defaults.charm_price_99 ? ", rounded up to the nearest £X.99" : ""}. e.g. an £8.00 trade cost at 40% markup{defaults.apply_vat ? " + VAT" : ""}{defaults.charm_price_99 ? ", charm-priced" : ""} → about £{(() => { let p = 8 * 1.4; if (defaults.apply_vat) p *= (1 + defaults.vat_rate_pct / 100); if (defaults.charm_price_99) { const pounds = Math.floor(p); p = pounds + 0.99; } return p.toFixed(2); })()}.</p>
        </div>

        {/* Input methods */}
        <div className="bg-white border-2 border-[#7bc67e] rounded-2xl p-5 mb-4" data-testid="apx-pencarrie-panel">
          <div className="flex items-center gap-2 mb-3">
            <Download size={18} className="text-[#7bc67e]" />
            <div className="text-sm font-extrabold">Fetch from PenCarrie</div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <div className="text-[10px] font-extrabold mb-1">Brand (optional)</div>
              <select value={pencarrieBrand} onChange={(e) => setPencarrieBrand(e.target.value)} className="input" data-testid="apx-pencarrie-brand">
                <option value="">All brands</option>
                {pencarrieBrands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-[10px] font-extrabold mb-1">Search name / style (optional)</div>
              <input value={pencarrieSearch} onChange={(e) => setPencarrieSearch(e.target.value)} placeholder="e.g. hoodie, polo, JH001…" className="input" data-testid="apx-pencarrie-search" />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={onPencarrieFilterChange} disabled={pencarrieLoading} className="w-full bg-[#7bc67e] hover:bg-[#5eb062] disabled:opacity-60 rounded-full text-sm font-extrabold py-2.5 inline-flex items-center justify-center gap-1.5" data-testid="apx-pencarrie-fetch">
                {pencarrieLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Fetch
              </button>
            </div>
          </div>
          {pencarrieTotal != null && (
            <div className="text-[11px] text-[#4b5563] mt-3 flex items-center justify-between flex-wrap gap-2">
              <span>
                {pencarrieMatching != null && pencarrieMatching !== pencarrieTotal
                  ? `${pencarrieMatching} match your filter (of ${pencarrieTotal} total) · `
                  : `${pencarrieTotal} products available · `}
                {pencarrieOffset} loaded so far
              </span>
              {pencarrieOffset < (pencarrieMatching ?? pencarrieTotal) && (
                <button type="button" onClick={() => onPencarrieFetch(false)} disabled={pencarrieLoading} className="font-extrabold text-[#166534] hover:underline" data-testid="apx-pencarrie-next">
                  Load next 500 →
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <label className="bg-white border-2 border-dashed border-[#7bc67e] hover:bg-[#f0fdf4] rounded-2xl p-5 cursor-pointer transition text-center" data-testid="apx-upload-csv">
            <input type="file" accept=".csv,text/csv" onChange={onCsvFile} className="hidden" />
            <Upload size={22} className="mx-auto text-[#7bc67e]" />
            <div className="mt-2 text-sm font-extrabold">Upload CSV</div>
            <div className="text-[11px] text-[#4b5563] mt-0.5">Columns: name, source_sku, source_price, image, description, colours, sizes …</div>
          </label>
          <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-4" data-testid="apx-json">
            <div className="text-xs font-extrabold flex items-center justify-between">
              <span><FileText size={12} className="inline mr-1 text-[#7bc67e]" /> Paste or upload JSON</span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-extrabold text-[#166534] hover:underline cursor-pointer">
                  Upload file…
                  <input type="file" accept=".json,application/json" onChange={onJsonFile} className="hidden" data-testid="apx-json-file" />
                </label>
                <button type="button" onClick={onJsonParse} disabled={!jsonText.trim()} className="text-[11px] font-extrabold bg-[#7bc67e] rounded-full px-2 py-0.5 hover:bg-[#5eb062] disabled:opacity-40">Load</button>
              </div>
            </div>
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={4} className="input mt-2 text-[11px] font-mono" placeholder='[{"name": "AWDis College Hoodie", "source_price": 8.99, "image": "…", "colours": ["Black","Navy"], "sizes": ["S","M","L"]}]' data-testid="apx-json-input" />
            <p className="text-[10px] text-[#4b5563] mt-1">For large files (a few MB+), use "Upload file" rather than pasting — much smoother.</p>
          </div>
          <button type="button" onClick={addManualRow} className="bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-2xl p-5 text-center transition" data-testid="apx-add-manual">
            <Plus size={22} className="mx-auto text-[#7bc67e]" />
            <div className="mt-2 text-sm font-extrabold">Add manually</div>
            <div className="text-[11px] text-[#4b5563] mt-0.5">One-off row — good for single products or corrections.</div>
          </button>
        </div>

        <p className="text-[11px] text-[#4b5563] mb-4 inline-flex items-start gap-1.5">
          <Info size={11} className="mt-0.5 text-[#7bc67e]" />
          "Fetch from PenCarrie" needs your PenCarrie API token set first, in{" "}
          <a href="/admin/integrations" className="text-[#166534] font-extrabold hover:underline">Admin → Integrations</a>
          {" "}(PenCarrie: My Account → Account Settings → API Access Tokens). First fetch — check the preview below looks right;
          if columns like image or price come through blank, PenCarrie's exact column names may need a small tweak on our end.
        </p>

        <details className="mb-4 bg-white border-2 border-[#dcfce7] rounded-2xl p-3">
          <summary className="cursor-pointer text-xs font-extrabold text-[#166534] inline-flex items-center gap-1"><Download size={11} /> Show me the CSV template</summary>
          <pre className="mt-2 bg-[#f8fafc] rounded-lg p-3 text-[11px] font-mono whitespace-pre-wrap">{SAMPLE_CSV}</pre>
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`} download="products-template.csv" className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#166534] hover:underline mt-2"><Download size={11} /> Download template</a>
        </details>

        {/* Preview */}
        {rows.length > 0 && (
          <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4 mb-8" data-testid="apx-preview">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold">Preview · {previewCount} rows ready to import</div>
              <div className="flex gap-2 items-center">
                {selected.size > 0 && (
                  <>
                    <span className="text-[11px] font-bold text-[#4b5563]">{selected.size} selected</span>
                    <button onClick={keepOnlySelected} className="text-[11px] font-extrabold text-[#166534] hover:underline" data-testid="apx-keep-selected">Keep only these</button>
                    <button onClick={removeSelected} className="text-[11px] font-extrabold text-rose-500 hover:underline" data-testid="apx-remove-selected">Remove these</button>
                  </>
                )}
                <button onClick={clearAll} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1" data-testid="apx-clear"><X size={11} /> Clear all</button>
                <button onClick={saveAll} disabled={saving || previewCount === 0} className="px-4 py-2 bg-[#7bc67e] rounded-full text-sm font-extrabold inline-flex items-center gap-1.5 hover:bg-[#5eb062] disabled:opacity-40" data-testid="apx-save">
                  {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                  {saving && saveProgress ? `Saving batch ${saveProgress.done + 1} of ${saveProgress.total}…` : `Save ${previewCount} products`}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold border-b border-[#dcfce7]">
                    <th className="py-2 pr-2"><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleSelectAll} data-testid="apx-select-all" /></th>
                    <th className="py-2 pr-2">Image</th>
                    <th className="py-2 pr-2">Name / SKU</th>
                    <th className="py-2 pr-2">Category</th>
                    <th className="py-2 pr-2">Fit</th>
                    <th className="py-2 pr-2">Colours</th>
                    <th className="py-2 pr-2">Sizes</th>
                    <th className="py-2 pr-2">Cost / Price</th>
                    <th className="py-2 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-[#f0fdf4] ${selected.has(i) ? "bg-[#f0fdf4]" : ""}`} data-testid={`apx-row-${i}`}>
                      <td className="py-2 pr-2"><input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} data-testid={`apx-row-select-${i}`} /></td>
                      <td className="py-2 pr-2">
                        {r.image ? <img src={r.image} alt="" className="w-10 h-10 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.opacity = 0.2)} /> : <div className="w-10 h-10 rounded-lg bg-[#f0fdf4] grid place-items-center text-[9px] text-[#7bc67e]">no img</div>}
                      </td>
                      <td className="py-2 pr-2">
                        <input value={r.name} onChange={(e) => patchRow(i, { name: e.target.value })} className="input-sm w-full" placeholder="Name" />
                        <input value={r.source_sku} onChange={(e) => patchRow(i, { source_sku: e.target.value })} className="input-sm w-full mt-1 text-[10px] font-mono" placeholder="SKU (optional)" />
                      </td>
                      <td className="py-2 pr-2">
                        <select value={r.category || ""} onChange={(e) => patchRow(i, { category: e.target.value })} className="input-sm w-full">
                          <option value="">Auto-detect</option>
                          {GARMENT_TYPES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <select value={r.gender_fit || "unisex"} onChange={(e) => patchRow(i, { gender_fit: e.target.value })} className="input-sm w-full">
                          {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2 min-w-[140px]">
                        <input value={(r.colors || []).map((c) => (c.name || c)).join("|")} onChange={(e) => {
                          const existing = new Map((r.colors || []).map((c) => [(c.name || c).toLowerCase(), c]));
                          const next = e.target.value.split("|").filter(Boolean).map((n) => {
                            const trimmed = n.trim();
                            const prev = existing.get(trimmed.toLowerCase());
                            return prev && typeof prev === "object" ? { ...prev, name: trimmed } : { name: trimmed, hex: "#cccccc" };
                          });
                          patchRow(i, { colors: next });
                        }} className="input-sm w-full text-[10px]" placeholder="Black|Navy|Red" />
                      </td>
                      <td className="py-2 pr-2 min-w-[110px]">
                        <input value={(r.sizes || []).join("|")} onChange={(e) => patchRow(i, { sizes: e.target.value.split("|").map((s) => s.trim()).filter(Boolean) })} className="input-sm w-full text-[10px]" placeholder="S|M|L|XL" />
                      </td>
                      <td className="py-2 pr-2 min-w-[130px]">
                        <input type="number" step="0.01" value={r.source_price ?? ""} onChange={(e) => patchRow(i, { source_price: parseFloat(e.target.value) || "" })} className="input-sm w-full text-[10px]" placeholder="Cost £" />
                        <input type="number" step="0.01" value={r.price ?? ""} onChange={(e) => patchRow(i, { price: parseFloat(e.target.value) || "" })} className="input-sm w-full mt-1 text-[10px]" placeholder="Retail £ (auto from markup)" />
                      </td>
                      <td className="py-2 pr-2">
                        <button onClick={() => removeRow(i)} className="text-rose-500 hover:bg-rose-50 rounded-full p-1"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bulk actions on already-imported products */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4 mb-4">
          <button type="button" onClick={() => setBulkOpen((v) => !v)} className="w-full flex items-center justify-between text-left" data-testid="apx-bulk-toggle">
            <span className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold inline-flex items-center gap-1.5"><Sparkles size={13} /> Bulk actions on imported products</span>
            <span className="text-[11px] text-[#4b5563]">{bulkOpen ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {bulkOpen && (
            <div className="mt-4 space-y-3">
              <p className="text-[11px] text-[#4b5563]">Re-price or turn on quantity-discount pricing across many products at once — no need to open each one individually. Re-pricing recalculates from each product's saved trade cost, so it only works on products imported with a source price.</p>

              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={bulkForm.scope === "all"} onChange={() => setBulkForm({ ...bulkForm, scope: "all" })} /> All imported products
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" checked={bulkForm.scope === "search"} onChange={() => setBulkForm({ ...bulkForm, scope: "search" })} /> Only products matching the search box above {importedSearch ? `("${importedSearch}")` : "(currently empty — same as All)"}
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 bg-[#f0fdf4] rounded-2xl p-4">
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={bulkForm.reprice} onChange={(e) => setBulkForm({ ...bulkForm, reprice: e.target.checked })} />
                    <span className="text-xs font-extrabold">Re-price with a new markup</span>
                  </label>
                  {bulkForm.reprice && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <label className="block">
                        <div className="text-[10px] font-extrabold mb-1">Markup % (ex-VAT)</div>
                        <input type="number" value={bulkForm.markup_pct} onChange={(e) => setBulkForm({ ...bulkForm, markup_pct: e.target.value })} className="input" data-testid="apx-bulk-markup" />
                      </label>
                      <div className="flex flex-col justify-end gap-1">
                        <label className="inline-flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={bulkForm.apply_vat} onChange={(e) => setBulkForm({ ...bulkForm, apply_vat: e.target.checked })} /> Add VAT ({bulkForm.vat_rate_pct}%)</label>
                        <label className="inline-flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={bulkForm.charm_price_99} onChange={(e) => setBulkForm({ ...bulkForm, charm_price_99: e.target.checked })} /> Round up to £X.99</label>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-extrabold mb-2">Quantity-discount pricing (bulk tiers)</div>
                  <div className="flex gap-3 text-[11px]">
                    <label className="inline-flex items-center gap-1.5"><input type="radio" checked={bulkForm.set_bulk_pricing_enabled === "unchanged"} onChange={() => setBulkForm({ ...bulkForm, set_bulk_pricing_enabled: "unchanged" })} /> Leave as-is</label>
                    <label className="inline-flex items-center gap-1.5"><input type="radio" checked={bulkForm.set_bulk_pricing_enabled === "on"} onChange={() => setBulkForm({ ...bulkForm, set_bulk_pricing_enabled: "on" })} /> Turn ON for these</label>
                    <label className="inline-flex items-center gap-1.5"><input type="radio" checked={bulkForm.set_bulk_pricing_enabled === "off"} onChange={() => setBulkForm({ ...bulkForm, set_bulk_pricing_enabled: "off" })} /> Turn OFF for these</label>
                  </div>
                  <p className="text-[10px] text-[#4b5563] mt-2">Uses whatever default bulk-discount tiers (% off at 10+/25+/100+/200+) you've already set in Product Settings.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => runBulkUpdate(true)} disabled={bulkBusy} className="text-xs font-extrabold border border-[#7bc67e] text-[#166534] rounded-full px-4 py-2 hover:bg-[#f0fdf4] disabled:opacity-50" data-testid="apx-bulk-preview">
                  {bulkBusy ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null} Preview (no changes made)
                </button>
                <button type="button" onClick={() => runBulkUpdate(false)} disabled={bulkBusy} className="text-xs font-extrabold bg-[#7bc67e] hover:bg-[#5eb062] rounded-full px-4 py-2 disabled:opacity-50" data-testid="apx-bulk-apply">
                  {bulkBusy ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null} Apply now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Existing imports */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4" data-testid="apx-existing">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold">Already imported · {importedTotal}</div>
            {loading && <Loader2 className="animate-spin text-[#7bc67e]" size={14} />}
          </div>
          <input value={importedSearch} onChange={(e) => setImportedSearch(e.target.value)} placeholder="Search imported products…" className="input mb-3" data-testid="apx-existing-search" />
          {imported.length === 0 ? (
            <div className="text-xs text-[#4b5563] italic py-4">{importedSearch ? "No matches." : "Nothing imported yet. Upload a CSV or paste JSON above to get started."}</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {imported.map((p) => (
                  <div key={p.id} className="border-2 border-[#dcfce7] rounded-2xl p-3 flex gap-3" data-testid={`apx-existing-${p.id}`}>
                    {p.image
                      ? <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-14 h-14 rounded-lg bg-[#f0fdf4] grid place-items-center flex-shrink-0 text-[9px] text-[#7bc67e]">no img</div>}
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-extrabold truncate">{p.name}</div>
                      <div className="text-[10px] text-[#4b5563] capitalize">{p.category} · {p.gender_fit} · £{Number(p.price).toFixed(2)}</div>
                      {p.brand && <div className="text-[10px] text-[#166534] mt-0.5">{p.brand} {p.source_sku ? `· ${p.source_sku}` : ""}</div>}
                      <div className="mt-1 flex gap-2 items-center">
                        <button onClick={() => toggleActive(p)} className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${p.active ? "bg-[#f0fdf4] text-[#166534]" : "bg-[#fee2e2] text-[#7f1d1d]"}`}>
                          {p.active ? "Live" : "Hidden"}
                        </button>
                        <a href={`/product/${p.id}`} target="_blank" rel="noreferrer" className="text-[10px] font-extrabold text-[#166534] hover:underline inline-flex items-center gap-0.5"><ExternalLink size={10} /> View</a>
                        <button onClick={() => removeImported(p.id)} className="ml-auto text-rose-500 hover:bg-rose-50 rounded-full p-1" data-testid={`apx-delete-${p.id}`}><Trash2 size={11} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {importedTotal > IMPORTED_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-4 mt-4" data-testid="apx-existing-pagination">
                  <button onClick={() => setImportedPage((p) => Math.max(0, p - 1))} disabled={importedPage === 0} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="text-xs text-[#4b5563]">Page {importedPage + 1} of {Math.ceil(importedTotal / IMPORTED_PAGE_SIZE)}</span>
                  <button onClick={() => setImportedPage((p) => (p + 1) * IMPORTED_PAGE_SIZE < importedTotal ? p + 1 : p)} disabled={(importedPage + 1) * IMPORTED_PAGE_SIZE >= importedTotal} className="inline-flex items-center gap-1 text-sm font-extrabold text-[#166534] disabled:opacity-30 disabled:cursor-not-allowed hover:underline">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.75rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; }
        .input:focus { outline: none; border-color: #7bc67e; }
        .input-sm { width: 100%; padding: 0.35rem 0.55rem; border-radius: 0.55rem; border: 2px solid #dcfce7; background: white; font-size: 0.75rem; }
        .input-sm:focus { outline: none; border-color: #7bc67e; }
      `}</style>
    </div>
  );
}
