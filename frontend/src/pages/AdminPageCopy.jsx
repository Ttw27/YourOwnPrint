import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, adminUpdatePageCopy, adminDeletePageCopy, uploadAdminImage, uploadAdminMedia } from "../lib/api";
import { Loader2, Save, Plus, Trash2, RotateCcw, Upload, Image as ImageIcon, X, Film } from "lucide-react";
import { MEDIA_RATIOS } from "../components/bold/MediaBlock";
import { DEFAULT_HERO_IMAGES, DEFAULT_PRICE_PROMISE_PHOTO } from "../lib/defaultImages";
import { SECTORS, TOOLS_SHOWCASE } from "../lib/data";
import { Link } from "react-router-dom";

/**
 * /admin/page-copy - Editable hero copy / bullets / body / FAQ / CTA for every
 * public page. Consumed by pages via the `usePageCopy(slug, defaults)` hook.
 * Any field left blank falls back to the code default so this is safe to adopt.
 */

const PAGE_COPY_SLUGS = [
  { slug: "home", label: "Home page" },
  { slug: "teams-schools", label: "Teams, Schools & Clubs hub" },
  { slug: "sports", label: "Sports & Fitness index" },
  { slug: "workwear", label: "Workwear index" },
  { slug: "for-business", label: "For Business (switchers) page" },
  { slug: "easy-ordering", label: "Order by WhatsApp or email page" },
  { slug: "dtf-printing", label: "Why we print with DTF page" },
  { slug: "website-services", label: "Website & ad services page" },
  { slug: "free-logo-design", label: "Free logo design page" },
  { slug: "business-enquiry", label: "Business enquiry page" },
  { slug: "school-trips", label: "School Trip T-shirts page" },
  { slug: "portfolio", label: "Portfolio page" },
  { slug: "reviews", label: "Reviews page" },
  { slug: "specials", label: "Specials collection" },
  { slug: "contact", label: "Contact page" },
  { slug: "how-we-print", label: "How We Print (DTF) block" },
  { slug: "fight-night", label: "Fight Night Tee" },
  { slug: "leavers-hoodies", label: "Leavers Hoodies" },
  { slug: "kit-your-workforce", label: "Kit Your Workforce" },
  { slug: "design-your-own", label: "Design Your Own" },
  { slug: "team-kits", label: "Team Kits" },
  { slug: "full-squad-configurator", label: "Full Squad Configurator" },
  { slug: "sports-outfit-configurator", label: "Sports Outfit Configurator" },
  { slug: "festival-tees-brands", label: "Festival Tees & Start Your Brand" },
  ...[
    ["healthcare", "Healthcare"], ["construction-trades", "Construction & Trades"], ["retail", "Retail"],
    ["security", "Security"], ["corporate", "Corporate"], ["sports-fitness", "Sports & Fitness"],
    ["industrial", "Industrial"], ["beauty-wellness", "Beauty & Wellness"], ["cleaning", "Cleaning & Maintenance"],
    ["hospitality-catering", "Hospitality & Catering"], ["education-schools", "Education & Schools"],
  ].map(([slug, name]) => ({ slug, label: `Industry: ${name}` })),
  { slug: "site-images", label: "Pictures used across the whole site" },
  { slug: "site-footer", label: "Footer - social media links" },
];

const EMPTY = { title: "", subtitle: "", body: "", bullets: [], faq: [], cta_label: "", cta_link: "", hero_image: "", images: {}, media: {} };

