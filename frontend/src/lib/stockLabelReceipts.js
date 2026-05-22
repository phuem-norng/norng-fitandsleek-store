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

export const formatBarcodeLabelOptionText = (row, categories) => {
    const allRows = stockLabelRows(categories);
    const name = row.name || row.slug || "Label";
    const ref = batchReceiptRefForRow(row, allRows);
    const displaySlug = ref || String(row.slug || "").trim();
    let qty = "";
    if (row.manage_stock) {
        const q = row.stock_received != null
            ? parseInt(row.stock_received, 10)
            : parseInt(row.stock, 10);
        if (Number.isFinite(q) && q > 0) qty = ` · ${q} units`;
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
