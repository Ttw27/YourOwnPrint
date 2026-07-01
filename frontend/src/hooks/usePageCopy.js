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
export default function usePageCopy(slug, defaults = {}) {
  const [override, setOverride] = useState(null);
  useEffect(() => {
    let live = true;
    fetchPageCopy(slug).then((v) => { if (live) setOverride(v || {}); });
    return () => { live = false; };
  }, [slug]);
  if (!override) return { ...defaults };
  // Only replace primitives + arrays the admin has explicitly set (not undefined).
  const merged = { ...defaults };
  Object.entries(override).forEach(([k, v]) => {
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0 && !defaults[k])) {
      merged[k] = v;
    }
  });
  return merged;
}