// Must match the `name` values in SECTORS (frontend/src/lib/data.js) - that's
// the key each override is stored under ("sector:<name>").
/**
 * What imagery each page ACTUALLY has, described by where it appears.
 *
 * Previously a generic "Hero image" box was shown on every page - but only the
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
      label: "Main photo at the top of the homepage", fallback: DEFAULT_HERO_IMAGES.home,
      hint: "The large photo beside 'Your Brand. Your Clothing. Your Own Print.'" },
    { key: "designer:banner", kind: "image", fallback: "/banners/designer-screenshot.jpg",
      label: "'Design your own' banner picture",
      hint: "The wide picture of the designer in the 'Design your own' banner on the homepage." },
    { key: "promo:find-my-kit", kind: "image",
      label: "Find My Kit banner photo",
      hint: "The photo in the 'Find My Kit' banner partway down the homepage.",
      emptyNote: "the banner shows a plain light-green panel" },
    { key: "promo:design-shop", kind: "image",
      label: "The Design Shop banner photo",
      hint: "The background photo in 'The Design Shop' banner on the homepage.",
      emptyNote: "the banner shows a plain purple panel" },
  ],
  sports: [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the Sports & Fitness page", fallback: DEFAULT_HERO_IMAGES.sports,
      hint: "The large photo beside 'Kit out your crew.'" },
  ],
  "leavers-hoodies": [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the Leavers Hoodies page", fallback: DEFAULT_HERO_IMAGES["leavers-hoodies"],
      hint: "The large photo to the right of the heading." },
  ],
  "team-kits": [
    { key: "hero_image", kind: "image", field: "hero_image",
      label: "Main photo at the top of the Team Kits page", fallback: DEFAULT_HERO_IMAGES["team-kits"],
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
  "fight-night": [
    { key: "hero", kind: "media",
      label: "Photo or video beside the headline",
      hint: "The block on the right of the Fight Night hero. A short clip here plays silently on a loop, or use a photo." },
  ],
  "site-images": [
    { key: "pricepromise", kind: "image",
      label: "Price Promise photo", fallback: DEFAULT_PRICE_PROMISE_PHOTO,
      hint: "The square photo in the dark 'Looking professional shouldn't cost a fortune' band - shows on the homepage, product pages, Specials, Team Kits and Kit Your Workforce." },
    { key: "tool:design", kind: "image", label: "Tool tile - Design Your Own",
      hint: "One of the five tool tiles. They appear on the homepage, shop pages, industry pages, sports pages and the portfolio." },
    { key: "tool:specials", kind: "image", label: "Tool tile - Your Own Print Specials" },
    { key: "tool:workforce", kind: "image", label: "Tool tile - Kit Your Workforce" },
    { key: "tool:team-kits", kind: "image", label: "Tool tile - Team Kits" },
    { key: "tool:fight-night", kind: "image", label: "Tool tile - Fight Night Tees" },
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
  { slug: "education-schools", label: "Education & Schools" },
];

// Photo tiles on the School Trips page (SchoolTrips.jsx, "school-trip:<key>") and the
// Teams, Schools & Clubs hub (TeamsSchools.jsx, "ts-tile:<id>"). No built-in photo:
// an empty one shows a plain light-green box.
const SITE_SCHOOL_TRIP_TILES = [
  { key: "t-shirt", label: "Trip T-Shirts" }, { key: "hoodie", label: "Hoodies" },
  { key: "polo", label: "Polo Shirts" }, { key: "cap", label: "Caps & Hats" },
];
const SITE_TS_TILES = [
  { key: "leavers", label: "Leavers hoodies" }, { key: "full-squad", label: "Sports club - full squad" },
  { key: "sports-outfit", label: "Gym, PT, boxing & class" }, { key: "group-hoodies", label: "Group hoodies & tees" },
  { key: "dance", label: "Dance & theatre" }, { key: "bespoke", label: "Bespoke enquiry" },
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

/** One media slot - image or short video, with a display ratio. */
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
        toast("Tip: that clip is on the large side - compressing it will make the page load faster.", { duration: 6000 });
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
        Video autoplays silently and loops. Keep clips 10&ndash;20s at 720p (roughly 2&ndash;5MB) so the page stays fast - 20MB max.
      </p>
    </div>
  );
}

