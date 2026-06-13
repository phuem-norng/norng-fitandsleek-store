export const LOT_TIERS = [
  { value: "older", label: "Older Stock" },
  { value: "newer", label: "Newer Stock" },
];

export const LOT_TIER_FILTER_OPTIONS = [
  { id: "all", label: "All tiers" },
  { id: "older", label: "Older stock" },
  { id: "newer", label: "Newer stock" },
];

export const LISTING_STATUSES = [
  { value: "active", label: "Active" },
  { value: "clearance", label: "Clearance" },
  { value: "on_hold", label: "On Hold" },
  { value: "discontinued", label: "Discontinued" },
];

export const LOT_LISTING_STATUS_FILTER_OPTIONS = [
  { id: "all", label: "All statuses" },
  ...LISTING_STATUSES.map((s) => ({ id: s.value, label: s.label })),
];

export const PRICE_RULES = [
  { value: "fixed", label: "Fixed Price" },
  { value: "percent_of_standard", label: "% of Standard Price" },
  { value: "follow_standard", label: "Follow Standard Price" },
];

export function lotTierLabel(value) {
  return LOT_TIERS.find((t) => t.value === value)?.label || value || "—";
}

export function lotTierTone(value) {
  switch (value) {
    case "older":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200";
    default:
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-200";
  }
}

export function listingStatusLabel(value) {
  return LISTING_STATUSES.find((s) => s.value === value)?.label || value || "—";
}

export function listingStatusTone(value) {
  switch (value) {
    case "clearance":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200";
    case "on_hold":
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
    case "discontinued":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
}

export function normalizeVariantPart(value) {
  return String(value ?? "").trim();
}

/** Match a stock-inventory SKU row to product + variant from an inventory lot. */
export function matchesStockVariantRow(row, { productId, size, color }) {
  if (Number(row?.product_id) !== Number(productId)) return false;
  return (
    normalizeVariantPart(row?.size) === normalizeVariantPart(size) &&
    normalizeVariantPart(row?.color) === normalizeVariantPart(color)
  );
}

/** Deep link into Stock & Inventory → SKU Details (optional section: overview | lots | movements). */
export function stockInventorySkuDetailPath({ productId, size, color, section = "lots", tab } = {}) {
  const params = new URLSearchParams();
  params.set("open", "sku");
  const scrollSection = section || tab;
  if (scrollSection) params.set("section", scrollSection);
  if (productId != null && productId !== "") params.set("product_id", String(productId));
  const normalizedSize = normalizeVariantPart(size);
  const normalizedColor = normalizeVariantPart(color);
  if (normalizedSize) params.set("size", normalizedSize);
  if (normalizedColor) params.set("color", normalizedColor);
  return `/admin/stock-inventory?${params.toString()}`;
}

/** Discount % off lot price (e.g. 20 → 20% off this lot's sell price). */
export function lotDiscountOff(lot) {
  if (!lot || !["percent_off_lot", "percent_of_standard"].includes(lot.price_rule) || lot.discount_percent_off == null) {
    return null;
  }
  const value = Number(lot.discount_percent_off);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatLotPriceEventAt(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function formatLotPriceEventSummary(event) {
  if (!event) return "";
  const parts = [event.action_label || event.action];
  if (event.discount_percent_off != null && Number(event.discount_percent_off) > 0) {
    parts.push(`${event.discount_percent_off}% off`);
  }
  if (event.unit_price_after != null) {
    parts.push(`→ $${Number(event.unit_price_after).toFixed(2)}`);
  } else if (event.unit_price_before != null && event.unit_price_after == null) {
    parts.push(`was $${Number(event.unit_price_before).toFixed(2)}`);
  }
  return parts.join(" · ");
}

export function formatLotDetailFieldValue(field, value) {
  if (value == null || value === "") return "—";
  if (field === "listing_status") return listingStatusLabel(value);
  if (field === "lot_tier") return lotTierLabel(value);
  if (field === "is_sellable") return value ? "Yes" : "No";
  if (field === "unit_cost") return `$${Number(value).toFixed(2)}`;
  return String(value);
}

export function formatLotDetailChangeLine(change) {
  if (!change) return "";
  const label = change.label || change.field || "Field";
  const before = formatLotDetailFieldValue(change.field, change.before);
  const after = formatLotDetailFieldValue(change.field, change.after);
  if (change.before == null || change.before === "") {
    return `${label}: ${after}`;
  }
  return `${label}: ${before} → ${after}`;
}

export function formatLotDetailEventSummary(event) {
  if (!event) return "";
  const parts = [event.action_label || event.action];
  if (event.metadata?.po_number) {
    parts.push(event.metadata.po_number);
  }
  const changes = Array.isArray(event.changes) ? event.changes : [];
  if (changes.length > 0) {
    parts.push(formatLotDetailChangeLine(changes[0]));
    if (changes.length > 1) {
      parts.push(`+${changes.length - 1} more`);
    }
  }
  return parts.join(" · ");
}

export function lotDiscountBasePrice(lot) {
  if (!lot) return 0;
  if (lot.discount_base_unit_price != null) return Number(lot.discount_base_unit_price) || 0;
  if (lot.compare_price != null) return Number(lot.compare_price) || 0;
  if (lot.price_rule === "percent_off_lot") return Number(lot.unit_price) || 0;
  return Number(lot.resolved_unit_price ?? lot.unit_price) || 0;
}

/** POS / scan lookup row with lot discount fields from barcode-scan API. */
export function scanLotDiscountHint(row) {
  if (!row) return null;
  const percentOff = Number(row.discount_percent_off);
  const comparePrice = Number(row.compare_price);
  const salePrice = Number(row.price);
  if (!Number.isFinite(percentOff) || percentOff <= 0) return null;
  if (!Number.isFinite(comparePrice) || comparePrice <= salePrice) return null;
  return { percentOff, comparePrice };
}

/** Shorter lot label for tables; full value stays in title/tooltip. */
export function isLotOnHold(lot) {
  if (!lot) return false;
  return lot.listing_status === "on_hold" || lot.is_sellable === false;
}

export function shortLotNumber(lotNumber) {
  const raw = String(lotNumber ?? "").trim();
  if (!raw) return "—";
  const parts = raw.split("-");
  if (parts.length <= 2) return raw;
  return parts.slice(-2).join("-");
}

export function variantLabel(size, color) {
  return [size, color].filter(Boolean).join(" / ") || "—";
}

export function emptyLotForm(row) {
  return {
    season: "",
    collection_code: "",
    listing_status: "active",
    quantity_on_hand: 0,
    unit_cost: Number(row?.wac_cost) || 0,
    unit_price: Number(row?.sell_price) || 0,
    price_rule: "fixed",
    price_percent: "",
    barcode: "",
    is_sellable: true,
    notes: "",
  };
}
