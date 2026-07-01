import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchPageCopy, adminUpdatePageCopy, adminDeletePageCopy } from "../lib/api";
import { Loader2, Save, Plus, Trash2, RotateCcw } from "lucide-react";

/**
 * /admin/page-copy — Editable hero copy / bullets / body / FAQ / CTA for every
 * public page. Consumed by pages via the `usePageCopy(slug, defaults)` hook.
 * Any field left blank falls back to the code default so this is safe to adopt.
 */

const PAGE_COPY_SLUGS = [
  { slug: "home", label: "Home page" },
  { slug: "teams-schools", label: "Teams, Schools & Clubs hub" },
  { slug: "sports", label: "Sports & Fitness index" },
  { slug: "workwear", label: "Workwear index" },
  { slug: "portfolio", label: "Portfolio page" },
  { slug: "reviews", label: "Reviews page" },
  { slug: "specials", label: "Specials collection" },
  { slug: "contact", label: "Contact page" },
  { slug: "fight-night", label: "Fight Night Tee" },
  { slug: "leavers-hoodies", label: "Leavers Hoodies" },
  { slug: "kit-your-workforce", label: "Kit Your Workforce" },
  { slug: "design-your-own", label: "Design Your Own" },
  { slug: "team-kits", label: "Team Kits" },
  { slug: "team-kit-builder", label: "Team Kit Builder" },
  { slug: "full-squad-configurator", label: "Full Squad Configurator" },
  { slug: "sports-outfit-configurator", label: "Sports Outfit Configurator" },
];

const EMPTY = { title: "", subtitle: "", body: "", bullets: [], faq: [], cta_label: "", cta_link: "" };

