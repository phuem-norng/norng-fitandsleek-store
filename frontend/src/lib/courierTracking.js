/** Courier URL templates — {code} is replaced with the tracking number. */
export const COURIER_URL_PRESETS = [
  {
    id: "jt",
    label: "J&T Express",
    template: "https://www.jtexpresskh.com/track?billCodes={code}",
  },
  {
    id: "vireak",
    label: "Vireak Buntham Express",
    template: "https://vireakbuntham.com/en/Tracking/Tracking?trackingCode={code}",
  },
];

export function applyCourierTemplate(template, trackingCode) {
  const code = String(trackingCode || "").trim();
  if (!template || !code) return "";
  return template.replace(/\{code\}/g, encodeURIComponent(code));
}

export function courierTrackLabel(provider, fallback = "courier") {
  const name = String(provider || "").trim();
  return name && name.toLowerCase() !== "internal" ? name : fallback;
}