/** One image slot - paste a URL or upload a file. Blank = use code default. */
// value = what's saved in admin. fallback = the built-in photo the site shows
// while nothing is saved (so an empty box isn't mistaken for "no photo").
function ImageField({ label, hint, value, onChange, testid, compact, fallback = "", emptyNote = "" }) {
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
        {(value || fallback) ? (
          <a href={value || fallback} target="_blank" rel="noreferrer" title="Open full size" className="w-16 h-16 rounded-lg overflow-hidden border border-[#e5e7eb] bg-white flex-shrink-0 block">
            <img src={value || fallback} alt="" className="w-full h-full object-cover" />
          </a>
        ) : (
          <div className="w-16 h-16 rounded-lg border border-dashed border-[#d1d5db] bg-white flex-shrink-0 grid place-items-center text-center text-[9px] font-bold text-[#9ca3af] leading-tight">
            <span><ImageIcon size={14} className="mx-auto mb-0.5" />No photo</span>
          </div>
        )}
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
      <div className="text-[10px] mt-1 font-bold" data-testid={testid ? `${testid}-status` : undefined}>
        {value
          ? <span className="text-[#166534]">Showing your photo. Press the &times; to go back to the built-in one.</span>
          : fallback
            ? <span className="text-[#4b5563]">Showing the built-in photo. Upload or paste a link to replace it.</span>
            : <span className="text-[#b45309]">No photo set{emptyNote ? ` - ${emptyNote}` : ""}.</span>}
      </div>
    </div>
  );
}

// Sections that appear on a page but are edited somewhere else (they're shared
// by several pages). Listed on each page's editor with where else they show and
// a button to where they're changed, so nothing on a page is "hidden" from it.
const SHARED_FOR = (slug) => {
  if (slug === "home") return ["pricepromise", "tools", "howweprint", "trusted", "recentwork"];
  if (["specials", "team-kits", "kit-your-workforce"].includes(slug)) return ["pricepromise"];
  if (slug === "portfolio") return ["tools"];
  if (slug === "school-trips") return ["schooltiles"];
  if (slug === "teams-schools") return ["tstiles"];
  if (slug === "how-we-print") return ["howweprint-self"];
  if (SITE_INDUSTRIES.some((i) => i.slug === slug)) return ["industryheader", "tools"];
  return [];
};

