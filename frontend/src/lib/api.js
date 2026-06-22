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
