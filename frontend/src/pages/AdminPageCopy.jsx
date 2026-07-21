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
  { slug: "site-images", label: "Pictures used across the whole site" },
  { slug: "site-footer", label: "Footer \u2014 social media links" },
];

const EMPTY = { title: "", subtitle: "", body: "", bullets: [], faq: [], cta_label: "", cta_link: "", hero_image: "", images: {}, media: {} };

// Must match the `name` values in SECTORS (frontend/src/lib/data.js) — that's
// the key each override is stored under ("sector:<name>").
/**
 * What imagery each page ACTUALLY has, described by where it appears.
 *
 * Previously a generic "Hero image" box was shown on every page — but only the
 * homepage reads it, so on every other page it saved happily and changed
 * nothing. Slots are now declared per page, so you only ever see fields that
 * really do something.
 *
 *   kind: "image"  → still image only
 *   kind: "media"  → image OR short looping video, with a shape setting
 */
const PAGE_MEDIA_SLOTS = {
  home: [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the homepage",
      hint: "The large photo beside 'Your Brand. Your Clothing. Your Own Print.'" },
  ],
  sports: [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the Sports & Fitness page",
      hint: "The large photo beside 'Kit out your crew.'" },
  ],
  "leavers-hoodies": [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the Leavers Hoodies page",
      hint: "The large photo to the right of the heading." },
  ],
  "team-kits": [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the Team Kits page",
      hint: "The large tilted photo beside 'Team Kits. Sorted.'" },
  ],
  "festival-tees-brands": [
    { key: "promo", kind: "media",
      label: "Photo or video beside 'Promo tops for your next date'",
      hint: "The square block on the right of that section. A short clip here plays silently on a loop." },
    { key: "brand", kind: "media",
      label: "Photo or video beside 'Start your own clothing line'",
      hint: "The square block on the left of the dark section further down. A short clip here plays silently on a loop." },
  ],
  "site-images": [
    { key: "pricepromise", kind: "image",
      label: "Price Promise photo",
      hint: "The square photo in the dark 'Looking professional shouldn't cost a fortune' band \u2014 shows on the homepage, product pages, Specials, Team Kits and Kit Your Workforce." },
    { key: "tool:design", kind: "image", label: "Tool tile \u2014 Design Your Own",
      hint: "One of the five tool tiles. They appear on the homepage, shop pages, industry pages, sports pages and the portfolio." },
    { key: "tool:specials", kind: "image", label: "Tool tile \u2014 Your Own Print Specials" },
    { key: "tool:workforce", kind: "image", label: "Tool tile \u2014 Kit Your Workforce" },
    { key: "tool:team-kits", kind: "image", label: "Tool tile \u2014 Team Kits" },
    { key: "tool:fight-night", kind: "image", label: "Tool tile \u2014 Fight Night Tees" },
  ],
};

// Header photo on each industry page, and the tile for it on Shop by Industry.
// Slugs must match the backend INDUSTRIES_CATALOGUE canonical entries.
// Footer social links. Leave one blank and that icon simply isn't shown.
const SITE_SOCIALS = [
  { key: "facebook", label: "Facebook", hint: "e.g. https://facebook.com/yourownprint" },
  { key: "instagram", label: "Instagram", hint: "e.g. https://instagram.com/yourownprint" },
  { key: "tiktok", label: "TikTok", hint: "e.g. https://tiktok.com/@yourownprint" },
  { key: "youtube", label: "YouTube", hint: "e.g. https://youtube.com/@yourownprint" },
  { key: "linkedin", label: "LinkedIn", hint: "e.g. https://linkedin.com/company/yourownprint" },
  { key: "x", label: "X (Twitter)", hint: "e.g. https://x.com/yourownprint" },
];

