import api from "./api";

export async function fetchTelegramSettings() {
  const { data } = await api.get("/telegram/settings");
  return data;
}

export async function fetchTelegramStatus() {
  const { data } = await api.get("/telegram/status");
  return data;
}

export async function fetchTelegramOrderLink(orderNumber) {
  const { data } = await api.get(`/telegram/orders/${encodeURIComponent(orderNumber)}/link`);
  return data;
}
