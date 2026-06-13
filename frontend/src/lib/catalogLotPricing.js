const EMPTY = "—";

function formatMoneyValue(value) {
  if (value == null || value === "") return EMPTY;
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return `$${n.toFixed(2)}`;
}

/** Admin product list/detail — cost or sell from mirrored inventory-lot pricing. */
export function formatCatalogLotMoney(product, kind = "sell") {
  if (!product) return EMPTY;
  const min = kind === "cost" ? product.cost_price : product.price;
  const max = kind === "cost" ? product.lot_cost_price_max : product.lot_sell_price_max;

  if (
    product.lot_pricing_varies &&
    min != null &&
    max != null &&
    Number.isFinite(Number(min)) &&
    Number.isFinite(Number(max)) &&
    Number(min) !== Number(max)
  ) {
    return `${formatMoneyValue(min)} – ${formatMoneyValue(max)}`;
  }

  return formatMoneyValue(min);
}

export function catalogLotPricingHint(product) {
  if (!product || product.pricing_source !== "inventory_lot") {
    return null;
  }
  if (product.lot_pricing_varies) {
    return "Varies by SKU · from inventory lots";
  }
  if (product.lot_pricing_variant_label) {
    return `From lot · ${product.lot_pricing_variant_label}`;
  }
  return "From inventory lot";
}