export default function AdminPageCopy() {
  const [slug, setSlug] = useState(PAGE_COPY_SLUGS[0].slug);
  const [copy, setCopy] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (s) => {
    setLoading(true);
    try {
      const d = await fetchPageCopy(s);
      setCopy({ ...EMPTY, ...d, bullets: d.bullets || [], faq: d.faq || [] });
    } catch { setCopy(EMPTY); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(slug); }, [slug]);

  const save = async () => {
    setSaving(true);
    try {
      // Only send fields the admin actually filled in — empty strings are treated as "clear".
      const payload = {
        title: copy.title, subtitle: copy.subtitle, body: copy.body,
        bullets: copy.bullets.filter((b) => b?.trim()),
        faq: copy.faq.filter((f) => (f.q || "").trim()),
        cta_label: copy.cta_label, cta_link: copy.cta_link,
      };
      await adminUpdatePageCopy(slug, payload);
      toast.success("Page copy saved");
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  const revert = async () => {
    if (!window.confirm("Clear all admin overrides for this page and revert to code defaults?")) return;
    try {
      await adminDeletePageCopy(slug);
      toast.success("Reverted to code defaults");
      load(slug);
    } catch (e) { toast.error(e?.response?.data?.detail || "Revert failed"); }
  };

  const setBullet = (i, v) => setCopy((c) => ({ ...c, bullets: c.bullets.map((b, idx) => idx === i ? v : b) }));
  const addBullet = () => setCopy((c) => ({ ...c, bullets: [...c.bullets, ""] }));
  const removeBullet = (i) => setCopy((c) => ({ ...c, bullets: c.bullets.filter((_, idx) => idx !== i) }));

  const setFaq = (i, p) => setCopy((c) => ({ ...c, faq: c.faq.map((f, idx) => idx === i ? { ...f, ...p } : f) }));
  const addFaq = () => setCopy((c) => ({ ...c, faq: [...c.faq, { q: "", a: "" }] }));
  const removeFaq = (i) => setCopy((c) => ({ ...c, faq: c.faq.filter((_, idx) => idx !== i) }));

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-page-copy">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Page copy CMS</h1>
        <p className="text-sm text-[#4b5563] mb-6">Edit the hero copy, bullets, body text, CTA and FAQ for every public page. Leave a field blank to fall back to the built-in default — safe to experiment.</p>

        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 space-y-4">
          <label className="block">
            <div className="text-xs font-extrabold mb-1">Page</div>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="input" data-testid="apc-slug">
              {PAGE_COPY_SLUGS.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
            </select>
          </label>

          {loading ? (
            <div className="py-10 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block" data-testid="apc-title">
                  <div className="text-xs font-extrabold mb-1">Hero title (H1)</div>
                  <input value={copy.title} onChange={(e) => setCopy({ ...copy, title: e.target.value })} className="input" placeholder="Leave blank for code default" />
                </label>
                <label className="block" data-testid="apc-subtitle">
                  <div className="text-xs font-extrabold mb-1">Hero subtitle</div>
                  <input value={copy.subtitle} onChange={(e) => setCopy({ ...copy, subtitle: e.target.value })} className="input" />
                </label>
                <label className="block" data-testid="apc-cta-label">
                  <div className="text-xs font-extrabold mb-1">CTA button label</div>
                  <input value={copy.cta_label} onChange={(e) => setCopy({ ...copy, cta_label: e.target.value })} className="input" placeholder="e.g. Get started" />
                </label>
                <label className="block" data-testid="apc-cta-link">
                  <div className="text-xs font-extrabold mb-1">CTA button link</div>
                  <input value={copy.cta_link} onChange={(e) => setCopy({ ...copy, cta_link: e.target.value })} className="input" placeholder="e.g. /contact" />
                </label>
              </div>

              <label className="block" data-testid="apc-body">
                <div className="text-xs font-extrabold mb-1">Body (long-form) <span className="text-[#4b5563] font-normal">— use blank lines to split paragraphs</span></div>
                <textarea value={copy.body} onChange={(e) => setCopy({ ...copy, body: e.target.value })} className="input min-h-[140px] font-mono text-[12px]" placeholder="Optional long-form copy — appears below the hero on most pages." />
              </label>

              <div data-testid="apc-bullets">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-extrabold">Feature bullets / chips</div>
                  <button onClick={addBullet} type="button" className="text-xs font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1" data-testid="apc-bullet-add"><Plus size={12} /> Add</button>
                </div>
                <div className="space-y-1.5">
                  {copy.bullets.map((b, i) => (
                    <div key={i} className="flex gap-2 items-center" data-testid={`apc-bullet-${i}`}>
                      <input value={b} onChange={(e) => setBullet(i, e.target.value)} className="input flex-1" placeholder="One bullet per line" />
                      <button onClick={() => removeBullet(i)} type="button" className="text-rose-500 hover:bg-rose-50 rounded-full p-1"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {copy.bullets.length === 0 && <div className="text-xs text-[#4b5563] italic">No custom bullets — the page will use its code defaults.</div>}
                </div>
              </div>

              <div data-testid="apc-faq">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-extrabold">FAQ</div>
                  <button onClick={addFaq} type="button" className="text-xs font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1" data-testid="apc-faq-add"><Plus size={12} /> Add FAQ</button>
                </div>
                <div className="space-y-2">
                  {copy.faq.map((f, i) => (
                    <div key={i} className="border-2 border-[#dcfce7] rounded-xl p-3 space-y-1.5" data-testid={`apc-faq-${i}`}>
                      <input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} className="input font-extrabold" placeholder="Question" />
                      <textarea value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} className="input min-h-[60px]" placeholder="Answer" />
                      <button onClick={() => removeFaq(i)} type="button" className="text-xs text-rose-500 hover:underline inline-flex items-center gap-1"><Trash2 size={11} /> Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[#dcfce7]">
                <button onClick={revert} type="button" className="text-xs font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1" data-testid="apc-revert"><RotateCcw size={12} /> Revert to code defaults</button>
                <button onClick={save} disabled={saving} className="px-5 py-3 bg-[#7bc67e] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50" data-testid="apc-save">
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`.input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.75rem; border: 2px solid #dcfce7; background: white; font-size: 0.875rem; } .input:focus { outline: none; border-color: #7bc67e; }`}</style>
    </div>
  );
}
