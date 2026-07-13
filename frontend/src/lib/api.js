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

export async function fetchProducts(category, limit = 500, offset = 0, genderFit, industries) {
  const { data } = await api.get("/products", { params: { ...(category ? { category } : {}), ...(industries ? { industries } : {}), ...(genderFit ? { gender_fit: genderFit } : {}), limit, offset } });
  return data; // {items, total, offset, returned}
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
export async function fetchAllProductsAdmin(offset = 0, limit = 25, q = "") {
  const { data } = await api.get("/admin/products", { params: { offset, limit, q } });
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
export async function fetchAdminDesignerProducts(offset = 0, limit = 25, q = "") {
  const { data } = await api.get("/admin/designer-products", { params: { offset, limit, q } });
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

// ----- Collection SEO (admin editable) -----
export async function fetchCollectionSeo(slug) {
  const { data } = await api.get(`/admin/collection-seo/${slug}`);
  return data;
}
export async function adminUpdateCollectionSeo(slug, payload) {
  const { data } = await api.patch(`/admin/collection-seo/${slug}`, payload);
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

// ----- Sports & Fitness Teams landings -----
export async function fetchSportsTeams() {
  const { data } = await api.get("/sports-teams");
  return data;
}
export async function fetchSportsTeam(slug) {
  const { data } = await api.get(`/sports-teams/${slug}`);
  return data;
}

// ----- Portfolio -----
export async function fetchPortfolio(params = {}) {
  const { data } = await api.get("/portfolio", { params });
  return data;
}
export async function fetchPortfolioCategories() {
  const { data } = await api.get("/portfolio/categories");
  return data;
}
export async function adminListPortfolio() {
  const { data } = await api.get("/admin/portfolio");
  return data;
}
export async function adminCreatePortfolio(payload) {
  const { data } = await api.post("/admin/portfolio", payload);
  return data;
}
export async function adminUpdatePortfolio(id, payload) {
  const { data } = await api.patch(`/admin/portfolio/${id}`, payload);
  return data;
}
export async function adminDeletePortfolio(id) {
  const { data } = await api.delete(`/admin/portfolio/${id}`);
  return data;
}

// ----- Navigation -----
export async function fetchNavigation() {
  const { data } = await api.get("/navigation");
  return data;
}
export async function adminUpdateNavigation(config) {
  const { data } = await api.patch("/admin/navigation", { config });
  return data;
}
export async function adminResetNavigation() {
  const { data } = await api.post("/admin/navigation/reset");
  return data;
}

// ----- Integration keys -----
export async function adminListIntegrations() {
  const { data } = await api.get("/admin/integrations");
  return data;
}
export async function adminUpdateIntegrations(values) {
  const { data } = await api.patch("/admin/integrations", { values });
  return data;
}
export async function fetchSiteWhatsApp() {
  const { data } = await api.get("/site/whatsapp");
  return data;
}

// ----- Bundle variants -----
export async function fetchBundleVariants(bundleId) {
  const { data } = await api.get(`/bundles/${bundleId}/variants`);
  return data;
}
export async function adminListBundleVariants(bundleId) {
  const { data } = await api.get("/admin/bundle-variants", { params: bundleId ? { bundle_id: bundleId } : {} });
  return data;
}
export async function adminCreateBundleVariant(payload) {
  const { data } = await api.post("/admin/bundle-variants", payload);
  return data;
}
export async function adminUpdateBundleVariant(id, payload) {
  const { data } = await api.patch(`/admin/bundle-variants/${id}`, payload);
  return data;
}
export async function adminDeleteBundleVariant(id) {
  const { data } = await api.delete(`/admin/bundle-variants/${id}`);
  return data;
}

// ----- Full Squad Configurator -----
export async function fetchFullSquadConfig() {
  const { data } = await api.get("/full-squad/config");
  return data;
}
export async function adminUpdateFullSquadAddons(values) {
  const { data } = await api.patch("/admin/full-squad/addons", { values });
  return data;
}

// ----- Sports Outfit Configurator (Gyms / PTs / Boxing / Thai / Kick) -----
export async function fetchSportsOutfitConfig() {
  const { data } = await api.get("/sports-outfit/config");
  return data;
}
export async function adminUpdateSportsOutfitAddons(values) {
  const { data } = await api.patch("/admin/sports-outfit/addons", { values });
  return data;
}

// ----- Artwork upload (Sports Outfit + Full Squad design attachments) -----
export async function uploadArtwork({ dataUrl, filename, purpose }) {
  const { data } = await api.post("/uploads/artwork", {
    image_data_url: dataUrl,
    filename: filename || "",
    purpose: purpose || "artwork",
  });
  // data => { id, url, filename, size_bytes }
  const backendBase = process.env.REACT_APP_BACKEND_URL || "";
  return { ...data, absolute_url: `${backendBase}${data.url}` };
}
export async function fetchSockSizes() {
  const { data } = await api.get("/sock-sizes");
  return data;
}
export async function adminUpdateSockSizes(values) {
  const { data } = await api.patch("/admin/sock-sizes", { values });
  return data;
}

// ----- Product bulk import (PenCarrie / manual one-off) -----
export async function bulkUpdateImported(payload) {
  const { data } = await api.post("/admin/products/bulk-update-imported", payload);
  return data;
}

export async function uploadAdminImage(file, folder = "admin-uploads") {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/admin/upload-image", formData, {
    params: { folder },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // {url}
}

export async function fetchImportedProducts(offset = 0, limit = 25, q = "") {
  const { data } = await api.get("/admin/products/imported", { params: { offset, limit, q } });
  return data;
}
export async function bulkImportProducts(payload) {
  const { data } = await api.post("/admin/products/bulk-import", payload);
  return data;
}
export async function patchImportedProduct(id, patch) {
  const { data } = await api.patch(`/admin/products/imported/${id}`, patch);
  return data;
}
export async function deleteImportedProduct(id) {
  const { data } = await api.delete(`/admin/products/imported/${id}`);
  return data;
}

// ----- Product overrides (edit hardcoded catalogue products) -----
export async function patchProductOverride(pid, patch) {
  const { data } = await api.patch(`/admin/products/${pid}/override`, patch);
  return data;
}
export async function clearProductOverride(pid) {
  const { data } = await api.delete(`/admin/products/${pid}/override`);
  return data;
}
export async function fetchProductOverride(pid) {
  const { data } = await api.get(`/admin/products/${pid}/override`);
  return data;
}
export async function suggestCrossSell(pid, limit = 6) {
  const { data } = await api.get(`/admin/products/${pid}/suggest-cross-sell`, { params: { limit } });
  return data;
}

// ----- Page copy CMS -----
export async function fetchPageCopy(slug) {
  try { const { data } = await api.get(`/page-copy/${slug}`); return data || {}; }
  catch { return {}; }
}
export async function adminUpdatePageCopy(slug, patch) {
  const { data } = await api.patch(`/admin/page-copy/${slug}`, patch);
  return data;
}
export async function adminDeletePageCopy(slug) {
  const { data } = await api.delete(`/admin/page-copy/${slug}`);
  return data;
}
export async function adminListPageCopySlugs() {
  const { data } = await api.get("/admin/page-copy-slugs");
  return data;
}

// ----- Designer AI helpers -----
export async function designerRemoveBg(imageBase64) {
  const { data } = await api.post("/designer/remove-bg", { image_base64: imageBase64 });
  return data;
}
export async function designerAiEffect(imageBase64, effect) {
  const { data } = await api.post("/designer/ai-effect", { image_base64: imageBase64, effect });
  return data;
}
export async function adminSendTestEmail(to) {
  const { data } = await api.post("/admin/test-email", { to });
  return data;
}

// ----- Multi-product cart -----
export async function priceCart(items) {
  const { data } = await api.post("/cart/price", { items, origin_url: window.location.origin });
  return data;
}
export async function createCartCheckout(items, customer_email) {
  const { data } = await api.post("/checkout/cart-session", { items, origin_url: window.location.origin, customer_email: customer_email || null });
  return data;
}

// ----- Customer auth -----
export async function customerRegister({ email, password, name }) {
  const { data } = await api.post("/customer/register", { email, password, name });
  return data;
}
export async function customerLogin({ email, password }) {
  const { data } = await api.post("/customer/login", { email, password });
  return data;
}
export async function customerLogout() {
  const { data } = await api.post("/customer/logout", {});
  return data;
}
export async function customerMe(token) {
  const { data } = await api.get("/customer/me", token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  return data;
}
export async function customerForgotPassword(email) {
  const { data } = await api.post("/customer/forgot-password", { email });
  return data;
}
export async function customerResetPassword({ token, new_password }) {
  const { data } = await api.post("/customer/reset-password", { token, new_password });
  return data;
}
// Customer cart / orders / addresses / designs
export async function customerGetCart(token) {
  const { data } = await api.get("/customer/cart", { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerPutCart(token, items) {
  const { data } = await api.put("/customer/cart", { items }, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerMergeCart(token, items) {
  const { data } = await api.post("/customer/cart/merge", { items }, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerOrders(token) {
  const { data } = await api.get("/customer/orders", { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerAddresses(token) {
  const { data } = await api.get("/customer/addresses", { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerAddAddress(token, address) {
  const { data } = await api.post("/customer/addresses", address, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerDeleteAddress(token, id) {
  const { data } = await api.delete(`/customer/addresses/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerDesigns(token) {
  const { data } = await api.get("/customer/designs", { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerSaveDesign(token, design) {
  const { data } = await api.post("/customer/designs", design, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
export async function customerDeleteDesign(token, id) {
  const { data } = await api.delete(`/customer/designs/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

// ----- Configurator settings (addon prices) -----
export async function adminGetConfiguratorSettings() {
  const { data } = await api.get("/admin/configurator-settings");
  return data;
}

// ----- Orders & enquiries (admin) -----
export async function adminListOrders(status = "all", limit = 200) {
  const { data } = await api.get("/admin/orders", { params: { status, limit } });
  return data;
}
export async function adminListEnquiries(limit = 200) {
  const { data } = await api.get("/admin/enquiries", { params: { limit } });
  return data;
}

// ----- PenCarrie API import -----
export async function pencarrieFetchCatalogue(offset = 0, limit = 500, brand = "", q = "") {
  const { data } = await api.get("/admin/pencarrie/fetch-catalogue", { params: { offset, limit, brand, q } });
  return data;
}
