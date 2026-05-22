import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useTheme } from "../../state/theme.jsx";
import { resolveImageUrl } from "../../lib/images";
import { closeSwal, errorAlert, loadingAlert, toastSuccess, warningConfirm } from "../../lib/swal";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { formatCountryLabel } from "../../lib/countries";
import CountryOriginPicker from "../../components/admin/CountryOriginPicker";
import CategoryPicker from "../../components/admin/CategoryPicker";
import {
    buildAllColumnsVisibility,
    loadTableColumnVisibility,
    TableColumnVisibilityMenu,
} from "../../components/admin/TableColumnVisibilityMenu.jsx";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import {
    BARCODE_QR_TYPE,
    batchReceiptRefForRow,
    buildStockReceivedLogRows,
    inventoryOnHandForMaster,
    masterBarcodeForRow,
    receiveBatchesForMaster,
} from "../../lib/stockLabelReceipts";

const STOCK_ADMIN_BASES = ["/admin/stock-inventory", "/admin/stock-received"];

const resolveStockAdminBase = (pathname) => {
    const p = (pathname || "").replace(/\/$/, "");
    if (p.includes("/admin/stock-received")) return "/admin/stock-received";
    return "/admin/stock-inventory";
};

const STOCK_RECEIVED_ADMIN_BASE = "/admin/stock-received";

const STOCK_TABLE_COLUMNS = [
    { id: "select", label: "Select" },
    { id: "products", label: "Products" },
    { id: "category", label: "Category" },
    { id: "condition", label: "Condition" },
    { id: "origin", label: "Origin" },
    { id: "stock", label: "Stock" },
    { id: "dateIn", label: "Date in" },
    { id: "status", label: "Status" },
    { id: "priceUnit", label: "Price unit" },
    { id: "totalPrice", label: "Total price" },
    { id: "actions", label: "Actions" },
];

const stockColumnsStorageKey = (pageKey) => `fitandsleek-stock-columns-${pageKey}`;

/** Units shown on Stock Received; checkout only decrements `stock`, never `stock_received`. */
const effectiveRowStock = (row, receivedPage, allRows = []) => {
    if (!row?.manage_stock) return null;
    if (receivedPage) {
        const batches = receiveBatchesForMaster(row, allRows);
        // Master legacy row stays in the log with its own opening `stock_received`; do not substitute
        // the sum of batch receipts (would double-count with each batch row + inflate totals).
        if (row.parent_id == null && batches.length > 0 && row.stock_received != null) {
            const legacy = parseInt(row.stock_received, 10);
            return Number.isFinite(legacy) ? Math.max(0, legacy) : 0;
        }
        if (batches.length > 0) {
            return batches.reduce((sum, batch) => {
                const q = batch.stock_received != null
                    ? parseInt(batch.stock_received, 10)
                    : parseInt(batch.stock, 10);
                return sum + (Number.isFinite(q) ? Math.max(0, q) : 0);
            }, 0);
        }
        if (row.stock_received != null) return parseInt(row.stock_received, 10) || 0;
        if (row.stock != null) return parseInt(row.stock, 10) || 0;
        return 0;
    }
    if (row.stock == null) return null;
    return parseInt(row.stock, 10) || 0;
};

const buildCategoryStockPayload = (form, receivedPage, editItem = null, allRows = []) => {
    const manage = !!form.manage_stock;
    const qty = manage && form.stock !== "" ? parseInt(form.stock, 10) : null;
    const min = manage && form.min_stock !== "" ? parseInt(form.min_stock, 10) : null;
    if (receivedPage) {
        const isBatch = editItem?.parent_id != null && editItem?.parent_id !== "";
        const isLegacyMaster =
            !isBatch
            && editItem?.id != null
            && receiveBatchesForMaster(editItem, allRows).length > 0;
        const payload = {
            manage_stock: manage,
            stock_received: qty,
            min_stock: min,
        };
        // Opening receipt on a label that already has Quick Restock batches: only change
        // stock_received; master on-hand is recalculated server-side from all receive rows.
        if (!isLegacyMaster && qty != null) {
            payload.stock = qty;
        }
        return payload;
    }
    return { manage_stock: manage, stock: qty, min_stock: min };
};

const STOCK_AGE_NEW_MAX_DAYS = 90;
const STOCK_AGE_AGING_MAX_DAYS = 180;

const todayYmd = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseDateOnly = (value) => {
    if (!value) return null;
    const s = String(value).slice(0, 10);
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
};

const effectiveDateIn = (item) => {
    if (!item) return null;
    if (item.date_in) return String(item.date_in).slice(0, 10);
    if (item.created_at) return String(item.created_at).slice(0, 10);
    return null;
};

const daysSinceDateIn = (dateIn) => {
    const d = parseDateOnly(dateIn);
    if (!d) return null;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startIn = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((start - startIn) / (1000 * 60 * 60 * 24));
};

const getStockAgeStatus = (dateIn) => {
    const days = daysSinceDateIn(dateIn);
    if (days === null) {
        return {
            label: "—",
            tone: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-white/10 dark:text-slate-400 dark:ring-white/10",
        };
    }
    if (days > STOCK_AGE_AGING_MAX_DAYS) {
        return {
            label: "Old Stock",
            tone: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
        };
    }
    if (days >= STOCK_AGE_NEW_MAX_DAYS) {
        return {
            label: "Aging",
            tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
        };
    }
    return {
        label: "New Stock",
        tone: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20",
    };
};

