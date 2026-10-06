// Marketing / analytics tags: Meta Pixel, Google Analytics 4, Google Ads.
// IDs are set in Admin > Integrations (served by /api/site/tracking). Nothing
// loads until the visitor accepts cookies (UK PECR) - see CookieConsent.jsx.
import { api } from "./api";

const KEY = "yop_cookie_consent";       // "all" | "essential"
let cfg = null;
let loaded = false;
const queue = [];

export function consentChoice() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setConsent(choice) {
  try { localStorage.setItem(KEY, choice); } catch { /* private mode */ }
  if (choice === "all") load();
}

export async function trackingConfig() {
  if (cfg) return cfg;
  try { cfg = (await api.get("/site/tracking")).data || {}; } catch { cfg = {}; }
  return cfg;
}
export const anyTracking = (c) => !!(c && (c.meta_pixel_id || c.ga4_id || c.google_ads_id));

function addScript(src) {
  const s = document.createElement("script");
  s.async = true; s.src = src;
  document.head.appendChild(s);
}

async function load() {
  if (loaded || consentChoice() !== "all") return;
  const c = await trackingConfig();
  if (!anyTracking(c)) return;
  loaded = true;
  if (c.meta_pixel_id) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,"script","https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", c.meta_pixel_id);
  }
  const gid = c.ga4_id || c.google_ads_id;
  if (gid) {
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gid)}`);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    if (c.ga4_id) window.gtag("config", c.ga4_id, { send_page_view: false });
    if (c.google_ads_id) window.gtag("config", c.google_ads_id);
  }
  queue.splice(0).forEach((fn) => fn());
}

export function initTracking() { if (consentChoice() === "all") load(); }

function run(fn) {
  if (consentChoice() !== "all") return;
  if (loaded) fn(); else { queue.push(fn); load(); }
}
const fbq = (...a) => window.fbq && window.fbq(...a);
const gtag = (...a) => window.gtag && window.gtag(...a);

export function trackPageView(path) {
  run(() => {
    fbq("track", "PageView");
    if (cfg?.ga4_id) gtag("event", "page_view", { page_path: path, page_location: window.location.href, page_title: document.title });
  });
}
export function trackViewProduct(p) {
  if (!p) return;
  run(() => {
    fbq("track", "ViewContent", { content_ids: [p.id], content_name: p.name, content_type: "product", value: Number(p.price) || 0, currency: "GBP" });
    gtag("event", "view_item", { currency: "GBP", value: Number(p.price) || 0, items: [{ item_id: p.id, item_name: p.name }] });
  });
}
export function trackAddToCart(line, value = 0) {
  const qty = Object.values(line?.size_qtys || {}).reduce((a, b) => a + Number(b || 0), 0);
  run(() => {
    fbq("track", "AddToCart", { content_ids: [line.product_id], content_type: "product", value, currency: "GBP", num_items: qty });
    gtag("event", "add_to_cart", { currency: "GBP", value, items: [{ item_id: line.product_id, quantity: qty }] });
  });
}
export function trackBeginCheckout(value = 0, flow = "") {
  run(() => {
    fbq("track", "InitiateCheckout", { value, currency: "GBP", content_category: flow });
    gtag("event", "begin_checkout", { currency: "GBP", value, flow });
  });
}
export function trackPurchase(orderId, value) {
  const k = `yop_purchase_${orderId}`;
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* ignore */ }
  run(() => {
    fbq("track", "Purchase", { value, currency: "GBP" }, { eventID: orderId });
    gtag("event", "purchase", { transaction_id: orderId, value, currency: "GBP" });
    if (cfg?.google_ads_id && cfg?.google_ads_purchase_label) {
      gtag("event", "conversion", { send_to: `${cfg.google_ads_id}/${cfg.google_ads_purchase_label}`, value, currency: "GBP", transaction_id: orderId });
    }
  });
}
