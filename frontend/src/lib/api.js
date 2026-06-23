import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

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
