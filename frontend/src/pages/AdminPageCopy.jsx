import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchPageCopy, adminUpdatePageCopy, adminDeletePageCopy, uploadAdminImage, uploadAdminMedia } from "../lib/api";
import { Loader2, Save, Plus, Trash2, RotateCcw, Upload, Image as ImageIcon, X, Film } from "lucide-react";
import { MEDIA_RATIOS } from "../components/bold/MediaBlock";

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
  { slug: "festival-tees-brands", label: "Festival Tees & Start Your Brand" },
];

const EMPTY = { title: "", subtitle: "", body: "", bullets: [], faq: [], cta_label: "", cta_link: "", hero_image: "", images: {}, media: {} };

// Must match the `name` values in SECTORS (frontend/src/lib/data.js) — that's
// the key each override is stored under ("sector:<name>").
// Named media slots per page — each can hold a still OR a short looping clip.
const PAGE_MEDIA_SLOTS = {
  "festival-tees-brands": [
    { key: "promo", label: "Promo tops block", hint: "Sits beside 'Promo tops for your next date'." },
  ],
};

const HOME_SECTOR_NAMES = [
  "Construction & Trades", "Healthcare", "Hospitality", "Retail", "Sports & Fitness",
  "Dance & Theatre", "Schools & Leavers", "Hi-Vis", "Security", "Beauty & Wellness",
];

/** One media slot — image or short video, with a display ratio. */
function MediaField({ label, hint, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const media = value || {};

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadAdminMedia(file, "page-media");
      onChange({ ...media, url: res.url, kind: res.kind });
      const mb = (res.bytes / 1_000_000).toFixed(1);
      toast.success(`${label} uploaded (${mb}MB)`);
      if (res.kind === "video" && res.bytes > 6_000_000) {
        toast("Tip: that clip is on the large side — compressing it will make the page load faster.", { duration: 6000 });
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); }
  };

  const isVideo = media.kind === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(media.url || "");

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl p-3">
      <div className="text-[11px] font-extrabold">{label}</div>
      {hint && <div className="text-[10px] text-[#4b5563] mb-2">{hint}</div>}

      <div className="flex items-center gap-2">
        <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#e5e7eb] bg-[#f0fdf4] flex-shrink-0 grid place-items-center">
          {media.url
            ? (isVideo
                ? <video src={media.url} muted className="w-full h-full object-cover" />
                : <img src={media.url} alt="" className="w-full h-full object-cover" />)
            : <ImageIcon size={14} className="text-[#d1d5db]" />}
        </div>
        <input
          value={media.url || ""}
          onChange={(e) => onChange({ ...media, url: e.target.value })}
          className="input flex-1 text-xs min-w-0"
          placeholder="Paste an image or video URL, or upload →"
        />
        {media.url && (
          <button type="button" onClick={() => onChange({})} title="Clear" className="w-8 h-8 grid place-items-center rounded-full text-rose-500 hover:bg-rose-50 flex-shrink-0">
            <X size={13} />
          </button>
        )}
        <label className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-2.5 py-2 hover:bg-[#f0fdf4] cursor-pointer whitespace-nowrap flex-shrink-0">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
          <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] font-bold text-[#4b5563]">Shape</span>
        <select
          value={media.ratio || "1:1"}
          onChange={(e) => onChange({ ...media, ratio: e.target.value })}
          className="input text-xs py-1"
        >
          {MEDIA_RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {isVideo && (
          <span className="text-[10px] text-[#166534] font-bold inline-flex items-center gap-1">
            <Film size={11} /> plays muted, on loop
          </span>
        )}
      </div>
      <p className="text-[10px] text-[#4b5563] mt-1.5">
        Video autoplays silently and loops. Keep clips 10&ndash;20s at 720p (roughly 2&ndash;5MB) so the page stays fast &mdash; 20MB max.
      </p>
    </div>
  );
}

/** One image slot — paste a URL or upload a file. Blank = use code default. */
function ImageField({ label, value, onChange, testid, compact }) {
  const [busy, setBusy] = useState(false);
  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await uploadAdminImage(file, "page-images");
      onChange(url);
      toast.success(`${label} uploaded`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className={compact ? "" : "mb-2"} data-testid={testid}>
      <div className="text-[11px] font-extrabold mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#e5e7eb] bg-white flex-shrink-0 grid place-items-center">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={13} className="text-[#d1d5db]" />}
        </div>
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1 text-xs"
          placeholder="Paste an image URL, or upload →"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} title="Clear (revert to default)" className="w-8 h-8 grid place-items-center rounded-full text-rose-500 hover:bg-rose-50 flex-shrink-0">
            <X size={13} />
          </button>
        )}
        <label className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#166534] border border-[#7bc67e] rounded-full px-2.5 py-2 hover:bg-[#f0fdf4] cursor-pointer whitespace-nowrap flex-shrink-0">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

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
        hero_image: copy.hero_image || "",
        images: copy.images || {},
        media: copy.media || {},
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

              {/* ---- Images (stored in the DB, so they survive every deploy) ---- */}
              <div className="border-2 border-[#dcfce7] rounded-2xl p-4 bg-[#f9fafb]" data-testid="apc-images">
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon size={15} className="text-[#7bc67e]" />
                  <div className="text-sm font-extrabold">Images</div>
                </div>
                <p className="text-[11px] text-[#4b5563] mb-3">
                  Anything set here is saved to the database and will <strong>never</strong> be overwritten by a future code update.
                  Leave blank to keep using the built-in default image.
                </p>

                <ImageField
                  label="Hero image"
                  value={copy.hero_image}
                  onChange={(v) => setCopy({ ...copy, hero_image: v })}
                  testid="apc-hero-image"
                />

                {(PAGE_MEDIA_SLOTS[slug] || []).length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-extrabold mb-2">Image or video blocks</div>
                    <div className="space-y-3">
                      {PAGE_MEDIA_SLOTS[slug].map((slot) => (
                        <MediaField
                          key={slot.key}
                          label={slot.label}
                          hint={slot.hint}
                          value={(copy.media || {})[slot.key]}
                          onChange={(v) => setCopy({ ...copy, media: { ...(copy.media || {}), [slot.key]: v } })}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {slug === "home" && (
                  <div className="mt-4">
                    <div className="text-xs font-extrabold mb-2">Sector tile images</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {HOME_SECTOR_NAMES.map((name) => (
                        <ImageField
                          key={name}
                          label={name}
                          value={(copy.images || {})[`sector:${name}`] || ""}
                          onChange={(v) => setCopy({
                            ...copy,
                            images: { ...(copy.images || {}), [`sector:${name}`]: v },
                          })}
                          testid={`apc-sector-${name}`}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )}
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
