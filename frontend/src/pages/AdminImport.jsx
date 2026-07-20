import React, { useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts, importJudgeMe } from "../lib/api";
import { toast } from "sonner";
import { Upload, Loader2, ArrowRight, CheckCircle2, FileUp } from "lucide-react";

const SAMPLE = `[
  {
    "id": "judgeme-123",
    "rating": 5,
    "title": "Great quality, great printing",
    "body": "Great quality product great printing took a little longer than my other orders but all good",
    "reviewer_name": "Simon Chinery",
    "created_at": "2025-12-16T00:00:00Z",
    "product_title": "Personalised Hoodie",
    "pictures": []
  }
]`;

/**
 * Judge.me's own export is a CSV, not JSON — the export button in their admin
 * produces a .csv file, so pasting "the JSON" meant finding the API instead.
 * This parses that CSV into the same shape the import endpoint already accepts.
 *
 * Written by hand rather than pulled from a library because review bodies are
 * full of commas, quotes and line breaks inside quoted fields, which a naive
 * split(",") mangles silently — you'd get a successful import full of truncated
 * reviews rather than an error.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }  // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

// Judge.me has renamed these columns over the years, so accept the variants.
const CSV_ALIASES = {
  rating: ["rating", "review_rating", "score"],
  title: ["title", "review_title"],
  body: ["body", "review_body", "content", "review"],
  reviewer_name: ["reviewer_name", "author", "name", "reviewer", "buyer_name"],
  created_at: ["created_at", "date", "review_date", "created"],
  product_title: ["product_title", "product", "product_name", "product handle", "product_handle"],
  pictures: ["pictures", "picture_urls", "photos", "images", "media_urls"],
};

function csvToReviews(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const pick = (cells, key) => {
    for (const alias of CSV_ALIASES[key]) {
      const idx = headers.indexOf(alias);
      if (idx !== -1 && cells[idx] != null && String(cells[idx]).trim() !== "") {
        return String(cells[idx]).trim();
      }
    }
    return "";
  };
  return rows.slice(1).map((cells) => {
    const picsRaw = pick(cells, "pictures");
    const pictures = picsRaw
      ? picsRaw.split(/[\s,|]+/).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u))
      : [];
    return {
      rating: Number(pick(cells, "rating")) || 5,
      title: pick(cells, "title"),
      body: pick(cells, "body"),
      reviewer_name: pick(cells, "reviewer_name"),
      created_at: pick(cells, "created_at"),
      product_title: pick(cells, "product_title"),
      pictures,
    };
  }).filter((r) => r.body || r.title);
}

export default function AdminImport() {
  const [json, setJson] = useState("");
  const [defaultProduct, setDefaultProduct] = useState("personalised-tee");
  const [mapText, setMapText] = useState("");
  const [products, setProducts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [fileNote, setFileNote] = useState("");

  const onFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const isCsv = /\.csv$/i.test(file.name) || (!text.trim().startsWith("[") && !text.trim().startsWith("{"));
    if (isCsv) {
      const reviews = csvToReviews(text);
      if (reviews.length === 0) {
        toast.error("Couldn't find any reviews in that CSV — check it's the Judge.me reviews export.");
        return;
      }
      setJson(JSON.stringify(reviews, null, 2));
      const withPics = reviews.filter((r) => r.pictures.length > 0).length;
      setFileNote(`Read ${reviews.length} reviews from ${file.name}${withPics ? ` (${withPics} with photos)` : ""}. Check the mapping below, then import.`);
      toast.success(`Read ${reviews.length} reviews from the CSV`);
    } else {
      setJson(text);
      setFileNote(`Loaded ${file.name}. Check the mapping below, then import.`);
    }
  };

  React.useEffect(() => { fetchProducts(undefined, 500).then((d) => setProducts(d.items || [])); }, []);

  const runImport = async () => {
    let reviews;
    try {
      const parsed = JSON.parse(json);
      reviews = Array.isArray(parsed) ? parsed : (parsed.reviews || parsed.data || []);
    } catch (e) {
      toast.error("That's not valid JSON. Paste an array of Judge.me reviews.");
      return;
    }
    if (!Array.isArray(reviews) || reviews.length === 0) {
      toast.error("No reviews found in the JSON. Expected an array of review objects.");
      return;
    }
    let product_id_map = null;
    if (mapText.trim()) {
      try {
        product_id_map = JSON.parse(mapText);
      } catch {
        toast.error("Product map JSON is invalid (must be {\"Judge.me product title\":\"our-product-id\"}).");
        return;
      }
    }
    setImporting(true);
    try {
      const res = await importJudgeMe({ reviews, default_product_id: defaultProduct, product_id_map });
      setResult(res);
      toast.success(`Imported ${res.imported} reviews (skipped ${res.skipped}).`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white text-[#1a1a1a] font-nunito min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Admin</div>
        <h1 className="font-nunito font-black text-4xl lg:text-5xl mt-2">Import Judge.me Reviews</h1>
        <p className="text-[#4b5563] mt-3 max-w-2xl">Bring your reviews across from Judge.me, photos included. Choose the file you exported from Judge.me &mdash; a CSV or a JSON file both work &mdash; then say which of our products each Judge.me product should attach to.</p>

        <div className="mt-8 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-nunito font-bold text-[#1a1a1a] mb-2">1. Choose your Judge.me export file (or paste it below)</label>
              <textarea
                data-testid="import-json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={SAMPLE}
                rows={14}
                className="w-full bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4 font-mono text-xs"
              />
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 text-xs font-nunito font-extrabold text-[#166534] border-2 border-[#7bc67e] rounded-full px-3 py-1.5 hover:bg-[#f0fdf4] cursor-pointer">
                  <FileUp size={13} /> Choose a CSV or JSON file
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    className="hidden"
                    data-testid="import-file"
                    onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
                  />
                </label>
                <button onClick={() => setJson(SAMPLE)} className="text-xs text-[#7bc67e] font-nunito font-bold hover:underline">Load sample</button>
              </div>
              {fileNote && (
                <div className="mt-2 text-xs text-[#166534] bg-[#f0fdf4] border border-[#dcfce7] rounded-xl px-3 py-2" data-testid="import-file-note">{fileNote}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-nunito font-bold text-[#1a1a1a] mb-2">2. Map Judge.me product titles → our product IDs (optional)</label>
              <textarea
                data-testid="import-map"
                value={mapText}
                onChange={(e) => setMapText(e.target.value)}
                placeholder={'{\n  "Personalised Hoodie": "personalised-hoodie",\n  "YourOwnPrint Special - Pro RTX Pro Pique Polo Shirt": "polo-shirt"\n}'}
                rows={6}
                className="w-full bg-white border border-[#e5e7eb] rounded-2xl p-4 font-mono text-xs"
              />
              <div className="text-xs text-[#4b5563] mt-1">Anything unmapped falls back to the default product below.</div>
            </div>

            <div>
              <label className="block text-sm font-nunito font-bold text-[#1a1a1a] mb-2">3. Default product (for unmapped reviews)</label>
              <select data-testid="import-default-product" value={defaultProduct} onChange={(e) => setDefaultProduct(e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-xl px-3 py-2.5">
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.id}</option>)}
              </select>
            </div>

            <button data-testid="import-run" onClick={runImport} disabled={importing || !json.trim()} className="w-full bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-60 text-white font-nunito font-extrabold rounded-full py-4 transition-colors flex items-center justify-center gap-2">
              {importing ? <><Loader2 className="animate-spin" size={18} />Importing…</> : <><Upload size={18} /> Import reviews</>}
            </button>

            {result && (
              <div className="bg-[#f0fdf4] border-2 border-[#7bc67e] rounded-2xl p-5">
                <div className="flex items-center gap-2"><CheckCircle2 className="text-[#7bc67e]" /><span className="font-nunito font-extrabold">Import complete</span></div>
                <div className="mt-2 text-sm text-[#1a1a1a]">
                  <strong data-testid="import-result-imported">{result.imported}</strong> imported · <strong data-testid="import-result-skipped">{result.skipped}</strong> skipped (no product match)
                </div>
                <Link to="/reviews" className="mt-3 inline-flex items-center gap-2 text-[#7bc67e] font-nunito font-bold text-sm">View reviews page <ArrowRight size={14} /></Link>
              </div>
            )}
          </div>

          <aside className="bg-[#f0fdf4] rounded-2xl p-6 border border-[#dcfce7] h-fit">
            <div className="font-nunito font-extrabold text-lg">How to export from Judge.me</div>
            <ol className="mt-3 space-y-3 text-sm text-[#4b5563] list-decimal pl-5">
              <li>Log into your Judge.me admin.</li>
              <li>Go to <strong>Reviews → Export</strong> and download the file. Judge.me gives you a CSV.</li>
              <li>Click <strong>Choose a CSV or JSON file</strong> on the left and pick it.</li>
              <li>Check the product mapping so ratings land on the right products.</li>
              <li>Press <strong>Import reviews</strong>.</li>
            </ol>
            <div className="mt-4 pt-4 border-t border-[#dcfce7] text-xs text-[#4b5563]">
              Imported reviews are tagged <strong>Verified</strong> and marked as imported.
            </div>
            <div className="mt-4 pt-4 border-t border-[#dcfce7] text-xs text-[#4b5563]">
              <strong>Photos</strong> come across automatically wherever Judge.me included a picture link.
              The images stay hosted on Judge.me&rsquo;s servers, so keep that account open &mdash; if you
              close it the photos will stop loading.
            </div>
            <div className="mt-4 pt-4 border-t border-[#dcfce7] text-xs text-[#4b5563]">
              Imported something wrong? Everything can be corrected or removed on the{" "}
              <Link to="/admin/reviews" className="text-[#166534] font-bold underline">Reviews</Link> page.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