const formatDateIn = (dateIn) => {
    const d = parseDateOnly(dateIn);
    if (!d) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** Receipt time from record creation (stock-received log). */
const formatDateInTime = (item) => {
    if (!item?.created_at) return null;
    const dt = new Date(item.created_at);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatDateInWithTime = (item) => {
    const dateStr = formatDateIn(effectiveDateIn(item));
    if (dateStr === "—") return dateStr;
    const time = formatDateInTime(item);
    return time ? `${dateStr}, ${time}` : dateStr;
};

function DateInCell({ item, showTime }) {
    const d = parseDateOnly(effectiveDateIn(item));
    if (!d) return "—";
    const time = showTime ? formatDateInTime(item) : null;
    return (
        <div className="flex flex-col items-center leading-none tabular-nums text-slate-700 dark:text-slate-300">
            <span className="text-[15px] font-extrabold leading-tight">{d.getDate()}</span>
            <span className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {d.toLocaleDateString("en-GB", { month: "short" })}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{d.getFullYear()}</span>
            {time ? (
                <span
                    className="mt-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/30"
                    title="Received at"
                >
                    {time}
                </span>
            ) : null}
        </div>
    );
}

const CONDITION_BADGE_NEW =
    "inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300/80 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/50";

const CONDITION_CHIP_SECOND_HAND =
    "inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-xs font-bold ring-1 ring-amber-200 dark:border-amber-400/45 dark:bg-amber-500/20 dark:ring-amber-400/35";

/** Quick Restock: filled circle + bold “+”; circle uses admin Theme preset (`--admin-primary`). */
const BTN_QUICK_RESTOCK =
    "absolute -bottom-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--admin-primary)] text-white shadow-[0_2px_6px_rgba(15,23,42,0.35)] ring-2 ring-white transition hover:brightness-110 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--admin-primary-rgb),0.5)] focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:ring-slate-900 dark:focus-visible:ring-offset-slate-900";

const QUICK_RESTOCK_MODAL_KICKER =
    "text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--admin-primary)]";

const QUICK_RESTOCK_OPTION_SELECTED =
    "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.1)] text-slate-900 ring-2 ring-[rgba(var(--admin-primary-rgb),0.22)] dark:text-slate-50";

const QUICK_RESTOCK_OPTION_IDLE =
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-200";

const QUICK_RESTOCK_SUBMIT_BTN =
    "rounded-xl bg-[color:var(--admin-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(var(--admin-primary-rgb),0.35)] transition hover:brightness-110 disabled:opacity-50";

const isAverageBundleLabel = (item) =>
    item?.product_condition === "second_hand" &&
    (item?.second_hand_sale_type || "single") === "average_bundle";

const getProductConditionDisplay = (item) => {
    const condition = item?.product_condition || "new";
    if (condition !== "second_hand") {
        return { kind: "new" };
    }
    const saleType = item?.second_hand_sale_type || "single";
    return {
        kind: "second_hand",
        saleLabel: saleType === "average_bundle" ? "Average" : "Single",
    };
};

const formatOriginLabel = formatCountryLabel;
const formatOriginCsv = (value) => formatOriginLabel(value).replace(/—/g, "");

const resolveItemCategoryId = (item) => {
    if (!item) return "";
    if (item.category_id != null && item.category_id !== "") return String(item.category_id);
    if (Array.isArray(item.category_ids) && item.category_ids.length) return String(item.category_ids[0]);
    return "";
};

const formatCategoryLabel = (id, catalogCategories) => {
    if (!id) return "—";
    return catalogCategories.find((c) => String(c.id) === String(id))?.name || "—";
};

const matchesDateInRange = (item, fromYmd, toYmd) => {
    if (!fromYmd && !toYmd) return true;
    const dateIn = effectiveDateIn(item);
    if (!dateIn) return false;
    if (fromYmd && dateIn < fromYmd) return false;
    if (toYmd && dateIn > toYmd) return false;
    return true;
};

const LABEL_COLORS = [
    "", "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#000000",
];

const DEFAULT_APPEARANCE = {
    width: 2,
    height: 80,
    margin: 10,
    lineColor: "#000000",
    bgColor: "#ffffff",
    rotation: 0,
    fontSize: 14,
    displayValue: true,
    format: "CODE128",
    showBarcode: true,
    showQR: true,
    showName: true,
    showPrice: true,
};

const EMPTY_QUICK_RESTOCK = {
    quantity: "",
    product_condition: "new",
    second_hand_sale_type: "single",
};

const EMPTY_FORM = {
    name: "",
    description: "",
    details: "",
    price: "",
    compare_at_price: "",
    label_color: "",
    image_url: "",
    gallery: "",
    sku: "",
    cost: "",
    unit: "",
    origin: "",
    brand_id: "",
    category_id: "",
    product_condition: "new",
    second_hand_sale_type: "single",
    bundle_total_cost: "",
    bundle_total_quantity: "",
    barcode_code: "",
    is_active: true,
    manage_stock: true,
    stock: "",
    min_stock: "",
    date_in: todayYmd(),
    show_stock_movement: false,
    has_variation: false,
    variation_product_type: "Clothes",
    variation_colors: "",
    variation_sizes: [],
    variation_custom_size: "",
};

const parseGallery = (v) =>
    String(v || "").split("\n").map((s) => s.trim()).filter(Boolean);

const parsePositiveNumber = (value) => {
    const n = parseFloat(String(value ?? "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
};

const parsePositiveInteger = (value) => {
    const n = parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const calculateBundleUnitCost = (totalCost, totalQuantity) => {
    const cost = parsePositiveNumber(totalCost);
    const quantity = parsePositiveInteger(totalQuantity);
    if (!cost || !quantity) return "";
    return (cost / quantity).toFixed(2);
};

/**
 * On-hand for average-bundle labels: live `stock` (synced from Stock Received / sales),
 * then bundle_total_quantity (initial bundle size on create/edit forms).
 */
const averageBundleOnHandQuantity = (stateOrItem) => {
    const stock = parseInt(String(stateOrItem?.stock ?? "").trim(), 10);
    if (Number.isFinite(stock) && stock >= 0) return stock;
    const raw = String(stateOrItem?.bundle_total_quantity ?? "").trim();
    if (raw !== "") {
        const fromBundle = parseInt(raw, 10);
        if (Number.isFinite(fromBundle) && fromBundle >= 0) return fromBundle;
    }
    return 0;
};

const stockFromBundleQuantity = (bundleTotalQuantity) => {
    const raw = String(bundleTotalQuantity ?? "").trim();
    if (raw === "") return "";
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? String(n) : "";
};

const isAverageBundleForm = (state) =>
    (state.product_condition || "new") === "second_hand" &&
    (state.second_hand_sale_type || "single") === "average_bundle";

const isSimpleStockForm = (state) => !isAverageBundleForm(state);

const applySecondHandBundleDefaults = (state) => {
    if (!isAverageBundleForm(state)) {
        const simpleState = state.product_condition === "second_hand"
            ? { ...state, second_hand_sale_type: state.second_hand_sale_type || "single" }
            : { ...state, second_hand_sale_type: "single" };

        return {
            ...simpleState,
            price: "",
            compare_at_price: "",
            cost: "",
            bundle_total_cost: "",
            bundle_total_quantity: "",
            manage_stock: true,
        };
    }

    const unitCost = calculateBundleUnitCost(state.bundle_total_cost, state.bundle_total_quantity);
    return {
        ...state,
        cost: unitCost || "",
        manage_stock: true,
        stock: stockFromBundleQuantity(state.bundle_total_quantity),
    };
};

const normalizeSaleFieldsForPayload = (state) => {
    const normalized = applySecondHandBundleDefaults(state);
    if ((normalized.product_condition || "new") !== "second_hand") {
        return {
            ...normalized,
            product_condition: "new",
            second_hand_sale_type: null,
            price: null,
            compare_at_price: null,
            cost: null,
            bundle_total_cost: null,
            bundle_total_quantity: null,
        };
    }

    if ((normalized.second_hand_sale_type || "single") !== "average_bundle") {
        return {
            ...normalized,
            second_hand_sale_type: "single",
            price: null,
            compare_at_price: null,
            cost: null,
            bundle_total_cost: null,
            bundle_total_quantity: null,
        };
    }

    return {
        ...normalized,
        product_condition: "second_hand",
        second_hand_sale_type: "average_bundle",
    };
};

const validateSaleFields = (state) => {
    const normalized = normalizeSaleFieldsForPayload(state);
    if (isSimpleStockForm(normalized)) {
        const stock = parseInt(String(normalized.stock ?? "").trim(), 10);
        if (!Number.isFinite(stock) || stock < 0) {
            return "Please enter the total stock for this item.";
        }
        return "";
    }

    const price = Number(normalized.price);
    if (!Number.isFinite(price) || price < 0) {
        return "Please enter a valid price.";
    }

    const totalCost = parsePositiveNumber(normalized.bundle_total_cost);
    const totalQuantity = parsePositiveInteger(normalized.bundle_total_quantity);
    if (!totalCost || !totalQuantity) {
        return "Please enter total bundle cost and total quantity.";
    }

    return "";
};

/** Strip current hero image: next gallery becomes `image_url` (or cleared). Repeats on each × on first slot. */
const removeLeadingProductPhoto = (state) => {
    const storedPrimary = String(state.image_url || "").trim();
    const gAll = parseGallery(state.gallery || "").filter(Boolean);
    if (storedPrimary) {
        if (gAll.length === 0) return { ...state, image_url: "" };
        const [next, ...others] = gAll;
        return { ...state, image_url: next, gallery: others.join("\n") };
    }
    if (gAll.length === 0) return { ...state, image_url: "", gallery: "" };
    const [, ...others] = gAll;
    return { ...state, image_url: "", gallery: others.join("\n") };
};

function mapItemToEditForm(item, receivedPage = false) {
    if (!item) return null;
    const displayQty = receivedPage
        ? (item.stock_received != null ? item.stock_received : item.stock)
        : item.stock;
    const mapped = {
        ...item,
        barcode_code: item.slug || "",
        compare_at_price: item.compare_at_price ?? "",
        category_id: resolveItemCategoryId(item),
        brand_id: item.brand_id != null ? String(item.brand_id) : "",
        product_condition: item.product_condition || "new",
        second_hand_sale_type: item.second_hand_sale_type || "single",
        bundle_total_cost: item.bundle_total_cost != null ? String(item.bundle_total_cost) : "",
        bundle_total_quantity: item.bundle_total_quantity != null ? String(item.bundle_total_quantity) : "",
        manage_stock: item.manage_stock ?? false,
        stock: displayQty != null ? String(displayQty) : "",
        min_stock: item.min_stock != null ? String(item.min_stock) : "",
        date_in: effectiveDateIn(item) || todayYmd(),
        show_stock_movement: false,
        has_variation: item.has_variation ?? false,
        variation_product_type: item.variation_product_type || "Clothes",
        variation_colors: item.variation_colors || "",
        variation_sizes: Array.isArray(item.variation_sizes) ? item.variation_sizes : [],
        variation_custom_size: "",
    };
    return isAverageBundleLabel(item) ? applySecondHandBundleDefaults(mapped) : mapped;
}

export default function AdminBarcodeQR() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: editRouteId } = useParams();
    const pathname = (location.pathname || "").replace(/\/$/, "");
    const stockBase = useMemo(() => resolveStockAdminBase(pathname), [pathname]);
    const isReceivedLogPage = stockBase === STOCK_RECEIVED_ADMIN_BASE;
    const isNewPage = pathname === `${stockBase}/new`;
    const isEditPage = Boolean(
        editRouteId
        && pathname.endsWith("/edit")
        && STOCK_ADMIN_BASES.some((base) => pathname.startsWith(base)),
    );

    const { user, refresh: refreshAuth } = useAuth();
    const { primaryColor, mode } = useTheme();
    const isDark = mode === "dark";
    const accentColor = primaryColor;
    const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

    const [rows, setRows] = useState([]);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [isCreating, setIsCreating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [err, setErr] = useState("");
    const [success, setSuccess] = useState("");
    const [animate, setAnimate] = useState(false);
    const [aiBusy, setAiBusy] = useState(false);
    const [stockFilter, setStockFilter] = useState("all");
    const [dateInFrom, setDateInFrom] = useState("");
    const [dateInTo, setDateInTo] = useState("");
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [previewItem, setPreviewItem] = useState(null);
    const [linkedProductsItem, setLinkedProductsItem] = useState(null);
    const [quickRestockItem, setQuickRestockItem] = useState(null);
    const [quickRestockForm, setQuickRestockForm] = useState({ ...EMPTY_QUICK_RESTOCK });
    const [quickRestockBusy, setQuickRestockBusy] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState(() =>
        loadTableColumnVisibility(stockColumnsStorageKey(stockBase), STOCK_TABLE_COLUMNS),
    );
    const [appearance, setAppearance] = useState({ ...DEFAULT_APPEARANCE });
    const [activeTab, setActiveTab] = useState("Appearance");
    const printRef = useRef(null);
    const galleryInputRef = useRef(null);
    const editGalleryInputRef = useRef(null);
    const replaceGalleryInputRef = useRef(null);
    const pendingReplaceGalleryIndexRef = useRef(null);
    const productImageInputRef = useRef(null);
    const editProductImageInputRef = useRef(null);
    const aiPhotoInputRef = useRef(null);
    const triggerAuthRefresh = async () => {
        try { await refreshAuth(); } catch { }
    };

    const extractErr = (e) => {
        if (e?.response?.status === 401) {
            triggerAuthRefresh();
            return "Unauthorized. Please log in again.";
        }
        return e?.response?.data?.message || "Request failed.";
    };

    const showSuccess = (msg) => {
        setSuccess(msg);
        setAnimate(true);
        setTimeout(() => { setAnimate(false); setTimeout(() => setSuccess(""), 300); }, 3000);
    };

    useEffect(() => {
        setColumnVisibility(loadTableColumnVisibility(stockColumnsStorageKey(stockBase), STOCK_TABLE_COLUMNS));
    }, [stockBase]);

    useEffect(() => {
        try {
            localStorage.setItem(stockColumnsStorageKey(stockBase), JSON.stringify(columnVisibility));
        } catch { /* ignore quota */ }
    }, [columnVisibility, stockBase]);

    const isColVisible = (columnId) => columnVisibility[columnId] !== false;

    const toggleTableColumn = (columnId) => {
        setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
    };

    const setAllTableColumnsVisible = (visible) => {
        setColumnVisibility(buildAllColumnsVisibility(STOCK_TABLE_COLUMNS, visible, "products"));
    };

    const load = async () => {
        setLoading(true);
        try {
            const [catRes, brandRes, productRes] = await Promise.all([
                api.get("/admin/categories", { params: { include_stock_labels: true } }),
                api.get("/admin/brands"),
                api.get("/admin/products", { params: { per_page: 500 } }),
            ]);
            const all = catRes?.data?.data || [];
            setRows(all.filter((c) => c.type === BARCODE_QR_TYPE));
            setCategories(all.filter((c) => c.type !== BARCODE_QR_TYPE));
            setBrands(brandRes?.data?.data || []);
            setProducts(productRes?.data?.data || productRes?.data || []);
        } catch (e) {
            setErr(extractErr(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (!isNewPage) return;
        setForm({ ...EMPTY_FORM });
        setErr("");
    }, [isNewPage, location.key]);

    useEffect(() => {
        if (!isEditPage || !editRouteId) return undefined;
        setEditing(null);
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get(`/admin/categories/${editRouteId}`);
                const item = data?.data;
                if (cancelled) return;
                if (!item || item.type !== BARCODE_QR_TYPE) {
                    navigate(stockBase, { replace: true });
                    return;
                }
                setEditing(mapItemToEditForm(item, isReceivedLogPage));
            } catch {
                if (!cancelled) navigate(stockBase, { replace: true });
            }
        })();
        return () => { cancelled = true; };
    }, [isEditPage, editRouteId, navigate, stockBase, isReceivedLogPage]);

    useEffect(() => {
        if (!isEditPage) setEditing(null);
    }, [isEditPage]);

    useEffect(() => {
        if (!previewItem) return;
        const key = `bqr_appearance_${previewItem.slug || previewItem.id}`;
        try {
            const saved = localStorage.getItem(key);
            setAppearance(saved ? { ...DEFAULT_APPEARANCE, ...JSON.parse(saved) } : { ...DEFAULT_APPEARANCE });
        } catch { setAppearance({ ...DEFAULT_APPEARANCE }); }
        setActiveTab("Appearance");
    }, [previewItem?.id]);

    useEffect(() => {
        if (!previewItem) return;
        const key = `bqr_appearance_${previewItem.slug || previewItem.id}`;
        try { localStorage.setItem(key, JSON.stringify(appearance)); } catch { }
    }, [appearance, previewItem?.id]);

    const resetForm = () => setForm({ ...EMPTY_FORM });

    const generateCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    };

    const resolveCanonicalLabel = (item) => {
        if (!item) return null;
        if (item.parent_id != null) {
            return rows.find((r) => String(r.id) === String(item.parent_id)) || item;
        }
        return item;
    };

    const labelBarcodeForItem = (item) => {
        const label = resolveCanonicalLabel(item);
        return String(label?.slug || "").trim();
    };

    const canOpenChosenProducts = (item) => {
        if (isReceivedLogPage) return true;
        return linkedProductsForLabel(item).length > 0;
    };

    const openChosenProducts = (item) => {
        if (!canOpenChosenProducts(item)) return;
        setLinkedProductsItem(item);
    };

    const closeChosenProducts = () => {
        setLinkedProductsItem(null);
    };

    const goToAddProductForBatch = () => {
        if (!linkedProductsItem) return;
        const label = resolveCanonicalLabel(linkedProductsItem);
        const barcodeCode = labelBarcodeForItem(linkedProductsItem);
        const categoryId = resolveItemCategoryId(label);
        const params = new URLSearchParams();
        params.set("new", "1");
        if (barcodeCode) params.set("barcode_code", barcodeCode);
        if (categoryId) params.set("category_id", categoryId);
        if (label?.brand_id) params.set("brand_id", String(label.brand_id));
        params.set("stock_label_id", String(linkedProductsItem.id));
        closeChosenProducts();
        navigate(`/admin/products?${params.toString()}`);
    };

    const sanitizeCode = (v) =>
        String(v || "").toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 30);

    const slugify = (str) =>
        String(str || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

    /* ── Image upload helpers ── */
    const handleImageUpload = async (e, isEdit = false) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (isEdit) setEditing((s) => ({ ...s, image_url: reader.result }));
                else setForm((s) => ({ ...s, image_url: reader.result }));
            };
            reader.readAsDataURL(file);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGalleryUpload = async (e, isEdit = false) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const urls = [];
            for (const file of Array.from(files)) {
                await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => { urls.push(reader.result); resolve(); };
                    reader.readAsDataURL(file);
                });
            }
            const setter = isEdit ? setEditing : setForm;
            setter((s) => {
                const current = parseGallery(s.gallery);
                return { ...s, gallery: [...current, ...urls].filter(Boolean).join("\n") };
            });
        } finally {
            if (e.target) e.target.value = "";
            setIsUploading(false);
        }
    };

    const handleReplaceGalleryImage = async (e, isEdit = false) => {
        const file = e.target.files?.[0];
        const targetIndex = pendingReplaceGalleryIndexRef.current;
        if (e.target) e.target.value = "";
        pendingReplaceGalleryIndexRef.current = null;
        if (!file || targetIndex == null || Number.isNaN(targetIndex)) return;
        setIsUploading(true);
        try {
            const newUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            const setter = isEdit ? setEditing : setForm;
            setter((s) => {
                const current = parseGallery(s.gallery);
                if (targetIndex < 0 || targetIndex >= current.length) return s;
                const next = [...current];
                next[targetIndex] = newUrl;
                return { ...s, gallery: next.filter(Boolean).join("\n") };
            });
        } finally {
            setIsUploading(false);
        }
    };

    /** Photo → similar-product match (vision) to pre-fill name, price, category, brand, description */
    const handleAutoRegisterPhoto = async (e, setData) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = "";
        if (!file) return;
        setAiBusy(true);
        setIsUploading(true);
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            setData((s) => ({ ...s, image_url: dataUrl }));

            const fd = new FormData();
            fd.append("image", file);
            try {
                const { data: vis } = await api.post("/vision/search", fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                const top = vis?.products?.[0];
                if (top) {
                    const priceVal = top.final_price ?? top.price;
                    setData((s) => ({
                        ...s,
                        image_url: dataUrl,
                        name: top.name || s.name,
                        description: top.description != null ? String(top.description) : s.description,
                        price: priceVal != null && priceVal !== "" ? String(priceVal) : s.price,
                        category_id: top.category?.id != null ? String(top.category.id) : s.category_id,
                        brand_id: top.brand?.id != null ? String(top.brand.id) : s.brand_id,
                    }));
                    await toastSuccess({ khText: "បានបំពេញពីរូបភាព", enText: "Fields filled from your photo match." });
                } else {
                    await toastSuccess({ khText: "រូបភាពបានផ្ទុក", enText: "Photo added. No close match found — edit details manually." });
                }
            } catch {
                await toastSuccess({ khText: "រូបភាពបានផ្ទុក", enText: "Photo added. Adjust name and price manually." });
            }
        } catch {
            setErr("Could not read the photo file.");
        } finally {
            setAiBusy(false);
            setIsUploading(false);
        }
    };

    /* ── CRUD ── */
    const create = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setErr("Product name is required"); return; }
        const validationError = validateSaleFields(form);
        if (validationError) { setErr(validationError); return; }
        setIsCreating(true);
        loadingAlert({ khTitle: "កំពុងបង្កើត", enTitle: "Creating…", khText: "សូមរង់ចាំ", enText: "Please wait" });
        try {
            const finalCode = form.barcode_code.trim() ? sanitizeCode(form.barcode_code) : generateCode();
            const saleForm = normalizeSaleFieldsForPayload(form);
            await api.post("/admin/categories", {
                name: saleForm.name.trim(),
                slug: finalCode,
                type: BARCODE_QR_TYPE,
                description: saleForm.description || null,
                details: saleForm.details || null,
                price: saleForm.price || null,
                compare_at_price: saleForm.compare_at_price || null,
                label_color: saleForm.label_color || null,
                image_url: saleForm.image_url || null,
                gallery: saleForm.gallery || null,
                sku: saleForm.sku || null,
                cost: saleForm.cost || null,
                unit: saleForm.unit || null,
                origin: saleForm.origin || null,
                brand_id: saleForm.brand_id || null,
                category_id: saleForm.category_id ? parseInt(saleForm.category_id, 10) : null,
                product_condition: saleForm.product_condition || "new",
                second_hand_sale_type: saleForm.second_hand_sale_type || null,
                bundle_total_cost: saleForm.bundle_total_cost || null,
                bundle_total_quantity: saleForm.bundle_total_quantity || null,
                is_active: saleForm.is_active,
                sort_order: 0,
                ...buildCategoryStockPayload(saleForm, isReceivedLogPage, null, rows),
                date_in: saleForm.date_in || todayYmd(),
                has_variation: !!saleForm.has_variation,
                variation_product_type: saleForm.has_variation ? (saleForm.variation_product_type || null) : null,
                variation_colors: saleForm.has_variation ? (saleForm.variation_colors || null) : null,
                variation_sizes: saleForm.has_variation && Array.isArray(saleForm.variation_sizes) && saleForm.variation_sizes.length ? saleForm.variation_sizes : null,
            });
            closeSwal();
            resetForm();
            await toastSuccess({ khText: "បង្កើតដោយជោគជ័យ", enText: "Created successfully!" });
            await load();
            navigate(stockBase);
        } catch (e2) {
            closeSwal();
            const msg = e2?.response?.data?.message || extractErr(e2);
            setErr(msg);
            await errorAlert({ khTitle: "បរាជ័យ", enTitle: "Failed", detail: msg });
        } finally {
            setIsCreating(false);
        }
    };

    const saveEdit = async () => {
        if (!editing?.name?.trim()) { setErr("Product name is required"); return; }
        const validationError = validateSaleFields(editing);
        if (validationError) { setErr(validationError); return; }
        const editCode = editing.barcode_code?.trim()
            ? sanitizeCode(editing.barcode_code)
            : (editing.slug || generateCode());
        try {
            const saleEditing = normalizeSaleFieldsForPayload(editing);
            await api.patch(`/admin/categories/${editing.id}`, {
                name: saleEditing.name,
                slug: editCode,
                description: saleEditing.description || null,
                details: saleEditing.details || null,
                price: saleEditing.price || null,
                compare_at_price: saleEditing.compare_at_price || null,
                label_color: saleEditing.label_color || null,
                image_url: saleEditing.image_url || null,
                gallery: saleEditing.gallery || null,
                sku: saleEditing.sku || null,
                cost: saleEditing.cost || null,
                unit: saleEditing.unit || null,
                origin: saleEditing.origin || null,
                brand_id: saleEditing.brand_id || null,
                category_id: saleEditing.category_id ? parseInt(saleEditing.category_id, 10) : null,
                product_condition: saleEditing.product_condition || "new",
                second_hand_sale_type: saleEditing.second_hand_sale_type || null,
                bundle_total_cost: saleEditing.bundle_total_cost || null,
                bundle_total_quantity: saleEditing.bundle_total_quantity || null,
                is_active: saleEditing.is_active,
                type: BARCODE_QR_TYPE,
                ...buildCategoryStockPayload(saleEditing, isReceivedLogPage, editing, rows),
                date_in: saleEditing.date_in || null,
                has_variation: !!saleEditing.has_variation,
                variation_product_type: saleEditing.has_variation ? (saleEditing.variation_product_type || null) : null,
                variation_colors: saleEditing.has_variation ? (saleEditing.variation_colors || null) : null,
                variation_sizes: saleEditing.has_variation && Array.isArray(saleEditing.variation_sizes) && saleEditing.variation_sizes.length ? saleEditing.variation_sizes : null,
            });
            showSuccess("Updated successfully!");
            await load();
            navigate(stockBase);
        } catch (e2) {
            setErr(extractErr(e2));
        }
    };

    const del = (id, navigateAfter = false) => {
        setPendingDelete({ type: "preset", id, navigateAfter });
    };

    const deleteLinkedProduct = (product) => {
        setLinkedProductsItem(null);
        setPendingDelete({ type: "product", product });
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleteBusy(true);
        setErr("");
        try {
            if (pendingDelete.type === "product") {
                await api.delete(`/admin/products/${pendingDelete.product.id}`);
                await toastSuccess({ khText: "បានលុបទំនិញ", enText: "Product deleted." });
            } else {
                await api.delete(`/admin/categories/${pendingDelete.id}`);
                showSuccess("Deleted successfully!");
            }
            await load();
            if (pendingDelete.type === "preset" && pendingDelete.navigateAfter) {
                navigate(stockBase);
            }
        } catch (e2) {
            setErr(extractErr(e2));
        } finally {
            setDeleteBusy(false);
            setPendingDelete(null);
        }
    };

    /** Clear all editable fields; keep `id` and `slug` so this stays the same record until Save. */
    const resetEditFormToEmpty = () => {
        if (!editing) return;
        setErr("");
        setEditing((prev) => ({
            ...EMPTY_FORM,
            id: prev.id,
            slug: prev.slug,
            barcode_code: "",
        }));
    };

    const handlePrint = () => {
        const node = printRef.current;
        if (!node) return;
        const line = appearance.lineColor || "#111827";
        const bg = appearance.bgColor || "#ffffff";
        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;
        const labelHtml = node.outerHTML;
        const printCss = `
 :root { --bqr-line: ${line}; --bqr-bg: ${bg}; }
 * { box-sizing: border-box; }
 @page { margin: 10mm; size: auto; }
 html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
 body.bqr-print-body {
 margin: 0;
 font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
 background: #e8eaed;
 min-height: 100vh;
 display: flex;
 flex-direction: column;
 align-items: center;
 justify-content: flex-start;
 padding: 24px;
 }
 @media print {
 body.bqr-print-body {
 background: #fff !important;
 padding: 0 !important;
 display: block;
 }
 body.bqr-print-body > .bqr-print-label {
 margin-left: auto;
 margin-right: auto;
 }
 }
 .bqr-print-label {
 display: flex;
 flex-direction: column;
 background: var(--bqr-bg);
 color: var(--bqr-line);
 border: 2px solid #1f2937;
 border-radius: 12px;
 padding: 26px 28px 28px;
 width: 100%;
 max-width: 96mm;
 margin: 0 auto;
 box-shadow: none;
 }
 @media print {
 .bqr-print-label {
 border-radius: 10px;
 max-width: 100%;
 break-inside: avoid;
 page-break-inside: avoid;
 }
 }
 .bqr-print-top {
 display: flex;
 flex-direction: row;
 flex-wrap: wrap;
 align-items: flex-start;
 justify-content: space-between;
 gap: 14px 18px;
 margin-bottom: 16px;
 }
 .bqr-print-info {
 flex: 1 1 160px;
 min-width: 0;
 max-width: 100%;
 }
 .bqr-print-info h2 {
 margin: 0 0 8px 0;
 font-size: 1.35rem;
 line-height: 1.2;
 font-weight: 700;
 }
 .bqr-print-info > p { margin: 0; font-size: 11px; line-height: 1.5; }
 .bqr-print-sku {
 display: inline-block;
 max-width: 100%;
 font-size: 10px;
 font-weight: 700;
 letter-spacing: 0.12em;
 text-transform: uppercase;
 padding: 6px 8px;
 border-radius: 6px;
 margin-bottom: 8px;
 border: 1px solid color-mix(in srgb, var(--bqr-line) 38%, transparent);
 background: color-mix(in srgb, var(--bqr-line) 8%, transparent);
 }
 .bqr-print-price {
 flex: 0 0 auto;
 align-self: flex-start;
 display: flex;
 flex-direction: column;
 align-items: stretch;
 gap: 6px;
 padding: 12px 14px 14px;
 border-radius: 10px;
 border: 1px solid color-mix(in srgb, var(--bqr-line) 22%, transparent);
 background: color-mix(in srgb, var(--bqr-line) 6%, transparent);
 width: auto;
 min-width: 6.5rem;
 max-width: 44%;
 }
 @media (min-width: 640px) {
 .bqr-print-price { align-items: flex-end; text-align: right; }
 }
 .bqr-print-price-head {
 margin: 0;
 font-size: 9px;
 font-weight: 600;
 letter-spacing: 0.2em;
 text-transform: uppercase;
 opacity: 0.48;
 line-height: 1.2;
 }
 .bqr-print-price-was {
 margin: 0;
 font-size: 13px;
 font-weight: 600;
 font-variant-numeric: tabular-nums;
 text-decoration: line-through;
 opacity: 0.58;
 line-height: 1.2;
 }
 .bqr-print-price-now {
 margin: 0;
 font-size: 1.85rem;
 font-weight: 700;
 font-variant-numeric: tabular-nums;
 letter-spacing: -0.02em;
 line-height: 1.05;
 }
 .bqr-print-codes {
 display: grid;
 align-items: center;
 gap: 14px 18px;
 border-top: 1px solid color-mix(in srgb, var(--bqr-line) 18%, transparent);
 padding-top: 16px;
 margin-top: 4px;
 }
 .bqr-print-codes--solo {
 grid-template-columns: 1fr;
 justify-items: center;
 }
 .bqr-print-codes:not(.bqr-print-codes--solo) {
 grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
 }
 .bqr-print-code-col {
 display: flex;
 flex-direction: column;
 align-items: center;
 gap: 10px;
 min-width: 0;
 width: 100%;
 }
 .bqr-print-code-col > p:first-of-type {
 margin: 0;
 font-size: 10px;
 font-weight: 600;
 letter-spacing: 0.2em;
 text-transform: uppercase;
 opacity: 0.55;
 }
 .bqr-print-barcode-wrap {
 width: 100%;
 display: flex;
 justify-content: center;
 overflow-x: auto;
 }
 .bqr-print-barcode-wrap svg { max-width: 100%; height: auto; }
 .bqr-print-divider {
 width: 1px;
 min-height: 118px;
 align-self: stretch;
 background: color-mix(in srgb, var(--bqr-line) 32%, transparent);
 }
 .bqr-print-qr-frame {
 border-radius: 10px;
 padding: 10px;
 border: 1px solid color-mix(in srgb, var(--bqr-line) 28%, transparent);
 background: var(--bqr-bg);
 }
 .bqr-print-qr-frame svg { width: 108px !important; height: 108px !important; }
 @media (max-width: 520px) {
 .bqr-print-codes:not(.bqr-print-codes--solo) {
 grid-template-columns: 1fr;
 justify-items: center;
 }
 .bqr-print-divider { display: none !important; }
 .bqr-print-code-col:first-of-type {
 border-bottom: 1px solid color-mix(in srgb, var(--bqr-line) 18%, transparent);
 padding-bottom: 18px;
 margin-bottom: 4px;
 }
 }
 svg { display: block; }
 `;
        win.document.open();
        win.document.write(
            `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Stock &amp; Inventory Label</title><style>${printCss}</style></head><body class="bqr-print-body">${labelHtml}</body></html>`,
        );
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
        }, 450);
    };

    const searchFiltered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (!q) return true;
            if (r.name?.toLowerCase().includes(q)) return true;
            if (String(r.slug || "").toLowerCase().includes(q)) return true;
            if (String(r.sku || "").toLowerCase().includes(q)) return true;
            return false;
        });
    }, [rows, search]);

    const resolveInventoryLabel = (item) => {
        if (!item) return null;
        if (item.parent_id != null) {
            return rows.find((r) => String(r.id) === String(item.parent_id)) || item;
        }
        return item;
    };

    const openQuickRestockModal = (item) => {
        const label = resolveInventoryLabel(item);
        if (!label) return;
        setQuickRestockForm({
            quantity: "",
            product_condition: label.product_condition || "new",
            second_hand_sale_type: label.second_hand_sale_type || "single",
        });
        setQuickRestockItem(label);
    };

    const closeQuickRestockModal = () => {
        setQuickRestockItem(null);
        setQuickRestockForm({ ...EMPTY_QUICK_RESTOCK });
    };

    useEffect(() => {
        if (!quickRestockItem) return undefined;
        const onKey = (ev) => {
            if (ev.key === "Escape" && !quickRestockBusy) closeQuickRestockModal();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [quickRestockItem, quickRestockBusy]);

    const submitQuickRestock = async (e) => {
        e.preventDefault();
        if (!quickRestockItem) return;
        const qty = parseInt(String(quickRestockForm.quantity ?? "").trim(), 10);
        if (!Number.isFinite(qty) || qty < 1) {
            await errorAlert({ khTitle: "បញ្ចូលចំនួន", enTitle: "Quantity required", detail: "Enter at least 1 unit to receive." });
            return;
        }
        setQuickRestockBusy(true);
        loadingAlert({ khTitle: "កំពុងទទួលស្តុក", enTitle: "Receiving stock…", khText: "សូមរង់ចាំ", enText: "Please wait" });
        try {
            const { data } = await api.post(`/admin/categories/${quickRestockItem.id}/quick-restock`, {
                quantity: qty,
                product_condition: quickRestockForm.product_condition || "new",
                second_hand_sale_type: quickRestockForm.product_condition === "second_hand"
                    ? (quickRestockForm.second_hand_sale_type || "single")
                    : null,
            });
            const inventory = data?.data?.inventory;
            const received = data?.data?.received;
            setRows((prev) => {
                const next = [...prev];
                if (inventory) {
                    const idx = next.findIndex((r) => r.id === inventory.id);
                    if (idx >= 0) next[idx] = inventory;
                }
                if (received) next.push(received);
                return next;
            });
            closeSwal();
            closeQuickRestockModal();
            await toastSuccess({
                khText: `បានទទួល ${qty} ឯកតា`,
                enText: `Received ${qty} unit${qty === 1 ? "" : "s"} successfully.`,
            });
        } catch (e2) {
            closeSwal();
            await errorAlert({
                khTitle: "បរាជ័យ",
                enTitle: "Could not receive stock",
                detail: extractErr(e2),
            });
        } finally {
            setQuickRestockBusy(false);
        }
    };

    const linkedProductsForLabel = (item) => {
        if (!item?.id) return [];
        const itemId = String(item.id);

        // Stock Received batch row: only products explicitly linked to this receipt.
        if (item.parent_id != null) {
            return products.filter(
                (product) =>
                    product.stock_label_id != null
                    && product.stock_label_id !== ""
                    && String(product.stock_label_id) === itemId,
            );
        }

        // Master inventory label: union of all receive batches + legacy barcode match.
        const masterId = itemId;
        const masterBarcode = String(item.slug || "").trim().toLowerCase();
        const batchIds = new Set(
            receiveBatchesForMaster(item, rows).map((b) => String(b.id)),
        );
        batchIds.add(masterId);
        return products.filter((product) => {
            if (product.stock_label_id != null && product.stock_label_id !== "") {
                return batchIds.has(String(product.stock_label_id));
            }
            if (masterBarcode) {
                return String(product?.barcode_code || "").trim().toLowerCase() === masterBarcode;
            }
            return false;
        });
    };

    const displayRowStock = (item) => {
        if (!item?.manage_stock) return null;
        // Stock Received: always sum receipt rows (opening + batches), including average bundle.
        if (isReceivedLogPage) {
            return effectiveRowStock(item, true, rows);
        }
        // Stock & Inventory (master rows): on-hand from `stock`, else sum of Stock Received rows.
        if (item.parent_id == null || item.parent_id === "") {
            const onHand = inventoryOnHandForMaster(item, rows);
            if (onHand != null) return onHand;
        }
        return effectiveRowStock(item, false, rows);
    };

    const displayRows = useMemo(() => {
        let list = searchFiltered;
        if (isReceivedLogPage) {
            list = buildStockReceivedLogRows(list, rows);
        } else {
            list = list.filter((r) => r.parent_id == null);
        }
        if (stockFilter === "low") {
            list = list.filter((r) => {
                if (!r.manage_stock) return false;
                const st = displayRowStock(r) ?? 0;
                const mn = parseInt(r.min_stock, 10) || 0;
                return st > 0 && mn > 0 && st <= mn;
            });
        } else if (stockFilter === "out") {
            list = list.filter((r) => r.manage_stock && (displayRowStock(r) ?? 0) === 0);
        }
        if (dateInFrom || dateInTo) {
            list = list.filter((r) => matchesDateInRange(r, dateInFrom, dateInTo));
        }
        return list;
    }, [searchFiltered, stockFilter, dateInFrom, dateInTo, isReceivedLogPage, rows, products]);

    const hasDateInRangeFilter = Boolean(dateInFrom || dateInTo);
    const clearDateInRange = () => {
        setDateInFrom("");
        setDateInTo("");
    };

    const trackedUnits = useMemo(() => {
        let units = 0;
        for (const r of displayRows) {
            if (r.manage_stock) {
                units += displayRowStock(r) ?? 0;
            }
        }
        return units;
    }, [displayRows, isReceivedLogPage, rows, products]);

    const totalPriceForLabel = (item) => {
        if (isAverageBundleLabel(item)) {
            const linked = linkedProductsForLabel(item);
            const units = displayRowStock(item) ?? averageBundleOnHandQuantity(item);
            const price = Number(item?.price);
            if (!Number.isFinite(price)) return null;
            return { amount: price * units, sourceCount: linked.length, units };
        }

        const linked = linkedProductsForLabel(item);
        const labelStock = effectiveRowStock(item, isReceivedLogPage, rows);
        let remainingUnits = item?.manage_stock && labelStock != null
            ? Math.max(0, labelStock)
            : null;
        let total = 0;
        let count = 0;
        let units = 0;
        for (const product of linked) {
            const price = Number(product?.price);
            if (!Number.isFinite(price)) continue;
            const stock = Number(product?.stock);
            let qty = Number.isFinite(stock) ? Math.max(0, stock) : 1;
            if (remainingUnits !== null) {
                if (remainingUnits <= 0) break;
                qty = Math.min(qty, remainingUnits);
                remainingUnits -= qty;
            }
            total += price * qty;
            count += 1;
            units += qty;
        }

        return count > 0 ? { amount: total, sourceCount: count, units } : null;
    };

    const averageUnitPriceForLabel = (item) => {
        if (!isAverageBundleLabel(item)) return null;
        const price = Number(item?.price);
        return Number.isFinite(price) ? price : null;
    };

    const canShowPrintLabel = (item) => isAverageBundleLabel(item);

    const exportCsv = () => {
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const header = ["Product", "Category", "Origin", "Stock", "Date In", "Status", "Price Unit", "Total Price"];
        const lines = [header.join(",")];
        for (const r of displayRows) {
            const catLabel = formatCategoryLabel(resolveItemCategoryId(r), categories);
            const st = r.manage_stock ? (displayRowStock(r) ?? 0) : "";
            const mn = r.manage_stock ? (parseInt(r.min_stock, 10) || 0) : 0;
            const stockLabel = !r.manage_stock
                ? "Untracked"
                : st === 0
                    ? "Out of stock"
                    : mn > 0 && st <= mn
                        ? "Low Stock"
                        : `${st} units`;
            const dateIn = effectiveDateIn(r);
            const status = getStockAgeStatus(dateIn).label;
            const averageUnitPrice = averageUnitPriceForLabel(r);
            const totalPrice = totalPriceForLabel(r);
            lines.push([
                esc(r.name),
                esc(catLabel === "—" ? "-" : catLabel),
                esc(formatOriginCsv(r.origin)),
                esc(stockLabel),
                esc(isReceivedLogPage ? formatDateInWithTime(r) : formatDateIn(dateIn)),
                esc(status),
                averageUnitPrice != null ? `$${averageUnitPrice.toFixed(2)}` : "-",
                totalPrice ? `$${totalPrice.amount.toFixed(2)} (${totalPrice.units} units)` : "-",
            ].join(","));
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `barcode-items-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const allSelected = displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));
    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(displayRows.map((r) => r.id)));
    };

    const toggleRowSelect = (id) => {
        setSelectedIds((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    /* ── Shared field styles ── */
    const inputCls =
        "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[rgba(var(--admin-primary-rgb),0.5)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.14)] dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]";
    const textareaCls =
        "w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[rgba(var(--admin-primary-rgb),0.5)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.14)] dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]";
    const selectCls = `${inputCls}`;
    const labelCls =
        "mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300";

    /* ── Reusable product form fields (full-width two-column on create/edit) ── */
    const renderFormFields = (data, setData, isEdit = false) => {
        const labelPreviewBg = data.label_color || "#475569";
        const previewPrice =
            data.price != null && String(data.price) !== ""
                ? `$${parseFloat(data.price).toFixed(2)}`
                : "$0.00";
        const previewName = data.name?.trim() || "Product name";
        const bandBg = labelPreviewBg && labelPreviewBg !== "" ? labelPreviewBg : "#6b4423";
        const bandFg = ["#ffffff", "#fff", ""].includes(String(bandBg).toLowerCase()) ? "#0f172a" : "#ffffff";
        const galleryUrls = parseGallery(data.gallery || "").filter(Boolean);
        const storedPrimaryImg = String(data.image_url || "").trim();
        /** Hero preview = canonical primary, or first gallery photo if API omits `image_url`. */
        const heroPhotoUrl = storedPrimaryImg || galleryUrls[0] || "";
        const galleryThumbUrls = storedPrimaryImg ? galleryUrls : galleryUrls.slice(1);
        const previewCompareFmt =
            data.compare_at_price !== "" &&
                data.compare_at_price != null &&
                !Number.isNaN(parseFloat(String(data.compare_at_price)))
                ? parseFloat(String(data.compare_at_price)).toFixed(2)
                : "";
        const productCondition = data.product_condition || "new";
        const isSecondHand = productCondition === "second_hand";
        const saleType = data.second_hand_sale_type || "single";
        const isAverageBundle = isSecondHand && saleType === "average_bundle";
        const usesSimpleTotalStock = !isAverageBundle;
        const bundleUnitCost = calculateBundleUnitCost(data.bundle_total_cost, data.bundle_total_quantity);

        const hasAnyPhotos = Boolean(storedPrimaryImg || galleryUrls.length > 0);
        const confirmClearAllPhotos = async () => {
            const res = await warningConfirm({
                enTitle: "Remove all photos?",
                enText:
                    "This clears the main image and every gallery photo from this form. For an existing product, click Save after to update the server.",
                enConfirm: "Remove photos",
                intent: "destructive",
            });
            if (!res.isConfirmed) return;
            setData((s) => ({ ...s, image_url: "", gallery: "" }));
        };

        return (
            <div className="w-full min-w-0 pb-1">
                <div className="grid grid-cols-1 items-start gap-8 lg:gap-10 xl:grid-cols-12">
                    <div className="min-w-0 space-y-6 xl:col-span-7">
                        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white ring-1 ring-slate-950/[0.02] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.03]">
                            {/* Compact label preview */}
                            <input
                                ref={isEdit ? editProductImageInputRef : productImageInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => handleImageUpload(e, isEdit)}
                            />
                            <input
                                ref={isEdit ? editGalleryInputRef : galleryInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="hidden"
                                onChange={(e) => handleGalleryUpload(e, isEdit)}
                            />
                            <input
                                ref={replaceGalleryInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => handleReplaceGalleryImage(e, isEdit)}
                            />
                            {/* Peach banner + tile overlapping downward onto white (shelf poster style) */}
                            <div className="relative bg-white dark:bg-slate-900">
                                <div
                                    className="min-h-[6.75rem] rounded-t-2xl px-6 pt-9 pb-[4.75rem] sm:min-h-[7.25rem] sm:px-10 sm:pt-10 sm:pb-[5.75rem]"
                                    style={{ backgroundColor: bandBg }}
                                    aria-hidden
                                />
                                <div className="relative z-[1] -mt-[7.25rem] flex justify-center px-4 pb-5 sm:-mt-[8rem] sm:px-8 sm:pb-6">
                                    <div className="relative flex w-full max-w-[min(100%,240px)] flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-[0_22px_50px_rgba(15,23,42,0.16),0_4px_12px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04] dark:border-white/12 dark:bg-slate-900 dark:shadow-black/45 dark:ring-white/[0.05]">
                                        {hasAnyPhotos && (
                                            <div className="absolute right-1 top-1 z-30 flex flex-col items-end gap-1 sm:right-2 sm:top-2">
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        void confirmClearAllPhotos();
                                                    }}
                                                    title="Remove all photos"
                                                    aria-label="Remove all photos from this product"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-white/15 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-red-900/50 dark:hover:bg-red-950/50 dark:hover:text-red-200"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M12 3a9 9 0 110 18 9 9 0 010-18z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                        <div className="group/hero aspect-square w-full shrink-0 overflow-hidden rounded-t-xl bg-neutral-100 dark:bg-slate-800/80">
                                            {heroPhotoUrl ? (
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    onClick={() => (isEdit ? editProductImageInputRef : productImageInputRef).current?.click()}
                                                    title="Click to replace photo"
                                                    aria-label="Replace product photo — upload a new image"
                                                    className="relative h-full w-full cursor-pointer overflow-hidden rounded-t-xl border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <img
                                                        src={resolveImageUrl(heroPhotoUrl)}
                                                        alt=""
                                                        className="pointer-events-none h-full w-full object-cover object-center"
                                                    />
                                                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/hero:bg-black/40 group-hover/hero:opacity-100">
                                                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-900 shadow-md">
                                                            Change photo
                                                        </span>
                                                    </span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    onClick={() => (isEdit ? editProductImageInputRef : productImageInputRef).current?.click()}
                                                    title="Add product photo"
                                                    aria-label="Add product photo"
                                                    className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-0 bg-transparent p-4 text-center text-slate-400 transition hover:bg-slate-100/80 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-400"
                                                >
                                                    <svg className="h-9 w-9 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-[11px] font-medium leading-snug">Click here or + below to add a photo.</span>
                                                </button>
                                            )}
                                        </div>
                                        <div
                                            className="mt-0 w-full shrink-0 rounded-b-xl px-4 py-3.5 text-left sm:px-4 sm:py-4"
                                            style={{ backgroundColor: bandBg, color: bandFg }}
                                        >
                                            <p className="text-[1.05rem] font-bold leading-tight tracking-tight sm:text-lg">{previewName}</p>
                                            <p className="mt-1.5 text-sm font-bold tabular-nums leading-tight sm:text-[0.9375rem]" style={{ color: bandFg }}>
                                                {previewPrice}
                                            </p>
                                            {previewCompareFmt !== "" ? (
                                                <p className="mt-1 text-sm font-semibold tabular-nums line-through opacity-65 dark:opacity-60" style={{ color: bandFg }}>
                                                    ${previewCompareFmt}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Small thumbnails + add-more (inline; no side panel) */}
                            <div className="border-t border-slate-200/90 px-4 py-3 dark:border-slate-700">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">Photos</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {!heroPhotoUrl ? (
                                        <button
                                            type="button"
                                            disabled={isUploading}
                                            onClick={() => (isEdit ? editProductImageInputRef : productImageInputRef).current?.click()}
                                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-slate-400 hover:bg-white disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-slate-500"
                                            aria-label="Add primary product photo"
                                            title="Primary photo"
                                        >
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>
                                    ) : (
                                        <>
                                            <div className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200/90 dark:border-slate-600">
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    title="Replace primary photo"
                                                    aria-label="Replace primary photo"
                                                    onClick={() => (isEdit ? editProductImageInputRef : productImageInputRef).current?.click()}
                                                    className="absolute inset-0 z-0 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--admin-primary)] disabled:opacity-50"
                                                />
                                                <img src={resolveImageUrl(heroPhotoUrl)} alt="" className="relative z-0 h-full w-full object-cover pointer-events-none" />
                                                <button
                                                    type="button"
                                                    disabled={isUploading}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setData((s) => removeLeadingProductPhoto(s));
                                                    }}
                                                    className="absolute right-0 top-0 z-10 flex h-4 min-w-[1rem] items-center justify-center rounded-bl-md bg-slate-900/75 text-[9px] font-bold leading-none text-white opacity-95 hover:bg-red-600"
                                                    aria-label="Remove primary photo — next thumbnail becomes main"
                                                    title="Remove"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            {galleryThumbUrls.map((url, idx) => {
                                                const galleryRmIndex = storedPrimaryImg ? idx : idx + 1;
                                                return (
                                                    <div key={`${galleryRmIndex}-${url.slice(0, 24)}`} className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200/90 dark:border-slate-600">
                                                        <button
                                                            type="button"
                                                            disabled={isUploading}
                                                            title="Click to replace this photo"
                                                            aria-label="Replace this gallery photo"
                                                            onClick={() => {
                                                                pendingReplaceGalleryIndexRef.current = galleryRmIndex;
                                                                replaceGalleryInputRef.current?.click();
                                                            }}
                                                            className="absolute inset-0 z-0 cursor-pointer hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                        <img
                                                            src={resolveImageUrl(url)}
                                                            alt=""
                                                            className="relative z-0 h-full w-full object-cover pointer-events-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={isUploading}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setData((s) => {
                                                                    const next = parseGallery(s.gallery).filter((_, i) => i !== galleryRmIndex);
                                                                    return { ...s, gallery: next.join("\n") };
                                                                });
                                                            }}
                                                            className="absolute right-0 top-0 z-10 flex h-4 min-w-[1rem] items-center justify-center rounded-bl-md bg-slate-900/75 text-[9px] font-bold leading-none text-white opacity-95 hover:bg-red-600"
                                                            title="Remove from gallery"
                                                            aria-label="Remove this gallery photo"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            <button
                                                type="button"
                                                disabled={isUploading}
                                                onClick={() => (isEdit ? editGalleryInputRef : galleryInputRef).current?.click()}
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-lg font-semibold leading-none text-slate-500 transition hover:border-[color:var(--admin-primary)] hover:text-[color:var(--admin-primary)] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-[color:var(--admin-primary)]"
                                                aria-label="Add more gallery photos"
                                                title="Add gallery images"
                                            >
                                                +
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-200/90 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-5 sm:py-3.5">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 shrink-0">Label color</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {LABEL_COLORS.map((c) => (
                                            <button
                                                key={c || "none"}
                                                type="button"
                                                onClick={() => setData((s) => ({ ...s, label_color: c }))}
                                                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${data.label_color === c ? "border-slate-800 dark:border-white scale-110" : "border-transparent"}`}
                                                style={{ backgroundColor: c || "#e2e8f0" }}
                                                title={c || "None"}
                                            />
                                        ))}
                                        <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 dark:border-slate-500" title="Custom color">
                                            <input
                                                type="color"
                                                value={data.label_color || "#6366f1"}
                                                onChange={(e) => setData((s) => ({ ...s, label_color: e.target.value }))}
                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                            />
                                            <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Product name */}
                        <div>
                            <label className={labelCls}>Product name *</label>
                            <input
                                value={data.name}
                                onChange={(e) => setData((s) => ({ ...s, name: e.target.value }))}
                                required
                                className={inputCls}
                                placeholder="e.g. Nike Air Force 1"
                            />
                        </div>

                        <CategoryPicker
                            categories={categories}
                            value={data.category_id || ""}
                            onChange={(id) => setData((s) => ({ ...s, category_id: id }))}
                            labelCls={labelCls}
                            inputCls={inputCls}
                            disabled={isUploading}
                        />

                        <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                            <div>
                                <label className={labelCls}>Product condition</label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {[
                                        { value: "new", label: "New", hint: "ទំនិញថ្មី" },
                                        { value: "second_hand", label: "Second-hand", hint: "ទំនិញមួយទឹក" },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setData((s) => applySecondHandBundleDefaults({
                                                ...s,
                                                product_condition: option.value,
                                            }))}
                                            className={`rounded-xl border px-4 py-3 text-left transition ${productCondition === option.value
                                                ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-slate-900 ring-2 ring-[rgba(var(--admin-primary-rgb),0.12)] dark:text-white"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-500"
                                                }`}
                                        >
                                            <span className="flex items-center gap-2 text-sm font-bold">
                                                <span className={`h-3 w-3 rounded-full border ${productCondition === option.value ? "border-[color:var(--admin-primary)] bg-[color:var(--admin-primary)]" : "border-slate-300 dark:border-slate-500"}`} />
                                                {option.label}
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isSecondHand && (
                                <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-400/20 dark:bg-amber-500/10">
                                    <div>
                                        <label className={labelCls}>Sale type</label>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {[
                                                { value: "single", label: "Single Item", hint: "លក់រាយមួយៗ" },
                                                { value: "average_bundle", label: "Average Bundle", hint: "លក់តម្លៃរួម" },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setData((s) => applySecondHandBundleDefaults({
                                                        ...s,
                                                        second_hand_sale_type: option.value,
                                                    }))}
                                                    className={`rounded-xl border px-4 py-3 text-left transition ${saleType === option.value
                                                        ? "border-amber-500 bg-white text-slate-900 ring-2 ring-amber-400/20 dark:bg-slate-900 dark:text-white"
                                                        : "border-amber-200 bg-white/70 text-slate-700 hover:bg-white dark:border-amber-400/20 dark:bg-slate-900/50 dark:text-slate-200"
                                                        }`}
                                                >
                                                    <span className="flex items-center gap-2 text-sm font-bold">
                                                        <span className={`h-3 w-3 rounded-full border ${saleType === option.value ? "border-amber-500 bg-amber-500" : "border-slate-300 dark:border-slate-500"}`} />
                                                        {option.label}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {isAverageBundle && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <div>
                                                    <label className={labelCls}>Total bundle cost ($)</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        value={data.bundle_total_cost || ""}
                                                        onChange={(e) => setData((s) => applySecondHandBundleDefaults({ ...s, bundle_total_cost: e.target.value }))}
                                                        className={inputCls}
                                                        placeholder="150.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Total quantity</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={data.bundle_total_quantity || ""}
                                                        onChange={(e) => setData((s) => applySecondHandBundleDefaults({ ...s, bundle_total_quantity: e.target.value }))}
                                                        className={inputCls}
                                                        placeholder="50"
                                                    />
                                                </div>
                                            </div>
                                            <p className="rounded-lg bg-white/80 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-slate-900/70 dark:text-amber-200">
                                                System will set Cost ($) to {bundleUnitCost ? `$${bundleUnitCost}` : "$0.00"} from bundle cost ÷ quantity. On hand matches Total quantity for this bundle label.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {!usesSimpleTotalStock && (
                            <>
                                {/* Price */}
                                <div>
                                    <label className={labelCls}>Price ($) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={data.price}
                                        onChange={(e) => setData((s) => ({ ...s, price: e.target.value }))}
                                        className={inputCls}
                                        placeholder="0.00"
                                    />
                                </div>

                                {/* Reduced price */}
                                <div className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reduced price</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Sales price will be crossed out</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setData((s) => ({ ...s, compare_at_price: s.compare_at_price ? "" : (s.price || "10.00") }))}
                                            className={`w-11 h-6 rounded-full transition-all flex items-center ${data.compare_at_price ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600"}`}
                                        >
                                            <span className={`w-4 h-4 bg-white rounded-full transform transition-transform mx-0.5 ${data.compare_at_price ? "translate-x-5" : "translate-x-0"}`} />
                                        </button>
                                    </div>
                                    {data.compare_at_price !== "" && data.compare_at_price !== undefined && (
                                        <>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={data.compare_at_price}
                                                onChange={(e) => setData((s) => ({ ...s, compare_at_price: e.target.value }))}
                                                className={inputCls}
                                                placeholder="Original price (will be crossed out)"
                                            />
                                            {data.compare_at_price && data.price && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Sales price will be crossed out, for example:{" "}
                                                    <span className="line-through text-slate-400">${parseFloat(data.compare_at_price || 0).toFixed(2)}</span>{" "}
                                                    for{" "}
                                                    <span className="font-semibold text-[color:var(--admin-primary)]">${parseFloat(data.price || 0).toFixed(2)}</span>
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Description + Suggest */}
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea
                                value={data.description || ""}
                                onChange={(e) => setData((s) => ({ ...s, description: e.target.value }))}
                                rows={3}
                                className={textareaCls}
                                placeholder="Product description…"
                            />
                        </div>

                        {!usesSimpleTotalStock && (
                            <div>
                                <label className={labelCls}>Barcode Code</label>
                                <div className="flex gap-2">
                                    <input
                                        value={data.barcode_code || ""}
                                        onChange={(e) => setData((s) => ({ ...s, barcode_code: sanitizeCode(e.target.value) }))}
                                        maxLength={30}
                                        className={`${inputCls} flex-1 font-mono tracking-widest`}
                                        placeholder="Custom code or auto-generate…"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setData((s) => ({ ...s, barcode_code: generateCode() }))}
                                        className="px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all whitespace-nowrap flex items-center gap-1.5"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Auto
                                    </button>
                                </div>
                                {(data.barcode_code || data.slug) && (
                                    <div className="mt-2 p-2 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center overflow-hidden">
                                        <Barcode
                                            value={data.barcode_code || data.slug || "CODE"}
                                            width={1.3}
                                            height={42}
                                            fontSize={10}
                                            margin={4}
                                            background="transparent"
                                            lineColor={isDark ? "#e2e8f0" : "#1e293b"}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {isAverageBundle && (
                            <div>
                                <label className={labelCls}>Cost ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={bundleUnitCost}
                                    disabled
                                    className={`${inputCls} cursor-not-allowed opacity-60`}
                                    placeholder="Auto-calculated from bundle"
                                />
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Cost is calculated from Total bundle cost divided by Total quantity.
                                </p>
                            </div>
                        )}

                        {/* Unit */}
                        <div>
                            <label className={labelCls}>Unit</label>
                            <select
                                value={data.unit || ""}
                                onChange={(e) => setData((s) => ({ ...s, unit: e.target.value }))}
                                className={selectCls}
                            >
                                <option value="">Select unit</option>
                                <option>Piece</option>
                                <option>Pair</option>
                                <option>Box</option>
                                <option>Kg</option>
                                <option>Liter</option>
                                <option>Set</option>
                            </select>
                        </div>

                        <CountryOriginPicker
                            value={data.origin || ""}
                            onChange={(code) => setData((s) => ({ ...s, origin: code }))}
                            labelCls={labelCls}
                            inputCls={inputCls}
                        />

                    </div>

                    <div className="min-w-0 space-y-6 xl:col-span-5">
                        {/* ── Stock ── */}
                        <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 ring-1 ring-slate-950/[0.02] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.03]">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Stock</h3>
                                    {usesSimpleTotalStock && (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This listing uses one total stock count for the web store and POS.</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-right max-w-[140px] sm:max-w-none">
                                        {usesSimpleTotalStock ? "Stock is tracked" : "Manage stock for this product"}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={usesSimpleTotalStock}
                                        onClick={() => setData((s) => ({ ...s, manage_stock: !s.manage_stock, show_stock_movement: s.manage_stock ? false : s.show_stock_movement }))}
                                        className={`w-11 h-6 rounded-full transition-all flex items-center shrink-0 ${usesSimpleTotalStock || data.manage_stock ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600"} ${usesSimpleTotalStock ? "cursor-not-allowed opacity-80" : ""}`}
                                    >
                                        <span className={`w-4 h-4 bg-white rounded-full transform transition-transform mx-0.5 ${usesSimpleTotalStock || data.manage_stock ? "translate-x-5" : "translate-x-0"}`} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Date in</label>
                                <input
                                    type="date"
                                    value={data.date_in || ""}
                                    onChange={(e) => setData((s) => ({ ...s, date_in: e.target.value }))}
                                    className={inputCls}
                                />
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Warehouse stock-in date for aging status</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>{usesSimpleTotalStock ? "Total stock" : "On hand"}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={data.stock ?? ""}
                                        onChange={(e) => setData((s) => ({ ...s, stock: e.target.value }))}
                                        disabled={(!data.manage_stock && !usesSimpleTotalStock) || isAverageBundle}
                                        className={`${inputCls} ${(!data.manage_stock && !usesSimpleTotalStock) || isAverageBundle ? "opacity-50 cursor-not-allowed" : ""}`}
                                        placeholder="0"
                                    />
                                    {isAverageBundle && (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Auto-filled from Total quantity.</p>
                                    )}
                                    {usesSimpleTotalStock && (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New and second-hand single items deduct from this count one unit at a time.</p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelCls}>Minimum</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={data.min_stock ?? ""}
                                        onChange={(e) => setData((s) => ({ ...s, min_stock: e.target.value }))}
                                        disabled={!data.manage_stock && !usesSimpleTotalStock}
                                        className={`${inputCls} ${!data.manage_stock && !usesSimpleTotalStock ? "opacity-50 cursor-not-allowed" : ""}`}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Stock Movement</p>
                                {!data.show_stock_movement ? (
                                    <button
                                        type="button"
                                        onClick={() => setData((s) => ({ ...s, show_stock_movement: true }))}
                                        className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                        Show results
                                    </button>
                                ) : (
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">On hand</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{data.stock || 0} units</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">Minimum</span>
                                            <span className="font-medium text-slate-600 dark:text-slate-400">{data.min_stock || 0} units</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${parseInt(data.stock || 0, 10) <= parseInt(data.min_stock || 0, 10) ? "bg-red-500" : "bg-[color:var(--admin-primary)]"}`}
                                                style={{ width: `${Math.min(100, parseInt(data.min_stock || 0, 10) > 0 ? (parseInt(data.stock || 0, 10) / Math.max(1, parseInt(data.min_stock || 0, 10))) * 100 : 100)}%` }}
                                            />
                                        </div>
                                        <p className={`text-xs font-medium ${parseInt(data.stock || 0, 10) <= parseInt(data.min_stock || 0, 10) ? "text-red-500" : "text-[color:var(--admin-primary)]"}`}>
                                            {parseInt(data.stock || 0, 10) <= parseInt(data.min_stock || 0, 10) ? "⚠ Low stock" : "✓ Stock OK"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        );
    };

    if (loading) return <AdminContentSkeleton lines={3} imageHeight={200} />;

    const successToast = (
        <div className={`fixed top-6 right-6 z-50 transition-all duration-500 ${animate ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}>
            {success && (
                <div className="bg-[color:var(--admin-primary)] text-white px-6 py-4 rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                </div>
            )}
        </div>
    );

    if (isNewPage) {
        return (
            <div className="w-full min-w-0 font-sans text-slate-950 dark:text-slate-100">
                {successToast}
                <div className="w-full min-w-0 space-y-6 pb-28">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(stockBase)}
                                disabled={isCreating}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[5px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Add a product</h1>
                                    <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-transparent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
                                        Stock &amp; Inventory
                                    </span>
                                </div>
                                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                    Fill in the details below, then create your catalog item.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-[5px] border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            title="Form tips: use a clear product name and price. Barcode can be auto-generated."
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                <div className="w-full min-w-0 pt-2">
                    {err && (
                        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/95 p-4 dark:border-red-900/60 dark:bg-red-950/40">
                            <span className="flex-1 text-sm font-medium text-red-700 dark:text-red-200">{err}</span>
                            <button type="button" onClick={() => setErr("")} className="text-sm font-semibold text-red-500 hover:text-red-700">
                                Dismiss
                            </button>
                        </div>
                    )}
                    <form onSubmit={create} className="space-y-2">
                        {renderFormFields(form, setForm, false)}
                        <div className="mt-10 flex max-w-none flex-col-reverse gap-3 border-t border-slate-200 pt-8 sm:flex-row dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => navigate(stockBase)}
                                disabled={isCreating}
                                className={`flex-1 rounded-xl border py-3.5 text-sm font-semibold transition disabled:opacity-50 ${isDark
                                    ? "border-slate-600 bg-slate-900/70 text-white hover:bg-slate-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="flex-1 rounded-xl py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 "
                                style={{
                                    backgroundColor: accentIsWhite ? "#0b0b0f" : accentColor,
                                }}
                            >
                                {isCreating ? "Creating…" : "Create product"}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            </div>
        );
    }

    if (isEditPage && !editing) {
        return (
            <div className="flex min-h-0 flex-1 flex-col admin-soft">
                {successToast}
                <AdminContentSkeleton lines={5} imageHeight={120} className="min-h-0 flex-1 px-4" />
            </div>
        );
    }

    if (isEditPage) {
        return (
            <div className="w-full min-w-0 font-sans text-slate-950 dark:text-slate-100">
                {successToast}
                <div className="w-full min-w-0 space-y-6 pb-28">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(stockBase)}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[5px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit product</h1>
                                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{editing.name}</p>
                            </div>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={resetEditFormToEmpty}
                                className="inline-flex h-9 items-center gap-1.5 rounded-[5px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                title="Clear all fields on this form (does not save until you click Save)"
                            >
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Reset
                            </button>
                        </div>
                    </div>
                <div className="w-full min-w-0 pt-2">
                    {err && (
                        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/95 p-4 dark:border-red-900/60 dark:bg-red-950/40">
                            <span className="flex-1 text-sm font-medium text-red-700 dark:text-red-200">{err}</span>
                            <button type="button" onClick={() => setErr("")} className="text-sm font-semibold text-red-500 hover:text-red-700">
                                Dismiss
                            </button>
                        </div>
                    )}
                    <div className="space-y-2">
                        {renderFormFields(editing, setEditing, true)}
                        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-200 pt-8 sm:flex-row dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => navigate(stockBase)}
                                className={`flex-1 rounded-xl border py-3.5 text-sm font-semibold transition ${isDark
                                    ? "border-slate-600 bg-slate-900/70 text-white hover:bg-slate-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveEdit}
                                className="flex-1 rounded-xl bg-[color:var(--admin-primary)] py-3.5 text-sm font-bold text-white transition hover:bg-[color:var(--admin-primary)] hover:opacity-95"
                            >
                                Save changes
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        );
    }

    return (
        <div className="font-sans text-slate-950 dark:text-slate-100">
            {successToast}
            <AdminConfirmDialog
                open={!!pendingDelete}
                onClose={() => {
                    if (deleteBusy) return;
                    setPendingDelete(null);
                }}
                onConfirm={confirmDelete}
                title={pendingDelete?.type === "product" ? "Delete this product?" : "Delete this preset?"}
                message={
                    pendingDelete?.type === "product"
                        ? `${pendingDelete.product?.name || "This product"} will be removed from Products.`
                        : "This action cannot be undone."
                }
                confirmLabel="Delete"
                cancelLabel="Cancel"
                destructive
                busy={deleteBusy}
            />

            <div className="w-full min-w-0 space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                {isReceivedLogPage ? "Stock Received" : "Stock &amp; Inventory"}
                            </h1>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                {isReceivedLogPage
                                    ? `${displayRows.length} receive batch${displayRows.length !== 1 ? "es" : ""}. Each Quick Restock adds a new row; totals are not reduced by checkout or sales.`
                                    : `${rows.length} registered item${rows.length !== 1 ? "s" : ""}. Manage labels, scan sales, and catalog visibility.`}
                            </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={exportCsv}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[5px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export
                            </button>
                            {!isReceivedLogPage ? (
                                <button
                                    type="button"
                                    onClick={() => navigate(`${stockBase}/new`)}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[5px] bg-[color:var(--admin-primary)] px-3 text-sm font-medium text-white transition hover:brightness-110"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Product
                                </button>
                            ) : null}
                        </div>
                </div>

                {err && (
                    <div className="flex items-center gap-3 rounded-3xl border border-red-200 bg-red-50/95 p-4 text-sm font-semibold text-red-700 shadow-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                        <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="flex-1">{err}</span>
                        <button type="button" onClick={() => setErr("")} className="rounded-full p-1 text-red-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/10">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                <section className="rounded-[22px] border border-white/80 bg-white/85 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.06)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 dark:ring-white/10">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative min-w-0 flex-1">
                            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search products, SKU, barcode, or category..."
                                className="h-11 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.10)] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-emerald-400/60 dark:focus:bg-slate-950/40"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value)}
                                className={`h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold outline-none transition-all duration-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-white/5 ${isDark ? "text-white" : "text-slate-700"}`}
                            >
                                <option value="all">All items</option>
                                <option value="low">Low in stock</option>
                                <option value="out">Out of stock</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#ECE8DD] bg-[#F4EFE8]/80 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#6b6b64] dark:text-slate-300">
                            <svg className="h-4 w-4 text-[#9a948a] dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Date In range:
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <label className="flex items-center gap-2 text-sm font-medium text-[#6b6b64] dark:text-slate-400">
                                <span>From</span>
                                <input
                                    type="date"
                                    value={dateInFrom}
                                    onChange={(e) => setDateInFrom(e.target.value)}
                                    max={dateInTo || undefined}
                                    className="h-9 min-w-[9.5rem] rounded-lg border border-[#E0DAD0] bg-white px-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                                />
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-[#6b6b64] dark:text-slate-400">
                                <span>To</span>
                                <input
                                    type="date"
                                    value={dateInTo}
                                    onChange={(e) => setDateInTo(e.target.value)}
                                    min={dateInFrom || undefined}
                                    className="h-9 min-w-[9.5rem] rounded-lg border border-[#E0DAD0] bg-white px-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                                />
                            </label>
                            {hasDateInRangeFilter && (
                                <button
                                    type="button"
                                    onClick={clearDateInRange}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E0DAD0] bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {(search || stockFilter !== "all" || hasDateInRangeFilter) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {search && (
                                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20">
                                    Search: {search}
                                </span>
                            )}
                            {stockFilter !== "all" && (
                                <button type="button" onClick={() => setStockFilter("all")} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15">
                                    Filter: {stockFilter} x
                                </button>
                            )}
                            {hasDateInRangeFilter && (
                                <button type="button" onClick={clearDateInRange} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15">
                                    Date in: {dateInFrom ? formatDateIn(dateInFrom) : "…"} – {dateInTo ? formatDateIn(dateInTo) : "…"} x
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {rows.length === 0 ? (
                    <div className="rounded-[30px] border border-white/80 bg-white p-14 text-center shadow-[0_24px_70px_rgba(15,23,42,0.07)] ring-1 ring-slate-950/[0.03] dark:border-white/10 dark:bg-slate-900 dark:ring-white/10">
                        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[26px] bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <p className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                            {isReceivedLogPage ? "No receive batches yet" : "No inventory items yet"}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {isReceivedLogPage
                                ? "Quick Restock from Stock & Inventory will appear here as receive batches."
                                : "Create your first product to start tracking labels, units, and catalog visibility."}
                        </p>
                        {!isReceivedLogPage ? (
                            <button type="button" onClick={() => navigate(`${stockBase}/new`)} className="mt-6 rounded-2xl border border-emerald-400 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-6 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(16,185,129,0.45)] ring-4 ring-emerald-500/15 transition hover:-translate-y-0.5 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 hover:shadow-[0_22px_50px_rgba(16,185,129,0.55)] dark:border-emerald-300 dark:ring-emerald-400/20">
                                Add product
                            </button>
                        ) : null}
                    </div>
                ) : displayRows.length === 0 ? (
                    <div className="rounded-[30px] border border-white/80 bg-white p-12 text-center shadow-[0_24px_70px_rgba(15,23,42,0.07)] ring-1 ring-slate-950/[0.03] dark:border-white/10 dark:bg-slate-900 dark:ring-white/10">
                        <p className="text-lg font-black text-slate-950 dark:text-white">No items match this filter</p>
                        <button type="button" onClick={() => setStockFilter("all")} className="mt-4 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-white dark:text-slate-950">Show all</button>
                    </div>
                ) : (
                    <section className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                        <div className="relative z-10 flex flex-col gap-2 px-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a948a]">Products</p>
                                <p className="mt-1 text-sm font-medium text-[#6b6b64] dark:text-slate-400">
                                    {isReceivedLogPage
                                        ? "Each row is one stock receipt. Tap to view linked products."
                                        : "Tap a row to open label preview"}
                                </p>
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#6b6b64] ring-1 ring-[#ECE8DD] dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
                                    {isReceivedLogPage ? `${displayRows.length} batches` : `${displayRows.length} products`}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20">{trackedUnits} units</span>
                                <div className="ml-auto sm:ml-0">
                                    <TableColumnVisibilityMenu
                                        columns={STOCK_TABLE_COLUMNS}
                                        visibility={columnVisibility}
                                        onToggle={toggleTableColumn}
                                        onShowAll={() => setAllTableColumnsVisible(true)}
                                        onHideAll={() => setAllTableColumnsVisible(false)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-b-2xl">
                            <table className="w-full min-w-[1400px] border-collapse text-sm">
                                <thead>
                                    <tr className="border-y border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                        {isColVisible("select") ? (
                                            <th className="w-10 px-3 py-2">
                                                <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
                                            </th>
                                        ) : null}
                                        {isColVisible("products") ? <th className="min-w-[340px] px-4 py-2">Products</th> : null}
                                        {isColVisible("category") ? <th id="bqr-category-anchor" className="w-40 px-4 py-2">Category</th> : null}
                                        {isColVisible("condition") ? <th className="min-w-[11.5rem] w-52 px-4 py-2 text-center">Condition</th> : null}
                                        {isColVisible("origin") ? <th className="w-36 px-4 py-2">Origin</th> : null}
                                        {isColVisible("stock") ? <th className="w-36 px-4 py-2 text-center">Stock</th> : null}
                                        {isColVisible("dateIn") ? <th className={`px-4 py-2 ${isReceivedLogPage ? "w-36" : "w-44"}`}>Date in</th> : null}
                                        {isColVisible("status") ? <th className="w-32 px-4 py-2 text-center">Status</th> : null}
                                        {isColVisible("priceUnit") ? <th className="w-28 px-4 py-2 text-right">Price unit</th> : null}
                                        {isColVisible("totalPrice") ? <th className="w-32 px-4 py-2 text-right">Total price</th> : null}
                                        {isColVisible("actions") ? <th className="w-28 px-4 py-2 text-right">Actions</th> : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayRows.map((item) => {
                                        const barcodeVal = masterBarcodeForRow(item, rows) || slugify(item.name) || "ITEM";
                                        const batchRef = isReceivedLogPage ? batchReceiptRefForRow(item, rows) : null;
                                        const catLabel = formatCategoryLabel(resolveItemCategoryId(item), categories);
                                        const st = item.manage_stock ? displayRowStock(item) : null;
                                        const mn = item.manage_stock ? (parseInt(item.min_stock, 10) || 0) : 0;
                                        const stockBadge = st === null
                                            ? { label: "Untracked", tone: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10", dot: "bg-slate-400" }
                                            : st === 0
                                                ? { label: "Out of stock", tone: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20", dot: "bg-red-500" }
                                                : mn > 0 && st <= mn
                                                    ? { label: "Low stock", tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20", dot: "bg-amber-500" }
                                                    : { label: `${st} units`, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20", dot: "bg-emerald-500" };
                                        const dateIn = effectiveDateIn(item);
                                        const ageStatus = getStockAgeStatus(dateIn);
                                        const conditionDisplay = getProductConditionDisplay(item);
                                        const averageUnitPrice = averageUnitPriceForLabel(item);
                                        const totalPrice = totalPriceForLabel(item);
                                        const showPrintLabel = canShowPrintLabel(item);
                                        const linkedProductRows = linkedProductsForLabel(item);
                                        const cellClass = "border-b border-slate-100 bg-white px-3 py-3 align-middle dark:border-white/10 dark:bg-slate-900";
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                                                {isColVisible("select") ? (
                                                    <td className={cellClass}>
                                                        <input type="checkbox" className="rounded border-slate-300" checked={selectedIds.has(item.id)} onChange={() => toggleRowSelect(item.id)} aria-label={`Select ${item.name}`} />
                                                    </td>
                                                ) : null}
                                                {isColVisible("products") ? (
                                                <td className={cellClass}>
                                                    <div className="flex w-full max-w-xl min-w-0 items-start gap-3 p-1">
                                                        <div className="group relative h-12 w-14 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => openChosenProducts(item)}
                                                                className={`relative h-12 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950 ${canOpenChosenProducts(item) ? "cursor-pointer hover:ring-2 hover:ring-emerald-400/25" : "cursor-default"}`}
                                                                title={canOpenChosenProducts(item) ? "Open chosen products" : undefined}
                                                                aria-label={canOpenChosenProducts(item) ? `Open chosen products for ${item.name || "item"}` : `${item.name || "item"} product image`}
                                                            >
                                                                {item.image_url ? (
                                                                    <img src={resolveImageUrl(item.image_url)} alt="" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="flex h-full w-full origin-center scale-[0.85] items-center justify-center">
                                                                        <Barcode value={barcodeVal} width={0.9} height={22} fontSize={8} margin={0} displayValue={false} format="CODE128" background="#ffffff" lineColor={isDark ? "#e2e8f0" : "#1e293b"} />
                                                                    </div>
                                                                )}
                                                            </button>
                                                            {!isReceivedLogPage ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(ev) => {
                                                                        ev.stopPropagation();
                                                                        openQuickRestockModal(item);
                                                                    }}
                                                                    className={BTN_QUICK_RESTOCK}
                                                                    title="Quick Restock"
                                                                    aria-label={`Quick restock ${item.name || "item"}`}
                                                                >
                                                                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" aria-hidden>
                                                                        <path d="M12 5v14M5 12h14" />
                                                                    </svg>
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openChosenProducts(item)}
                                                            className={`min-w-0 flex-1 rounded-lg border border-transparent text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30 ${canOpenChosenProducts(item) ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]" : "cursor-default"}`}
                                                        >
                                                            <div className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                                                                {item.name}
                                                            </div>
                                                            <div className="truncate font-mono text-xs text-[#8b857b] dark:text-slate-400">{barcodeVal}</div>
                                                            {batchRef ? (
                                                                <div className="truncate font-mono text-[10px] text-emerald-700 dark:text-emerald-400" title="Receive batch ref">
                                                                    {batchRef}
                                                                </div>
                                                            ) : null}
                                                        </button>
                                                    </div>
                                                </td>
                                                ) : null}
                                                {isColVisible("category") ? (
                                                <td className={cellClass} title={catLabel === "—" ? "" : catLabel}>
                                                    <span className="inline-flex max-w-[10rem] items-center rounded-full bg-[#F4EFE8] px-3 py-1.5 text-xs font-semibold text-[#6b4d24] ring-1 ring-[#ECE8DD] dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
                                                        <span className="truncate">{catLabel === "—" ? "-" : catLabel}</span>
                                                    </span>
                                                </td>
                                                ) : null}
                                                {isColVisible("condition") ? (
                                                <td className={`${cellClass} text-center`}>
                                                    {conditionDisplay.kind === "new" ? (
                                                        <span className={CONDITION_BADGE_NEW}>New</span>
                                                    ) : (
                                                        <span className={CONDITION_CHIP_SECOND_HAND} title={`Second-hand · ${conditionDisplay.saleLabel}`}>
                                                            <span className="whitespace-nowrap text-amber-900 dark:text-amber-100">Second-hand</span>
                                                            <span className="h-3.5 w-px shrink-0 bg-amber-400/70 dark:bg-amber-300/50" aria-hidden />
                                                            <span className="whitespace-nowrap rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200/80 dark:bg-sky-950/80 dark:text-sky-100 dark:ring-sky-400/40">
                                                                {conditionDisplay.saleLabel}
                                                            </span>
                                                        </span>
                                                    )}
                                                </td>
                                                ) : null}
                                                {isColVisible("origin") ? (
                                                <td className={`${cellClass} text-[13px] font-semibold text-slate-700 dark:text-slate-300`}>
                                                    {formatOriginLabel(item.origin)}
                                                </td>
                                                ) : null}
                                                {isColVisible("stock") ? (
                                                <td className={`${cellClass} text-center`}>
                                                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ring-1 ${stockBadge.tone}`}>
                                                        <span className={`h-2 w-2 rounded-full ${stockBadge.dot}`} aria-hidden />
                                                        {stockBadge.label}
                                                    </span>
                                                </td>
                                                ) : null}
                                                {isColVisible("dateIn") ? (
                                                <td className={`${cellClass} text-center tabular-nums`}>
                                                    {isReceivedLogPage ? (
                                                        <DateInCell item={item} showTime />
                                                    ) : (
                                                        <span
                                                            className="inline-block max-w-[11rem] text-[13px] font-semibold leading-snug text-slate-700 dark:text-slate-300"
                                                            title={formatDateInWithTime(item)}
                                                        >
                                                            {formatDateInWithTime(item)}
                                                        </span>
                                                    )}
                                                </td>
                                                ) : null}
                                                {isColVisible("status") ? (
                                                <td className={`${cellClass} text-center`}>
                                                    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${ageStatus.tone}`}>
                                                        {ageStatus.label}
                                                    </span>
                                                </td>
                                                ) : null}
                                                {isColVisible("priceUnit") ? (
                                                <td className={`${cellClass} text-right text-[15px] font-extrabold text-slate-900 tabular-nums dark:text-slate-100`}>
                                                    {averageUnitPrice != null ? `$${averageUnitPrice.toFixed(2)}` : "-"}
                                                </td>
                                                ) : null}
                                                {isColVisible("totalPrice") ? (
                                                <td
                                                    className={`${cellClass} text-right tabular-nums`}
                                                    title={totalPrice?.sourceCount ? `From ${totalPrice.sourceCount} linked product${totalPrice.sourceCount === 1 ? "" : "s"} · ${totalPrice.units} units` : totalPrice ? `${totalPrice.units} units` : ""}
                                                >
                                                    {totalPrice ? (
                                                        <div className="flex flex-col items-end leading-tight">
                                                            <span className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100">${totalPrice.amount.toFixed(2)}</span>
                                                            <span className="mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10">
                                                                {totalPrice.units} units
                                                            </span>
                                                        </div>
                                                    ) : "-"}
                                                </td>
                                                ) : null}
                                                {isColVisible("actions") ? (
                                                <td className={`${cellClass} text-right`}>
                                                    <div className="inline-flex items-center justify-end gap-1">
                                                        {showPrintLabel ? (
                                                            <button type="button" onClick={() => setPreviewItem(item)} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" title="Open label preview & print">
                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                                </svg>
                                                            </button>
                                                        ) : null}
                                                        <button type="button" onClick={() => navigate(`${stockBase}/${item.id}/edit`)} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10" title="Edit">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button type="button" onClick={() => del(item.id)} className="rounded-full border border-red-100 bg-red-50 p-2 text-red-600 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" title="Delete">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                                ) : null}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>

            {quickRestockItem && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={closeQuickRestockModal} aria-hidden />
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="quick-restock-title"
                        onSubmit={submitQuickRestock}
                        className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-950/[0.04] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.06]"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div className="border-b border-slate-200/90 px-5 py-4 dark:border-slate-700/90 sm:px-7">
                            <p className={QUICK_RESTOCK_MODAL_KICKER}>Quick Restock</p>
                            <h3 id="quick-restock-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                Receive stock
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add units to inventory and log a Stock Received batch.</p>
                        </div>
                        <div className="space-y-4 p-5 sm:p-7">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Product</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={quickRestockItem.name || ""}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Barcode</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={quickRestockItem.slug || slugify(quickRestockItem.name) || ""}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/90 px-3.5 font-mono text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quantity to receive *</label>
                                <input
                                    type="number"
                                    min={1}
                                    required
                                    autoFocus
                                    value={quickRestockForm.quantity}
                                    onChange={(e) => setQuickRestockForm((s) => ({ ...s, quantity: e.target.value }))}
                                    className={`${inputCls} px-3.5 font-semibold tabular-nums`}
                                    placeholder="e.g. 500"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Condition</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: "new", label: "New" },
                                        { value: "second_hand", label: "Second-hand" },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setQuickRestockForm((s) => ({
                                                ...s,
                                                product_condition: option.value,
                                                second_hand_sale_type: option.value === "second_hand" ? (s.second_hand_sale_type || "single") : "single",
                                            }))}
                                            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${quickRestockForm.product_condition === option.value
                                                ? QUICK_RESTOCK_OPTION_SELECTED
                                                : QUICK_RESTOCK_OPTION_IDLE
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {quickRestockForm.product_condition === "second_hand" ? (
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sale type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: "single", label: "Single" },
                                            { value: "average_bundle", label: "Average bundle" },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setQuickRestockForm((s) => ({ ...s, second_hand_sale_type: option.value }))}
                                                className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${quickRestockForm.second_hand_sale_type === option.value
                                                    ? QUICK_RESTOCK_OPTION_SELECTED
                                                    : QUICK_RESTOCK_OPTION_IDLE
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-slate-200/90 bg-slate-50/80 px-5 py-4 dark:border-slate-700/90 dark:bg-slate-950/50 sm:flex-row sm:justify-end sm:px-7">
                            <button
                                type="button"
                                onClick={closeQuickRestockModal}
                                disabled={quickRestockBusy}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={quickRestockBusy}
                                className={QUICK_RESTOCK_SUBMIT_BTN}
                            >
                                {quickRestockBusy ? "Saving…" : "Save & receive"}
                            </button>
                        </div>
                    </form>
                </div>,
                document.body,
            )}

            {linkedProductsItem && (() => {
                const linked = linkedProductsForLabel(linkedProductsItem);
                const canonicalLabel = resolveCanonicalLabel(linkedProductsItem);
                const titleCode = labelBarcodeForItem(linkedProductsItem) || slugify(canonicalLabel?.name) || "";
                const isReceiveBatch = linkedProductsItem.parent_id != null;
                const isAverageBundle = isAverageBundleLabel(linkedProductsItem);
                const receiptUnits = isReceiveBatch && !isAverageBundle
                    ? (effectiveRowStock(linkedProductsItem, true, rows) ?? 0)
                    : null;
                const catalogUnits = linked.reduce((sum, product) => {
                    const stock = Number(product?.stock);
                    return sum + (Number.isFinite(stock) ? Math.max(0, stock) : 0);
                }, 0);
                const unitsLabel = isAverageBundle
                    ? `${displayRowStock(linkedProductsItem) ?? averageBundleOnHandQuantity(linkedProductsItem)} units on hand`
                    : isReceiveBatch
                        ? `${receiptUnits} units in this receipt`
                        : `${catalogUnits} units`;
                return createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={closeChosenProducts} aria-hidden />
                        <div className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-950/[0.04] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.06]" role="dialog" aria-modal="true">
                            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/90 bg-white/90 px-5 py-4 backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-900/90 sm:px-7">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Chosen Products</p>
                                    <h3 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                        {canonicalLabel?.name || linkedProductsItem.name || "Stock label"}
                                    </h3>
                                    <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                                        {linkedProductsItem.parent_id != null ? (
                                            <>
                                                Receive batch: <span className="font-semibold text-slate-700 dark:text-slate-200">{linkedProductsItem.slug || "—"}</span>
                                                {" · "}Scan label: <span className="font-semibold text-slate-700 dark:text-slate-200">{titleCode || "—"}</span>
                                            </>
                                        ) : (
                                            <>
                                                Label barcode: <span className="font-semibold text-slate-700 dark:text-slate-200">{titleCode || "—"}</span>
                                            </>
                                        )}
                                        {" · "}{linked.length} product{linked.length === 1 ? "" : "s"} · {unitsLabel}
                                        {isReceiveBatch && !isAverageBundle && linked.length > 0 && catalogUnits !== receiptUnits ? (
                                            <span className="text-slate-400 dark:text-slate-500"> ({catalogUnits} in catalog)</span>
                                        ) : null}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {isReceivedLogPage ? (
                                        <button
                                            type="button"
                                            onClick={goToAddProductForBatch}
                                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-400 bg-emerald-500 px-3.5 text-sm font-bold text-white transition hover:bg-emerald-600"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add product
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={closeChosenProducts}
                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                        aria-label="Close"
                                    >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                                {linked.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
                                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                            {isReceiveBatch
                                                ? `No catalog products linked to this receive batch yet.${receiptUnits > 0 ? ` (${receiptUnits} units received — use Add first product below to list items for sale.)` : ""}`
                                                : "No POS products linked to this label yet."}
                                        </p>
                                        {isReceivedLogPage ? (
                                            <button
                                                type="button"
                                                onClick={goToAddProductForBatch}
                                                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Add first product
                                            </button>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[980px] border-collapse text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-white/5 dark:text-slate-400">
                                                        <th className="px-4 py-3">Product</th>
                                                        <th className="px-4 py-3">Barcode</th>
                                                        <th className="px-4 py-3">Category</th>
                                                        <th className="px-4 py-3 text-right">Price</th>
                                                        <th className="px-4 py-3 text-right">Stock</th>
                                                        <th className="w-28 px-4 py-3 text-center">Date in</th>
                                                        <th className="px-4 py-3 text-center">Status</th>
                                                        <th className="px-4 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {linked.map((product) => {
                                                        const productStock = Number(product?.stock);
                                                        const productPrice = Number(product?.price);
                                                        const productCategory = product?.category?.name || formatCategoryLabel(product?.category_id, categories);
                                                        return (
                                                            <tr key={product.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex min-w-0 items-center gap-3">
                                                                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                                                                            {product.image_url ? (
                                                                                <img src={resolveImageUrl(product.image_url)} alt="" className="h-full w-full object-cover" />
                                                                            ) : (
                                                                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-400">IMG</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{product.name || "Product"}</p>
                                                                            <p className="truncate text-xs font-semibold text-slate-400 dark:text-slate-500">{product.brand?.name || "No brand"}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{product.sku || "-"}</td>
                                                                <td className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">{productCategory === "—" ? "-" : productCategory}</td>
                                                                <td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                                                                    {Number.isFinite(productPrice) ? `$${productPrice.toFixed(2)}` : "-"}
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                                                                    {Number.isFinite(productStock) ? productStock : 0}
                                                                </td>
                                                                <td className="px-4 py-3 text-center tabular-nums">
                                                                    <DateInCell
                                                                        item={{
                                                                            date_in: product?.date_in ?? linkedProductsItem?.date_in,
                                                                            created_at: product?.created_at ?? linkedProductsItem?.created_at,
                                                                        }}
                                                                        showTime
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${product.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20" : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10"}`}>
                                                                        {product.is_active ? "Active" : "Inactive"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className="inline-flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setLinkedProductsItem(null);
                                                                                navigate(`/admin/products?edit=${product.id}`);
                                                                            }}
                                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/10"
                                                                            title="Edit product"
                                                                            aria-label={`Edit ${product.name || "product"}`}
                                                                        >
                                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => deleteLinkedProduct(product)}
                                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                                                                            title="Delete product"
                                                                            aria-label={`Delete ${product.name || "product"}`}
                                                                        >
                                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* ── Print Preview Modal ── */}
            {previewItem && canShowPrintLabel(previewItem) && (() => {
                const barcodeVal = previewItem.slug || slugify(previewItem.name) || "ITEM";
                const qrVal = `${window.location.origin}/category/${previewItem.slug || previewItem.id}`;
                const showBarcode = appearance.showBarcode !== false;
                const showQR = !!appearance.showQR;
                const codesDual = showBarcode && showQR;
                const rotateStyle = appearance.rotation ? { transform: `rotate(${appearance.rotation}deg)`, display: "inline-block" } : {};
                const TABS = ["Appearance", "Text", "Advanced"];
                const controlAccent = "var(--admin-primary)";
                const printForm = {
                    shell:
                        "relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[min(100%,56rem)] flex-col overflow-y-auto overflow-x-hidden rounded-3xl border border-slate-200/90 bg-white shadow-slate-900/10 ring-1 ring-slate-950/[0.04] dark:border-slate-700/90 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/[0.06] lg:overflow-hidden",
                    previewFrame:
                        "w-full overflow-visible rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-slate-100/90 p-5 dark:border-slate-700/80 dark:from-slate-800/50 dark:to-slate-900/40",
                    settingsCol:
                        "flex min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900/90 md:border-l md:border-slate-200/80 dark:md:border-slate-700/80",
                    tabWrap: "min-w-0 shrink-0 p-3 sm:p-4",
                    tabRail:
                        "flex min-w-0 flex-wrap gap-1 rounded-2xl border border-slate-200/60 bg-slate-100/90 p-1 dark:border-slate-700/60 dark:bg-slate-900/80 sm:flex-nowrap",
                    tabBtnOn:
                        "flex-1 rounded-xl bg-white py-2.5 text-center text-xs font-semibold text-slate-900 dark:bg-slate-700 dark:text-white sm:text-sm",
                    tabBtnOff:
                        "flex-1 rounded-xl py-2.5 text-center text-xs font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 sm:text-sm",
                    scroll: "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-3 sm:p-4 [scrollbar-gutter:stable]",
                    card: "divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/95",
                    strip:
                        "bg-slate-50/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800/70 dark:text-slate-400",
                    block: "px-4 py-3.5 sm:px-5",
                    label: "text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100",
                    hint: "mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400",
                    chip:
                        "rounded-lg border border-slate-200/80 bg-white px-2.5 py-0.5 font-mono text-xs tabular-nums text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
                    range: "mt-2 h-2 w-full cursor-pointer rounded-full",
                    select:
                        "mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.85)] dark:focus:bg-slate-900",
                    switchRow: "flex items-center justify-between gap-4",
                    switchBtn: "relative h-8 w-12 shrink-0 rounded-full transition-colors duration-200 ease-out",
                    switchKnob:
                        "pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full bg-white ring-1 ring-black/5 transition-transform duration-200 ease-out",
                };
                return createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setPreviewItem(null)} aria-hidden />
                        <div className={printForm.shell} role="dialog" aria-modal="true" aria-labelledby="bqr-print-title">

                            {/* Header */}
                            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/90 bg-white/80 px-5 py-4 backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-900/80 sm:px-7 sm:py-5">
                                <div className="min-w-0 space-y-1">
                                    <h3 id="bqr-print-title" className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                                        Print label
                                    </h3>
                                    <p className="max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                        Preview on the left, adjust options on the right, then print.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPreviewItem(null)}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    aria-label="Close"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Body — min-h-0 so the settings column can shrink and scroll */}
                            <div className="grid min-h-0 flex-1 divide-y divide-slate-200/90 dark:divide-slate-700/90 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:grid-rows-1 lg:divide-x lg:divide-y-0 lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">

                                {/* Left: live preview + print button */}
                                <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-y-contain p-5 sm:p-7">
                                    <div className={printForm.previewFrame}>
                                        <div className="mx-auto flex w-full max-w-full justify-center px-2 pb-3 pt-1 sm:px-3 sm:pb-4">
                                            <div
                                                ref={printRef}
                                                className="bqr-print-label flex w-full max-w-[96mm] flex-col rounded-xl border-2 border-slate-800 p-7 ring-1 ring-slate-900/[0.08] sm:p-8 dark:border-slate-600 dark:ring-white/[0.08]"
                                                style={{ backgroundColor: appearance.bgColor }}
                                            >
                                                {appearance.showName && (
                                                    <div className="bqr-print-top mb-4 flex flex-col gap-4 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                                                        <div className="bqr-print-info min-w-0 flex-1 space-y-2.5">
                                                            <span
                                                                className="bqr-print-sku inline-flex max-w-full items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.14em]"
                                                                style={{
                                                                    color: appearance.lineColor,
                                                                    borderColor: `${appearance.lineColor}40`,
                                                                    backgroundColor: `${appearance.lineColor}0d`,
                                                                }}
                                                            >
                                                                <span className="truncate">{previewItem.sku || "SKU"}</span>
                                                            </span>
                                                            <h2
                                                                className="text-[1.35rem] font-bold leading-snug tracking-tight sm:text-2xl"
                                                                style={{ color: appearance.lineColor }}
                                                            >
                                                                {previewItem.name}
                                                            </h2>
                                                            {previewItem.description && (
                                                                <p
                                                                    className="max-w-prose text-[11px] leading-relaxed sm:text-xs"
                                                                    style={{ color: appearance.lineColor, opacity: 0.72 }}
                                                                >
                                                                    {previewItem.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {appearance.showPrice && previewItem.price && (
                                                            <aside
                                                                className="bqr-print-price shrink-0 rounded-xl border px-4 py-3.5 sm:min-w-[8.25rem] sm:items-end sm:text-right"
                                                                style={{
                                                                    borderColor: `${appearance.lineColor}2e`,
                                                                    backgroundColor: `${appearance.lineColor}0a`,
                                                                }}
                                                            >
                                                                <p className="bqr-print-price-head" style={{ color: appearance.lineColor }}>
                                                                    Price
                                                                </p>
                                                                {previewItem.compare_at_price ? (
                                                                    <p className="bqr-print-price-was" style={{ color: appearance.lineColor }}>
                                                                        ${parseFloat(previewItem.compare_at_price).toFixed(2)}
                                                                    </p>
                                                                ) : null}
                                                                <p className="bqr-print-price-now" style={{ color: appearance.lineColor }}>
                                                                    ${parseFloat(previewItem.price).toFixed(2)}
                                                                </p>
                                                            </aside>
                                                        )}
                                                    </div>
                                                )}
                                                {(showBarcode || showQR) && (
                                                    <div
                                                        className={
                                                            codesDual
                                                                ? "bqr-print-codes mt-1 grid w-full grid-cols-1 gap-6 border-t pt-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-5 sm:pt-5"
                                                                : "bqr-print-codes bqr-print-codes--solo mt-1 grid w-full place-items-center gap-4 border-t pt-5 sm:pt-5"
                                                        }
                                                        style={{ borderColor: `${appearance.lineColor}2a` }}
                                                    >
                                                        {showBarcode && (
                                                            <section
                                                                className={
                                                                    codesDual
                                                                        ? "bqr-print-code-col flex min-w-0 flex-col items-center gap-2.5 border-b pb-6 sm:border-b-0 sm:pb-0"
                                                                        : "bqr-print-code-col flex min-w-0 flex-col items-center gap-2.5"
                                                                }
                                                                style={codesDual ? { borderColor: `${appearance.lineColor}26` } : undefined}
                                                            >
                                                                <p
                                                                    className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-55"
                                                                    style={{ color: appearance.lineColor }}
                                                                >
                                                                    Barcode
                                                                </p>
                                                                <div
                                                                    className="bqr-print-barcode-wrap flex w-full max-w-full justify-center overflow-x-auto rounded-lg px-1 py-0.5 [scrollbar-width:thin]"
                                                                    style={rotateStyle}
                                                                >
                                                                    <Barcode
                                                                        value={barcodeVal}
                                                                        format={appearance.format}
                                                                        width={appearance.width}
                                                                        height={appearance.height}
                                                                        margin={appearance.margin}
                                                                        fontSize={appearance.fontSize}
                                                                        displayValue={appearance.displayValue}
                                                                        background={appearance.bgColor}
                                                                        lineColor={appearance.lineColor}
                                                                    />
                                                                </div>
                                                            </section>
                                                        )}
                                                        {showBarcode && showQR && (
                                                            <div
                                                                aria-hidden
                                                                className="bqr-print-divider hidden w-px shrink-0 self-stretch sm:block sm:min-h-[7.5rem]"
                                                                style={{ backgroundColor: `${appearance.lineColor}40` }}
                                                            />
                                                        )}
                                                        {showQR && (
                                                            <section className="bqr-print-code-col flex min-w-0 flex-col items-center gap-2.5">
                                                                <p
                                                                    className="text-[10px] font-semibold uppercase tracking-[0.22em] opacity-55"
                                                                    style={{ color: appearance.lineColor }}
                                                                >
                                                                    QR code
                                                                </p>
                                                                <div
                                                                    className="bqr-print-qr-frame rounded-xl border p-2.5 "
                                                                    style={{
                                                                        borderColor: `${appearance.lineColor}38`,
                                                                        backgroundColor: appearance.bgColor,
                                                                    }}
                                                                >
                                                                    <QRCodeSVG
                                                                        value={qrVal}
                                                                        size={96}
                                                                        bgColor={appearance.bgColor}
                                                                        fgColor={appearance.lineColor}
                                                                        level="M"
                                                                    />
                                                                </div>
                                                            </section>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handlePrint}
                                        className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition hover:opacity-95 active:scale-[0.99] sm:text-base"
                                        style={{ backgroundColor: accentIsWhite ? "#0b0b0f" : accentColor }}
                                    >
                                        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Print label
                                    </button>
                                </div>

                                {/* Right: settings — single visual system (tabs + one list-style card per view) */}
                                <div className={printForm.settingsCol}>
                                    <div className={`${printForm.tabWrap} shrink-0 border-b border-slate-200/90 dark:border-slate-700/90`}>
                                        <div className={printForm.tabRail} role="tablist" aria-label="Label settings">
                                            {TABS.map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={activeTab === t}
                                                    onClick={() => setActiveTab(t)}
                                                    className={activeTab === t ? printForm.tabBtnOn : printForm.tabBtnOff}
                                                    style={
                                                        activeTab === t
                                                            ? { boxShadow: `0 1px 3px rgba(15,23,42,0.08), inset 0 0 0 1.5px ${controlAccent}55` }
                                                            : undefined
                                                    }
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={printForm.scroll}>
                                        {activeTab === "Appearance" && (
                                            <div className={printForm.card}>
                                                <div className={printForm.strip}>Barcode size</div>
                                                <div className={printForm.block}>
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <label className={printForm.label} htmlFor="bqr-print-width">
                                                            Width
                                                        </label>
                                                        <span className={printForm.chip}>{appearance.width}</span>
                                                    </div>
                                                    <input
                                                        id="bqr-print-width"
                                                        type="range"
                                                        min={1}
                                                        max={5}
                                                        step={0.5}
                                                        value={appearance.width}
                                                        onChange={(e) => setAppearance((s) => ({ ...s, width: parseFloat(e.target.value) }))}
                                                        className={printForm.range}
                                                        style={{ accentColor: controlAccent }}
                                                    />
                                                </div>
                                                <div className={printForm.block}>
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <label className={printForm.label} htmlFor="bqr-print-height">
                                                            Height
                                                        </label>
                                                        <span className={printForm.chip}>{appearance.height}</span>
                                                    </div>
                                                    <input
                                                        id="bqr-print-height"
                                                        type="range"
                                                        min={20}
                                                        max={200}
                                                        step={5}
                                                        value={appearance.height}
                                                        onChange={(e) => setAppearance((s) => ({ ...s, height: parseInt(e.target.value, 10) }))}
                                                        className={printForm.range}
                                                        style={{ accentColor: controlAccent }}
                                                    />
                                                </div>
                                                <div className={printForm.block}>
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <label className={printForm.label} htmlFor="bqr-print-margin">
                                                            Margin
                                                        </label>
                                                        <span className={printForm.chip}>{appearance.margin}</span>
                                                    </div>
                                                    <input
                                                        id="bqr-print-margin"
                                                        type="range"
                                                        min={0}
                                                        max={30}
                                                        step={1}
                                                        value={appearance.margin}
                                                        onChange={(e) => setAppearance((s) => ({ ...s, margin: parseInt(e.target.value, 10) }))}
                                                        className={printForm.range}
                                                        style={{ accentColor: controlAccent }}
                                                    />
                                                </div>

                                                <div className={printForm.strip}>Colors &amp; rotation</div>
                                                <div className={`${printForm.block} ${printForm.switchRow}`}>
                                                    <span className={printForm.label}>Line color</span>
                                                    <label className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full border-2 border-slate-200 transition hover:ring-2 hover:ring-slate-300/80 dark:border-slate-600 dark:hover:ring-slate-500/50">
                                                        <input
                                                            type="color"
                                                            value={appearance.lineColor}
                                                            onChange={(e) => setAppearance((s) => ({ ...s, lineColor: e.target.value }))}
                                                            className="absolute inset-0 h-16 w-16 -left-2 -top-2 cursor-pointer opacity-0"
                                                        />
                                                        <span className="absolute inset-0 rounded-full" style={{ backgroundColor: appearance.lineColor }} />
                                                    </label>
                                                </div>
                                                <div className={`${printForm.block} ${printForm.switchRow}`}>
                                                    <span className={printForm.label}>Background</span>
                                                    <label className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full border-2 border-slate-200 transition hover:ring-2 hover:ring-slate-300/80 dark:border-slate-600 dark:hover:ring-slate-500/50">
                                                        <input
                                                            type="color"
                                                            value={appearance.bgColor}
                                                            onChange={(e) => setAppearance((s) => ({ ...s, bgColor: e.target.value }))}
                                                            className="absolute inset-0 h-16 w-16 -left-2 -top-2 cursor-pointer opacity-0"
                                                        />
                                                        <span className="absolute inset-0 rounded-full" style={{ backgroundColor: appearance.bgColor }} />
                                                    </label>
                                                </div>
                                                <div className={printForm.block}>
                                                    <label className={printForm.label} htmlFor="bqr-print-rotation">
                                                        Rotation
                                                    </label>
                                                    <select
                                                        id="bqr-print-rotation"
                                                        value={appearance.rotation}
                                                        onChange={(e) => setAppearance((s) => ({ ...s, rotation: parseInt(e.target.value, 10) }))}
                                                        className={printForm.select}
                                                    >
                                                        <option value={0}>Normal (0°)</option>
                                                        <option value={90}>90°</option>
                                                        <option value={180}>180°</option>
                                                        <option value={270}>270°</option>
                                                    </select>
                                                </div>

                                                <div className={printForm.strip}>Options</div>
                                                <div className={`${printForm.block} ${printForm.switchRow}`}>
                                                    <div className="min-w-0 pr-2">
                                                        <p className={printForm.label}>Show barcode</p>
                                                        <p className={printForm.hint}>Scannable bars for this item code.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={showBarcode}
                                                        onClick={() => setAppearance((s) => ({ ...s, showBarcode: !(s.showBarcode !== false) }))}
                                                        className={`${printForm.switchBtn} ${showBarcode ? "" : "bg-slate-200 dark:bg-slate-700"}`}
                                                        style={showBarcode ? { backgroundColor: controlAccent } : undefined}
                                                    >
                                                        <span
                                                            className={`${printForm.switchKnob} ${showBarcode ? "translate-x-5" : "translate-x-0"}`}
                                                        />
                                                    </button>
                                                </div>
                                                <div className={`${printForm.block} ${printForm.switchRow}`}>
                                                    <div className="min-w-0 pr-2">
                                                        <p className={printForm.label}>Show QR code</p>
                                                        <p className={printForm.hint}>Store link beside the barcode when both are on.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={showQR}
                                                        onClick={() => setAppearance((s) => ({ ...s, showQR: !s.showQR }))}
                                                        className={`${printForm.switchBtn} ${showQR ? "" : "bg-slate-200 dark:bg-slate-700"}`}
                                                        style={showQR ? { backgroundColor: controlAccent } : undefined}
                                                    >
                                                        <span
                                                            className={`${printForm.switchKnob} ${showQR ? "translate-x-5" : "translate-x-0"}`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === "Text" && (
                                            <div className={printForm.card}>
                                                <div className={printForm.strip}>Typography</div>
                                                <div className={printForm.block}>
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <label className={printForm.label} htmlFor="bqr-print-fontsize">
                                                            Font size
                                                        </label>
                                                        <span className={printForm.chip}>{appearance.fontSize}px</span>
                                                    </div>
                                                    <input
                                                        id="bqr-print-fontsize"
                                                        type="range"
                                                        min={8}
                                                        max={24}
                                                        step={1}
                                                        value={appearance.fontSize}
                                                        onChange={(e) => setAppearance((s) => ({ ...s, fontSize: parseInt(e.target.value, 10) }))}
                                                        className={printForm.range}
                                                        style={{ accentColor: controlAccent }}
                                                    />
                                                </div>
                                                <div className={`${printForm.block} ${printForm.switchRow}`}>
                                                    <div className="min-w-0 pr-2">
                                                        <p className={printForm.label}>Show code text</p>
                                                        <p className={printForm.hint}>Readable line under the bars.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={appearance.displayValue}
                                                        onClick={() => setAppearance((s) => ({ ...s, displayValue: !s.displayValue }))}
                                                        className={`${printForm.switchBtn} ${appearance.displayValue ? "" : "bg-slate-200 dark:bg-slate-700"}`}
                                                        style={appearance.displayValue ? { backgroundColor: controlAccent } : undefined}
                                                    >
                                                        <span
                                                            className={`${printForm.switchKnob} ${appearance.displayValue ? "translate-x-5" : "translate-x-0"}`}
                                                        />
                                                    </button>
                                                </div>
                                                <div className={`${printForm.block} ${printForm.switchRow}`}>
                                                    <div className="min-w-0 pr-2">
                                                        <p className={printForm.label}>Show name &amp; price</p>
                                                        <p className={printForm.hint}>Title block above the barcode.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={appearance.showName}
                                                        onClick={() => setAppearance((s) => ({ ...s, showName: !s.showName }))}
                                                        className={`${printForm.switchBtn} ${appearance.showName ? "" : "bg-slate-200 dark:bg-slate-700"}`}
                                                        style={appearance.showName ? { backgroundColor: controlAccent } : undefined}
                                                    >
                                                        <span
                                                            className={`${printForm.switchKnob} ${appearance.showName ? "translate-x-5" : "translate-x-0"}`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === "Advanced" && (
                                            <div className={printForm.card}>
                                                <div className={printForm.strip}>Encoding</div>
                                                <div className={printForm.block}>
                                                    <label className={`${printForm.label} mb-2 block`} htmlFor="bqr-print-format">
                                                        Barcode format
                                                    </label>
                                                    <select
                                                        id="bqr-print-format"
                                                        value={appearance.format}
                                                        onChange={(e) => setAppearance((s) => ({ ...s, format: e.target.value }))}
                                                        className={`${printForm.select} !mt-0`}
                                                    >
                                                        <option value="CODE128">CODE 128 — any text</option>
                                                        <option value="CODE39">CODE 39 — alphanumeric</option>
                                                        <option value="EAN13">EAN-13 — 12 digits</option>
                                                        <option value="EAN8">EAN-8 — 7 digits</option>
                                                        <option value="UPC">UPC-A — 11 digits</option>
                                                        <option value="ITF14">ITF-14 — 14 digits</option>
                                                        <option value="pharmacode">Pharmacode — numeric</option>
                                                        <option value="codabar">Codabar</option>
                                                    </select>
                                                    <p className={`${printForm.hint} mt-2`}>
                                                        EAN / UPC need numeric codes that match length rules.
                                                    </p>
                                                </div>
                                                <div className={printForm.block}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })}
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/90 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
                                                    >
                                                        Reset to defaults
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body,
                );
            })()}
        </div>
    );
}
