/** Stock & Inventory (`barcode_qr`) helpers shared by Stock Received and Products admin. */

export const BARCODE_QR_TYPE = "barcode_qr";

const normalizeType = (value) => String(value || "").toLowerCase().trim();

const effectiveDateIn = (item) => {
    if (!item) return null;
    if (item.date_in) return String(item.date_in).slice(0, 10);
    if (item.created_at) return String(item.created_at).slice(0, 10);
    return null;
};

/** @param {Array<object>} categories */
export const stockLabelRows = (categories) =>
    (categories || []).filter((c) => normalizeType(c.type) === BARCODE_QR_TYPE);

/** Units on one Stock Received row (batch or legacy opening). */
export const receivedQuantityForRow = (row) => {
    if (!row) return 0;
    if (row.stock_received != null && row.stock_received !== "") {
        const q = parseInt(String(row.stock_received), 10);
        if (Number.isFinite(q)) return Math.max(0, q);
    }
    // Quick Restock batches only — master sellable `stock` must not appear in received totals.
    if (row.parent_id != null && row.parent_id !== "" && row.stock != null && row.stock !== "") {
        const q = parseInt(String(row.stock), 10);
        if (Number.isFinite(q)) return Math.max(0, q);
    }
    return 0;
};

/** Sum opening receipt + all Quick Restock batches for a master label. */
export const totalReceivedForMaster = (master, allRows) => {
    if (!master) return 0;
    const batches = receiveBatchesForMaster(master, allRows);
    let total = 0;

    if (master.stock_received != null && master.stock_received !== "") {
        total += receivedQuantityForRow({ stock_received: master.stock_received });
    }
    for (const batch of batches) {
        total += receivedQuantityForRow(batch);
    }
    if (batches.length === 0 && (master.stock_received == null || master.stock_received === "")) {
        return receivedQuantityForRow(master);
    }
    return total;
};

/**
 * Sellable on-hand for Stock & Inventory (master row): `stock` when set,
 * otherwise sum of Stock Received rows, then bundle_total_quantity for new average bundles.
 */
export const inventoryOnHandForMaster = (master, allRows) => {
    if (!master?.manage_stock) return null;

    const batches = receiveBatchesForMaster(master, allRows);
    const hasReceipts =
        batches.length > 0
        || (master.stock_received != null && master.stock_received !== "");

    if (master.stock != null && master.stock !== "") {
        const st = parseInt(String(master.stock), 10);
        if (Number.isFinite(st)) return Math.max(0, st);
    }

    if (hasReceipts) {
        return totalReceivedForMaster(master, allRows);
    }

    const bundle = parseInt(String(master.bundle_total_quantity ?? ""), 10);
    if (Number.isFinite(bundle) && bundle >= 0) return bundle;

    return 0;
};

/** Sum receive-batch rows (Quick Restock) under a master inventory label. */
export const receiveBatchesForMaster = (masterRow, allRows) => {
    if (!masterRow?.id) return [];
    const masterId = String(masterRow.id);
    return (allRows || []).filter((r) => String(r.parent_id) === masterId);
};

/** Master label barcode for a row (batch rows inherit their label slug). */
export const masterBarcodeForRow = (item, allRows) => {
    if (!item) return "";
    if (item.parent_id != null && item.parent_id !== "") {
        const master = (allRows || []).find((r) => String(r.id) === String(item.parent_id));
        return String(master?.slug || item.slug || "").trim();
    }
    return String(item.slug || "").trim();
};

/** Batch receipt ref shown under the master barcode (Quick Restock slugs). */
export const batchReceiptRefForRow = (item, allRows) => {
    if (!item?.parent_id) return null;
    const batchSlug = String(item.slug || "").trim();
    const masterSlug = masterBarcodeForRow(item, allRows);
    if (!batchSlug || batchSlug === masterSlug) return null;
    return batchSlug;
};

/**
 * Stock Received log: one row per receive event (Quick Restock batch or legacy master receipt).
 */
