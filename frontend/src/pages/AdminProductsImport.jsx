import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchImportedProducts, bulkImportProducts, patchImportedProduct, deleteImportedProduct,
} from "../lib/api";
import {
  Upload, Plus, Trash2, Save, Loader2, Download, FileText, X, Info, ExternalLink,
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
  "t-shirts", "hoodies", "polos", "sweatshirts", "aprons", "bottoms",
  "jackets", "hi-vis", "hats", "bags", "socks",
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
  const colours = String(coloursRaw || "")
    .split(/[|,;]/).map((s) => s.trim()).filter(Boolean)
    .map((name) => ({ name, hex: "#cccccc" }));
  const sizes = String(sizesRaw || "").split(/[|,;]/).map((s) => s.trim()).filter(Boolean);
  return {
    name: pick("name", "title", "product_name"),
    source_sku: pick("source_sku", "sku", "style", "code"),
    source_price: parseFloat(pick("source_price", "trade_price", "cost")) || undefined,
    price: parseFloat(pick("price", "retail_price")) || undefined,
    image: pick("image", "image_url", "img", "picture"),
    additional_images: String(pick("additional_images", "gallery") || "").split(/[|;]/).map((s) => s.trim()).filter(Boolean),
    description: pick("description", "desc", "summary"),
    colors: colours,
    sizes,
    gender_fit: (pick("gender_fit", "gender", "fit") || "unisex").toLowerCase(),
    brand: pick("brand"),
    category: pick("category", "garment_type"),
    industry_tags: String(pick("industry_tags", "tags") || "").split(/[|,;]/).map((s) => s.trim()).filter(Boolean),
  };
}

const EMPTY_ROW = {
  name: "", source_sku: "", source_price: "", price: "", image: "", description: "",
  colors: [], sizes: [], gender_fit: "unisex", brand: "", category: "",
};

export default function AdminProductsImport() {
  const [rows, setRows] = useState([]);
  const [imported, setImported] = useState([]);
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

  async function refresh() {
    setLoading(true);
    try { const d = await fetchImportedProducts(); setImported(d.items || []); }
    catch { toast.error("Failed to load imported products"); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  function pushRows(list) {
    const normalised = list.map(normaliseRow).filter((r) => r.name);
    setRows((prev) => [...prev, ...normalised]);
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

  const patchRow = (i, p) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...p } : r));
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const addManualRow = () => setRows((rs) => [...rs, { ...EMPTY_ROW }]);
  const clearAll = () => setRows([]);

  async function saveAll() {
    const filtered = rows.filter((r) => r.name?.trim());
    if (!filtered.length) { toast.error("Nothing to save."); return; }
    setSaving(true);
    try {
      const d = await bulkImportProducts({ ...defaults, items: filtered });
      const imgNote = d.images_mirrored_to_r2 || d.images_failed_to_mirror
        ? ` ${d.images_mirrored_to_r2 || 0} image(s) saved to R2${d.images_failed_to_mirror ? `, ${d.images_failed_to_mirror} couldn't be fetched (kept original link)` : ""}.`
        : "";
      toast.success(`Imported ${d.created?.length || 0} products${d.skipped?.length ? `, ${d.skipped.length} skipped` : ""}.${imgNote}`);
      setRows([]);
      refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Import failed"); }
    finally { setSaving(false); }
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
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <label className="bg-white border-2 border-dashed border-[#7bc67e] hover:bg-[#f0fdf4] rounded-2xl p-5 cursor-pointer transition text-center" data-testid="apx-upload-csv">
            <input type="file" accept=".csv,text/csv" onChange={onCsvFile} className="hidden" />
            <Upload size={22} className="mx-auto text-[#7bc67e]" />
            <div className="mt-2 text-sm font-extrabold">Upload CSV</div>
            <div className="text-[11px] text-[#4b5563] mt-0.5">Columns: name, source_sku, source_price, image, description, colours, sizes …</div>
          </label>
          <div className="bg-white border-2 border-[#dcfce7] rounded-2xl p-4" data-testid="apx-json">
            <div className="text-xs font-extrabold flex items-center justify-between">
              <span><FileText size={12} className="inline mr-1 text-[#7bc67e]" /> Paste JSON</span>
              <button type="button" onClick={onJsonParse} disabled={!jsonText.trim()} className="text-[11px] font-extrabold bg-[#7bc67e] rounded-full px-2 py-0.5 hover:bg-[#5eb062] disabled:opacity-40">Load</button>
            </div>
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={4} className="input mt-2 text-[11px] font-mono" placeholder='[{"name": "AWDis College Hoodie", "source_price": 8.99, "image": "…", "colours": ["Black","Navy"], "sizes": ["S","M","L"]}]' data-testid="apx-json-input" />
          </div>
          <button type="button" onClick={addManualRow} className="bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-2xl p-5 text-center transition" data-testid="apx-add-manual">
            <Plus size={22} className="mx-auto text-[#7bc67e]" />
            <div className="mt-2 text-sm font-extrabold">Add manually</div>
            <div className="text-[11px] text-[#4b5563] mt-0.5">One-off row — good for single products or corrections.</div>
          </button>
        </div>

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
              <div className="flex gap-2">
                <button onClick={clearAll} className="text-[11px] font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1" data-testid="apx-clear"><X size={11} /> Clear</button>
                <button onClick={saveAll} disabled={saving || previewCount === 0} className="px-4 py-2 bg-[#7bc67e] rounded-full text-sm font-extrabold inline-flex items-center gap-1.5 hover:bg-[#5eb062] disabled:opacity-40" data-testid="apx-save">
                  {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />} Save {previewCount} products
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#4b5563] font-extrabold border-b border-[#dcfce7]">
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
                    <tr key={i} className="border-b border-[#f0fdf4]" data-testid={`apx-row-${i}`}>
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
                        <input value={(r.colors || []).map((c) => (c.name || c)).join("|")} onChange={(e) => patchRow(i, { colors: e.target.value.split("|").filter(Boolean).map((n) => ({ name: n.trim(), hex: "#cccccc" })) })} className="input-sm w-full text-[10px]" placeholder="Black|Navy|Red" />
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

        {/* Existing imports */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4" data-testid="apx-existing">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-[#7bc67e] font-extrabold">Already imported · {imported.length}</div>
            {loading && <Loader2 className="animate-spin text-[#7bc67e]" size={14} />}
          </div>
          {imported.length === 0 ? (
            <div className="text-xs text-[#4b5563] italic py-4">Nothing imported yet. Upload a CSV or paste JSON above to get started.</div>
          ) : (
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