function SharedSections({ slug, siteImages, builtIn, onOpen }) {
  const keys = SHARED_FOR(slug);
  if (!keys.length) return null;
  const img = (k, fb) => (siteImages.images || {})[k] || fb;
  const tools = TOOLS_SHOWCASE.map((t) => img(`tool:${t.key}`, t.image));
  const ITEMS = {
    pricepromise: { label: "Price Promise photo ('Looking professional shouldn't cost a fortune')",
      where: "Shows on the homepage, every product page, Specials, Team Kits and Kit Your Workforce - one photo for all of them.",
      thumbs: [img("pricepromise", DEFAULT_PRICE_PROMISE_PHOTO)], go: "site-images" },
    tools: { label: "The 5 tool tiles (Design Your Own, Specials, Kit Your Workforce, Team Kits, Fight Night)",
      where: "Shows on the homepage, shop pages, industry pages, sports pages and Portfolio.",
      thumbs: tools, go: "site-images" },
    howweprint: { label: "'How we print' section (DTF)",
      where: "Shows on the homepage and every product page. Its wording is edited in its own entry.", go: "how-we-print" },
    "howweprint-self": { label: "Where this block shows",
      where: "This section appears on the homepage and on every product page, so changes here show in all of those places." },
    trusted: { label: "'Trusted by' logos", where: "Edited in Admin > Portfolio.", href: "/admin/portfolio" },
    recentwork: { label: "Recent work photos", where: "Your portfolio jobs - edited in Admin > Portfolio.", href: "/admin/portfolio" },
    schooltiles: { label: "The 4 garment photo tiles ('Pick your garment')",
      where: "Set with the other site-wide pictures.",
      thumbs: SITE_SCHOOL_TRIP_TILES.map((t) => img(`school-trip:${t.key}`, "")).filter(Boolean), go: "site-images" },
    tstiles: { label: "The 6 group photo tiles ('Which group are you kitting out?')",
      where: "Set with the other site-wide pictures.",
      thumbs: SITE_TS_TILES.map((t) => img(`ts-tile:${t.key}`, "")).filter(Boolean), go: "site-images" },
    industryheader: { label: "Header photo at the top of this page",
      where: "Also used on this industry's tile in the Shop by Industry list.",
      thumbs: [img(`industry:${slug}`, builtIn.industries[slug] || "")].filter(Boolean), go: "site-images" },
  };
  return (
    <div className="border-2 border-[#dcfce7] rounded-2xl p-4 bg-white mb-4" data-testid="apc-shared">
      <div className="text-sm font-extrabold">Shared sections on this page</div>
      <p className="text-[11px] text-[#4b5563] mb-3">These appear on this page too, but they&rsquo;re shared with other pages, so they&rsquo;re changed in one place.</p>
      <div className="space-y-2">
        {keys.map((k) => {
          const it = ITEMS[k];
          return (
            <div key={k} className="flex items-center gap-3 border border-[#e5e7eb] rounded-xl p-2.5" data-testid={`apc-shared-${k}`}>
              {it.thumbs?.length > 0 && (
                <div className="flex -space-x-3 flex-shrink-0">
                  {it.thumbs.slice(0, 5).map((u, i) => (
                    <img key={i} src={u} alt="" className="w-12 h-12 rounded-lg object-cover border-2 border-white" />
                  ))}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-extrabold">{it.label}</div>
                <div className="text-[10px] text-[#4b5563]">{it.where}</div>
              </div>
              {it.go && (
                <button type="button" onClick={() => onOpen(it.go)} className="text-[11px] font-extrabold text-[#166534] border-2 border-[#7bc67e] rounded-full px-3 py-1.5 hover:bg-[#f0fdf4] whitespace-nowrap" data-testid={`apc-shared-open-${k}`}>
                  Change it &rarr;
                </button>
              )}
              {it.href && (
                <Link to={it.href} className="text-[11px] font-extrabold text-[#166534] border-2 border-[#7bc67e] rounded-full px-3 py-1.5 hover:bg-[#f0fdf4] whitespace-nowrap">Open &rarr;</Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Garment-type tabs at the top of an industry page. Saved in extras.tabs;
// "Use the suggested tabs" removes it so the built-in list applies again.
function IndustryTabsCard({ slug, value, onChange }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    setInfo(null);
    api.get(`/industries/${slug}`, { params: { limit: 1 } }).then(({ data }) => setInfo(data)).catch(() => setInfo({}));
  }, [slug]);
  if (!info) return <div className="py-3"><Loader2 size={14} className="animate-spin text-[#7bc67e]" /></div>;
  const types = (info.facets?.category || []).map((c) => c.value);
  const label = (v) => ({ "t-shirts": "T-shirts", "hi-vis": "Hi-vis", bottoms: "Trousers & joggers", hats: "Caps & hats", "kids-baby": "Kids & baby" }[v]
    || v.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));
  const custom = Array.isArray(value);
  const current = custom ? value : (info.default_tabs || []);
  const set = (list) => onChange(list);
  const move = (i, d) => { const l = [...current]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; set(l); };
  return (
    <div className="border-2 border-[#dcfce7] rounded-2xl p-4 bg-[#f9fafb]" data-testid="apc-industry-tabs">
      <div className="text-sm font-extrabold">Tabs at the top of this page</div>
      <p className="text-[11px] text-[#4b5563] mb-3">
        The garment types shown as buttons above the products (after &ldquo;All products&rdquo;). They&rsquo;re also shown first, mixed together, when a customer is on &ldquo;All products&rdquo;.
        The filter list on the left is not affected. {custom ? "" : "Showing the suggested tabs."}
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {current.length === 0 && <span className="text-[11px] text-[#4b5563]">No tabs - the page shows only the filter list.</span>}
        {current.map((t, i) => (
          <span key={t} className="inline-flex items-center gap-1 bg-[#7bc67e] rounded-full pl-3 pr-1 py-1 text-xs font-extrabold" data-testid={`apc-tab-${t}`}>
            {label(t)}
            <button type="button" onClick={() => move(i, -1)} title="Move left" className="w-5 h-5 rounded-full hover:bg-white/50">&lsaquo;</button>
            <button type="button" onClick={() => move(i, 1)} title="Move right" className="w-5 h-5 rounded-full hover:bg-white/50">&rsaquo;</button>
            <button type="button" onClick={() => set(current.filter((x) => x !== t))} title="Remove" className="w-5 h-5 grid place-items-center rounded-full hover:bg-white/50"><X size={11} /></button>
          </span>
        ))}
      </div>
      <div className="text-[11px] font-extrabold mb-1">Add a tab</div>
      <div className="flex flex-wrap gap-1.5">
        {types.filter((t) => !current.includes(t)).map((t) => (
          <button key={t} type="button" onClick={() => set([...current, t])} className="inline-flex items-center gap-1 bg-white border-2 border-[#dcfce7] hover:border-[#7bc67e] rounded-full px-3 py-1 text-xs font-bold" data-testid={`apc-addtab-${t}`}>
            <Plus size={11} /> {label(t)}
          </button>
        ))}
      </div>
      {custom && (
        <button type="button" onClick={() => onChange(undefined)} className="mt-3 text-[11px] font-extrabold text-[#166534] hover:underline inline-flex items-center gap-1">
          <RotateCcw size={11} /> Use the suggested tabs
        </button>
      )}
      <p className="text-[10px] text-[#4b5563] mt-2">Remember to press Save.</p>
    </div>
  );
}

export default function AdminPageCopy() {
  const [slug, setSlug] = useState(PAGE_COPY_SLUGS[0].slug);
  const [copy, setCopy] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // If the saved text can't be loaded, the editor would show blanks - and saving
  // them would wipe the page. So Save is blocked until it loads properly.
  const [loadFailed, setLoadFailed] = useState(false);
  // Built-in header photos for industry + sports pages (they come from the
  // backend catalogue), shown in the editor while no photo is saved.
  const [builtIn, setBuiltIn] = useState({ industries: {}, sports: {} });
  // Site-wide pictures, for the "Shared sections on this page" thumbnails.
  const [siteImages, setSiteImages] = useState({});
  useEffect(() => {
    api.get("/page-copy/site-images").then(({ data }) => setSiteImages(data || {})).catch(() => {});
  }, [slug]);
  useEffect(() => {
    const toMap = (list) => Object.fromEntries((Array.isArray(list) ? list : []).map((x) => [x.slug, x.hero_image]));
    Promise.all([api.get("/industries").catch(() => ({})), api.get("/sports-teams").catch(() => ({}))])
      .then(([a, b]) => setBuiltIn({ industries: toMap(a.data), sports: toMap(b.data) }));
  }, []);

  const load = async (s) => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const { data } = await api.get(`/page-copy/${s}`);
      const d = data || {};
      setCopy({ ...EMPTY, ...d, bullets: d.bullets || [], faq: d.faq || [] });
    } catch {
      setCopy(EMPTY);
      setLoadFailed(true);
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(slug); }, [slug]);

  const save = async () => {
    if (loadFailed) { toast.error("This page's saved text didn't load, so saving could wipe it. Click 'Try again' first."); return; }
    setSaving(true);
    try {
      // Only send fields the admin actually filled in - empty strings are treated as "clear".
      const payload = {
        title: copy.title, subtitle: copy.subtitle, body: copy.body,
        bullets: copy.bullets.filter((b) => b?.trim()),
        faq: copy.faq.filter((f) => (f.q || "").trim()),
        cta_label: copy.cta_label, cta_link: copy.cta_link,
        hero_image: copy.hero_image || "",
        images: copy.images || {},
        media: copy.media || {},
        extras: copy.extras || {},  // e.g. footer social links (were never saved)
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

  // "Pictures used across the whole site" isn't a page - it has no heading,
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

              {SITE_INDUSTRIES.some((it) => it.slug === slug) && (
                <IndustryTabsCard slug={slug} value={(copy.extras || {}).tabs} onChange={(v) => setExtra("tabs", v)} />
              )}

              <SharedSections slug={slug} siteImages={siteImages} builtIn={builtIn} onOpen={(s) => { setSlug(s); window.scrollTo({ top: 0, behavior: "smooth" }); }} />

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
                    This page doesn&rsquo;t have any pictures you can swap out yet - only its wording.
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
                          fallback={slot.fallback || (slot.key.startsWith("tool:") ? (TOOLS_SHOWCASE.find((t) => `tool:${t.key}` === slot.key) || {}).image : "")}
                          emptyNote={slot.emptyNote}
                        />
                      )
                    ))}
                  </div>
                )}

                {isSiteFooter && (
                  <div className="space-y-3" data-testid="apc-socials">
                    <p className="text-[11px] text-[#4b5563]">
                      Paste the full web address of each profile. Leave one blank and that icon
                      simply isn&rsquo;t shown in the footer - no empty button, no dead link.
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
                            fallback={builtIn.industries[it.slug] || ""}
                            compact
                          />
                        ))}
                      </div>
                    </div>

                    {[
                      { title: "School Trips page - garment tiles", hint: "The 4 photo tiles under 'Pick your garment' on the School Trips page.", prefix: "school-trip", list: SITE_SCHOOL_TRIP_TILES },
                      { title: "Teams, Schools & Clubs page - group tiles", hint: "The photo at the top of each 'Which group are you kitting out?' tile.", prefix: "ts-tile", list: SITE_TS_TILES },
                    ].map((g) => (
                      <div key={g.prefix}>
                        <div className="text-xs font-extrabold mb-1">{g.title}</div>
                        <p className="text-[10px] text-[#4b5563] mb-2">{g.hint}</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {g.list.map((it) => (
                            <ImageField
                              key={it.key}
                              label={it.label}
                              value={(copy.images || {})[`${g.prefix}:${it.key}`] || ""}
                              onChange={(v) => setImage(`${g.prefix}:${it.key}`, v)}
                              testid={`apc-${g.prefix}-${it.key}`}
                              emptyNote="the tile shows a plain light-green box"
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    ))}

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
                            fallback={builtIn.sports[it.slug] || ""}
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
                          fallback={(SECTORS.find((s) => s.name === name) || {}).image || ""}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!isSiteImages && !isSiteFooter && (
              <label className="block" data-testid="apc-body">
                <div className="text-xs font-extrabold mb-1">Longer description <span className="text-[#4b5563] font-normal">- leave an empty line between paragraphs</span></div>
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
                  {copy.bullets.length === 0 && <div className="text-xs text-[#4b5563] italic">None added - the page is using the bullet points it came with.</div>}
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
                {loadFailed && (
                  <div className="text-sm text-amber-800 bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-2 inline-flex items-center gap-3" data-testid="apc-load-failed">
                    Couldn&rsquo;t load this page&rsquo;s saved text, so saving is paused to protect it.
                    <button type="button" onClick={() => load(slug)} className="font-extrabold underline">Try again</button>
                  </div>
                )}
                <button onClick={save} disabled={saving || loadFailed} className="px-5 py-3 bg-[#7bc67e] rounded-full font-extrabold inline-flex items-center gap-2 hover:bg-[#5eb062] disabled:opacity-50" data-testid="apc-save">
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
