const PHNOM_PENH_MARKERS = [
  "phnom penh",
  "phnompenh",
  "pp",
  "ភ្នំពេញ",
  "រាជធានីភ្នំពេញ",
];

export const DEFAULT_DELIVERY_RATES = {
  phnom_penh: 1.5,
  province: 2,
};

export function normalizeProvince(province) {
  return String(province || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isPhnomPenhProvince(province) {
  const normalized = normalizeProvince(province);
  if (!normalized) return false;
  if (PHNOM_PENH_MARKERS.includes(normalized)) return true;
  return PHNOM_PENH_MARKERS.some((marker) => normalized.includes(marker));
}

export function resolveDeliveryFee(province, rates = DEFAULT_DELIVERY_RATES) {
  const zone = isPhnomPenhProvince(province) ? "phnom_penh" : "province";
  const fee = Number(rates?.[zone] ?? DEFAULT_DELIVERY_RATES[zone] ?? 0);
  return {
    zone,
    fee: Number.isFinite(fee) ? fee : 0,
    label: zone === "phnom_penh" ? "Phnom Penh" : "Province",
  };
}
