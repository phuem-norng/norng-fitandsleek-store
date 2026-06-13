function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function colorsMatch(want, have) {
  const w = norm(want);
  const h = norm(have);
  if (!w || !h) return true;
  if (w === h) return true;
  if (w.length === 1 && h.startsWith(w)) return true;
  if (h.length === 1 && w.startsWith(h)) return true;
  return false;
}

function sizesMatch(want, have) {
  const w = norm(want);
  const h = norm(have);
  if (!w || !h) return true;
  return w === h;
}

function activeStorefrontDiscount(product) {
  return product?.discount ?? product?.active_discount ?? product?.activeDiscount ?? null;
}

/** Price from inventory lot that would sell next (API: storefront_unit_price / variant_lot_prices). */
export function resolveStorefrontLotPrice(product, size = null, color = null) {
  if (!product) return 0;

  const prices = product.variant_lot_prices;
  const hasSize = norm(size);
  const hasColor = norm(color);

  if (Array.isArray(prices) && prices.length > 0 && (hasSize || hasColor)) {
    const row = prices.find((entry) => sizesMatch(size, entry.size) && colorsMatch(color, entry.color));
    if (row?.unit_price != null) {
      return Number(row.unit_price) || 0;
    }
  }

  if (product.storefront_unit_price != null && product.storefront_unit_price !== "") {
    return Number(product.storefront_unit_price) || 0;
  }

  const activeDisc = activeStorefrontDiscount(product);
  return Number(
    product.discount?.sale_price ??
      activeDisc?.sale_price ??
      product.final_price ??
      product.price ??
      0,
  );
}

/** Lot price with active admin promotional discount applied. */
export function applyAdminDiscountToLotPrice(lotPrice, product) {
  const disc = activeStorefrontDiscount(product);
  if (!disc || typeof disc !== "object") return lotPrice;

  const lotBase = Number(lotPrice) || 0;
  if (lotBase <= 0) return lotBase;

  const type = disc.type ?? disc.discount_type;
  const value = Number(disc.value ?? disc.discount_value ?? 0);
  if (type === "percentage" && value > 0) {
    return Math.max(0, lotBase * (1 - value / 100));
  }
  if (type === "fixed" && value > 0) {
    return Math.max(0, lotBase - value);
  }

  const catalogSale = Number(disc.sale_price ?? 0);
  const catalogOriginal = Number(disc.original_price ?? product?.price ?? 0);
  if (catalogSale > 0 && catalogOriginal > catalogSale) {
    return Math.max(0, lotBase * (catalogSale / catalogOriginal));
  }

  return lotBase;
}

export function resolveStorefrontCustomerPrice(product, size = null, color = null) {
  if (!product) return 0;

  const prices = product.variant_lot_prices;
  const hasSize = norm(size);
  const hasColor = norm(color);

  if (Array.isArray(prices) && prices.length > 0 && (hasSize || hasColor)) {
    const row = prices.find((entry) => sizesMatch(size, entry.size) && colorsMatch(color, entry.color));
    if (row?.customer_price != null) {
      return Number(row.customer_price) || 0;
    }
    if (row?.unit_price != null) {
      return applyAdminDiscountToLotPrice(Number(row.unit_price) || 0, product);
    }
  }

  if (product.storefront_customer_price != null && product.storefront_customer_price !== "") {
    return Number(product.storefront_customer_price) || 0;
  }

  return applyAdminDiscountToLotPrice(resolveStorefrontLotPrice(product, size, color), product);
}

/** Catalog / reference price from product master (not lot). */
export function resolveCatalogReferencePrice(product) {
  if (!product) return 0;
  const activeDisc = activeStorefrontDiscount(product);
  return Number(
    product.discount?.original_price ??
      product.discount?.sale_price ??
      activeDisc?.sale_price ??
      product.final_price ??
      product.price ??
      0,
  );
}

function resolveLotDiscountMeta(product, size = null, color = null) {
  if (!product) return null;

  const prices = product.variant_lot_prices;
  const hasSize = norm(size);
  const hasColor = norm(color);

  if (Array.isArray(prices) && prices.length > 0 && (hasSize || hasColor)) {
    const row = prices.find((entry) => sizesMatch(size, entry.size) && colorsMatch(color, entry.color));
    if (row?.lot_discount) return row.lot_discount;
  }

  return product.storefront_lot_discount ?? null;
}

/** True when the next sellable inventory lot has a % discount (lot discount modal). */
export function hasStorefrontLotDiscount(product, size = null, color = null) {
  const meta = resolveLotDiscountMeta(product, size, color);
  if (!meta) return false;
  const compare = Number(meta.compare_price);
  const sale = Number(meta.sale_price);
  return Number(meta.percent_off) > 0 && compare > sale;
}

/** True when admin configured an active promotional discount on the product. */
export function hasStorefrontAdminDiscount(product) {
  const disc = activeStorefrontDiscount(product);
  if (!disc || typeof disc !== "object") return false;
  const type = disc.type ?? disc.discount_type;
  const value = Number(disc.value ?? disc.discount_value ?? 0);
  if ((type === "percentage" || type === "fixed") && value > 0) return true;
  const salePrice = Number(disc.sale_price ?? 0);
  const original = Number(disc.original_price ?? product.price ?? 0);
  return salePrice > 0 && original > salePrice;
}

/**
 * Storefront price row for product cards / detail.
 * Compare = lot base before discount; sale = lot price (with admin promo stacked when active).
 */
export function resolveStorefrontPriceDisplay(product, size = null, color = null) {
  const lotPrice = resolveStorefrontLotPrice(product, size, color);
  const lotDisc = resolveLotDiscountMeta(product, size, color);
  const lotCompare = lotDisc?.compare_price != null ? Number(lotDisc.compare_price) : null;

  if (hasStorefrontAdminDiscount(product)) {
    const sale = Math.round(resolveStorefrontCustomerPrice(product, size, color) * 100) / 100;
    const compare =
      lotCompare != null && lotCompare > sale
        ? lotCompare
        : lotPrice > sale
          ? lotPrice
          : null;
    let pctLabel = null;
    if (compare != null && compare > sale) {
      pctLabel = `-${Math.round(((compare - sale) / compare) * 100)}%`;
    }

    return { sale, compare, pctLabel };
  }

  if (lotDisc && lotCompare != null && lotCompare > lotPrice) {
    const percentOff = Number(lotDisc.percent_off) || 0;

    return {
      sale: lotPrice,
      compare: lotCompare,
      pctLabel: percentOff > 0 ? `-${Math.round(percentOff)}%` : null,
    };
  }

  return { sale: lotPrice, compare: null, pctLabel: null };
}