const SITE_INDUSTRIES = [
  { slug: "healthcare", label: "Healthcare" },
  { slug: "construction-trades", label: "Construction & Trades" },
  { slug: "retail", label: "Retail" },
  { slug: "security", label: "Security" },
  { slug: "corporate", label: "Corporate" },
  { slug: "sports-fitness", label: "Sports & Fitness" },
  { slug: "industrial", label: "Industrial" },
  { slug: "beauty-wellness", label: "Beauty & Wellness" },
  { slug: "cleaning", label: "Cleaning & Maintenance" },
  { slug: "hospitality-catering", label: "Hospitality & Catering" },
];

// Header photo on each sports landing page. Slugs match SPORTS_TEAMS_CATALOGUE.
const SITE_SPORTS_TEAMS = [
  { slug: "football", label: "Football Kits" },
  { slug: "rugby", label: "Rugby Kits" },
  { slug: "gyms", label: "Gym Kit & Branded Apparel" },
  { slug: "personal-trainers", label: "Personal Trainer Kit" },
  { slug: "boxing-gyms", label: "Boxing Gym Kit" },
  { slug: "thai-boxing", label: "Thai Boxing Gym Kit" },
  { slug: "kick-boxing", label: "Kickboxing Gym Kit" },
  { slug: "dance-studios", label: "Dance Studio Apparel" },
];

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
function ImageField({ label, hint, value, onChange, testid, compact }) {
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
      <div className="text-[11px] font-extrabold">{label}</div>
      {hint && <div className="text-[10px] text-[#4b5563] mb-1.5">{hint}</div>}
      <div className="flex items-center gap-2 mt-1">
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

  // "Pictures used across the whole site" isn't a page — it has no heading,
  // wording or FAQ of its own, so those fields are hidden for it.
  // Declared before the JSX below reads it.
  const isSiteImages = slug === "site-images";
  const isSiteFooter = slug === "site-footer";
  const setExtra = (key, v) => setCopy((c) => ({ ...c, extras: { ...(c.extras || {}), [key]: v } }));
  const setImage = (key, v) => setCopy((c) => ({ ...c, images: { ...(c.images || {}), [key]: v } }));

  return (
    <div className="min-h-screen bg-[#f8fafc] font-nunito" data-testid="admin-page-copy">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-black text-3xl mb-1">Pages</h1>
        <p className="text-sm text-[#4b5563] mb-5">Pick a page below, then change its wording and pictures. Anything you leave blank keeps the wording the site already has, so you can change one thing at a time.</p>

        {/* A visible list beats a dropdown: with 17+ pages a <select> hid both
            which page you were editing and that the others existed at all. */}
        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-4 mb-5">
          <div className="text-xs font-extrabold mb-2">Choose a page</div>
          <div className="flex flex-wrap gap-1.5" data-testid="apc-page-list">
            {PAGE_COPY_SLUGS.map((s) => {
              const active = s.slug === slug;
              const hasMedia = (PAGE_MEDIA_SLOTS[s.slug] || []).length > 0;
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setSlug(s.slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? "bg-[#7bc67e] border-[#7bc67e] text-[#1a1a1a]"
                      : "bg-white border-[#dcfce7] hover:border-[#7bc67e]"
                  }`}
                  data-testid={`apc-page-${s.slug}`}
                >
                  {s.label}
                  {hasMedia && <Film size={11} className={active ? "text-[#1a1a1a]" : "text-[#7bc67e]"} />}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#4b5563] mt-2">
            <Film size={10} className="inline text-[#7bc67e]" /> = this page has an image/video block you can set.
          </p>
        </div>

        <div className="bg-white border-2 border-[#dcfce7] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#dcfce7]">
            <div className="font-extrabold">
              {(PAGE_COPY_SLUGS.find((s) => s.slug === slug) || {}).label || slug}
            </div>
            <span className="text-[10px] text-[#4b5563]">editing this page</span>
          </div>

          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="hidden" data-testid="apc-slug" aria-hidden="true" tabIndex={-1}>
            {PAGE_COPY_SLUGS.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>

          {loading ? (
            <div className="py-10 grid place-items-center"><Loader2 className="animate-spin text-[#7bc67e]" /></div>
          ) : (
            <>
              {!isSiteImages && !isSiteFooter && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block" data-testid="apc-title">
                  <div className="text-xs font-extrabold mb-1">Main heading</div>
                  <div className="text-[10px] text-[#4b5563] mb-1">The big line of text at the top of the page.</div>
                  <input value={copy.title} onChange={(e) => setCopy({ ...copy, title: e.target.value })} className="input" placeholder="Leave blank to keep the current heading" />
                </label>
                <label className="block" data-testid="apc-subtitle">
                  <div className="text-xs font-extrabold mb-1">Text under the heading</div>
                  <div className="text-[10px] text-[#4b5563] mb-1">The smaller paragraph directly beneath it.</div>
                  <input value={copy.subtitle} onChange={(e) => setCopy({ ...copy, subtitle: e.target.value })} className="input" />
                </label>
                <label className="block" data-testid="apc-cta-label">
                  <div className="text-xs font-extrabold mb-1">Button text</div>
                  <div className="text-[10px] text-[#4b5563] mb-1">What the main button says.</div>
                  <input value={copy.cta_label} onChange={(e) => setCopy({ ...copy, cta_label: e.target.value })} className="input" placeholder="e.g. Get a quote" />
                </label>
                <label className="block" data-testid="apc-cta-link">
                  <div className="text-xs font-extrabold mb-1">Where the button goes</div>
                  <div className="text-[10px] text-[#4b5563] mb-1">A page on your site, e.g. /contact</div>
                  <input value={copy.cta_link} onChange={(e) => setCopy({ ...copy, cta_link: e.target.value })} className="input" placeholder="e.g. /contact" />
                </label>
              </div>
              )}

              {/* ---- Images (stored in the DB, so they survive every deploy) ---- */}
              <div className="border-2 border-[#dcfce7] rounded-2xl p-4 bg-[#f9fafb]" data-testid="apc-images">
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon size={15} className="text-[#7bc67e]" />
                  <div className="text-sm font-extrabold">Pictures &amp; video on this page</div>
                </div>
                <p className="text-[11px] text-[#4b5563] mb-3" hidden={isSiteFooter}>
                  Only the pictures this page actually uses are listed. Whatever you set is stored in the
                  database, so a future site update can&rsquo;t wipe it. Leave one blank and the page keeps
                  using the picture that&rsquo;s built in.
                </p>

                {(PAGE_MEDIA_SLOTS[slug] || []).length === 0 && slug !== "home" && !isSiteImages && !isSiteFooter ? (
                  <div className="bg-white border border-[#e5e7eb] rounded-xl p-3 text-[11px] text-[#4b5563]">
                    This page doesn&rsquo;t have any pictures you can swap out yet &mdash; only its wording.
                    If there&rsquo;s a photo on it you&rsquo;d like to be able to change, say which one and it can be added here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(PAGE_MEDIA_SLOTS[slug] || []).map((slot) => (
                      slot.kind === "media" ? (
                        <MediaField
                          key={slot.key}
                          label={slot.label}
                          hint={slot.hint}
                          value={(copy.media || {})[slot.key]}
                          onChange={(v) => setCopy({ ...copy, media: { ...(copy.media || {}), [slot.key]: v } })}
                        />
                      ) : (
                        <ImageField
                          key={slot.key}
                          label={slot.label}
                          hint={slot.hint}
                          value={slot.field === "hero_image" ? copy.hero_image : (copy.images || {})[slot.key] || ""}
                          onChange={(v) => slot.field === "hero_image"
                            ? setCopy({ ...copy, hero_image: v })
                            : setCopy({ ...copy, images: { ...(copy.images || {}), [slot.key]: v } })}
                          testid={`apc-slot-${slot.key}`}
                        />
                      )
                    ))}
                  </div>
                )}

                {isSiteFooter && (
                  <div className="space-y-3" data-testid="apc-socials">
                    <p className="text-[11px] text-[#4b5563]">
                      Paste the full web address of each profile. Leave one blank and that icon
                      simply isn&rsquo;t shown in the footer &mdash; no empty button, no dead link.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {SITE_SOCIALS.map((sn) => (
                        <label key={sn.key} className="block" data-testid={`apc-social-${sn.key}`}>
                          <div className="text-[11px] font-extrabold mb-1">{sn.label}</div>
                          <input
                            value={(copy.extras || {})[sn.key] || ""}
                            onChange={(e) => setExtra(sn.key, e.target.value)}
                            className="input text-xs w-full"
                            placeholder={sn.hint}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {isSiteImages && (
                  <div className="mt-5 space-y-5">
                    <div>
                      <div className="text-xs font-extrabold mb-1">Industry pages</div>
                      <p className="text-[10px] text-[#4b5563] mb-2">
                        The photo behind the title on each industry page, and on that industry&rsquo;s tile in the Shop by Industry list.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {SITE_INDUSTRIES.map((it) => (
                          <ImageField
                            key={it.slug}
                            label={it.label}
                            value={(copy.images || {})[`industry:${it.slug}`] || ""}
                            onChange={(v) => setImage(`industry:${it.slug}`, v)}
                            testid={`apc-industry-${it.slug}`}
                            compact
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-extrabold mb-1">Sports &amp; fitness landing pages</div>
                      <p className="text-[10px] text-[#4b5563] mb-2">
                        The photo behind the title at the top of each of these pages.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {SITE_SPORTS_TEAMS.map((it) => (
                          <ImageField
                            key={it.slug}
                            label={it.label}
                            value={(copy.images || {})[`sportsteam:${it.slug}`] || ""}
                            onChange={(v) => setImage(`sportsteam:${it.slug}`, v)}
                            testid={`apc-sportsteam-${it.slug}`}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {slug === "home" && (
                  <div className="mt-4">
                    <div className="text-xs font-extrabold mb-1">The 10 &lsquo;Shop by Sector&rsquo; tiles</div>
                    <p className="text-[10px] text-[#4b5563] mb-2">The row of photo tiles partway down the homepage. Each one is named after the sector it shows.</p>
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

              {!isSiteImages && !isSiteFooter && (
              <label className="block" data-testid="apc-body">
                <div className="text-xs font-extrabold mb-1">Longer description <span className="text-[#4b5563] font-normal">— leave an empty line between paragraphs</span></div>
                <textarea value={copy.body} onChange={(e) => setCopy({ ...copy, body: e.target.value })} className="input min-h-[140px] font-mono text-[12px]" placeholder="Optional. Extra paragraphs that appear under the heading." />
              </label>
              )}

              {!isSiteImages && !isSiteFooter && (
              <div data-testid="apc-bullets">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-extrabold">Bullet points</div>
                  <button onClick={addBullet} type="button" className="text-xs font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1" data-testid="apc-bullet-add"><Plus size={12} /> Add</button>
                </div>
                <div className="space-y-1.5">
                  {copy.bullets.map((b, i) => (
                    <div key={i} className="flex gap-2 items-center" data-testid={`apc-bullet-${i}`}>
                      <input value={b} onChange={(e) => setBullet(i, e.target.value)} className="input flex-1" placeholder="One bullet per line" />
                      <button onClick={() => removeBullet(i)} type="button" className="text-rose-500 hover:bg-rose-50 rounded-full p-1"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {copy.bullets.length === 0 && <div className="text-xs text-[#4b5563] italic">None added — the page is using the bullet points it came with.</div>}
                </div>
              </div>
              )}

              {!isSiteImages && !isSiteFooter && (
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
              )}

              <div className="flex justify-between items-center pt-2 border-t border-[#dcfce7]">
                <button onClick={revert} type="button" className="text-xs font-extrabold text-rose-500 hover:underline inline-flex items-center gap-1" data-testid="apc-revert"><RotateCcw size={12} /> Undo all my changes to this page</button>
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
