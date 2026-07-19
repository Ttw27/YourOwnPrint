import { useEffect, useState } from "react";
import { fetchPageCopy } from "../lib/api";

/**
 * usePageCopy(slug, defaults)
 *
 * Reads admin-editable CMS overrides for a page from GET /api/page-copy/{slug}
 * and merges them onto the caller's `defaults` object. Any field the admin
 * hasn't touched falls back to the code default — safe, drop-in adoption.
 *
 * Usage:
 *   const copy = usePageCopy("home", { title: "Hardcoded default", subtitle: "..." });
 *   return <h1>{copy.title}</h1>;
 */

// Per-page-load cache. Shared components (PricePromise, ToolsShowcase) ask for
// the same slug on the same screen, and without this each copy of the component
// would fire its own request. Cleared on a full page reload, so an admin edit
// shows up as soon as the page is refreshed.
const COPY_CACHE = new Map();
const COPY_INFLIGHT = new Map();

function loadPageCopy(slug) {
  if (COPY_CACHE.has(slug)) return Promise.resolve(COPY_CACHE.get(slug));
  if (COPY_INFLIGHT.has(slug)) return COPY_INFLIGHT.get(slug);
  const p = fetchPageCopy(slug)
    .then((v) => {
      const val = v || {};
      COPY_CACHE.set(slug, val);
      COPY_INFLIGHT.delete(slug);
      return val;
    })
    .catch(() => {
      // A failed fetch must not blank the page — fall through to code defaults.
      COPY_CACHE.set(slug, {});
      COPY_INFLIGHT.delete(slug);
      return {};
    });
  COPY_INFLIGHT.set(slug, p);
  return p;
}

export default function usePageCopy(slug, defaults = {}) {
  const [override, setOverride] = useState(() => COPY_CACHE.get(slug) || null);
  useEffect(() => {
    let live = true;
    loadPageCopy(slug).then((v) => { if (live) setOverride(v || {}); });
    return () => { live = false; };
  }, [slug]);
  if (!override) return { ...defaults };
  // Only overwrite when admin has set a truthy value (empty strings mean "unset — use default").
  const merged = { ...defaults };
  Object.entries(override).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    merged[k] = v;
  });
  return merged;
}

/**
 * Slug holding imagery that isn't owned by any single page — the Price Promise
 * photo, the five tool tiles, and the industry / sports-team header photos.
 * These appear on many pages at once, so they can't live in a page's own record.
 */
export const SITE_IMAGES_SLUG = "site-images";

/**
 * useSiteImages()
 *
 * Admin overrides for site-wide imagery. Always returns the code default when
 * nothing has been set, so every caller is safe to adopt without a fallback of
 * its own.
 *
 *   const site = useSiteImages();
 *   <img src={site.image(`industry:${slug}`, ind.hero_image)} />
 */
export function useSiteImages() {
  const copy = usePageCopy(SITE_IMAGES_SLUG, {});
  const images = copy.images || {};
  const media = copy.media || {};
  return {
    images,
    media,
    image: (key, fallback = "") => (images[key] || "").trim() || fallback,
    mediaFor: (key) => media[key],
  };
}