export const buildStockReceivedLogRows = (filteredRows, allRows) => {
    const batches = (filteredRows || []).filter((r) => r.parent_id != null && r.parent_id !== "");
    const legacy = [];
    for (const master of (filteredRows || []).filter((r) => r.parent_id == null || r.parent_id === "")) {
        const children = receiveBatchesForMaster(master, allRows);
        const qty = master.stock_received != null
            ? parseInt(master.stock_received, 10)
            : (children.length === 0 ? parseInt(master.stock, 10) : NaN);
        if (!master.manage_stock || !Number.isFinite(qty) || qty <= 0) continue;
        if (children.length > 0 && master.stock_received == null) continue;
        legacy.push(master);
    }
    const combined = [...batches, ...legacy];
    return combined.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        const da = effectiveDateIn(a) || "";
        const db = effectiveDateIn(b) || "";
        return db.localeCompare(da);
    });
};

/**
 * Barcode label dropdown on Products admin — mirrors Stock Received rows plus standalone masters.
 */
export const buildProductBarcodeLabelOptions = (categories) => {
    const allRows = stockLabelRows(categories);
    const receipts = buildStockReceivedLogRows(allRows, allRows);
    const receiptIds = new Set(receipts.map((r) => String(r.id)));

    const extras = [];
    for (const master of allRows.filter((r) => r.parent_id == null || r.parent_id === "")) {
        if (receiptIds.has(String(master.id))) continue;
        const children = receiveBatchesForMaster(master, allRows);
        if (children.length > 0) continue;
        if (!master.manage_stock) continue;
        const st = master.stock != null ? parseInt(master.stock, 10) : NaN;
        if (Number.isFinite(st) && st > 0) extras.push(master);
    }

    const combined = [...receipts, ...extras];
    return combined.sort((a, b) => {
        const na = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
        if (na !== 0) return na;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
    });
};

export const catalogUnitsForMasterLabel = (master, allCategories, products = [], ignoreProductId = null) => {
    if (!master?.id) return 0;
    const masterId = String(master.id);
    const masterBarcode = String(master.slug || "").trim().toLowerCase();
    const batchIds = new Set(
        receiveBatchesForMaster(master, allCategories).map((b) => String(b.id)),
    );
    batchIds.add(masterId);

    let units = 0;
    for (const product of products || []) {
        if (ignoreProductId != null && String(product?.id) === String(ignoreProductId)) {
            continue;
        }
        let linked = false;
        if (product.stock_label_id != null && product.stock_label_id !== "") {
            linked = batchIds.has(String(product.stock_label_id));
        } else if (masterBarcode) {
            linked = String(product?.barcode_code || "").trim().toLowerCase() === masterBarcode;
        }
        if (!linked) continue;
        const st = Number(product?.stock);
        if (Number.isFinite(st)) units += Math.max(0, st);
    }
    return units;
};

export const formatBarcodeLabelOptionText = (row, categories, products = []) => {
    const allRows = stockLabelRows(categories);
    const master = resolveMasterCategoryForLabel(row, allRows);
    const name = row.name || row.slug || "Label";
    const ref = batchReceiptRefForRow(row, allRows);
    const displaySlug = ref || String(master?.slug || row.slug || "").trim();
    let qty = "";
    if (row.manage_stock || master?.manage_stock) {
        if (isAverageBundleCategory(master)) {
            const catalog = catalogUnitsForMasterLabel(master, allRows, products);
            const pool = inventoryOnHandForMaster(master, allRows) ?? 0;
            const remaining = Math.max(0, pool - catalog);
            if (remaining > 0) qty = ` · ${remaining} units left`;
            else if (pool > 0) qty = ` · ${pool} units`;
        } else {
            const q = row.stock_received != null
                ? parseInt(row.stock_received, 10)
                : parseInt(row.stock, 10);
            if (Number.isFinite(q) && q > 0) qty = ` · ${q} units`;
        }
    }
    const dateIn = effectiveDateIn(row);
    const dateSuffix = dateIn ? ` · ${dateIn}` : "";
    return `${name} · ${displaySlug}${qty}${dateSuffix}`;
};

