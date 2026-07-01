import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchCollectionSeo, adminUpdateCollectionSeo } from "../lib/api";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

// Kept in sync with backend GARMENT_TYPE_CATALOGUE slugs. Editable slugs the admin can enrich.
const COLLECTION_SLUGS = [
  "t-shirts", "hoodies", "polos", "sweatshirts", "aprons", "bottoms",
  "jackets", "workwear", "hi-vis", "kids", "sports-tees", "team-kits",
  "tracksuits", "shorts", "socks",
];

export default function AdminCollectionSeo() {
  const [slug, setSlug] = useState(COLLECTION_SLUGS[0]);
  const [seo, setSeo] = useState({ intro: "", body: "", faq: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (s) => {
    setLoading(true);
    try { setSeo(await fetchCollectionSeo(s)); }
    catch { setSeo({ intro: "", body: "", faq: [] }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(slug); }, [slug]);

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = {
        intro: seo.intro || "",
        body: seo.body || "",
        faq: (seo.faq || []).filter((f) => (f.q || "").trim()),
      };
      await adminUpdateCollectionSeo(slug, cleaned);
      toast.success("SEO copy saved");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const setFaq = (i, patch) => setSeo((s) => ({ ...s, faq: (s.faq || []).map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  const addFaq = () => setSeo((s) => ({ ...s, faq: [...(s.faq || []), { q: "", a: "" }] }));
  const removeFaq = (i) => setSeo((s) => ({ ...s, faq: (s.faq || []).filter((_, idx) => idx !== i) }));

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-collection-seo">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Collection SEO</h1>
        <p className="text-sm text-[#4b5563] mb-6">Write in-depth SEO copy for each collection page (<code>/shop/&lt;slug&gt;</code>). The <strong>intro</strong> shows under the H1 in the hero; the <strong>body</strong> appears at the bottom of the page with FAQ items — great for Google visibility.</p>

        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 space-y-4">
          <label className="block">
            <div className="text-xs font-extrabold mb-1">Collection</div>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="input" data-testid="acs-slug">
              {COLLECTION_SLUGS.map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
            </select>
          </label>

          {loading ? (
            <div className="py-10 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
          ) : (
            <>
              <label className="block" data-testid="acs-intro">
                <div className="text-xs font-extrabold mb-1">Intro <span className="text-[#4b5563] font-normal">(1&ndash;2 sentences under the H1)</span></div>
                <textarea value={seo.intro} onChange={(e) => setSeo({ ...seo, intro: e.target.value })} className="input min-h-[70px]" placeholder="Short hook shown right below the collection title." />
              </label>

              <label className="block" data-testid="acs-body">
                <div className="text-xs font-extrabold mb-1">Body <span className="text-[#4b5563] font-normal">(long-form — use blank lines to split paragraphs)</span></div>
                <textarea value={seo.body} onChange={(e) => setSeo({ ...seo, body: e.target.value })} className="input min-h-[220px] font-mono text-[12px]" placeholder={"Long-form SEO copy about the collection.\n\nParagraph 2 — talk about garment quality, print options, ideal uses (schools, gyms, teams, businesses).\n\nParagraph 3 — quality &amp; delivery reassurance, colours, sizes, care."} />
              </label>

              <div data-testid="acs-faq">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-extrabold">FAQ items</div>
                  <button onClick={addFaq} type="button" className="text-xs font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1" data-testid="acs-faq-add"><Plus size={12} /> Add FAQ</button>
                </div>
                <div className="space-y-2">
                  {(seo.faq || []).map((f, i) => (
                    <div key={i} className="border-2 border-[#dcfce7] rounded-xl p-3 space-y-2" data-testid={`acs-faq-${i}`}>
                      <input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} className="input font-extrabold" placeholder="Question" data-testid={`acs-faq-${i}-q`} />
                      <textarea value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} className="input min-h-[60px]" placeholder="Answer" data-testid={`acs-faq-${i}-a`} />
                      <button onClick={() => removeFaq(i)} type="button" className="text-xs text-rose-500 hover:underline inline-flex items-center gap-1" data-testid={`acs-faq-${i}-del`}><Trash2 size={11} /> Remove</button>
                    </div>
                  ))}
                  {(!seo.faq || seo.faq.length === 0) && (
                    <div className="text-xs text-[#4b5563] italic">No FAQ items yet. Add one to boost long-tail search relevance.</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="px-5 py-3 bg-[#7bc67e] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50" data-testid="acs-save">
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.75rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; }
        .input:focus { outline: none; border-color: #7bc67e; }
      `}</style>
    </div>
  );
}
