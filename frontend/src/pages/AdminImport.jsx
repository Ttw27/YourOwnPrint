import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BoldNavbar, BoldFooter } from "../components/bold/BoldLayout";
import { fetchProducts, importJudgeMe } from "../lib/api";
import { toast } from "sonner";
import { Upload, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

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

export default function AdminImport() {
  const [json, setJson] = useState("");
  const [defaultProduct, setDefaultProduct] = useState("personalised-tee");
  const [mapText, setMapText] = useState("");
  const [products, setProducts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  React.useEffect(() => { fetchProducts().then(setProducts); }, []);

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
      <BoldNavbar />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-xs uppercase tracking-[0.3em] text-[#7bc67e] font-nunito font-bold">Admin</div>
        <h1 className="font-nunito font-black text-4xl lg:text-5xl mt-2">Import Judge.me Reviews</h1>
        <p className="text-[#4b5563] mt-3 max-w-2xl">One-off migration: paste your Judge.me reviews JSON export below. Map each Judge.me product to one of our product IDs so ratings land on the right products.</p>

        <div className="mt-8 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-nunito font-bold text-[#1a1a1a] mb-2">1. Paste Judge.me reviews JSON</label>
              <textarea
                data-testid="import-json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={SAMPLE}
                rows={14}
                className="w-full bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-4 font-mono text-xs"
              />
              <button onClick={() => setJson(SAMPLE)} className="text-xs text-[#7bc67e] font-nunito font-bold mt-1 hover:underline">Load sample</button>
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
              <li>Log into Judge.me admin.</li>
              <li>Go to <strong>Settings → Integrations → Public widget API</strong> or use the Reviews → Export tool.</li>
              <li>Download or copy the full JSON of your reviews.</li>
              <li>Paste it into the box on the left.</li>
              <li>Map at least your top product titles to our product IDs for accurate per-product ratings.</li>
            </ol>
            <div className="mt-4 pt-4 border-t border-[#dcfce7] text-xs text-[#4b5563]">
              Imported reviews are tagged <strong>Verified</strong> and marked as imported.
            </div>
          </aside>
        </div>
      </div>
      <BoldFooter />
    </div>
  );
}