/** Sellable units remaining on this receipt/label row (for product allocation pool). */
export const labelPoolStockForCategory = (label) => {
    if (!label?.manage_stock) return "0";
    if (label.stock != null && label.stock !== "") {
        const st = parseInt(String(label.stock), 10);
        if (!Number.isNaN(st)) return String(Math.max(0, st));
    }
    if (label.stock_received != null && label.stock_received !== "") {
        const st = parseInt(String(label.stock_received), 10);
        if (!Number.isNaN(st)) return String(Math.max(0, st));
    }
    return "0";
};

export const findBarcodeLabelBySlug = (slug, options) => {
    const codeU = String(slug || "").trim().toUpperCase();
    if (!codeU) return null;
    return (options || []).find((b) => String(b.slug || "").trim().toUpperCase() === codeU) ?? null;
};

export const findBarcodeLabelById = (id, options) => {
    if (id == null || id === "") return null;
    return (options || []).find((b) => String(b.id) === String(id)) ?? null;
};

export const isAverageBundleCategory = (label) =>
    String(label?.product_condition || "new") === "second_hand"
    && String(label?.second_hand_sale_type || "single") === "average_bundle";

/** Master inventory row for a label or receive-batch row. */
export const resolveMasterCategoryForLabel = (label, allCategories) => {
    if (!label) return null;
    if (label.parent_id == null || label.parent_id === "") return label;
    return (allCategories || []).find((c) => String(c.id) === String(label.parent_id)) ?? label;
};

/** Unit selling price for second-hand average bundle labels. */
export const averageBundleSellingUnitPrice = (master) => {
    if (!master) return "0";
    const cost = Number(master.bundle_total_cost);
    const qty = parseInt(String(master.bundle_total_quantity ?? ""), 10);
    const fromBundle =
        Number.isFinite(cost) && cost >= 0 && Number.isFinite(qty) && qty > 0
            ? (cost / qty).toFixed(2)
            : null;
    if (master.price != null && master.price !== "") {
        const fromPrice = Number(master.price);
        if (Number.isFinite(fromPrice) && fromPrice > 0) return String(fromPrice);
        if (fromPrice === 0 && fromBundle != null) return fromBundle;
        if (Number.isFinite(fromPrice) && fromPrice >= 0) return String(fromPrice);
    }
    if (fromBundle != null) return fromBundle;
    return "0";
};

/**
 * Price + stock pool when linking a product to a Stock & Inventory / Stock Received row.
 *
 * @param {object|null} label
 * @param {Array<object>} allCategories
 * @param {{ ignoreProductId?: number|string, usedStockForSlug?: (slug: string, ignoreProductId?: number|string) => number }} [options]
 */
export const labelPricePoolForProduct = (label, allCategories, options = {}) => {
    if (!label) return null;

    const master = resolveMasterCategoryForLabel(label, allCategories);
    const slug = String(master?.slug || label.slug || "").trim();
    const isAverageBundle = isAverageBundleCategory(master);
    const isSecondHand = String(master?.product_condition || "new") === "second_hand";
    const saleType = String(master?.second_hand_sale_type || "single");

    let price = "0";
    if (isAverageBundle) {
        price = averageBundleSellingUnitPrice(master);
    } else if (master?.price != null && master.price !== "") {
        const n = Number(master.price);
        if (!Number.isNaN(n)) price = String(n);
    }

    let poolStock = labelPoolStockForCategory(label);
    const rawPoolStock = poolStock;
    let usedStock = 0;
    if (isAverageBundle) {
        const masterPool = inventoryOnHandForMaster(master, allCategories) ?? 0;
        const catalogUnits = catalogUnitsForMasterLabel(
            master,
            allCategories,
            options.products,
            null,
        );
        const remaining = Math.max(0, masterPool - catalogUnits);
        poolStock = String(remaining);
    } else {
        usedStock = options.usedStockForSlug
            ? options.usedStockForSlug(slug, options.ignoreProductId ?? null)
            : 0;
        const available = Math.max(0, (parseInt(rawPoolStock, 10) || 0) - usedStock);
        poolStock = String(available);
    }

    return {
        label,
        master,
        slug,
        stockLabelId: label.id,
        masterLabelId: master?.id,
        price,
        poolStock,
        rawPoolStock,
        usedStock,
        condition: master?.product_condition || "new",
        saleType,
        isSecondHand,
        isAverageBundle,
    };
};
