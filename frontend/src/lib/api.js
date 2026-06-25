import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// ----- Admin auth (token in localStorage) -----
export const ADMIN_TOKEN_KEY = "yop_admin_token";

export function getAdminToken() {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ""; } catch { return ""; }
}
export function setAdminToken(token) {
  try { token ? localStorage.setItem(ADMIN_TOKEN_KEY, token) : localStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
}
export function clearAdminToken() { setAdminToken(""); }

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function adminLogin(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  if (data?.token) setAdminToken(data.token);
  return data;
}
export async function adminLogout() {
  clearAdminToken();
  try { await api.post("/auth/logout"); } catch {}
}
export async function fetchAdminMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function fetchProducts(category) {
  const { data } = await api.get("/products", { params: category ? { category } : {} });
  return data;
}

export async function submitContact(payload) {
  const { data } = await api.post("/contact", payload);
  return data;
}

export async function selectTheme(theme_id, note = "") {
  const { data } = await api.post("/theme-selection", { theme_id, note });
  return data;
}

export async function createCheckout(payload) {
  const { data } = await api.post("/checkout/session", payload);
  return data;
}

export async function fetchCheckoutStatus(session_id) {
  const { data } = await api.get(`/checkout/status/${session_id}`);
  return data;
}

export async function fetchProductReviews(product_id) {
  const { data } = await api.get(`/reviews/product/${product_id}`);
  return data;
}

export async function fetchReviewsAggregate() {
  const { data } = await api.get("/reviews/aggregate");
  return data;
}

export async function fetchRecentReviews(limit = 12) {
  const { data } = await api.get("/reviews/recent", { params: { limit } });
  return data;
}

export async function submitReview(payload) {
  const { data } = await api.post("/reviews", payload);
  return data;
}

export async function importJudgeMe(payload) {
  const { data } = await api.post("/reviews/import-judgeme", payload);
  return data;
}

export async function fetchPlacements() {
  const { data } = await api.get("/placements");
  return data;
}

export async function submitQuoteRequest(payload) {
  const { data } = await api.post("/quote-request", payload);
  return data;
}

export async function fetchFightNightAddons() {
  const { data } = await api.get("/fight-night/addons");
  return data;
}
export async function fetchFightNightTiers() {
  const { data } = await api.get("/bulk-tiers/fight-night");
  return data;
}
export async function fetchLeaversTiers() {
  const { data } = await api.get("/bulk-tiers/leavers");
  return data;
}
export async function fetchLeaversProducts() {
  const { data } = await api.get("/leavers/products");
  return data;
}
export async function createGroupOrder(payload) {
  const { data } = await api.post("/group-orders", payload);
  return data;
}
export async function fetchGroupOrder(token) {
  const { data } = await api.get(`/group-orders/${token}`);
  return data;
}
export async function joinGroupOrder(token, payload) {
  const { data } = await api.post(`/group-orders/${token}/join`, payload);
  return data;
}
export async function fetchGroupOrderManage(token, manage_token) {
  const { data } = await api.get(`/group-orders/${token}/manage/${manage_token}`);
  return data;
}
export async function removeGroupMember(token, manage_token, member_id) {
  const { data } = await api.delete(`/group-orders/${token}/manage/${manage_token}/members/${member_id}`);
  return data;
}
export async function closeGroupOrder(token, manage_token) {
  const { data } = await api.post(`/group-orders/${token}/manage/${manage_token}/close`);
  return data;
}

// ----- Product meta + generic bulk pricing -----
export async function fetchProductBulkTiers(product_id) {
  const { data } = await api.get(`/bulk-tiers/product/${product_id}`);
  return data;
}
export async function fetchBulkDefaults() {
  const { data } = await api.get("/bulk-tiers/defaults");
  return data;
}
export async function updateBulkDefaults(payload) {
  const { data } = await api.patch("/admin/bulk-tiers/defaults", payload);
  return data;
}
export async function fetchAllProductsAdmin() {
  const { data } = await api.get("/admin/products");
  return data;
}
export async function updateProductMeta(product_id, payload) {
  const { data } = await api.patch(`/admin/products/${product_id}/meta`, payload);
  return data;
}
export async function fetchTeamKitAddons() {
  const { data } = await api.get("/team-kits/addons");
  return data;
}
export async function fetchTeamKitBrands(product_id) {
  const { data } = await api.get("/team-kit-brands", { params: product_id ? { product_id } : {} });
  return data;
}
export async function createTeamKitBrand(payload) {
  const { data } = await api.post("/team-kit-brands", payload);
  return data;
}
export async function updateTeamKitBrand(id, payload) {
  const { data } = await api.put(`/team-kit-brands/${id}`, payload);
  return data;
}
export async function deleteTeamKitBrand(id) {
  const { data } = await api.delete(`/team-kit-brands/${id}`);
  return data;
}

// ----- Designer (Design Your Own) -----
export async function fetchDesignerProducts() {
  const { data } = await api.get("/designer/products");
  return data;
}
export async function fetchAdminDesignerProducts() {
  const { data } = await api.get("/admin/designer-products");
  return data;
}
export async function updateDesignerSettings(product_id, payload) {
  const { data } = await api.patch(`/admin/designer-products/${product_id}`, payload);
  return data;
}
export async function saveDesignerArtwork(payload) {
  const { data } = await api.post("/designer/artwork", payload);
  return data;
}

// ----- Allowed placements (public) -----
export async function fetchAllowedPlacements(product_id) {
  const { data } = await api.get(`/products/${product_id}/allowed-placements`);
  return data; // { allowed_placements: [...] }
}

// ----- Kit Your Workforce -----
export async function fetchWorkforceProducts() {
  const { data } = await api.get("/workforce/products");
  return data;
}
export async function fetchWorkforceTiers() {
  const { data } = await api.get("/workforce/tiers");
  return data;
}
export async function workforceCheckout(payload) {
  const { data } = await api.post("/workforce/checkout", payload);
  return data;
}
export async function workforceQuote(payload) {
  const { data } = await api.post("/workforce/quote", payload);
  return data;
}
export async function updateWorkforceTiers(payload) {
  const { data } = await api.patch("/admin/workforce-tiers", payload);
  return data;
}

// ----- Your Own Print Specials -----
export async function fetchSpecialsProducts() {
  const { data } = await api.get("/specials/products");
  return data;
}

// ----- Industries -----
export async function fetchIndustries() {
  const { data } = await api.get("/industries");
  return data;
}
export async function fetchIndustry(slug, opts = {}) {
  const { data } = await api.get(`/industries/${slug}`, { params: opts });
  return data;
}

// ----- Shop by garment type -----
export async function fetchShopTypes() {
  const { data } = await api.get("/shop/types");
  return data;
}
export async function fetchShopByType(slug, opts = {}) {
  const { data } = await api.get(`/shop/type/${slug}`, { params: opts });
  return data;
}

export const GENDER_FIT_VALUES = ["mens", "womens", "unisex", "kids"];
export const INDUSTRY_SLUGS = ["trades", "hospitality", "healthcare", "beauty", "construction", "logistics", "fitness", "cleaning", "hair-beauty"];

// ----- Leavers' templates + checkout + bespoke -----
export async function fetchLeaversTemplates() {
  const { data } = await api.get("/leavers/templates");
  return data;
}
export async function leaversCheckout(payload) {
  const { data } = await api.post("/leavers/checkout", payload);
  return data;
}
export async function leaversBespoke(payload) {
  const { data } = await api.post("/leavers/bespoke", payload);
  return data;
}
export async function adminListLeaversTemplates() {
  const { data } = await api.get("/admin/leavers/templates");
  return data;
}
export async function adminCreateLeaversTemplate(payload) {
  const { data } = await api.post("/admin/leavers/templates", payload);
  return data;
}
export async function adminUpdateLeaversTemplate(id, payload) {
  const { data } = await api.put(`/admin/leavers/templates/${id}`, payload);
  return data;
}
export async function adminDeleteLeaversTemplate(id) {
  const { data } = await api.delete(`/admin/leavers/templates/${id}`);
  return data;
}

// ----- Also bought with (cross-sells) -----
export async function fetchAlsoBought(product_id, limit = 4) {
  const { data } = await api.get(`/products/${product_id}/also-bought`, { params: { limit } });
  return data;
}

// ----- Match with (curator-picked complementary items) -----
export async function fetchMatchWith(product_id, limit = 4) {
  const { data } = await api.get(`/products/${product_id}/match-with`, { params: { limit } });
  return data;
}

// ----- Customer Q&A -----
export async function fetchProductQA(product_id) {
  const { data } = await api.get(`/qa/${product_id}`);
  return data;
}
export async function postProductQuestion(payload) {
  const { data } = await api.post(`/qa`, payload);
  return data;
}
export async function fetchAllAdminQA() {
  const { data } = await api.get(`/admin/qa`);
  return data;
}
export async function answerProductQuestion(qa_id, answer) {
  const { data } = await api.post(`/admin/qa/${qa_id}/answer`, { answer });
  return data;
}
export async function deleteProductQuestion(qa_id) {
  const { data } = await api.delete(`/admin/qa/${qa_id}`);
  return data;
}

export const PLACEMENT_LABELS = {
  "left-breast": "Left breast",
  "right-breast": "Right breast",
  "full-front": "Full front",
  "back-print": "Back print",
  "left-sleeve": "Left sleeve",
  "right-sleeve": "Right sleeve",
  "neck-label": "Neck label",
};
export const ALL_PLACEMENTS = ["left-breast", "right-breast", "full-front", "back-print", "left-sleeve", "right-sleeve", "neck-label"];
