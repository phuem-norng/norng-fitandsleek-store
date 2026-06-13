/** Variant row barcode formats (react-barcode / JsBarcode names). */

export const VARIANT_BARCODE_FORMAT_OPTIONS = [
  { value: "EAN13", label: "EAN-13 (The Most Popular Globally)" },
  { value: "UPC", label: "UPC-A (The North American Standard)" },
  { value: "CODE128", label: "Code 128" },
];

export const DEFAULT_VARIANT_BARCODE_FORMAT = "EAN13";

export function normalizeVariantBarcodeFormat(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "UPC" || v === "UPC-A" || v === "UPCA") return "UPC";
  if (v === "CODE128" || v === "CODE-128" || v === "CODE 128") return "CODE128";
  return "EAN13";
}

export function barcodeFormatShortLabel(format) {
  const fmt = normalizeVariantBarcodeFormat(format);
  if (fmt === "UPC") return "UPC-A";
  if (fmt === "CODE128") return "Code 128";
  return "EAN-13";
}

/** Format prop for react-barcode. */
export function reactBarcodeFormat(format) {
  return normalizeVariantBarcodeFormat(format);
}

export function variantBarcodeMaxLength(format) {
  const fmt = normalizeVariantBarcodeFormat(format);
  if (fmt === "UPC") return 12;
  if (fmt === "CODE128") return 120;
  return 13;
}

export function variantBarcodePlaceholder(format) {
  const fmt = normalizeVariantBarcodeFormat(format);
  if (fmt === "UPC") return "12-digit UPC-A";
  if (fmt === "CODE128") return "Alphanumeric Code 128";
  return "13-digit EAN-13";
}

export function sanitizeVariantBarcodeInput(value, format) {
  const fmt = normalizeVariantBarcodeFormat(format);
  if (fmt === "CODE128") {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9\-_.]/g, "")
      .slice(0, variantBarcodeMaxLength(fmt));
  }
  const digits = String(value || "").replace(/\D/g, "");
  return digits.slice(0, variantBarcodeMaxLength(fmt));
}

/** EAN-13 / UPC-A check digit (GTIN). */
function gtinCheckDigit(bodyDigits) {
  const d = bodyDigits.split("").map((c) => parseInt(c, 10));
  let sum = 0;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    const posFromRight = d.length - i;
    sum += d[i] * (posFromRight % 2 === 1 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}

export function generateVariantBarcode(format = DEFAULT_VARIANT_BARCODE_FORMAT) {
  const fmt = normalizeVariantBarcodeFormat(format);
  if (fmt === "CODE128") {
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `VAR-${Date.now().toString(36).toUpperCase().slice(-6)}${random}`.slice(0, 48);
  }
  const len = fmt === "UPC" ? 11 : 12;
  let body = "";
  for (let i = 0; i < len; i += 1) {
    body += String(Math.floor(Math.random() * 10));
  }
  return body + gtinCheckDigit(body);
}

export function isValidVariantBarcode(value, format) {
  const fmt = normalizeVariantBarcodeFormat(format);
  const code = sanitizeVariantBarcodeInput(value, fmt);
  if (!code) return false;
  if (fmt === "CODE128") return code.length >= 1;
  const expected = variantBarcodeMaxLength(fmt);
  if (code.length !== expected) return false;
  const body = code.slice(0, expected - 1);
  return body + gtinCheckDigit(body) === code;
}
