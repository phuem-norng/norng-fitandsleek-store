import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2Icon,
  LayoutGridIcon,
  ListIcon,
  Link2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { useTheme } from "../../state/theme.jsx";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import { resolveImageUrl } from "../../lib/images";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import ProductDetailDrawer from "../../components/admin/ProductDetailDrawer.jsx";
import AdminSortMenu from "../../components/admin/AdminSortMenu.jsx";
import BrandCreateForm from "../../components/admin/BrandCreateForm.jsx";
import CategoryCreateForm from "../../components/admin/CategoryCreateForm.jsx";
import FieldWithQuickCreate, { CreateNewSelectOption, QUICK_CREATE_OPTION } from "../../components/admin/FieldWithQuickCreate.jsx";
import { CatalogPricingReadOnly } from "../../components/admin/CatalogPricingFields.jsx";
import StockLabelCreateForm from "../../components/admin/StockLabelCreateForm.jsx";
import SupplierCreateForm from "../../components/admin/SupplierCreateForm.jsx";
import VariantBarcodeFields from "../../components/admin/VariantBarcodeFields.jsx";
import { DEFAULT_VARIANT_BARCODE_FORMAT } from "../../lib/variantBarcode.js";
import AdminFilterDrawer, { AdminFilterToolbarButton } from "../../components/admin/AdminFilterDrawer.jsx";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import { sliceAdminListPage } from "../../lib/adminListQuery.js";
import { matchesSection } from "../../lib/adminListFilters.js";
import { recordMatchesYearMonth } from "../../lib/adminYearMonthFilter.js";
import { useAdminFilterDrawer } from "../../lib/useAdminFilterDrawer.js";
import { useAdminYearMonthFilter } from "../../lib/useAdminYearMonthFilter.js";
import { AdminContentSkeleton, AdminDashboardLoader, AdminSectionLoader } from "@/components/admin/AdminLoading";
import { adminReturnToFromSearch } from "../../lib/adminReturnNav.js";
import {
  buildPoLineDefaultsFromProductCreate,
  enrichProductForPoList,
  PO_APPLY_KEY,
  PO_RETURN_LINE_KEY,
} from "../../lib/poCreateBridge.js";
import {
  buildVariantMatrixRowsFromGrid,
  parseVariantMatrix,
  stockTotalFromVariantUiRows,
  variantMatrixPayloadFromUiRows,
  variantMatrixTotalQty,
} from "../../lib/variantMatrix.js";
import {
  buildAllColumnsVisibility,
  loadTableColumnVisibility,
  TableColumnVisibilityMenu,
} from "../../components/admin/TableColumnVisibilityMenu.jsx";
import {
  BARCODE_QR_TYPE,
  buildProductStockBarcodePickerOptions,
  findStockLabelById,
  formatStockBarcodePickerLabel,
  labelPricePoolForProduct,
} from "../../lib/stockLabelReceipts";
import {
  buildProductGroups,
  loadProductSortPrefs,
  saveProductSortPrefs,
  sortProducts,
} from "../../lib/productSort.js";
import { formatCatalogLotMoney } from "../../lib/catalogLotPricing.js";

const PRODUCTS_TABLE_COLUMNS = [
  { id: "select", label: "Select" },
  { id: "productName", label: "Product Name" },
  { id: "brand", label: "Brand" },
  { id: "category", label: "Category" },
  { id: "costPrice", label: "Cost/unit" },
  { id: "sellPrice", label: "Sell price" },
  { id: "totalStock", label: "Total Stock" },
  { id: "sizes", label: "Sizes available" },
  { id: "colors", label: "Colors available" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Action" },
];

const PRODUCTS_COLUMNS_STORAGE_KEY = "fitandsleek-products-columns-v2";
const PRODUCTS_SORT_STORAGE_KEY = "fitandsleek-products-sort";

const EMPTY_TABLE_CELL = "-";

const FILTER_NONE = "__none__";

function formatProductMoney(value) {
  if (value == null || value === "") return EMPTY_TABLE_CELL;
  const n = Number(value);
  if (Number.isNaN(n)) return EMPTY_TABLE_CELL;
  return `$${n.toFixed(2)}`;
}

function formatProductCatalogCost(product) {
  return product?.pricing_source === "inventory_lot"
    ? formatCatalogLotMoney(product, "cost")
    : formatProductMoney(product?.cost_price);
}

function formatProductCatalogSell(product) {
  return product?.pricing_source === "inventory_lot"
    ? formatCatalogLotMoney(product, "sell")
    : formatProductMoney(product?.price);
}

function requiredFieldMark() {
  return (
    <span className="ml-0.5 text-red-500" aria-hidden>
      *
    </span>
  );
}

function hasProductCoverPhoto(imageUrl) {
  return Boolean(String(imageUrl ?? "").trim());
}

function sizesAvailableLabel(rawSizes) {
  if (Array.isArray(rawSizes)) {
    const list = rawSizes.map((s) => String(s).trim()).filter(Boolean);
    return list.length ? list.join(", ") : EMPTY_TABLE_CELL;
  }
  if (typeof rawSizes === "string" && rawSizes.trim()) {
    const list = rawSizes.split(",").map((s) => s.trim()).filter(Boolean);
    return list.length ? list.join(", ") : EMPTY_TABLE_CELL;
  }
  return EMPTY_TABLE_CELL;
}

function totalStockForProduct(product) {
  if (!product) return 0;
  const matrixRows = parseVariantMatrix(product.variant_matrix);
  if (matrixRows.length > 0) return variantMatrixTotalQty(product.variant_matrix);
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function colorsAvailableLabel(rawColors) {
  if (rawColors == null || rawColors === "") return EMPTY_TABLE_CELL;
  if (typeof rawColors === "string") {
    const list = rawColors.split(",").map((s) => s.trim()).filter(Boolean);
    return list.length ? list.join(", ") : EMPTY_TABLE_CELL;
  }
  if (!Array.isArray(rawColors)) return EMPTY_TABLE_CELL;
  const seen = new Set();
  const names = [];
  for (const item of rawColors) {
    const n = typeof item === "string"
      ? item.trim()
      : String(item?.name ?? item?.label ?? "").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(n);
  }
  return names.length ? names.join(", ") : EMPTY_TABLE_CELL;
}

function brandNameForProduct(product) {
  const name = String(product?.brand?.name ?? "").trim();
  return name || EMPTY_TABLE_CELL;
}

const tableCellTextClass = (value, { mono = false } = {}) => {
  const isEmpty = value === EMPTY_TABLE_CELL;
  if (isEmpty) {
    return "text-xs text-slate-500 dark:text-slate-400 font-mono";
  }
  return mono
    ? "text-xs font-mono text-slate-600 dark:text-slate-300"
    : "text-xs text-slate-600 dark:text-slate-300";
};

const gridMetaTextClass = (value, { mono = false } = {}) => {
  const isEmpty = value === EMPTY_TABLE_CELL;
  if (isEmpty) {
    return "text-[10px] font-mono text-slate-400 dark:text-slate-500";
  }
  return mono
    ? "text-[10px] font-mono text-slate-500 dark:text-slate-400"
    : "text-[10px] text-slate-500 dark:text-slate-400";
};

function newColorRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newMatrixRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanSkuBarcodePart(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function sanitizeStockBarcodeInput(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 30);
}

function generateProductSku(productName) {
  const base = cleanSkuBarcodePart(productName) || "PRODUCT";
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${base}-${Date.now().toString(36).toUpperCase().slice(-5)}${random}`.slice(0, 60);
}

/** Unique color names from swatch rows for variant-stock datalist (first spelling wins). */
function uniqueColorNamesFromSwatchRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const n = String(r?.name ?? "").trim();
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

/** Colors for variant-stock dropdown — only names defined under “Colors”, never stale matrix values. */
function variantStockColorPicklist(swatchRows) {
  return uniqueColorNamesFromSwatchRows(swatchRows);
}

function productTypeLabelFromInferred(inferred) {
  if (inferred === "shoes") return "Shoes";
  if (inferred === "clothes") return "Clothes";
  if (inferred === "bag" || inferred === "bags") return "Bags";
  if (inferred === "hat" || inferred === "hats") return "Hats";
  if (inferred === "accessory") return "Accessories";
  return "Other";
}

/** Clear matrix row `color` when it no longer exists in swatch rows (case-insensitive). */
function pruneVariantMatrixColorsToSwatches(matrixUiRows, swatchRows) {
  const allowed = new Set(uniqueColorNamesFromSwatchRows(swatchRows).map((n) => String(n).toLowerCase()));
  return (matrixUiRows || []).map((row) => {
    const c = String(row?.color ?? "").trim();
    if (!c || !allowed.has(c.toLowerCase())) return { ...row, color: "" };
    return row;
  });
}

/** First matching swatch `image_url` for a color name (case-insensitive). */
function swatchImageUrlForColorName(swatchRows, name) {
  const want = String(name ?? "").trim().toLowerCase();
  if (!want) return "";
  for (const r of swatchRows || []) {
    const n = String(r?.name ?? "").trim();
    if (n.toLowerCase() !== want) continue;
    return String(r?.image_url ?? "").trim();
  }
  return "";
}

/**
 * Custom color picker for variant matrix rows — a plain select element cannot show thumbnails.
 */
function VariantMatrixColorSelect({
  swatchRows,
  picklist,
  value,
  onChange,
  disabled,
  id,
  emptyLabel,
  orphanValue,
  orphanLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hasOptions = Array.isArray(picklist) && picklist.length > 0;
  const disabledCtl = disabled || !hasOptions;
  const displayVal = String(value ?? "").trim();
  const thumbSrc = displayVal ? swatchImageUrlForColorName(swatchRows, displayVal) : "";
  const resolvedThumb = thumbSrc ? resolveImageUrl(thumbSrc) : "";

  const baseBtn =
    "flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm outline-none transition hover:bg-slate-50/80 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800/80";
  const rowBtn =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800";

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        type="button"
        id={id}
        disabled={disabledCtl}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabledCtl && setOpen((o) => !o)}
        className={baseBtn}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {displayVal ? (
            <>
              {resolvedThumb ? (
                <img src={resolvedThumb} alt="" className="h-8 w-8 shrink-0 rounded-md border border-slate-200/80 object-cover dark:border-slate-600" />
              ) : (
                <span
                  className="h-8 w-8 shrink-0 rounded-md border border-dashed border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700"
                  aria-hidden
                  title="No swatch image"
                />
              )}
              <span className="truncate font-medium">{displayVal}</span>
            </>
          ) : (
            <span className="truncate text-slate-500 dark:text-slate-400">{emptyLabel}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && hasOptions ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!displayVal}
              className={rowBtn}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <span className="h-8 w-8 shrink-0 rounded-md border border-slate-200/60 bg-slate-50 dark:border-slate-600 dark:bg-slate-800" aria-hidden />
              <span className="truncate text-slate-500 dark:text-slate-400">{emptyLabel}</span>
            </button>
          </li>
          {picklist.map((name) => {
            const n = String(name);
            const u = swatchImageUrlForColorName(swatchRows, n);
            const src = u ? resolveImageUrl(u) : "";
            const selected = displayVal.toLowerCase() === n.trim().toLowerCase();
            return (
              <li key={n} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${rowBtn} ${selected ? "bg-[rgba(var(--admin-primary-rgb),0.1)] dark:bg-[rgba(var(--admin-primary-rgb),0.15)]" : ""}`}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                >
                  {src ? (
                    <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-md border border-slate-200/80 object-cover dark:border-slate-600" />
                  ) : (
                    <span
                      className="h-8 w-8 shrink-0 rounded-md border border-dashed border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700"
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{n}</span>
                </button>
              </li>
            );
          })}
          {orphanValue && orphanLabel ? (
            <li role="none">
              <button
                type="button"
                role="option"
                aria-selected={displayVal.toLowerCase() === String(orphanValue).trim().toLowerCase()}
                className={`${rowBtn} border-t border-slate-100 dark:border-slate-800`}
                onClick={() => {
                  onChange(String(orphanValue));
                  setOpen(false);
                }}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-md border border-dashed border-amber-300/80 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/40"
                  aria-hidden
                />
                <span className="truncate text-amber-900 dark:text-amber-100">{orphanLabel}</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/** UI rows for color swatches only (name + optional image). Stock lives on Color × Size matrix. */
function colorVariantRowsFromApi(raw) {
  const emptyRow = () => [{ id: newColorRowId(), name: "", image_url: "" }];
  if (raw == null || raw === "") return emptyRow();
  if (typeof raw === "string") {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return emptyRow();
    return parts.map((name) => ({ id: newColorRowId(), name, image_url: "" }));
  }
  if (!Array.isArray(raw) || raw.length === 0) return emptyRow();
  const rows = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const n = item.trim();
      if (n) rows.push({ id: newColorRowId(), name: n, image_url: "" });
    } else if (item && typeof item === "object") {
      const name = String(item.name ?? item.label ?? "").trim();
      const image_url = String(item.image_url ?? item.imageUrl ?? "").trim();
      if (name || image_url) rows.push({ id: newColorRowId(), name, image_url });
    }
  }
  return rows.length ? rows : emptyRow();
}

function productColorsPayloadFromRows(rows) {
  return rows
    .map((r) => ({
      name: String(r?.name ?? "").trim(),
      image_url: (() => {
        const u = String(r?.image_url ?? "").trim();
        return u || null;
      })(),
    }))
    .filter((r) => r.name);
}

function emptyVariantMatrixRow() {
  return {
    id: newMatrixRowId(),
    color: "",
    size: "",
    qty: "",
    sku_barcode: "",
    barcode_format: DEFAULT_VARIANT_BARCODE_FORMAT,
  };
}

function variantMatrixRowsFromApi(raw) {
  const empty = () => [emptyVariantMatrixRow()];
  const m = parseVariantMatrix(raw);
  if (m.length === 0) return empty();
  return m.map((r) => ({
    id: newMatrixRowId(),
    color: r.color,
    size: r.size,
    qty: String(r.qty),
    sku_barcode: String(r.sku_barcode ?? "").trim(),
    barcode_format: r.barcode_format || DEFAULT_VARIANT_BARCODE_FORMAT,
  }));
}

export default function AdminProducts({
  embeddedInPo = false,
  embeddedOpen = false,
  embeddedOnCreated,
  embeddedOnClose,
  embeddedSupplierId = null,
} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /** Where to go after create/edit cancel or save (e.g. stock-inventory chosen label). */
  const adminReturnToRef = useRef(null);

  const captureAdminReturnTo = (search) => {
    const path = adminReturnToFromSearch(search);
    if (path) adminReturnToRef.current = path;
  };

  const finishAdminProductFlow = () => {
    const back = adminReturnToRef.current;
    if (!back) return false;
    adminReturnToRef.current = null;
    navigate(back);
    return true;
  };
  const { refresh: refreshAuth } = useAuth();
  const { can } = useAdminPermissions();
  const canCreateProducts = can("products", "create");
  const canEditProducts = can("products", "edit");
  const canDeleteProducts = can("products", "delete");
  const canCreateCategories = can("categories", "create");
  const canCreateBrands = can("brands", "create");
  const canUploadProductMedia = canCreateProducts || canEditProducts;
  const { primaryColor, mode } = useTheme();
  const { settings: homepageSettings } = useHomepageSettings();
  const isDark = mode === "dark";
  const accentColor = primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
  const deleteButtonStyle = {
    backgroundColor: isDark ? "rgba(127, 29, 29, 0.22)" : "#fef2f2",
    color: isDark ? "#fecdd3" : "#991b1b",
    border: `1px solid ${isDark ? "rgba(248, 113, 113, 0.45)" : "#fecdd3"}`,
    borderRadius: "5px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.35rem",
    padding: "0.45rem 0.75rem",
    fontWeight: 600,
    fontSize: "0.875rem",
    transition: "all 150ms ease",
  };

  const deleteIconButtonStyle = {
    ...deleteButtonStyle,
    width: "2.5rem",
    height: "2.5rem",
    padding: "0.5rem",
    fontWeight: 500,
  };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", cost_price: "", stock: "", allocated_stock: "", category_id: "", brand_id: "", supplier_id: "", image_url: "", gender: "", is_active: true, has_variants: true,
    model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: ""
  });
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [animate, setAnimate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useState("");
  const listFilters = useAdminFilterDrawer(["stock", "gender", "section", "category", "stockName", "supplier"]);
  const yearMonthFilter = useAdminYearMonthFilter(2020);
  const [selectedIds, setSelectedIds] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState(() =>
    loadTableColumnVisibility(PRODUCTS_COLUMNS_STORAGE_KEY, PRODUCTS_TABLE_COLUMNS),
  );
  const [viewMode, setViewMode] = useState("list");
  const [listPage, setListPage] = useState(1);
  const [productSort, setProductSort] = useState(() => loadProductSortPrefs(PRODUCTS_SORT_STORAGE_KEY));
  const [editGalleryError, setEditGalleryError] = useState("");
  const addImageModalFileInputRef = useRef(null);
  const createCoverFileInputRef = useRef(null);
  const createGalleryFileInputRef = useRef(null);
  /** @type {React.MutableRefObject<{ slotIndex: number } | null>} */
  const createGalleryUploadTargetRef = useRef(null);
  const [createPhotoActiveSlot, setCreatePhotoActiveSlot] = useState(0);
  /** Fixed gallery slots (create product only); synced to `form.gallery` as compact newline string for submit. */
  const [createGallerySlotUrls, setCreateGallerySlotUrls] = useState(() => Array.from({ length: 4 }, () => ""));
  const [createColorVariants, setCreateColorVariants] = useState(() => [{ id: newColorRowId(), name: "", image_url: "" }]);
  const [createVariantMatrix, setCreateVariantMatrix] = useState(() => [emptyVariantMatrixRow()]);
  const [editVariantMatrix, setEditVariantMatrix] = useState(() => [emptyVariantMatrixRow()]);
  /** Same slot layout as create; synced to `editing.gallery` while the edit modal is open. */
  const [editPhotoActiveSlot, setEditPhotoActiveSlot] = useState(0);
  const [editGallerySlotUrls, setEditGallerySlotUrls] = useState(() => Array.from({ length: 4 }, () => ""));
  const editGallerySlotFileInputRef = useRef(null);
  const editGallerySlotUploadTargetRef = useRef(null);
  const createColorFileInputRef = useRef(null);
  /** Stable row `id` set when opening the color swatch file picker (avoids wrong row if indices shift while dialog is open). */
  const createColorUploadRowIdRef = useRef(null);
  const editColorFileInputRef = useRef(null);
  const editColorUploadRowIdRef = useRef(null);
  const [imageUrlPicker, setImageUrlPicker] = useState(null);
  const [imageUrlPickerDraft, setImageUrlPickerDraft] = useState("");
  const [productType, setProductType] = useState("Clothes");
  const [customSize, setCustomSize] = useState("");
  const [editProductType, setEditProductType] = useState("Clothes");
  const [editCustomSize, setEditCustomSize] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  /** @type {[Record<string, boolean> & { variantRows?: Record<string, Record<string, boolean>> }, Function]} */
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [imageUrlPickerError, setImageUrlPickerError] = useState("");
  const [addImageModalDragging, setAddImageModalDragging] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  /** @type {[{ type: 'category'|'brand'|'supplier'|'stockLabel', target: 'create'|'edit' } | null, Function]} */
  const [quickCreate, setQuickCreate] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);

  const isProductRowClickTarget = (target) => Boolean(
    target?.closest?.("button, input, a, label, [data-stop-row-click]"),
  );

  const openProductDetail = (product) => setDetailProduct(product);
  const closeProductDetail = () => setDetailProduct(null);

  const handleProductRowClick = (product) => (event) => {
    if (isProductRowClickTarget(event.target)) return;
    openProductDetail(product);
  };

  const closeCreateForm = () => {
    if (isCreating) return;
    setCreateFieldErrors({});
    setShowCreateForm(false);
    if (embeddedInPo) {
      embeddedOnClose?.();
      return;
    }
    finishAdminProductFlow();
  };

  const createLabelClass = (key, size = "md") => {
    const invalid = Boolean(createFieldErrors[key]);
    if (size === "xs") {
      return invalid
        ? "mb-1 block text-xs font-medium text-red-600 dark:text-red-400"
        : "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";
    }
    return invalid
      ? "mb-1.5 block text-sm font-medium text-red-600 dark:text-red-400"
      : "mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200";
  };

  const createVariantRowErrors = (rowId) => createFieldErrors.variantRows?.[rowId] || {};

  const createVariantSubLabelClass = (invalid) =>
    invalid
      ? "mb-1 block text-xs font-medium text-red-600 dark:text-red-400"
      : "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

  const createInputErrorClass = (invalid) =>
    invalid ? " border-red-500 focus:border-red-500 focus:ring-red-200/60 dark:border-red-500 dark:focus:ring-red-900/40" : "";

  const clearCreateFieldError = (key, rowId = null, subKey = null) => {
    setCreateFieldErrors((prev) => {
      if (rowId != null && subKey) {
        const rows = prev.variantRows;
        if (!rows?.[rowId]?.[subKey]) return prev;
        const nextRows = { ...rows };
        const row = { ...nextRows[rowId] };
        delete row[subKey];
        if (Object.keys(row).length === 0) delete nextRows[rowId];
        else nextRows[rowId] = row;
        const next = { ...prev };
        if (Object.keys(nextRows).length === 0) {
          delete next.variantRows;
          delete next.variantStock;
        } else {
          next.variantRows = nextRows;
        }
        return next;
      }
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateCreateProductForm = () => {
    const errors = {};
    const messages = [];

    if (!String(form.brand_id || "").trim()) {
      errors.brand_id = true;
      messages.push("Brand is required.");
    }

    if (!hasProductCoverPhoto(form.image_url)) {
      errors.photos = true;
      messages.push("Product cover photo is required.");
    }

    const colorNames = uniqueColorNamesFromSwatchRows(createColorVariants);
    if (colorNames.length === 0) {
      errors.colors = true;
      messages.push("At least one color is required.");
    }

    const sizes = normalizeSizes(form.sizes);
    if (sizes.length === 0) {
      errors.sizes = true;
      messages.push("At least one size is required.");
    }

    return {
      ok: messages.length === 0,
      errors,
      detail: messages[0] || "Please fill in all required fields.",
    };
  };

  const buildCreateVariantMatrixPayload = () => {
    const colorNames = uniqueColorNamesFromSwatchRows(createColorVariants);
    const sizes = normalizeSizes(form.sizes);
    if (colorNames.length === 0 || sizes.length === 0) return null;
    const { rows } = buildVariantMatrixRowsFromGrid(
      colorNames,
      sizes,
      createVariantMatrix,
      newMatrixRowId,
    );
    const pruned = pruneVariantMatrixColorsToSwatches(rows, createColorVariants);
    const payload = variantMatrixPayloadFromUiRows(pruned);
    return payload.length ? payload : null;
  };

  const editLabelClass = (key, size = "md") => {
    const invalid = Boolean(editFieldErrors[key]);
    if (size === "xs") {
      return invalid
        ? "mb-1 block text-xs font-medium text-red-600 dark:text-red-400"
        : "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";
    }
    return invalid
      ? "mb-1.5 block text-sm font-medium text-red-600 dark:text-red-400"
      : "mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200";
  };

  const clearEditFieldError = (key) => {
    setEditFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateEditProductForm = () => {
    const errors = {};
    const messages = [];

    if (!String(editing?.brand_id || "").trim()) {
      errors.brand_id = true;
      messages.push("Brand is required.");
    }

    if (!hasProductCoverPhoto(editing?.image_url)) {
      errors.photos = true;
      messages.push("Product cover photo is required.");
    }

    const editSwatches = Array.isArray(editing?.colors) ? editing.colors : [];
    const colorNames = uniqueColorNamesFromSwatchRows(editSwatches);
    if (colorNames.length === 0) {
      errors.colors = true;
      messages.push("At least one color is required.");
    }

    const sizes = normalizeSizes(editing?.sizes);
    if (sizes.length === 0) {
      errors.sizes = true;
      messages.push("At least one size is required.");
    }

    return {
      ok: messages.length === 0,
      errors,
      detail: messages[0] || "Please fill in all required fields.",
    };
  };

  const buildEditVariantMatrixPayload = () => {
    const editSwatches = Array.isArray(editing?.colors) ? editing.colors : [];
    const colorNames = uniqueColorNamesFromSwatchRows(editSwatches);
    const sizes = normalizeSizes(editing?.sizes);
    if (colorNames.length === 0 || sizes.length === 0) return null;
    const { rows } = buildVariantMatrixRowsFromGrid(
      colorNames,
      sizes,
      editVariantMatrix,
      newMatrixRowId,
    );
    const pruned = pruneVariantMatrixColorsToSwatches(rows, editSwatches);
    const payload = variantMatrixPayloadFromUiRows(pruned);
    return payload.length ? payload : null;
  };

  const closeEditForm = () => {
    setEditing(null);
    setEditFieldErrors({});
    finishAdminProductFlow();
  };

  const getValidationMessage = (error) => {
    const responseMessage = error?.response?.data?.message;
    const errors = error?.response?.data?.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors).flat().find(Boolean);
      return first || responseMessage || "Validation failed.";
    }
    return responseMessage || error?.message || "Create failed.";
  };

  const PRODUCT_TYPES = ["Clothes", "Shoes", "Bags", "Hats", "Accessories", "Other"];

  const SIZE_PRESETS = {
    clothes: ["XS", "S", "M", "L", "XL", "XXL"],
    shoes: ["38", "39", "40", "41", "42", "43"],
    bag: ["10L", "15L", "20L", "25L", "30L", "35L", "40L", "45L", "50L+"],
    bags: ["10L", "15L", "20L", "25L", "30L", "35L", "40L", "45L", "50L+"],
    hat: ["S (54-55 cm)", "M (56-57 cm)", "L (58-59 cm)", "XL (60-61 cm)", "XXL (62-63 cm)", "OSFM (55-61 cm)"],
    hats: ["S (54-55 cm)", "M (56-57 cm)", "L (58-59 cm)", "XL (60-61 cm)", "XXL (62-63 cm)", "OSFM (55-61 cm)"],
    accessory: ["One Size", "Free Size"],
    other: [],
  };

  const normalizeSizes = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string") {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  const normalizeType = (value) => String(value || "").toLowerCase().trim();

  const inferTypeFromCategory = (category) => {
    if (!category) return "";
    if (category.type) {
      const type = normalizeType(category.type);
      if (type === "bag" || type === "bags") return "bag";
      if (type === "hat" || type === "hats" || type === "cap" || type === "caps") return "hat";
      return type;
    }
    const name = normalizeType(category.name);
    if (name.includes("shoe") || name.includes("sneaker") || name.includes("boot")) return "shoes";
    if (name.includes("shirt") || name.includes("dress") || name.includes("clothe") || name.includes("apparel")) return "clothes";
    if (name.includes("belt")) return "belt";
    if (name.includes("hat") || name.includes("cap")) return "hat";
    if (name.includes("bag")) return "bag";
    return "";
  };

  const getSizePreset = (typeKey) => SIZE_PRESETS[typeKey] || [];

  const formatSupplierOptionLabel = (supplier) => {
    const name = String(supplier?.name || "Supplier").trim();
    const code = String(supplier?.supplier_code || "").trim();
    return code ? `${name}. ${code}` : name;
  };

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.is_active !== false),
    [suppliers],
  );

  const stockNameForProduct = (product) => {
    const id = product?.stock_label_id;
    if (id != null && id !== "") {
      const byId = categories.find(
        (c) => String(c.id) === String(id) && normalizeType(c.type) === BARCODE_QR_TYPE,
      );
      if (byId) {
        const name = String(byId.name || "").trim();
        return name || EMPTY_TABLE_CELL;
      }
    }
    return EMPTY_TABLE_CELL;
  };

  const supplierIdForProduct = (product) => {
    const code = product?.supplier?.supplier_code
      || suppliers.find((s) => String(s.id) === String(product?.supplier_id))?.supplier_code;
    return code ? String(code).trim() : EMPTY_TABLE_CELL;
  };

  const stockLabelKeyForProduct = (product) => {
    const id = product?.stock_label_id;
    if (id != null && id !== "") {
      const byId = categories.find(
        (c) => String(c.id) === String(id) && normalizeType(c.type) === BARCODE_QR_TYPE,
      );
      if (byId) return String(byId.id);
    }
    return "";
  };

  const supplierKeyForProduct = (product) => {
    if (product?.supplier_id != null && product?.supplier_id !== "") {
      return String(product.supplier_id);
    }
    return "";
  };

  const catalogCategories = useMemo(
    () => categories.filter((c) => normalizeType(c.type) !== BARCODE_QR_TYPE),
    [categories]
  );

  /** One dropdown row per stock inventory master (link by id, not barcode). */
  const stockBarcodePickerOptions = useMemo(
    () => buildProductStockBarcodePickerOptions(categories),
    [categories]
  );

  const usedProductStockForBarcodeLabel = (slug, ignoreProductId = null) => {
    const code = String(slug || "").trim().toLowerCase();
    if (!code) return 0;
    let used = 0;
    for (const product of rows || []) {
      if (ignoreProductId != null && String(product?.id) === String(ignoreProductId)) continue;
      if (String(product?.barcode_code || "").trim().toLowerCase() !== code) continue;
      const st = Number(product?.stock);
      if (Number.isFinite(st)) used += Math.max(0, st);
    }
    return used;
  };

  const resolveLabelPoolForForm = (state, options = {}) => {
    const id = String(state?.stock_label_id || "").trim();
    if (id) {
      const label = findStockLabelById(id, categories, stockBarcodePickerOptions);
      const lp = labelPricePoolForProduct(label, categories, {
        ignoreProductId: options.ignoreProductId ?? null,
        usedStockForSlug: (slug, ignoreId) => usedProductStockForBarcodeLabel(slug, ignoreId),
        products: rows,
      });
      if (lp) return lp;
    }
    return null;
  };

  const linkStockLabelIdToFormState = (state, labelId, {
    ignoreProductId = null,
    categories: cats = categories,
    pickerOpts = stockBarcodePickerOptions,
  } = {}) => {
    if (!labelId) {
      return { ...state, stock_label_id: "", barcode_code: "" };
    }
    const label = findStockLabelById(labelId, cats, pickerOpts);
    if (!label) {
      return { ...state, stock_label_id: String(labelId), barcode_code: "" };
    }
    const lp = labelPricePoolForProduct(label, cats, {
      ignoreProductId,
      usedStockForSlug: (slug, ignoreId) => usedProductStockForBarcodeLabel(slug, ignoreId),
      products: rows,
    });
    const base = {
      ...state,
      stock_label_id: String(label.id),
      barcode_code: "",
    };
    if (!lp) return base;
    return applyLabelPoolToFormState(base, lp);
  };

  const applyLabelPoolToFormState = (state, lp) => {
    if (!lp) return state;
    const nextPrice = lp.isAverageBundle ? lp.price : state.price;
    return {
      ...state,
      stock_label_id: lp.stockLabelId != null ? String(lp.stockLabelId) : state.stock_label_id,
      price: nextPrice,
    };
  };

  const barcodeLabelModeText = (meta) => {
    if (!meta) return "";
    if (meta.isAverageBundle) {
      return "Second-hand average bundle: unit price comes from the stock label. Set stock manually for this product.";
    }
    if (meta.isSecondHand) {
      return "Second-hand single item: set price and stock manually. The barcode links this product to the stock label.";
    }
    return "Linked to a stock label. Set price and stock manually for this product.";
  };

  const selectedFormBarcodeLabelMeta = useMemo(
    () => resolveLabelPoolForForm(form),
    [form.stock_label_id, categories, rows]
  );

  const selectedEditBarcodeLabelMeta = useMemo(
    () => (editing ? resolveLabelPoolForForm(editing, { ignoreProductId: editing.id }) : null),
    [editing, categories, rows]
  );

  const formBarcodeLocksPrice = Boolean(selectedFormBarcodeLabelMeta?.isAverageBundle);
  const editBarcodeLocksPrice = Boolean(selectedEditBarcodeLabelMeta?.isAverageBundle);

  const lockedPriceStockInputCls =
    "cursor-not-allowed bg-slate-50 text-slate-800 ring-0 selection:bg-transparent dark:bg-slate-800/95 dark:text-slate-100";

  const formatLockedPriceDisplay = (v) => {
    if (v === "" || v == null) return "—";
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : String(v);
  };

  const stockBarcodeFieldCls =
    "w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]";

  const productRelationSelectCls = stockBarcodeFieldCls;

  const renderStockLabelField = ({
    selectId,
    stockLabelId,
    onStockLabelChange,
    pickerOptions,
    onCreateStock,
    compactTop = false,
    required = false,
    invalid = false,
    label = "Stock label",
    emptyOptionLabel,
  }) => (
    <div className={compactTop ? "" : "mt-4"}>
      <FieldWithQuickCreate
        label={label}
        htmlFor={selectId}
        required={required}
        invalid={invalid}
        optionalHint={required ? undefined : "(optional)"}
      >
        <select
          id={selectId}
          value={String(stockLabelId || "").trim()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === QUICK_CREATE_OPTION) {
              onCreateStock?.();
              return;
            }
            onStockLabelChange(v || "");
          }}
          className={`${stockBarcodeFieldCls}${invalid ? createInputErrorClass(true) : ""}`}
        >
          <CreateNewSelectOption label="+ Create new stock label…" />
          <option value="">
            {emptyOptionLabel ?? (required ? `Select ${label.toLowerCase()}…` : "Select stock…")}
          </option>
          {pickerOptions.map((row) => (
            <option key={row.id} value={String(row.id)}>
              {formatStockBarcodePickerLabel(row)}
            </option>
          ))}
        </select>
      </FieldWithQuickCreate>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Links inventory only. For color/size items, use Variant Barcode on each variant row.
      </p>
    </div>
  );

  const selectedCategory = categories.find((c) => String(c.id) === String(form.category_id));
  const selectedEditCategory = categories.find((c) => String(c.id) === String(editing?.category_id));
  const sizeOptions = getSizePreset(normalizeType(productType));
  const editSizeOptions = getSizePreset(normalizeType(editProductType));

  /** Strip host from absolute storage URLs so gallery always resolves with VITE_BACKEND_ORIGIN (avoids wrong host:port with no path). */
  const canonicalizeGalleryStorageUrl = (s) => {
    const t = String(s || "").trim();
    if (!t) return "";
    try {
      if (/^https?:\/\//i.test(t)) {
        const u = new URL(t);
        const idx = u.pathname.indexOf("/storage/");
        if (idx !== -1) return u.pathname.slice(idx) + (u.search || "");
      }
    } catch {
      /* ignore */
    }
    return t;
  };

  const isBareHttpOriginUrl = (s) => {
    try {
      const u = new URL(String(s).trim());
      if (!/^https?:$/i.test(u.protocol)) return false;
      const p = (u.pathname || "").replace(/\/+$/, "") || "/";
      return p === "/" && !u.search;
    } catch {
      return false;
    }
  };

  const parseGallery = (value) => {
    const normalizeOne = (v) => {
      const t = String(v).trim();
      if (!t || isBareHttpOriginUrl(t)) return null;
      return canonicalizeGalleryStorageUrl(t);
    };
    if (Array.isArray(value)) {
      return value.map(normalizeOne).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/\r?\n+/)
        .map((v) => normalizeOne(v))
        .filter(Boolean);
    }
    return [];
  };

  const MAX_GALLERY_THUMBNAILS = 5;
  /** Create-product sidebar: 1 cover + 4 gallery slots (matches storefront layout). */
  const CREATE_FORM_GALLERY_SLOTS = 4;
  const capGalleryUrlArray = (urls) => urls.slice(0, MAX_GALLERY_THUMBNAILS).filter(Boolean);
  const joinGalleryCapped = (urls) => capGalleryUrlArray(urls).join("\n");

  /** Ordered compact string for API from fixed create-form gallery slots (top slot first). */
  const compactGalleryStringFromSlotRow = (slots) => {
    const ordered = [];
    for (let i = 0; i < CREATE_FORM_GALLERY_SLOTS; i += 1) {
      const t = String(slots[i] || "").trim();
      if (t) ordered.push(t);
    }
    return joinGalleryCapped(ordered);
  };

  /** Browser MIME + octet-stream / empty type with a known image extension (matches server gallery-upload rules). */
  const isAcceptableProductImageFile = (file) => {
    if (!file) return false;
    const t = String(file.type || "").toLowerCase();
    if (t.startsWith("image/")) return true;
    if (t === "application/octet-stream" || t === "binary/octet-stream" || t === "") {
      return /\.(jpe?g|jfif|pjpeg|png|apng|gif|webp|svg|bmp|dib|ico|tiff?|avif|heic|heif|heics|jxl|qoi)$/i.test(String(file.name || ""));
    }
    return false;
  };

  const pickGalleryUploadUrl = (d) => {
    if (!d || typeof d !== "object") return "";
    const candidates = [
      d.image_url,
      d.url,
      d.path,
      d.imageUrl,
      d.file_url,
      d.fileUrl,
      d?.data?.image_url,
      d?.data?.url,
      d?.data?.path,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const x = candidates[i];
      if (typeof x === "string" && x.trim()) return x.trim();
    }
    if (typeof d.data === "string" && d.data.trim()) return d.data.trim();
    if (d?.data && typeof d.data === "object" && !Array.isArray(d.data)) {
      const nested = pickGalleryUploadUrl(d.data);
      if (nested) return nested;
    }
    return "";
  };

  const uploadGalleryFile = async (file) => {
    if (!canUploadProductMedia) {
      throw new Error("You don't have permission to upload product images.");
    }
    const fd = new FormData();
    fd.append("image", file);
    const { data } = await api.post("/admin/products/gallery-upload", fd);
    const raw = pickGalleryUploadUrl(data);
    if (!raw) return "";
    return canonicalizeGalleryStorageUrl(raw);
  };

  const triggerCreateColorUpload = (rowId) => {
    createColorUploadRowIdRef.current = rowId;
    createColorFileInputRef.current?.click();
  };

  const onCreateColorFileSelected = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    const rowId = createColorUploadRowIdRef.current;
    createColorUploadRowIdRef.current = null;
    if (input) input.value = "";
    if (!file) return;
    if (!isAcceptableProductImageFile(file)) {
      setErr("This file type is not supported. Use a common image format (JPG, PNG, WebP, etc.).");
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadGalleryFile(file);
      if (!url) {
        setErr("Upload did not return an image URL. Try again or check storage.");
        return;
      }
      const primary = canonicalizeGalleryStorageUrl(url) || url;
      setCreateColorVariants((prev) => {
        const ix = prev.findIndex((r) => r.id === rowId);
        if (ix < 0) return prev;
        const n = [...prev];
        n[ix] = { ...n[ix], image_url: primary };
        return n;
      });
    } catch (error) {
      setErr(extractErr(error));
    } finally {
      setIsUploading(false);
    }
  };

  const triggerEditColorUpload = (rowId) => {
    editColorUploadRowIdRef.current = rowId;
    editColorFileInputRef.current?.click();
  };

  const onEditColorFileSelected = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    const rowId = editColorUploadRowIdRef.current;
    editColorUploadRowIdRef.current = null;
    if (input) input.value = "";
    if (!file) return;
    if (!isAcceptableProductImageFile(file)) {
      setEditGalleryError("This file type is not supported. Use JPG, PNG, WebP, etc.");
      return;
    }
    setIsUploading(true);
    setEditGalleryError("");
    try {
      const url = await uploadGalleryFile(file);
      if (!url) {
        setEditGalleryError("Upload did not return an image URL. Try again or check storage.");
        return;
      }
      const primary = canonicalizeGalleryStorageUrl(url) || url;
      setEditing((prev) => {
        if (!prev) return prev;
        const colors = Array.isArray(prev.colors) ? [...prev.colors] : [];
        const ix = colors.findIndex((r) => r && typeof r === "object" && r.id === rowId);
        if (ix < 0) return prev;
        if (typeof colors[ix] !== "object") return prev;
        colors[ix] = { ...colors[ix], image_url: primary };
        return { ...prev, colors };
      });
    } catch (error) {
      setEditGalleryError(extractErr(error));
    } finally {
      setIsUploading(false);
    }
  };

  const triggerAuthRefresh = async () => {
    try {
      await refreshAuth();
    } catch (e) {
      console.warn('Auth refresh failed');
    }
  };

  const extractErr = (e) => {
    const status = e?.response?.status;
    if (status === 401) {
      triggerAuthRefresh();
      return "Unauthorized (401). Please login again.";
    }
    if (status === 422) {
      return getValidationMessage(e);
    }
    if (!e?.response) {
      return e?.message || "Network error. Check your connection and that the API URL (VITE_API_BASE_URL) is correct.";
    }
    const msg = e?.response?.data?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    return "Failed to load/save data.";
  };

  const parseCategoriesResponse = (categoriesData) => (
    Array.isArray(categoriesData)
      ? categoriesData
      : (categoriesData?.data || categoriesData || [])
  );

  const reloadCategories = async () => {
    const { data: categoriesData } = await api.get("/admin/categories", {
      params: { include_stock_labels: true },
    });
    const next = parseCategoriesResponse(categoriesData);
    setCategories(next);
    return next;
  };

  const reloadBrands = async () => {
    const { data: brandsData } = await api.get("/admin/brands");
    const next = brandsData?.data || [];
    setBrands(next);
    return next;
  };

  const reloadSuppliers = async () => {
    const { data: suppliersData } = await api.get("/admin/suppliers");
    const next = suppliersData?.data || [];
    setSuppliers(next);
    return next;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data: productsData } = await api.get("/admin/products", { params: { per_page: 500 } });
      const { data: categoriesData } = await api.get("/admin/categories", {
        params: { include_stock_labels: true },
      });
      const { data: brandsData } = await api.get("/admin/brands");
      const { data: suppliersData } = await api.get("/admin/suppliers");
      const categories = parseCategoriesResponse(categoriesData);
      const brands = brandsData?.data || [];
      const suppliers = suppliersData?.data || [];
      setRows(productsData?.data || []);
      setCategories(categories);
      setBrands(brands);
      setSuppliers(suppliers);
    } catch (e2) {
      setErr(extractErr(e2));
    } finally {
      setLoading(false);
    }
  };

  const openQuickCreate = (type, target = "create") => {
    setQuickCreate({ type, target });
  };

  const closeQuickCreate = () => {
    setQuickCreate(null);
  };

  const applyProductFieldPatch = (target, patch) => {
    if (target === "edit") {
      setEditing((s) => (s ? { ...s, ...patch } : s));
    } else {
      setForm((s) => ({ ...s, ...patch }));
    }
  };

  const tryOpenQuickCreateFromSelect = (type, target, value) => {
    if (value !== QUICK_CREATE_OPTION) return false;
    if (type === "category" && !canCreateCategories) return false;
    if (type === "brand" && !canCreateBrands) return false;
    openQuickCreate(type, target);
    return true;
  };

  const onCategorySelectChange = (target) => (e) => {
    const v = e.target.value;
    if (tryOpenQuickCreateFromSelect("category", target, v)) return;
    applyProductFieldPatch(target, { category_id: v });
    if (target === "create" && v) clearCreateFieldError("sizes");
  };

  const onBrandSelectChange = (target) => (e) => {
    const v = e.target.value;
    if (tryOpenQuickCreateFromSelect("brand", target, v)) return;
    applyProductFieldPatch(target, { brand_id: v });
    if (target === "create" && v) clearCreateFieldError("brand_id");
    if (target === "edit" && v) clearEditFieldError("brand_id");
  };

  const onSupplierSelectChange = (target) => (e) => {
    const v = e.target.value;
    if (tryOpenQuickCreateFromSelect("supplier", target, v)) return;
    applyProductFieldPatch(target, { supplier_id: v });
    if (target === "create" && v) clearCreateFieldError("supplier_id");
  };

  const handleQuickCreateSuccess = async (type, created) => {
    const target = quickCreate?.target || "create";
    if (type === "category") {
      await reloadCategories();
      if (created?.id != null) {
        applyProductFieldPatch(target, { category_id: String(created.id) });
      }
    } else if (type === "brand") {
      await reloadBrands();
      if (created?.id != null) {
        applyProductFieldPatch(target, { brand_id: String(created.id) });
      }
    } else if (type === "supplier") {
      await reloadSuppliers();
      if (created?.id != null) {
        applyProductFieldPatch(target, { supplier_id: String(created.id) });
      }
    } else if (type === "stockLabel") {
      const cats = await reloadCategories();
      if (created?.id != null) {
        const apply = (state) => linkStockLabelIdToFormState(state, String(created.id), { categories: cats });
        if (target === "edit") {
          setEditing((s) => (s ? apply(s) : s));
        } else {
          setForm((s) => apply(s));
        }
      }
    }
    closeQuickCreate();
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (embeddedInPo) return;
    if (searchParams.get("new") === "1") {
      setShowCreateForm(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [embeddedInPo, searchParams, setSearchParams]);

  useEffect(() => {
    if (!embeddedInPo) return;
    load();
  }, [embeddedInPo]);

  useEffect(() => {
    if (!embeddedInPo || !embeddedOpen) return;
    setShowCreateForm(true);
    if (embeddedSupplierId) {
      setForm((f) => ({ ...f, supplier_id: String(embeddedSupplierId) }));
    }
  }, [embeddedInPo, embeddedOpen, embeddedSupplierId]);

  useEffect(() => {
    try {
      localStorage.setItem(PRODUCTS_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch { /* ignore quota */ }
  }, [columnVisibility]);

  useEffect(() => {
    saveProductSortPrefs(PRODUCTS_SORT_STORAGE_KEY, productSort);
  }, [productSort]);

  const isColVisible = (columnId) => columnVisibility[columnId] !== false;

  const toggleTableColumn = (columnId) => {
    setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
  };

  const setAllTableColumnsVisible = (visible) => {
    setColumnVisibility(buildAllColumnsVisibility(PRODUCTS_TABLE_COLUMNS, visible, "productName"));
  };

  /** After labels load, apply average-bundle price from linked stock_label_id. */
  useEffect(() => {
    const id = String(form.stock_label_id || "").trim();
    if (!id) return;
    setForm((s) => {
      const lp = resolveLabelPoolForForm(s);
      if (!lp) return s;
      const next = applyLabelPoolToFormState(s, lp);
      if (
        String(s.price) === String(next.price)
        && String(s.stock_label_id || "") === String(next.stock_label_id || "")
      ) {
        return s;
      }
      return next;
    });
  }, [form.stock_label_id, categories, rows]);

  /** Same as create: sync edit form from chosen label (average bundle auto-fills unit price). */
  useEffect(() => {
    if (!editing) return;
    const id = String(editing.stock_label_id || "").trim();
    if (!id) return;
    setEditing((s) => {
      if (!s) return s;
      const lp = resolveLabelPoolForForm(s, { ignoreProductId: s.id });
      if (!lp) return s;
      const next = applyLabelPoolToFormState(s, lp);
      if (
        String(s.price) === String(next.price)
        && String(s.stock_label_id || "") === String(next.stock_label_id || "")
      ) {
        return s;
      }
      return next;
    });
  }, [editing?.id, editing?.stock_label_id, categories, rows]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((p) => p.id === id)));
  }, [rows]);

  const applyInferredProductType = (inferred, { autoVariants = true } = {}) => {
    if (!inferred) return;
    setProductType(productTypeLabelFromInferred(inferred));
    if (
      autoVariants
      && (inferred === "bag" || inferred === "bags" || inferred === "hat" || inferred === "hats")
    ) {
      setForm((s) => (s.has_variants ? s : { ...s, has_variants: true }));
    }
  };

  useEffect(() => {
    if (!showCreateForm) return;
    if (!form.category_id || !selectedCategory) return;
    const inferred = inferTypeFromCategory(selectedCategory);
    applyInferredProductType(inferred);
  }, [showCreateForm, form.category_id, selectedCategory]);

  useEffect(() => {
    if (!editing) return;
    if (!editing.category_id) return;
    if (!selectedEditCategory) return;
    const inferred = inferTypeFromCategory(selectedEditCategory);
    if (!inferred) return;
    const nextType = inferred === "shoes" ? "Shoes" : inferred === "clothes" ? "Clothes" : inferred === "bag" || inferred === "bags" ? "Bags" : inferred === "hat" || inferred === "hats" ? "Hats" : inferred === "accessory" ? "Accessories" : "Other";
    setEditProductType(nextType);
    if (inferred === "bag" || inferred === "bags" || inferred === "hat" || inferred === "hats") {
      setEditing((s) => (s && !s.has_variants ? { ...s, has_variants: true } : s));
    }
  }, [editing, selectedEditCategory]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setAnimate(true);
    setTimeout(() => {
      setAnimate(false);
      setTimeout(() => setSuccess(""), 300);
    }, 3000);
  };

  const applyMainImageFile = async (file) => {
    if (!file || !isAcceptableProductImageFile(file)) return;
    setIsUploading(true);
    setErr("");
    try {
      const url = await uploadGalleryFile(file);
      if (!url) {
        setErr("Upload did not return an image URL. Try again or check storage.");
        return;
      }
      const primary = canonicalizeGalleryStorageUrl(url) || url;
      setForm((s) => ({ ...s, image_url: primary }));
      clearCreateFieldError("photos");
    } catch (error) {
      setErr(extractErr(error));
    } finally {
      setIsUploading(false);
    }
  };

  const applyEditMainImageFile = async (file) => {
    if (!file || !isAcceptableProductImageFile(file)) return;
    setIsUploading(true);
    setEditGalleryError("");
    try {
      const url = await uploadGalleryFile(file);
      if (!url) {
        setEditGalleryError("Upload did not return an image URL. Try again or check storage.");
        return;
      }
      const primary = canonicalizeGalleryStorageUrl(url) || url;
      setEditing((s) => (s ? { ...s, image_url: primary } : s));
      clearEditFieldError("photos");
    } catch (error) {
      setEditGalleryError(extractErr(error));
    } finally {
      setIsUploading(false);
    }
  };

  const resetImageUrlPicker = () => {
    setImageUrlPicker(null);
    setImageUrlPickerDraft("");
    setImageUrlPickerError("");
    setAddImageModalDragging(false);
  };

  const applyImageUrlPicker = () => {
    const picker = imageUrlPicker;
    if (!picker) {
      resetImageUrlPicker();
      return;
    }
    const v = imageUrlPickerDraft.trim();
    if (!v) {
      setImageUrlPickerError("Please enter a URL.");
      return;
    }
    setImageUrlPickerError("");
    const img = new Image();
    img.onload = () => {
      if (picker.form === "create") {
        if (picker.area === "main") {
          setForm((s) => ({ ...s, image_url: v }));
          clearCreateFieldError("photos");
        } else {
          const idx = typeof picker.index === "number" ? picker.index : 0;
          if (idx < 0 || idx >= CREATE_FORM_GALLERY_SLOTS) {
            resetImageUrlPicker();
            return;
          }
          setCreateGallerySlotUrls((prev) => {
            const n = [...prev];
            n[idx] = canonicalizeGalleryStorageUrl(v) || v;
            return n;
          });
        }
      } else if (picker.form === "edit") {
        if (picker.area === "main") {
          setEditing((s) => (s ? { ...s, image_url: v } : s));
          clearEditFieldError("photos");
        } else {
          const idx = typeof picker.index === "number" ? picker.index : 0;
          if (idx < 0 || idx >= CREATE_FORM_GALLERY_SLOTS) {
            resetImageUrlPicker();
            return;
          }
          setEditGallerySlotUrls((prev) => {
            const n = [...prev];
            n[idx] = canonicalizeGalleryStorageUrl(v) || v;
            return n;
          });
        }
      }
      resetImageUrlPicker();
    };
    img.onerror = () => {
      setImageUrlPickerError("Could not load image. Check the URL or try another.");
    };
    img.src = v;
  };

  useEffect(() => {
    if (!imageUrlPicker) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") resetImageUrlPicker();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [imageUrlPicker]);

  useLayoutEffect(() => {
    if (!showCreateForm) {
      resetImageUrlPicker();
      setCreateGallerySlotUrls(Array.from({ length: CREATE_FORM_GALLERY_SLOTS }, () => ""));
      setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
      setCreateVariantMatrix([emptyVariantMatrixRow()]);
      return;
    }
    setCreatePhotoActiveSlot(0);
    const u = capGalleryUrlArray(parseGallery(form.gallery));
    setCreateGallerySlotUrls(Array.from({ length: CREATE_FORM_GALLERY_SLOTS }, (_, i) => (u[i] || "").trim()));
  }, [showCreateForm]);

  /** Keep `form.gallery` aligned with fixed gallery slots while the create modal is open (avoids nested setState bugs). */
  useEffect(() => {
    if (!showCreateForm) return;
    const next = compactGalleryStringFromSlotRow(createGallerySlotUrls);
    setForm((s) => (s.gallery === next ? s : { ...s, gallery: next }));
  }, [createGallerySlotUrls, showCreateForm]);

  useLayoutEffect(() => {
    if (!editing) {
      setEditGallerySlotUrls(Array.from({ length: 4 }, () => ""));
      setEditPhotoActiveSlot(0);
      return;
    }
    const u = capGalleryUrlArray(parseGallery(editing.gallery || ""));
    setEditGallerySlotUrls(Array.from({ length: CREATE_FORM_GALLERY_SLOTS }, (_, i) => (u[i] || "").trim()));
    setEditPhotoActiveSlot(0);
  }, [editing?.id]);

  /** Keep `editing.gallery` aligned with fixed gallery slots while the edit modal is open. */
  useEffect(() => {
    if (!editing) return;
    const next = compactGalleryStringFromSlotRow(editGallerySlotUrls);
    setEditing((s) => (s && s.gallery === next ? s : { ...s, gallery: next }));
  }, [editGallerySlotUrls]);

  useEffect(() => {
    if (!editing) resetImageUrlPicker();
  }, [editing]);

  const ADD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

  /** Create-product: place uploaded image at a fixed gallery slot (0..3) and sync `form.gallery`. */
  const ingestCreateGallerySlotFileList = async (fileList, slotIndex) => {
    const files = fileList ? Array.from(fileList).filter((f) => isAcceptableProductImageFile(f)) : [];
    if (files.length === 0) {
      const msg = "No supported image files in selection.";
      setErr(msg);
      return { ok: false, error: msg };
    }
    if (slotIndex < 0 || slotIndex >= CREATE_FORM_GALLERY_SLOTS) {
      const msg = "Invalid gallery slot.";
      setErr(msg);
      return { ok: false, error: msg };
    }
    setIsUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const url = await uploadGalleryFile(file);
        if (url) urls.push(url);
      }
      if (urls.length === 0) {
        const msg =
          "Upload did not return an image URL. Try again, confirm you are logged in, or check the server (storage link / permissions).";
        setErr(msg);
        return { ok: false, error: msg };
      }
      const primaryRaw = urls[0];
      const primary = canonicalizeGalleryStorageUrl(primaryRaw) || primaryRaw;
      setCreateGallerySlotUrls((prev) => {
        const n = [...prev];
        n[slotIndex] = primary;
        return n;
      });
      return { ok: true };
    } catch (error) {
      const msg = extractErr(error);
      setErr(msg);
      return { ok: false, error: msg };
    } finally {
      setIsUploading(false);
    }
  };

  /** Edit-product: place uploaded image at a fixed gallery slot (0..3) and sync `editing.gallery` via `editGallerySlotUrls`. */
  const ingestEditGallerySlotFileList = async (fileList, slotIndex) => {
    const files = fileList ? Array.from(fileList).filter((f) => isAcceptableProductImageFile(f)) : [];
    if (files.length === 0) {
      const msg = "No supported image files in selection.";
      setEditGalleryError(msg);
      return { ok: false, error: msg };
    }
    if (slotIndex < 0 || slotIndex >= CREATE_FORM_GALLERY_SLOTS) {
      const msg = "Invalid gallery slot.";
      setEditGalleryError(msg);
      return { ok: false, error: msg };
    }
    setIsUploading(true);
    setEditGalleryError("");
    try {
      const urls = [];
      for (const file of files) {
        const url = await uploadGalleryFile(file);
        if (url) urls.push(url);
      }
      if (urls.length === 0) {
        const msg =
          "Upload did not return an image URL. Try again, confirm you are logged in, or check the server (storage link / permissions).";
        setEditGalleryError(msg);
        return { ok: false, error: msg };
      }
      const primaryRaw = urls[0];
      const primary = canonicalizeGalleryStorageUrl(primaryRaw) || primaryRaw;
      setEditGallerySlotUrls((prev) => {
        const n = [...prev];
        n[slotIndex] = primary;
        return n;
      });
      return { ok: true };
    } catch (error) {
      const msg = extractErr(error);
      setEditGalleryError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsUploading(false);
    }
  };

  const applyAddImageModalFile = async (file) => {
    const picker = imageUrlPicker;
    if (!picker || !file) return;
    setImageUrlPickerError("");
    if (!isAcceptableProductImageFile(file)) {
      setImageUrlPickerError(
        "This file type is not supported. Use PNG, JPG, WebP, GIF, or another common image format."
      );
      return;
    }
    if (file.size > ADD_IMAGE_MAX_BYTES) {
      setImageUrlPickerError("Image must be 10 MB or smaller.");
      return;
    }
    if (picker.form === "create") {
      if (picker.area === "main") {
        applyMainImageFile(file);
        resetImageUrlPicker();
        return;
      }
      const slotIndex = typeof picker.index === "number" ? picker.index : 0;
      const created = await ingestCreateGallerySlotFileList([file], slotIndex);
      if (created.ok) resetImageUrlPicker();
      else setImageUrlPickerError(created.error || "Upload failed.");
      return;
    }
    if (picker.form === "edit") {
      if (picker.area === "main") {
        applyEditMainImageFile(file);
        resetImageUrlPicker();
        return;
      }
      const slotIndex = typeof picker.index === "number" ? picker.index : 0;
      const edited = await ingestEditGallerySlotFileList([file], slotIndex);
      if (edited.ok) resetImageUrlPicker();
      else setImageUrlPickerError(edited.error || "Upload failed.");
    }
  };

  useEffect(() => {
    if (!imageUrlPicker) return undefined;
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.type?.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            void applyAddImageModalFile(f);
          }
          return;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [imageUrlPicker]);

  const handleCreateGalleryFileInput = async (e) => {
    const files = e.target.files;
    const target = createGalleryUploadTargetRef.current;
    createGalleryUploadTargetRef.current = null;
    if (e.target) e.target.value = "";
    if (!files || files.length === 0) return;
    if (target && typeof target.slotIndex === "number") {
      await ingestCreateGallerySlotFileList(files, target.slotIndex);
    }
  };

  const handleEditGallerySlotFileInput = async (e) => {
    const files = e.target.files;
    const target = editGallerySlotUploadTargetRef.current;
    editGallerySlotUploadTargetRef.current = null;
    if (e.target) e.target.value = "";
    if (!files || files.length === 0) return;
    if (target && typeof target.slotIndex === "number") {
      await ingestEditGallerySlotFileList(files, target.slotIndex);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!canCreateProducts) {
      await errorAlert({
        khTitle: "គ្មានសិទ្ធិ",
        enTitle: "Not allowed",
        detail: "You don't have permission to create products.",
      });
      return;
    }
    if (isCreating) return;
    setErr("");
    setCreateError("");

    if (!form.category_id) {
      const detail = "Please select a category";
      setErr(detail);
      await errorAlert({
        khTitle: "ទិន្នន័យមិនគ្រប់",
        enTitle: "Missing required field",
        detail,
      });
      return;
    }

    const createValidation = validateCreateProductForm();
    if (!createValidation.ok) {
      setCreateFieldErrors(createValidation.errors);
      setCreateError(createValidation.detail);
      await errorAlert({
        khTitle: "ទិន្នន័យមិនគ្រប់",
        enTitle: "Missing required fields",
        detail: createValidation.detail,
      });
      return;
    }
    setCreateFieldErrors({});

    setIsCreating(true);
    loadingAlert({
      khTitle: "កំពុងបង្កើតទំនិញ",
      enTitle: "Creating product",
      khText: "សូមរង់ចាំបន្តិច",
      enText: "Please wait",
    });
    const orderedGalleryForCreate = () => {
      const o = [];
      for (let i = 0; i < CREATE_FORM_GALLERY_SLOTS; i += 1) {
        const t = String(createGallerySlotUrls[i] || "").trim();
        if (t) o.push(t);
      }
      return capGalleryUrlArray(o);
    };
    try {
      const createHasVariants = true;
      const variantMatrixPayload = buildCreateVariantMatrixPayload();
      const colorNames = uniqueColorNamesFromSwatchRows(createColorVariants);
      const stockPayload = variantMatrixPayload
        ? variantMatrixPayload.reduce((sum, r) => sum + (r.qty || 0), 0)
        : 0;
      const response = await api.post("/admin/products", {
        ...form,
        sku: String(form.sku || "").trim() || null,
        brand_id: form.brand_id || null,
        supplier_id: embeddedInPo && embeddedSupplierId ? Number(embeddedSupplierId) : null,
        barcode_code: null,
        stock_label_id: null,
        cost_price: null,
        price: 0,
        stock: stockPayload,
        colors:
          createHasVariants && colorNames.length
            ? productColorsPayloadFromRows(createColorVariants)
            : null,
        variant_matrix: variantMatrixPayload,
        sizes: createHasVariants ? normalizeSizes(form.sizes) : [],
        payment_methods: [],
        gallery: orderedGalleryForCreate(),
      });
      if (![200, 201].includes(response?.status)) {
        throw new Error("Create failed.");
      }
      const created = response?.data?.data ?? response?.data;
      const createdId = created?.id ?? created?.product_id;

      if (embeddedInPo && embeddedOnCreated && createdId != null) {
        const enriched = enrichProductForPoList(
          { ...created, id: createdId },
          form,
          createColorVariants,
        );
        const lineDefaults = buildPoLineDefaultsFromProductCreate(form, createVariantMatrix);
        closeSwal();
        setCreateFieldErrors({});
        setForm({ name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", cost_price: "", stock: "", allocated_stock: "", category_id: "", brand_id: "", supplier_id: embeddedSupplierId ? String(embeddedSupplierId) : "", image_url: "", gender: "", is_active: true, has_variants: true, model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: "" });
        setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
        setCreateVariantMatrix([emptyVariantMatrixRow()]);
        setShowCreateForm(false);
        await toastSuccess({
          khText: "បានបង្កើតទំនិញដោយជោគជ័យ",
          enText: "Product added to purchase order line.",
        });
        embeddedOnCreated(enriched, lineDefaults);
        embeddedOnClose?.();
        setIsCreating(false);
        return;
      }

      const poLineKey = sessionStorage.getItem(PO_RETURN_LINE_KEY);
      if (poLineKey && createdId != null) {
        sessionStorage.setItem(
          PO_APPLY_KEY,
          JSON.stringify({
            lineKey: poLineKey,
            product: enrichProductForPoList({ ...created, id: createdId }, form, createColorVariants),
            lineDefaults: buildPoLineDefaultsFromProductCreate(form, createVariantMatrix),
          }),
        );
        sessionStorage.removeItem(PO_RETURN_LINE_KEY);
        closeSwal();
        setCreateFieldErrors({});
        setForm({ name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", cost_price: "", stock: "", allocated_stock: "", category_id: "", brand_id: "", supplier_id: "", image_url: "", gender: "", is_active: true, has_variants: true, model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: "" });
        setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
        setCreateVariantMatrix([emptyVariantMatrixRow()]);
        setShowCreateForm(false);
        await toastSuccess({
          khText: "បានបង្កើតទំនិញដោយជោគជ័យ",
          enText: "Product added — returning to purchase order.",
        });
        navigate("/admin/purchase-orders?resume=1");
        setIsCreating(false);
        return;
      }
      closeSwal();
      setCreateFieldErrors({});
      setForm({ name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", cost_price: "", stock: "", allocated_stock: "", category_id: "", brand_id: "", supplier_id: "", image_url: "", gender: "", is_active: true, has_variants: true, model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: "" });
      setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
      setCreateVariantMatrix([emptyVariantMatrixRow()]);
      setShowCreateForm(false);
      await toastSuccess({
        khText: "បានបង្កើតទំនិញដោយជោគជ័យ",
        enText: "Created successfully!",
      });
      if (finishAdminProductFlow()) return;
      await load();
    } catch (e2) {
      closeSwal();
      const detail = e2?.response?.status === 422 ? getValidationMessage(e2) : extractErr(e2);
      setErr(detail);
      const slugHint = String(detail).toLowerCase().includes("slug")
        ? `សូមបំពេញ Slug - ${detail}`
        : detail;
      setCreateError(slugHint);
      await errorAlert({
        khTitle: "បង្កើតទំនិញបរាជ័យ",
        enTitle: "Create failed",
        detail: slugHint,
      });
    } finally {
      closeSwal();
      setIsCreating(false);
    }
  };

  const startEdit = async (p) => {
    if (!canEditProducts) return;
    let fresh = p;
    try {
      const { data } = await api.get(`/admin/products/${p.id}`);
      fresh = data?.data ?? data ?? p;
    } catch {
      /* use list row */
    }
    const apiVariantRows = variantMatrixRowsFromApi(fresh.variant_matrix);
    const apiColors = colorVariantRowsFromApi(fresh.colors);
    const apiSizes = normalizeSizes(fresh.sizes);
    setEditFieldErrors({});
    setEditVariantMatrix(apiVariantRows);
    setEditing({
      ...fresh,
      has_variants: true,
      barcode_code: fresh.barcode_code ?? "",
      stock_label_id: fresh.stock_label_id != null && fresh.stock_label_id !== "" ? String(fresh.stock_label_id) : "",
      supplier_id: fresh.supplier_id != null && fresh.supplier_id !== "" ? String(fresh.supplier_id) : "",
      cost_price: fresh.cost_price != null && fresh.cost_price !== "" ? String(fresh.cost_price) : "",
      price: fresh.price != null && fresh.price !== "" ? String(fresh.price) : "",
      sizes: apiSizes,
      colors: apiColors.length ? apiColors : [{ id: newColorRowId(), name: "", image_url: "" }],
      gallery: joinGalleryCapped(parseGallery(fresh.gallery)),
    });
  };

  useEffect(() => {
    const search = location.search || "";
    captureAdminReturnTo(search);
    const editId = new URLSearchParams(search).get("edit");
    if (!editId || rows.length === 0) return;
    const product = rows.find((p) => String(p.id) === String(editId));
    if (!product) return;
    startEdit(product);
    navigate("/admin/products", { replace: true });
  }, [location.search, rows]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    if (params.get("new") !== "1") return;

    captureAdminReturnTo(location.search || "");

    const categoryId = (params.get("category_id") || "").trim();
    const brandId = (params.get("brand_id") || "").trim();
    const stockLabelId = (params.get("stock_label_id") || "").trim();

    setCreateVariantMatrix([emptyVariantMatrixRow()]);
    setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
    const baseForm = {
      name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", cost_price: "", stock: "", allocated_stock: "",
      category_id: categoryId, brand_id: brandId, supplier_id: "", image_url: "", gender: "", is_active: true, has_variants: true,
      model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: "",
    };
    setForm(
      stockLabelId
        ? linkStockLabelIdToFormState(baseForm, stockLabelId)
        : baseForm,
    );
    setCreateFieldErrors({});
    setShowCreateForm(true);
    navigate("/admin/products", { replace: true });
  }, [location.search, navigate]);

  const saveEdit = async () => {
    if (!canEditProducts) {
      setErr("You don't have permission to edit products.");
      return;
    }
    setErr("");

    if (!editing.category_id) {
      setErr("Please select a category");
      return;
    }

    const editValidation = validateEditProductForm();
    if (!editValidation.ok) {
      setEditFieldErrors(editValidation.errors);
      setErr(editValidation.detail);
      return;
    }
    setEditFieldErrors({});

    try {
      const editSwatches = Array.isArray(editing.colors) ? editing.colors : [];
      const variantMatrixPayload = buildEditVariantMatrixPayload();
      const colorNames = uniqueColorNamesFromSwatchRows(editSwatches);
      const patchBody = {
        name: editing.name,
        category_id: editing.category_id,
        brand_id: editing.brand_id || null,
        description: editing.description || "",
        image_url: editing.image_url || "",
        stock: variantMatrixPayload
          ? variantMatrixPayload.reduce((sum, r) => sum + (r.qty || 0), 0)
          : 0,
        colors: colorNames.length ? productColorsPayloadFromRows(editSwatches) : null,
        variant_matrix: variantMatrixPayload,
        sizes: normalizeSizes(editing.sizes),
        gallery: capGalleryUrlArray(parseGallery(editing.gallery)),
        is_active: editing.is_active,
      };
      await api.patch(`/admin/products/${editing.id}`, patchBody);
      setEditing(null);
      showSuccess("Product updated successfully!");
      if (finishAdminProductFlow()) return;
      await load();
    } catch (e2) {
      setErr(extractErr(e2));
    }
  };

  const del = (id) => {
    if (!canDeleteProducts) return;
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!canDeleteProducts) return;
    setDeleteBusy(true);
    setErr("");
    try {
      if (pendingBulkDelete) {
        await Promise.all(selectedIds.map((id) => api.delete(`/admin/products/${id}`)));
        showSuccess("Selected products deleted successfully!");
        setSelectedIds([]);
      } else if (pendingDeleteId != null) {
        await api.delete(`/admin/products/${pendingDeleteId}`);
        showSuccess("Product deleted successfully!");
        if (editing?.id === pendingDeleteId) closeEditForm();
      }
      await load();
    } catch (e2) {
      setErr(extractErr(e2));
    } finally {
      setDeleteBusy(false);
      setPendingDeleteId(null);
      setPendingBulkDelete(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Gender options (fixed list; Boys/Girls ready for future categories)
  const GENDER_OPTIONS = [
    { key: "men", label: "Men" },
    { key: "women", label: "Women" },
    { key: "boys", label: "Boys" },
    { key: "girls", label: "Girls" },
  ];

  // Section type tabs from Homepage Sections (Section List), skipping non-category keys
  const sectionTabs = useMemo(() => {
    const raw = homepageSettings?.sections;
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .filter(([key]) => key !== "discounts")
      .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99))
      .map(([key, val]) => ({ key, title: val.title || key }));
  }, [homepageSettings]);

  // Gender match helper — "men" should NOT match "women"
  const matchesGender = (slug, key) => {
    const s = (slug || "").toLowerCase();
    if (key === "men") return s === "men" || s.startsWith("men-");
    if (key === "women") return s === "women" || s.startsWith("women-");
    if (key === "boys") return s === "boys" || s.startsWith("boys-") || s.includes("-boys");
    if (key === "girls") return s === "girls" || s.startsWith("girls-") || s.includes("-girls");
    return false;
  };

  const filteredRows = rows.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.sku || "").toLowerCase().includes(q) ||
      String(p.barcode_code || "").toLowerCase().includes(q) ||
      String(p.category?.name || "").toLowerCase().includes(q) ||
      String(p.brand?.name || "").toLowerCase().includes(q);

    const catSlug = String(p.category?.slug || "").toLowerCase();
    const catName = String(p.category?.name || "").toLowerCase();

    const matchesGenderFilter = matchesSection(listFilters.applied, "gender", (key) => matchesGender(catSlug, key));
    const matchesSectionFilter = matchesSection(listFilters.applied, "section", (key) =>
      catName.includes(key.toLowerCase()) || catSlug.includes(key.toLowerCase()));
    const matchesStockFilter = matchesSection(listFilters.applied, "stock", (key) => {
      if (key === "out") return Number(p.stock) === 0;
      if (key === "in_stock") return Number(p.stock) > 0;
      if (key === "active") return !!p.is_active;
      if (key === "inactive") return !p.is_active;
      return false;
    });
    const matchesCategoryFilter = matchesSection(
      listFilters.applied,
      "category",
      (id) => String(p.category_id || "") === String(id),
    );

    const matchesStockNameFilter = matchesSection(listFilters.applied, "stockName", (value) => {
      const key = stockLabelKeyForProduct(p);
      if (value === FILTER_NONE) return !key;
      return key === String(value);
    });

    const matchesSupplierFilter = matchesSection(listFilters.applied, "supplier", (value) => {
      const key = supplierKeyForProduct(p);
      if (value === FILTER_NONE) return !key;
      return key === String(value);
    });

    const matchesYearMonth = recordMatchesYearMonth(
      p.created_at,
      yearMonthFilter.applied.year,
      yearMonthFilter.applied.month,
    );

    return (
      matchesSearch &&
      matchesGenderFilter &&
      matchesSectionFilter &&
      matchesStockFilter &&
      matchesCategoryFilter &&
      matchesStockNameFilter &&
      matchesSupplierFilter &&
      matchesYearMonth
    );
  });

  const sortContext = useMemo(
    () => ({ catalogCategories, supplierLabelFor: supplierIdForProduct }),
    [catalogCategories, suppliers],
  );

  const sortedRows = useMemo(
    () => sortProducts(filteredRows, productSort.sortBy, productSort.sortDir, sortContext),
    [filteredRows, productSort.sortBy, productSort.sortDir, sortContext],
  );

  const listPageSlice = useMemo(() => sliceAdminListPage(sortedRows, listPage), [sortedRows, listPage]);
  const paginatedRows = listPageSlice.rows;
  const listLastPage = listPageSlice.lastPage;
  const listUsePagination = listPageSlice.usePagination;

  const listFilterSignature = useMemo(
    () =>
      JSON.stringify({
        applied: listFilters.applied,
        year: yearMonthFilter.applied.year,
        month: yearMonthFilter.applied.month,
      }),
    [listFilters.applied, yearMonthFilter.applied.year, yearMonthFilter.applied.month],
  );

  useEffect(() => {
    setListPage(1);
  }, [search, productSort.sortBy, productSort.sortDir, productSort.groupBy, listFilterSignature]);

  useEffect(() => {
    if (listPage > listLastPage) setListPage(listLastPage);
  }, [listPage, listLastPage]);

  const productGroups = useMemo(
    () => buildProductGroups(paginatedRows, productSort.groupBy, sortContext),
    [paginatedRows, productSort.groupBy, sortContext],
  );

  const visibleTableColumnCount = PRODUCTS_TABLE_COLUMNS.filter((col) => isColVisible(col.id)).length;

  const splitColumns = [
    paginatedRows.filter((_, index) => index % 2 === 0),
    paginatedRows.filter((_, index) => index % 2 === 1),
  ];

  const allSelected =
    paginatedRows.length > 0 && paginatedRows.every((p) => selectedIds.includes(p.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const pageIds = new Set(paginatedRows.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    const next = new Set(selectedIds);
    paginatedRows.forEach((p) => next.add(p.id));
    setSelectedIds(Array.from(next));
  };

  const deleteSelected = () => {
    if (!canDeleteProducts || selectedIds.length === 0) return;
    setPendingBulkDelete(true);
  };

  const productFilterSections = useMemo(() => {
    const stockOpts = [
      { value: "out", label: "Out of stock" },
      { value: "in_stock", label: "In stock" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ].map((opt) => ({
      ...opt,
      count: rows.filter((p) => {
        if (opt.value === "out") return Number(p.stock) === 0;
        if (opt.value === "in_stock") return Number(p.stock) > 0;
        if (opt.value === "active") return !!p.is_active;
        if (opt.value === "inactive") return !p.is_active;
        return false;
      }).length,
    }));

    const genderOpts = GENDER_OPTIONS.map((opt) => ({
      value: opt.key,
      label: opt.label,
      count: rows.filter((p) => matchesGender(String(p.category?.slug || "").toLowerCase(), opt.key)).length,
    }));

    const sectionOpts = sectionTabs.map((tab) => ({
      value: tab.key,
      label: tab.title,
      count: rows.filter((p) => {
        const catName = String(p.category?.name || "").toLowerCase();
        const catSlug = String(p.category?.slug || "").toLowerCase();
        return catName.includes(tab.key.toLowerCase()) || catSlug.includes(tab.key.toLowerCase());
      }).length,
    }));

    const categoryOpts = catalogCategories
      .map((c) => ({
        value: String(c.id),
        label: c.name || "—",
        count: rows.filter((p) => String(p.category_id || "") === String(c.id)).length,
      }))
      .filter((o) => o.count > 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    const stockNameSeen = new Map();
    for (const product of rows) {
      const key = stockLabelKeyForProduct(product);
      if (!key || stockNameSeen.has(key)) continue;
      const label = categories.find((c) => String(c.id) === key);
      if (label) stockNameSeen.set(key, formatStockBarcodePickerLabel(label));
    }
    const stockNameOpts = [
      {
        value: FILTER_NONE,
        label: "No stock label",
        count: rows.filter((p) => !stockLabelKeyForProduct(p)).length,
      },
      ...[...stockNameSeen.entries()]
        .map(([value, label]) => ({
          value,
          label,
          count: rows.filter((p) => stockLabelKeyForProduct(p) === value).length,
        }))
        .filter((o) => o.count > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];

    const supplierSeen = new Map();
    for (const product of rows) {
      const key = supplierKeyForProduct(product);
      if (!key || supplierSeen.has(key)) continue;
      const supplier = suppliers.find((s) => String(s.id) === key);
      if (supplier) supplierSeen.set(key, formatSupplierOptionLabel(supplier));
    }
    const supplierOpts = [
      {
        value: FILTER_NONE,
        label: "No supplier",
        count: rows.filter((p) => !supplierKeyForProduct(p)).length,
      },
      ...[...supplierSeen.entries()]
        .map(([value, label]) => ({
          value,
          label,
          count: rows.filter((p) => supplierKeyForProduct(p) === value).length,
        }))
        .filter((o) => o.count > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];

    return [
      { id: "stock", title: "Stock", options: stockOpts },
      { id: "gender", title: "Gender", options: genderOpts },
      ...(sectionOpts.length ? [{ id: "section", title: "Section / type", options: sectionOpts }] : []),
      { id: "category", title: "Categories", options: categoryOpts },
      { id: "stockName", title: "Stock name", options: stockNameOpts },
      { id: "supplier", title: "Supplier", options: supplierOpts },
    ];
  }, [rows, sectionTabs, catalogCategories, categories, suppliers, stockBarcodePickerOptions]);

  const renderProductListRow = (p) => (
    <tr
      key={p.id}
      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
      onClick={handleProductRowClick(p)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (isProductRowClickTarget(e.target)) return;
        e.preventDefault();
        openProductDetail(p);
      }}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${p.name}`}
    >
      {isColVisible("select") && canDeleteProducts ? (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedIds.includes(p.id)}
            onChange={() => toggleSelect(p.id)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
          />
        </td>
      ) : null}
      {isColVisible("productName") ? (
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-xs overflow-hidden shrink-0">
              {p.image_url ? (
                <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                p.name?.charAt(0)?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{p.name}</p>
            </div>
          </div>
        </td>
      ) : null}
      {isColVisible("brand") ? (
        <td className={`px-4 py-3 ${tableCellTextClass(brandNameForProduct(p))}`}>{brandNameForProduct(p)}</td>
      ) : null}
      {isColVisible("category") ? (
        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{p.category?.name || EMPTY_TABLE_CELL}</td>
      ) : null}
      {isColVisible("costPrice") ? (
        <td className={`px-4 py-3 text-sm tabular-nums ${tableCellTextClass(formatProductCatalogCost(p))}`}>
          {formatProductCatalogCost(p)}
        </td>
      ) : null}
      {isColVisible("sellPrice") ? (
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {formatProductCatalogSell(p)}
        </td>
      ) : null}
      {isColVisible("totalStock") ? (
        <td className="px-4 py-3 text-sm tabular-nums text-slate-600 dark:text-slate-300">
          {totalStockForProduct(p).toLocaleString()}
        </td>
      ) : null}
      {isColVisible("sizes") ? (
        <td className={`px-4 py-3 max-w-[12rem] ${tableCellTextClass(sizesAvailableLabel(p.sizes))}`}>
          <span className="line-clamp-2">{sizesAvailableLabel(p.sizes)}</span>
        </td>
      ) : null}
      {isColVisible("colors") ? (
        <td className={`px-4 py-3 max-w-[12rem] ${tableCellTextClass(colorsAvailableLabel(p.colors))}`}>
          <span className="line-clamp-2">{colorsAvailableLabel(p.colors)}</span>
        </td>
      ) : null}
      {isColVisible("status") ? (
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${p.is_active
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-300"
              }`}
          >
            {p.is_active ? "Active" : "Inactive"}
          </span>
        </td>
      ) : null}
      {isColVisible("actions") ? (
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {canEditProducts ? (
            <button
              type="button"
              onClick={() => startEdit(p)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[5px] border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-200 dark:hover:bg-white/10"
              title="Edit"
              aria-label="Edit product"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            ) : null}
            {canDeleteProducts ? (
            <button
              type="button"
              onClick={() => del(p.id)}
              className="inline-flex transition-colors"
              style={deleteIconButtonStyle}
              aria-label="Delete product"
              title="Delete"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );

  if (!embeddedInPo && loading) return <AdminContentSkeleton lines={3} imageHeight={240} />;

  if (embeddedInPo && loading) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center p-6">
        <AdminSectionLoader rows={4} />
      </div>
    );
  }

  const wrapCreateForm = (inner) => {
    if (embeddedInPo) {
      if (!embeddedOpen || !showCreateForm) return null;
      return inner;
    }
    return (
      <AdminModal
        open={showCreateForm}
        onClose={closeCreateForm}
        title="Add new product"
        titleId="create-product-form-title"
        maxWidthClass="max-w-5xl"
        closeOnBackdrop={!isCreating}
      >
        {inner}
      </AdminModal>
    );
  };

  return (
 <>
      {!embeddedInPo ? (
        <div>
          <div className="w-full min-w-0 space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Products</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your product catalog</p>
              </div>
              {canCreateProducts ? (
              <button
                onClick={() => {
                  setCreateFieldErrors({});
                  setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
                  setCreateVariantMatrix([emptyVariantMatrixRow()]);
                  setForm((s) => ({ ...s, has_variants: true }));
                  setShowCreateForm(true);
                }}
                className="inline-flex items-center gap-1.5 h-9 rounded-[5px] px-3 text-sm font-medium text-white transition hover:brightness-110 bg-[color:var(--admin-primary)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Product
              </button>
              ) : null}
            </div>

            {/* Stat cards */}
            <div className="admin-stat-grid grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: "Total Sales", value: `$${Number(rows.reduce((s, p) => s + Number(p.price || 0) * (p.sold_count || 0), 0) || 0).toLocaleString()}`, sub: "+20.1%" },
                { label: "Total Products", value: rows.length.toLocaleString(), sub: "+5.02%" },
                { label: "Active Products", value: rows.filter((p) => p.is_active).length.toLocaleString(), sub: "+3.1%" },
                { label: "Out of Stock", value: rows.filter((p) => Number(p.stock) === 0).length.toLocaleString(), sub: "-3.58%" },
              ].map((c, index) => (
                <div key={c.label} className="admin-surface admin-spectrum-kpi rounded-xl border admin-border p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-none">{c.value}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{c.sub} from last month</p>
                </div>
              ))}
            </div>

            {/* Error Alert */}
            {err && (
              <div className="mb-6 rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 flex items-center gap-3 animate-shake dark:border-[#7f1d1d]/60 dark:bg-[#450a0a]/45">
                <svg className="w-6 h-6 flex-shrink-0 text-[#ef4444] dark:text-[#f87171]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-[#991b1b] dark:text-[#fecaca]">{err}</span>
                <button onClick={() => setErr("")} className="ml-auto text-[#dc2626] transition-colors hover:text-[#991b1b] dark:text-[#fca5a5] dark:hover:text-[#fecaca]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <AdminConfirmDialog
              open={pendingDeleteId != null || pendingBulkDelete}
              onClose={() => {
                if (deleteBusy) return;
                setPendingDeleteId(null);
                setPendingBulkDelete(false);
              }}
              onConfirm={confirmDelete}
              title={pendingBulkDelete ? "Delete selected products?" : "Delete this product?"}
              message={
                pendingBulkDelete
                  ? `Permanently remove ${selectedIds.length} selected product(s)? This cannot be undone.`
                  : "This action cannot be undone. The product will be removed from your catalog."
              }
              confirmLabel="Delete"
              cancelLabel="Cancel"
              destructive
              busy={deleteBusy}
            />

            <ProductDetailDrawer
              open={detailProduct != null}
              product={detailProduct}
              onClose={closeProductDetail}
            />
          </div>
        </div>
      ) : null}

      {wrapCreateForm(
        <>
          <p className="-mt-2 mb-6 text-sm font-medium text-[#183c6b]/90 dark:text-slate-400">
            Required fields are marked with an asterisk (*).
          </p>

          <form onSubmit={create} className="space-y-8">
            <div className="space-y-8">
              <fieldset className="min-w-0 space-y-5 border-0 p-0">
                <legend className="sr-only">Product information</legend>

                {/* Row 1: Product name */}
                <div className="min-w-0">
                  <label htmlFor="create-product-name" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
                    Product name <span className="text-red-500" aria-hidden>*</span>
                  </label>
                  <input
                    id="create-product-name"
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    required
                    autoComplete="off"
                    className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
                    placeholder="e.g. Classic fit tee"
                  />
                </div>

                {/* Row 2: Category | Brand */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                  <FieldWithQuickCreate
                    label="Category"
                    htmlFor="create-product-category"
                    required
                  >
                    <select
                      id="create-product-category"
                      value={form.category_id}
                      onChange={onCategorySelectChange("create")}
                      required
                      className={productRelationSelectCls}
                    >
                      {canCreateCategories ? <CreateNewSelectOption /> : null}
                      <option value="">Select a category</option>
                      {catalogCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </FieldWithQuickCreate>
                  <FieldWithQuickCreate
                    label="Brand"
                    htmlFor="create-product-brand"
                    required
                    invalid={Boolean(createFieldErrors.brand_id)}
                  >
                    <select
                      id="create-product-brand"
                      value={form.brand_id}
                      onChange={onBrandSelectChange("create")}
                      className={`${productRelationSelectCls}${createInputErrorClass(createFieldErrors.brand_id)}`}
                    >
                      {canCreateBrands ? <CreateNewSelectOption /> : null}
                      <option value="">Select a brand</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </FieldWithQuickCreate>
                </div>

                <CatalogPricingReadOnly />

              </fieldset>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 dark:shadow-none">
                  <div className="border-b border-slate-200/90 px-4 py-3 sm:px-5 sm:py-4 dark:border-slate-800">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--admin-primary-rgb),0.14)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.22)]">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-sm font-bold uppercase tracking-[0.12em] sm:text-base ${createFieldErrors.photos ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>
                          Product photos
                          {requiredFieldMark()}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    {(() => {
                      const slotIdx = createPhotoActiveSlot;
                      const gi = slotIdx - 1;
                      const previewSrc = slotIdx === 0 ? form.image_url || "" : createGallerySlotUrls[gi] || "";
                      const showPreviewTools = slotIdx === 0 || (slotIdx >= 1 && slotIdx <= CREATE_FORM_GALLERY_SLOTS);
                      const openCreatePicker = (idx) => {
                        setCreatePhotoActiveSlot(idx);
                        if (idx === 0) {
                          setImageUrlPicker({ form: "create", area: "main" });
                          setImageUrlPickerDraft(form.image_url.startsWith("data:") ? "" : form.image_url || "");
                          return;
                        }
                        const gIndex = idx - 1;
                        const cur = createGallerySlotUrls[gIndex] || "";
                        setImageUrlPicker({ form: "create", area: "gallery", index: gIndex, filled: Boolean(cur) });
                        setImageUrlPickerDraft(cur && String(cur).startsWith("data:") ? "" : cur || "");
                      };
                      const maxPhotoSlot = CREATE_FORM_GALLERY_SLOTS;
                      return (
                        <div className="rounded-xl bg-slate-50/90 p-4 sm:p-5 dark:bg-slate-900/50">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
                            {/* Thumbnails column (left on desktop) */}
                            <div className="flex w-full shrink-0 flex-row flex-wrap content-start justify-center gap-2.5 sm:w-[5rem] sm:flex-col sm:justify-start sm:gap-2.5">
                              <button
                                type="button"
                                onClick={() => openCreatePicker(0)}
                                className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 transition sm:w-full dark:bg-slate-800/55 ${createPhotoActiveSlot === 0
                                    ? "border-[color:var(--admin-primary)] ring-2 ring-[rgba(var(--admin-primary-rgb),0.25)]"
                                    : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                                  }`}
                                aria-label="Cover image — add or change"
                              >
                                {form.image_url ? (
                                  <>
                                    <img src={resolveImageUrl(form.image_url)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                    <div
                                      className="absolute bottom-0 left-0 right-0 z-[1] py-1 text-center text-[10px] font-bold uppercase tracking-[0.14em]"
                                      style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#ffffff" }}
                                    >
                                      COVER
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-1 pb-5 pt-2">
                                      <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500" strokeWidth={2} aria-hidden />
                                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Cover</span>
                                    </div>
                                    <div
                                      className="absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-bold uppercase tracking-[0.14em]"
                                      style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#ffffff" }}
                                    >
                                      COVER
                                    </div>
                                  </>
                                )}
                              </button>
                              {Array.from({ length: CREATE_FORM_GALLERY_SLOTS }, (_, i) => {
                                const si = i + 1;
                                const url = createGallerySlotUrls[i] || "";
                                const filled = Boolean(url);
                                return (
                                  <button
                                    key={`cg-slot-${i}`}
                                    type="button"
                                    onClick={() => openCreatePicker(si)}
                                    className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 p-1.5 transition sm:w-full dark:bg-slate-800/55 ${createPhotoActiveSlot === si
                                        ? "border-[color:var(--admin-primary)] ring-2 ring-[rgba(var(--admin-primary-rgb),0.25)]"
                                        : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                                      }`}
                                    aria-label={filled ? `Gallery image ${i + 1}` : `Add gallery image ${i + 1}`}
                                  >
                                    {filled ? (
                                      <img src={resolveImageUrl(url)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                    ) : (
                                      <>
                                        <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500" strokeWidth={2} aria-hidden />
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Gallery</span>
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {/* Main preview (right on desktop) */}
                            <div className="min-h-[240px] min-w-0 flex-1 sm:min-h-[280px]">
                              <div
                                role="presentation"
                                tabIndex={-1}
                                className={`group/prev relative flex h-full min-h-[240px] w-full flex-col overflow-hidden rounded-xl border-2 border-dashed border-slate-200/95 bg-slate-100/60 dark:border-slate-600 dark:bg-slate-800/40 sm:min-h-[280px] ${previewSrc ? "border-solid border-slate-200 dark:border-slate-600" : ""
                                  }`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const f = e.dataTransfer.files?.[0];
                                  if (!f || !isAcceptableProductImageFile(f)) return;
                                  if (f.size > ADD_IMAGE_MAX_BYTES) {
                                    setErr("Image must be 10 MB or smaller.");
                                    return;
                                  }
                                  if (slotIdx === 0) {
                                    applyMainImageFile(f);
                                    return;
                                  }
                                  if (!showPreviewTools) return;
                                  const r = await ingestCreateGallerySlotFileList([f], gi);
                                  if (!r.ok && r.error) setErr(r.error);
                                }}
                              >
                                {previewSrc ? (
                                  <img src={resolveImageUrl(previewSrc)} alt="" className="mx-auto max-h-[min(52vh,420px)] w-full flex-1 object-contain p-2" />
                                ) : (
                                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                                    <svg className="h-14 w-14 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 48 48" aria-hidden>
                                      <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
                                      <circle cx="16" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
                                      <path d="M4 34l10-10 8 8 6-6 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <p className="max-w-[16rem] text-sm text-slate-500 dark:text-slate-400">Select a thumbnail to preview</p>
                                  </div>
                                )}
                                {showPreviewTools ? (
                                  <div className="pointer-events-auto absolute bottom-3 right-3 flex gap-1.5">
                                    <button
                                      type="button"
                                      className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-slate-600 dark:hover:bg-slate-500"
                                      aria-label="Previous photo slot"
                                      title="Previous slot"
                                      disabled={slotIdx <= 0}
                                      onClick={() => setCreatePhotoActiveSlot((s) => Math.max(0, s - 1))}
                                    >
                                      <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-slate-600 dark:hover:bg-slate-500"
                                      aria-label="Next photo slot"
                                      title="Next slot"
                                      disabled={slotIdx >= maxPhotoSlot}
                                      onClick={() => setCreatePhotoActiveSlot((s) => Math.min(maxPhotoSlot, s + 1))}
                                    >
                                      <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {isUploading ? (
                            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              <AdminDashboardLoader size={20} />
                              Uploading…
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="create-product-description" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Description
                </label>
                <textarea
                  id="create-product-description"
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  rows={4}
                  className="w-full min-h-[7.5rem] resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
                  placeholder="Short description for listings and search…"
                />
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 sm:items-start">
                  <div className="min-w-0">
                    <span className={createLabelClass("colors")}>
                      Colors available
                      {requiredFieldMark()}
                    </span>
                    <input
                      ref={createColorFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onCreateColorFileSelected}
                      aria-hidden
                      tabIndex={-1}
                    />
                    <div className="space-y-3">
                      {createColorVariants.map((row, idx) => (
                        <div
                          key={row.id}
                          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                        >
                          <button
                            type="button"
                            onClick={() => triggerCreateColorUpload(row.id)}
                            disabled={isCreating || isUploading}
                            aria-label={row.image_url ? "Replace swatch image" : "Upload swatch image"}
                            title={row.image_url ? "Replace swatch image" : "Upload swatch image"}
                            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-[color:var(--admin-primary)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            {row.image_url ? (
                              <img src={resolveImageUrl(row.image_url)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                <Upload className="h-4 w-4 shrink-0" aria-hidden />
                              </span>
                            )}
                          </button>
                          <div className="min-w-0 flex-1 flex flex-col gap-2">
                            <input
                              list="create-color-name-options"
                              id={`create-color-name-${row.id}`}
                              value={row.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCreateColorVariants((prev) => {
                                  const n = [...prev];
                                  if (n[idx]) n[idx] = { ...n[idx], name: v };
                                  return n;
                                });
                                if (v.trim()) clearCreateFieldError("colors");
                              }}
                              autoComplete="off"
                              placeholder="e.g. Black"
                              className={`min-h-[44px] w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)] border-slate-200 dark:border-slate-600${createFieldErrors.colors ? createInputErrorClass(true) : ""}`}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {row.image_url ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCreateColorVariants((prev) => {
                                      const n = [...prev];
                                      if (n[idx]) n[idx] = { ...n[idx], image_url: "" };
                                      return n;
                                    })
                                  }
                                  disabled={isCreating}
                                  aria-label="Clear swatch image"
                                  title="Clear swatch image"
                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[color:var(--admin-primary)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                                >
                                  <X className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                                </button>
                              ) : null}
                              {createColorVariants.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const removed = String(createColorVariants[idx]?.name ?? "").trim();
                                    setCreateColorVariants((prev) => prev.filter((_, i) => i !== idx));
                                    if (removed) {
                                      setCreateVariantMatrix((prev) =>
                                        prev.map((row) =>
                                          String(row.color ?? "").trim().toLowerCase() === removed.toLowerCase()
                                            ? { ...row, color: "" }
                                            : row
                                        )
                                      );
                                    }
                                  }}
                                  disabled={isCreating}
                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-400 dark:hover:bg-red-950/40"
                                  aria-label="Remove color row"
                                  title="Remove color"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setCreateColorVariants((prev) => [...prev, { id: newColorRowId(), name: "", image_url: "" }])
                        }
                        disabled={isCreating}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--admin-primary)] hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4 shrink-0" aria-hidden />
                        Add color
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className={createLabelClass("sizes")}>
                      Sizes available
                      {requiredFieldMark()}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {!form.category_id ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">Select a category above to see size presets.</span>
                      ) : sizeOptions.length === 0 ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400">No presets for this category — use Add below.</span>
                      ) : null}
                      {sizeOptions.map((size) => (
                        <label
                          key={size}
                          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded border text-xs font-semibold transition select-none ${form.category_id ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                            } ${form.sizes.includes(size)
                              ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.2)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
                            }`}
                          title={size}
                        >
                          <input
                            type="checkbox"
                            checked={form.sizes.includes(size)}
                            disabled={!form.category_id || isCreating}
                            onChange={() => {
                              setForm((s) => {
                                const sizes = s.sizes.includes(size) ? s.sizes.filter((v) => v !== size) : [...s.sizes, size];
                                if (sizes.length) clearCreateFieldError("sizes");
                                return { ...s, sizes };
                              });
                            }}
                            className="sr-only"
                            aria-label={`Size ${size}`}
                          />
                          <span aria-hidden>{size}</span>
                        </label>
                      ))}
                      <input
                        value={customSize}
                        onChange={(e) => setCustomSize(e.target.value)}
                        placeholder="Custom size"
                        aria-label="Custom size"
                        disabled={!form.category_id || isCreating}
                        className={`h-11 min-w-[6rem] flex-1 rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:min-w-[8rem] border-slate-200 dark:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50${createFieldErrors.sizes ? createInputErrorClass(true) : ""}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const value = customSize.trim();
                            if (!value) return;
                            setForm((s) => {
                              const sizes = s.sizes.includes(value) ? s.sizes : [...s.sizes, value];
                              if (sizes.length) clearCreateFieldError("sizes");
                              return { ...s, sizes };
                            });
                            setCustomSize("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={!form.category_id || isCreating}
                        onClick={() => {
                          const value = customSize.trim();
                          if (!value) return;
                          setForm((s) => {
                            const sizes = s.sizes.includes(value) ? s.sizes : [...s.sizes, value];
                            if (sizes.length) clearCreateFieldError("sizes");
                            return { ...s, sizes };
                          });
                          setCustomSize("");
                        }}
                        className="h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: accentIsWhite ? "#15803d" : accentColor }}
                      >
                        Add
                      </button>
                    </div>
                    {Array.isArray(form.sizes) && form.sizes.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {form.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() =>
                              setForm((s) => ({
                                ...s,
                                sizes: s.sizes.filter((v) => v !== size),
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            title="Remove size"
                          >
                            {size}
                            <span className="text-slate-400" aria-hidden>×</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <datalist id="create-color-name-options">
                  <option value="Black" />
                  <option value="White" />
                  <option value="Navy" />
                  <option value="Red" />
                  <option value="Beige" />
                  <option value="Gray" />
                  <option value="Olive" />
                  <option value="Khaki" />
                </datalist>
              </div>

              <footer className="mt-2 border-t border-slate-200 pt-6 dark:border-slate-800">
                {createError ? (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                    {createError}
                  </div>
                ) : null}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCreateForm}
                    disabled={isCreating}
                    className="inline-flex h-11 min-w-[7rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !canCreateProducts}
                    className="inline-flex h-11 min-w-[10rem] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
                  >
                    {isCreating ? (
                      <AdminDashboardLoader size={22} />
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                    {isCreating ? "Creating…" : "Add product"}
                  </button>
                </div>
              </footer>
            </div>
          </form>
          <input
            ref={createCoverFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only fixed left-0 top-0 -z-10 h-px w-px opacity-0"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (e.target) e.target.value = "";
              if (f) applyMainImageFile(f);
            }}
          />
          <input
            ref={createGalleryFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only fixed left-0 top-0 -z-10 h-px w-px opacity-0"
            aria-hidden
            tabIndex={-1}
            onChange={handleCreateGalleryFileInput}
          />
        </>
      )}


      {!embeddedInPo ? (
        <>
          {/* Products table card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative z-10 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                  <div className="shrink-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {listFilters.activeCount === 0 ? "All Products" : `Filtered products`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {listUsePagination
                        ? `${paginatedRows.length} on this page · ${sortedRows.length} total`
                        : `${sortedRows.length} product${sortedRows.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products, barcode, SKU…"
                  className="h-8 min-w-[10rem] flex-1 rounded-[5px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-600 sm:max-w-[14rem] sm:flex-initial sm:min-w-0 sm:w-44"
                />

                <AdminFilterToolbarButton
                  activeCount={listFilters.activeCount + yearMonthFilter.activeCount}
                  onClick={() => {
                    yearMonthFilter.syncDraftFromApplied();
                    listFilters.openDrawer();
                  }}
                  className="h-8 rounded-[5px]"
                />

                <AdminSortMenu
                  sortBy={productSort.sortBy}
                  sortDir={productSort.sortDir}
                  groupBy={productSort.groupBy}
                  onSortByChange={(sortBy) => setProductSort((s) => ({ ...s, sortBy }))}
                  onSortDirChange={(sortDir) => setProductSort((s) => ({ ...s, sortDir }))}
                  onGroupByChange={(groupBy) => setProductSort((s) => ({ ...s, groupBy }))}
                />

                <AdminFilterDrawer
                  open={listFilters.open}
                  onClose={listFilters.closeDrawer}
                  sections={productFilterSections}
                  selected={listFilters.draft}
                  onToggle={listFilters.toggleDraft}
                  onApply={() => {
                    yearMonthFilter.apply();
                    listFilters.apply();
                  }}
                  onClearAll={() => {
                    yearMonthFilter.clear();
                    listFilters.clearAll();
                  }}
                  yearMonth={{
                    value: yearMonthFilter.draft,
                    onChange: yearMonthFilter.setDraft,
                    startYear: 2020,
                    title: "Added date",
                    hint: "Filter by when the product was added to the catalog.",
                  }}
                />

                <div
                  role="group"
                  aria-label="View mode"
                  className="inline-flex items-center rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5"
                >
                  {[
                    { mode: "list", icon: <ListIcon className="w-3.5 h-3.5" />, label: "List" },
                    { mode: "grid", icon: <LayoutGridIcon className="w-3.5 h-3.5" />, label: "Grid" },
                    { mode: "split", icon: <Columns2Icon className="w-3.5 h-3.5" />, label: "Split" },
                  ].map((v) => (
                    <button
                      key={v.mode}
                      onClick={() => setViewMode(v.mode)}
                      aria-label={`${v.label} view`}
                      className={`h-7 px-2 rounded-[5px] text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === v.mode ? "" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      style={viewMode === v.mode ? { backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#fff" } : undefined}
                    >
                      {v.icon}{v.label}
                    </button>
                  ))}
                </div>

                {canDeleteProducts ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
                  />
                  Select all
                </label>
                ) : null}

                {canDeleteProducts && selectedIds.length > 0 ? (
                  <button
                    onClick={deleteSelected}
                    className="h-8 rounded-[5px] border border-[#fecaca] bg-transparent px-3 text-xs font-medium text-[#b91c1c] transition-colors hover:bg-[#fef2f2] dark:border-[#7f1d1d]/55 dark:text-[#fca5a5] dark:hover:bg-[#450a0a]/40"
                  >
                    Delete ({selectedIds.length})
                  </button>
                ) : null}

                <button
                  onClick={load}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  title="Refresh"
                >
                  {loading ? (
                    <AdminDashboardLoader size={18} />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>

                <TableColumnVisibilityMenu
                  columns={PRODUCTS_TABLE_COLUMNS}
                  visibility={columnVisibility}
                  onToggle={toggleTableColumn}
                  onShowAll={() => setAllTableColumnsVisible(true)}
                  onHideAll={() => setAllTableColumnsVisible(false)}
                />
              </div>
            </div>

            {loading ? (
              <AdminSectionLoader rows={6} />
            ) : filteredRows.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-slate-500 dark:text-slate-200 text-lg">No products yet</p>
                <p className="text-slate-400 dark:text-slate-400 text-sm mt-1">Create your first product above</p>
              </div>
            ) : (
              <>
            {viewMode === "list" ? (
              <div className="overflow-x-auto rounded-b-xl">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {isColVisible("select") && canDeleteProducts ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 w-8"></th>
                      ) : null}
                      {isColVisible("productName") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Product Name</th>
                      ) : null}
                      {isColVisible("brand") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Brand</th>
                      ) : null}
                      {isColVisible("category") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Category</th>
                      ) : null}
                      {isColVisible("costPrice") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Cost/unit</th>
                      ) : null}
                      {isColVisible("sellPrice") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Sell price</th>
                      ) : null}
                      {isColVisible("totalStock") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Total Stock</th>
                      ) : null}
                      {isColVisible("sizes") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Sizes available</th>
                      ) : null}
                      {isColVisible("colors") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Colors available</th>
                      ) : null}
                      {isColVisible("status") ? (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
                      ) : null}
                      {isColVisible("actions") ? (
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400"></th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {productGroups
                      ? productGroups.flatMap((group) => [
                        <tr key={`group-${group.key}`} className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/40">
                          <td colSpan={visibleTableColumnCount} className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <span className="uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Group · </span>
                            {group.label}
                            <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">({group.items.length})</span>
                          </td>
                        </tr>,
                        ...group.items.map((p) => renderProductListRow(p)),
                      ])
                      : paginatedRows.map((p) => renderProductListRow(p))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "split" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                {splitColumns.map((columnRows, columnIndex) => (
                  <div key={columnIndex} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Column {columnIndex + 1}
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {columnRows.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No products</div>
                      ) : (
                        columnRows.map((p) => {
                          const splitMeta = [
                            isColVisible("brand") ? brandNameForProduct(p) : null,
                            isColVisible("category") ? (p.category?.name || EMPTY_TABLE_CELL) : null,
                            isColVisible("costPrice") ? formatProductCatalogCost(p) : null,
                            isColVisible("sellPrice") ? formatProductCatalogSell(p) : null,
                            isColVisible("totalStock") ? `Stock: ${totalStockForProduct(p).toLocaleString()}` : null,
                            isColVisible("sizes") ? sizesAvailableLabel(p.sizes) : null,
                            isColVisible("colors") ? colorsAvailableLabel(p.colors) : null,
                          ].filter(Boolean);
                          return (
                            <div key={p.id} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={handleProductRowClick(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { if (!isProductRowClickTarget(e.target)) { e.preventDefault(); openProductDetail(p); } } }} role="button" tabIndex={0} aria-label={`View details for ${p.name}`}>
                              {isColVisible("select") && canDeleteProducts ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(p.id)}
                                  onChange={() => toggleSelect(p.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-0"
                                />
                              ) : null}
                              {isColVisible("productName") ? (
                                <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs overflow-hidden shrink-0">
                                  {p.image_url ? (
                                    <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    p.name?.charAt(0)?.toUpperCase()
                                  )}
                                </div>
                              ) : null}
                              <div className="min-w-0 flex-1">
                                {isColVisible("productName") ? (
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                                ) : null}
                                {splitMeta.length > 0 ? (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{splitMeta.join(" • ")}</p>
                                ) : null}
                              </div>
                              {isColVisible("status") ? (
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${p.is_active
                                      ? "border-[rgba(var(--admin-primary-rgb),0.35)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-[color:var(--admin-primary)]"
                                      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-300"
                                    }`}
                                >
                                  {p.is_active ? "Active" : "Inactive"}
                                </span>
                              ) : null}
                              {isColVisible("actions") ? (
                                <div className="flex items-center gap-1">
                                  {canEditProducts ? (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(p)}
                                    className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px] transition-colors"
                                    title="Edit"
                                    aria-label="Edit product"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  ) : null}
                                  {canDeleteProducts ? (
                                  <button
                                    type="button"
                                    onClick={() => del(p.id)}
                                    className="transition-colors"
                                    style={deleteIconButtonStyle}
                                    aria-label="Delete product"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
                {paginatedRows.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
                    onClick={handleProductRowClick(p)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      if (isProductRowClickTarget(e.target)) return;
                      e.preventDefault();
                      openProductDetail(p);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${p.name}`}
                  >
                    {/* Image */}
                    {(isColVisible("select") || isColVisible("status") || isColVisible("productName")) ? (
                      <div className="relative aspect-square bg-slate-50 dark:bg-slate-800">
                        {isColVisible("productName") ? (
                          p.image_url ? (
                            <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-300 dark:text-slate-600">
                              {p.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )
                        ) : null}
                        {(isColVisible("select") || isColVisible("status")) ? (
                          <div className="absolute top-2 right-2 flex items-center gap-1.5">
                              {isColVisible("select") && canDeleteProducts ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(p.id)}
                                onChange={() => toggleSelect(p.id)}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white/90"
                              />
                            ) : null}
                            {isColVisible("status") ? (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${p.is_active
                                  ? "border border-[rgba(var(--admin-primary-rgb),0.45)] bg-[var(--admin-primary)] text-white"
                                  : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-200"
                                }`}>
                                {p.is_active ? "Active" : "Inactive"}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Info */}
                    <div className="p-3">
                      {isColVisible("productName") ? (
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate leading-snug">{p.name}</p>
                      ) : null}
                      {isColVisible("brand") ? (
                        <p className={`mt-0.5 truncate ${gridMetaTextClass(brandNameForProduct(p))}`}>{brandNameForProduct(p)}</p>
                      ) : null}
                      {isColVisible("category") ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{p.category?.name || EMPTY_TABLE_CELL}</p>
                      ) : null}
                      {isColVisible("sizes") ? (
                        <p className={`mt-0.5 truncate ${gridMetaTextClass(sizesAvailableLabel(p.sizes))}`}>Sizes: {sizesAvailableLabel(p.sizes)}</p>
                      ) : null}
                      {isColVisible("colors") ? (
                        <p className={`mt-0.5 truncate ${gridMetaTextClass(colorsAvailableLabel(p.colors))}`}>Colors: {colorsAvailableLabel(p.colors)}</p>
                      ) : null}

                      {(isColVisible("costPrice") || isColVisible("sellPrice") || isColVisible("actions")) ? (
                        <div className="flex items-center justify-between mt-2">
                          {(isColVisible("costPrice") || isColVisible("sellPrice")) ? (
                            <div>
                              {isColVisible("costPrice") ? (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">Cost: {formatProductCatalogCost(p)}</p>
                              ) : null}
                              {isColVisible("sellPrice") ? (
                                <p className="text-base font-bold text-slate-900 dark:text-slate-100">{formatProductCatalogSell(p)}</p>
                              ) : null}
                              {isColVisible("totalStock") ? (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Stock: {totalStockForProduct(p).toLocaleString()}</p>
                              ) : null}
                            </div>
                          ) : <div />}
                          {isColVisible("actions") ? (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canEditProducts ? (
                              <button
                                type="button"
                                onClick={() => startEdit(p)}
                                className="h-7 w-7 flex items-center justify-center rounded-[5px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
                                title="Edit"
                                aria-label="Edit product"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              ) : null}
                              {canDeleteProducts ? (
                              <button
                                type="button"
                                onClick={() => del(p.id)}
                                className="h-7 w-7 flex items-center justify-center rounded-[5px] border border-transparent text-[#dc2626] transition-colors hover:border-[#fecaca] hover:bg-[#fef2f2] dark:text-[#f87171] dark:hover:border-[#7f1d1d]/50 dark:hover:bg-[#450a0a]/35"
                                title="Delete"
                                aria-label="Delete product"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <AdminListPaginationBar
              page={listPage}
              lastPage={listLastPage}
              total={sortedRows.length}
              onPageChange={setListPage}
            />
              </>
            )}
          </div>

          <AdminModal
            open={!!editing}
            onClose={closeEditForm}
            title="Edit product"
            titleId="edit-product-form-title"
            maxWidthClass="max-w-5xl"
          >
            {editing ? (
              <>
                <p className="-mt-2 mb-6 text-sm font-medium text-[#183c6b]/90 dark:text-slate-400">
                  Required fields are marked with an asterisk (*).
                </p>
                <form
                  className="space-y-8"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveEdit();
                  }}
                >
                  <div className="space-y-8">
                    <fieldset className="min-w-0 space-y-5 border-0 p-0">
                      <legend className="sr-only">Product information</legend>

                      <div className="min-w-0">
                        <label htmlFor="edit-product-name" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
                          Product name <span className="text-red-500" aria-hidden>*</span>
                        </label>
                        <input
                          id="edit-product-name"
                          value={editing.name}
                          onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                          required
                          autoComplete="off"
                          className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
                          placeholder="e.g. Classic fit tee"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                        <FieldWithQuickCreate
                          label="Category"
                          htmlFor="edit-product-category"
                          required
                        >
                          <select
                            id="edit-product-category"
                            value={editing.category_id || ""}
                            onChange={onCategorySelectChange("edit")}
                            required
                            className={productRelationSelectCls}
                          >
                            {canCreateCategories ? <CreateNewSelectOption /> : null}
                            <option value="">Select a category</option>
                            {catalogCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </FieldWithQuickCreate>
                        <FieldWithQuickCreate
                          label="Brand"
                          htmlFor="edit-product-brand"
                          required
                          invalid={Boolean(editFieldErrors.brand_id)}
                        >
                          <select
                            id="edit-product-brand"
                            value={editing.brand_id || ""}
                            onChange={onBrandSelectChange("edit")}
                            className={`${productRelationSelectCls}${createInputErrorClass(editFieldErrors.brand_id)}`}
                          >
                            {canCreateBrands ? <CreateNewSelectOption /> : null}
                            <option value="">Select a brand</option>
                            {brands.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </FieldWithQuickCreate>
                      </div>

                      <CatalogPricingReadOnly productId={editing.id} product={editing} />

                    </fieldset>

                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 dark:shadow-none">
                        <div className="border-b border-slate-200/90 px-4 py-3 sm:px-5 sm:py-4 dark:border-slate-800">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--admin-primary-rgb),0.14)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.22)]">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <h3 className={`text-sm font-bold uppercase tracking-[0.12em] sm:text-base ${editFieldErrors.photos ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>
                                Product photos
                                {requiredFieldMark()}
                              </h3>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 sm:p-6">
                          {(() => {
                            const slotIdx = editPhotoActiveSlot;
                            const gi = slotIdx - 1;
                            const previewSrc = slotIdx === 0 ? editing.image_url || "" : editGallerySlotUrls[gi] || "";
                            const showPreviewTools = slotIdx === 0 || (slotIdx >= 1 && slotIdx <= CREATE_FORM_GALLERY_SLOTS);
                            const openEditPicker = (idx) => {
                              setEditPhotoActiveSlot(idx);
                              if (idx === 0) {
                                setImageUrlPicker({ form: "edit", area: "main" });
                                setImageUrlPickerDraft(editing.image_url?.startsWith("data:") ? "" : editing.image_url || "");
                                return;
                              }
                              const gIndex = idx - 1;
                              const cur = editGallerySlotUrls[gIndex] || "";
                              setImageUrlPicker({ form: "edit", area: "gallery", index: gIndex, filled: Boolean(cur) });
                              setImageUrlPickerDraft(cur && String(cur).startsWith("data:") ? "" : cur || "");
                            };
                            const maxPhotoSlot = CREATE_FORM_GALLERY_SLOTS;
                            return (
                              <div className="rounded-xl bg-slate-50/90 p-4 sm:p-5 dark:bg-slate-900/50">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
                                  {/* Thumbnails column (left on desktop) */}
                                  <div className="flex w-full shrink-0 flex-row flex-wrap content-start justify-center gap-2.5 sm:w-[5rem] sm:flex-col sm:justify-start sm:gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditPicker(0)}
                                      className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 transition sm:w-full dark:bg-slate-800/55 ${editPhotoActiveSlot === 0
                                          ? "border-[color:var(--admin-primary)] ring-2 ring-[rgba(var(--admin-primary-rgb),0.25)]"
                                          : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                                        }`}
                                      aria-label="Cover image — add or change"
                                    >
                                      {editing.image_url ? (
                                        <>
                                          <img src={resolveImageUrl(editing.image_url)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                          <div
                                            className="absolute bottom-0 left-0 right-0 z-[1] py-1 text-center text-[10px] font-bold uppercase tracking-[0.14em]"
                                            style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#ffffff" }}
                                          >
                                            COVER
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-1 pb-5 pt-2">
                                            <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500" strokeWidth={2} aria-hidden />
                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Cover</span>
                                          </div>
                                          <div
                                            className="absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-bold uppercase tracking-[0.14em]"
                                            style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#ffffff" }}
                                          >
                                            COVER
                                          </div>
                                        </>
                                      )}
                                    </button>
                                    {Array.from({ length: CREATE_FORM_GALLERY_SLOTS }, (_, i) => {
                                      const si = i + 1;
                                      const url = editGallerySlotUrls[i] || "";
                                      const filled = Boolean(url);
                                      return (
                                        <button
                                          key={`cg-slot-${i}`}
                                          type="button"
                                          onClick={() => openEditPicker(si)}
                                          className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 p-1.5 transition sm:w-full dark:bg-slate-800/55 ${editPhotoActiveSlot === si
                                              ? "border-[color:var(--admin-primary)] ring-2 ring-[rgba(var(--admin-primary-rgb),0.25)]"
                                              : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                                            }`}
                                          aria-label={filled ? `Gallery image ${i + 1}` : `Add gallery image ${i + 1}`}
                                        >
                                          {filled ? (
                                            <img src={resolveImageUrl(url)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                          ) : (
                                            <>
                                              <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500" strokeWidth={2} aria-hidden />
                                              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Gallery</span>
                                            </>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {/* Main preview (right on desktop) */}
                                  <div className="min-h-[240px] min-w-0 flex-1 sm:min-h-[280px]">
                                    <div
                                      role="presentation"
                                      tabIndex={-1}
                                      className={`group/prev relative flex h-full min-h-[240px] w-full flex-col overflow-hidden rounded-xl border-2 border-dashed border-slate-200/95 bg-slate-100/60 dark:border-slate-600 dark:bg-slate-800/40 sm:min-h-[280px] ${previewSrc ? "border-solid border-slate-200 dark:border-slate-600" : ""
                                        }`}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onDrop={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const f = e.dataTransfer.files?.[0];
                                        if (!f || !isAcceptableProductImageFile(f)) return;
                                        if (f.size > ADD_IMAGE_MAX_BYTES) {
                                          setErr("Image must be 10 MB or smaller.");
                                          return;
                                        }
                                        if (slotIdx === 0) {
                                          applyEditMainImageFile(f);
                                          return;
                                        }
                                        if (!showPreviewTools) return;
                                        const r = await ingestEditGallerySlotFileList([f], gi);
                                        if (!r.ok && r.error) setErr(r.error);
                                      }}
                                    >
                                      {previewSrc ? (
                                        <img src={resolveImageUrl(previewSrc)} alt="" className="mx-auto max-h-[min(52vh,420px)] w-full flex-1 object-contain p-2" />
                                      ) : (
                                        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                                          <svg className="h-14 w-14 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 48 48" aria-hidden>
                                            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
                                            <circle cx="16" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
                                            <path d="M4 34l10-10 8 8 6-6 16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                          <p className="max-w-[16rem] text-sm text-slate-500 dark:text-slate-400">Select a thumbnail to preview</p>
                                        </div>
                                      )}
                                      {showPreviewTools ? (
                                        <div className="pointer-events-auto absolute bottom-3 right-3 flex gap-1.5">
                                          <button
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-slate-600 dark:hover:bg-slate-500"
                                            aria-label="Previous photo slot"
                                            title="Previous slot"
                                            disabled={slotIdx <= 0}
                                            onClick={() => setEditPhotoActiveSlot((s) => Math.max(0, s - 1))}
                                          >
                                            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                                          </button>
                                          <button
                                            type="button"
                                            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-slate-600 dark:hover:bg-slate-500"
                                            aria-label="Next photo slot"
                                            title="Next slot"
                                            disabled={slotIdx >= maxPhotoSlot}
                                            onClick={() => setEditPhotoActiveSlot((s) => Math.min(maxPhotoSlot, s + 1))}
                                          >
                                            <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                {isUploading ? (
                                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    <AdminDashboardLoader size={20} />
                                    Uploading…
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="edit-product-description" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Description
                      </label>
                      <textarea
                        id="edit-product-description"
                        value={editing.description || ""}
                        onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))}
                        rows={4}
                        className="w-full min-h-[7.5rem] resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
                        placeholder="Short description for listings and search…"
                      />
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 sm:items-start">
                        <div className="min-w-0">
                          <span className={editLabelClass("colors")}>
                            Colors available
                            {requiredFieldMark()}
                          </span>
                          <input
                            ref={editColorFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onEditColorFileSelected}
                            aria-hidden
                            tabIndex={-1}
                          />
                          <div className="space-y-3">
                            {(Array.isArray(editing.colors) ? editing.colors : []).map((row, idx) => (
                              <div
                                key={row.id || `edit-color-${idx}`}
                                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                              >
                                <button
                                  type="button"
                                  onClick={() => triggerEditColorUpload(row.id)}
                                  disabled={isUploading}
                                  aria-label={row.image_url ? "Replace swatch image" : "Upload swatch image"}
                                  title={row.image_url ? "Replace swatch image" : "Upload swatch image"}
                                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-[color:var(--admin-primary)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                                >
                                  {row.image_url ? (
                                    <img src={resolveImageUrl(row.image_url)} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="flex h-full w-full items-center justify-center">
                                      <Upload className="h-4 w-4 shrink-0" aria-hidden />
                                    </span>
                                  )}
                                </button>
                                <div className="min-w-0 flex-1 flex flex-col gap-2">
                                  <input
                                    list="edit-color-name-options"
                                    id={`edit-color-name-${row.id || idx}`}
                                    value={row.name || ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setEditing((s) => {
                                        if (!s) return s;
                                        const colors = Array.isArray(s.colors) ? [...s.colors] : [];
                                        if (colors[idx]) colors[idx] = { ...colors[idx], name: v };
                                        return { ...s, colors };
                                      });
                                    }}
                                    autoComplete="off"
                                    placeholder="e.g. Black"
                                    className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
                                  />
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    {row.image_url ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditing((s) => {
                                            if (!s) return s;
                                            const colors = Array.isArray(s.colors) ? [...s.colors] : [];
                                            if (colors[idx]) colors[idx] = { ...colors[idx], image_url: "" };
                                            return { ...s, colors };
                                          })
                                        }
                                        aria-label="Clear swatch image"
                                        title="Clear swatch image"
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[color:var(--admin-primary)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                                      >
                                        <X className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                                      </button>
                                    ) : null}
                                    {(Array.isArray(editing.colors) ? editing.colors : []).length > 1 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const colors = Array.isArray(editing?.colors) ? editing.colors : [];
                                          const removed = String(colors[idx]?.name ?? "").trim();
                                          if (removed) {
                                            setEditVariantMatrix((prev) =>
                                              prev.map((row) =>
                                                String(row.color ?? "").trim().toLowerCase() === removed.toLowerCase()
                                                  ? { ...row, color: "" }
                                                  : row
                                              )
                                            );
                                          }
                                          setEditing((s) => {
                                            if (!s) return s;
                                            const c = Array.isArray(s.colors) ? s.colors : [];
                                            return { ...s, colors: c.filter((_, i) => i !== idx) };
                                          });
                                        }}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-900/50 dark:bg-red-400 dark:hover:bg-red-950/40"
                                        aria-label="Remove color row"
                                        title="Remove color"
                                      >
                                        <Trash2 className="h-4 w-4" aria-hidden />
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setEditing((s) =>
                                  s
                                    ? {
                                      ...s,
                                      colors: [...(Array.isArray(s.colors) ? s.colors : []), { id: newColorRowId(), name: "", image_url: "" }],
                                    }
                                    : s
                                )
                              }
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--admin-primary)] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Plus className="h-4 w-4 shrink-0" aria-hidden />
                              Add color
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className={editLabelClass("sizes")}>
                            Sizes available
                            {requiredFieldMark()}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {!editing.category_id ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400">Select a category above to see size presets.</span>
                            ) : editSizeOptions.length === 0 ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400">No presets for this category — use Add below.</span>
                            ) : null}
                            {editSizeOptions.map((size) => (
                              <label
                                key={size}
                                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded border text-xs font-semibold transition select-none ${editing.category_id ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                                  } ${(editing.sizes || []).includes(size)
                                    ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.2)]"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
                                  }`}
                                title={size}
                              >
                                <input
                                  type="checkbox"
                                  checked={(editing.sizes || []).includes(size)}
                                  disabled={!editing.category_id}
                                  onChange={() =>
                                    setEditing((s) => ({
                                      ...s,
                                      sizes: (s.sizes || []).includes(size) ? (s.sizes || []).filter((v) => v !== size) : [...(s.sizes || []), size],
                                    }))
                                  }
                                  className="sr-only"
                                  aria-label={`Size ${size}`}
                                />
                                <span aria-hidden>{size}</span>
                              </label>
                            ))}
                            <input
                              value={editCustomSize}
                              onChange={(e) => setEditCustomSize(e.target.value)}
                              placeholder="Custom size"
                              aria-label="Custom size"
                              disabled={!editing.category_id}
                              className="h-11 min-w-[6rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:min-w-[8rem] disabled:cursor-not-allowed disabled:opacity-50"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const value = editCustomSize.trim();
                                  if (!value) return;
                                  setEditing((s) => ({
                                    ...s,
                                    sizes: (s.sizes || []).includes(value) ? s.sizes : [...(s.sizes || []), value],
                                  }));
                                  setEditCustomSize("");
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!editing.category_id}
                              onClick={() => {
                                const value = editCustomSize.trim();
                                if (!value) return;
                                setEditing((s) => ({
                                  ...s,
                                  sizes: (s.sizes || []).includes(value) ? s.sizes : [...(s.sizes || []), value],
                                }));
                                setEditCustomSize("");
                              }}
                              className="h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ backgroundColor: accentIsWhite ? "#15803d" : accentColor }}
                            >
                              Add
                            </button>
                          </div>
                          {Array.isArray(editing.sizes) && editing.sizes.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {editing.sizes.map((size) => (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() =>
                                    setEditing((s) => ({
                                      ...s,
                                      sizes: (s.sizes || []).filter((v) => v !== size),
                                    }))
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                  title="Remove size"
                                >
                                  {size}
                                  <span className="text-slate-400" aria-hidden>×</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <datalist id="edit-color-name-options">
                        <option value="Black" />
                        <option value="White" />
                        <option value="Navy" />
                        <option value="Red" />
                        <option value="Beige" />
                        <option value="Gray" />
                        <option value="Olive" />
                        <option value="Khaki" />
                      </datalist>
                    </div>

                    <footer className="mt-2 border-t border-slate-200 pt-6 dark:border-slate-800">
                      {err ? (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
                          {err}
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
                        <button
                          type="button"
                          onClick={closeEditForm}
                          className="inline-flex h-11 min-w-[7rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        {canEditProducts ? (
                        <button
                          type="submit"
                          className="inline-flex h-11 min-w-[10rem] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                          style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
                        >
                          Save changes
                        </button>
                        ) : null}
                      </div>
                    </footer>
                  </div>
                </form>
                <input
                  ref={editGallerySlotFileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only fixed left-0 top-0 -z-10 h-px w-px opacity-0"
                  aria-hidden
                  tabIndex={-1}
                  onChange={handleEditGallerySlotFileInput}
                />
              </>
            ) : null}
          </AdminModal>


          {imageUrlPicker &&
            createPortal(
              <div
                className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[4px]"
                role="presentation"
                onClick={resetImageUrlPicker}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="image-url-picker-title"
                  aria-describedby="image-url-picker-subtitle"
                  className="admin-theme w-[min(440px,92vw)] rounded-[18px] border border-[color:var(--admin-card-border)] bg-[var(--admin-card-bg)] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <h4
                    id="image-url-picker-title"
                    className="text-[22px] font-normal leading-tight tracking-[1px] text-[color:var(--admin-heading)] dark:text-slate-100"
                    style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                  >
                    Add Image
                  </h4>
                  <p id="image-url-picker-subtitle" className="mt-1 text-xs text-[color:var(--admin-muted)] dark:text-slate-400">
                    {imageUrlPicker.area === "main"
                      ? "Main image · drag & drop or paste a URL"
                      : `Gallery thumbnail ${(imageUrlPicker.index ?? 0) + 1} · drag & drop or paste a URL`}
                  </p>

                  <div
                    role="button"
                    tabIndex={0}
                    className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed border-[color:var(--admin-card-border)] px-5 py-7 text-center transition-[border-color,background-color] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--admin-primary)] focus-visible:ring-offset-2 dark:border-slate-600 dark:focus-visible:ring-[color:var(--admin-primary)] dark:focus-visible:ring-offset-slate-900 ${addImageModalDragging
                        ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] dark:border-[rgba(var(--admin-primary-rgb),0.9)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)]"
                        : "hover:border-[color:var(--admin-primary)] hover:bg-[rgba(var(--admin-primary-rgb),0.1)] dark:hover:border-[rgba(var(--admin-primary-rgb),0.85)] dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)]"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addImageModalFileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setAddImageModalDragging(true);
                    }}
                    onDragLeave={() => setAddImageModalDragging(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setAddImageModalDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (!f || !isAcceptableProductImageFile(f)) return;
                      if (f.size > ADD_IMAGE_MAX_BYTES) {
                        setImageUrlPickerError("Image must be 10 MB or smaller.");
                        return;
                      }
                      await applyAddImageModalFile(f);
                    }}
                    onClick={() => addImageModalFileInputRef.current?.click()}
                  >
                    <svg className="mx-auto mb-2 h-8 w-8 text-[color:var(--admin-primary)]" fill="none" viewBox="0 0 32 32" aria-hidden>
                      <path
                        d="M16 22V10M10 16l6-6 6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect x="2" y="2" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="1.5" className="text-[color:var(--admin-muted)] opacity-60" />
                    </svg>
                    <p className="text-[13px] leading-relaxed text-[color:var(--admin-muted)] dark:text-slate-400">
                      Drop image here or{" "}
                      <strong
                        className="cursor-pointer font-medium text-[color:var(--admin-primary)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          addImageModalFileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        browse files
                      </strong>
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--admin-muted)] opacity-80 dark:text-slate-500 dark:opacity-100">
                      PNG, JPG, WebP up to 10 MB
                    </p>
                  </div>

                  <div className="my-4 flex items-center gap-2.5 text-[11px] font-normal uppercase tracking-wide text-[color:var(--admin-muted)] opacity-80 dark:text-slate-500 dark:opacity-100">
                    <span className="h-px flex-1 bg-[color:var(--admin-card-border)] dark:bg-slate-600" aria-hidden />
                    or
                    <span className="h-px flex-1 bg-[color:var(--admin-card-border)] dark:bg-slate-600" aria-hidden />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      autoFocus
                      value={imageUrlPickerDraft}
                      onChange={(e) => {
                        setImageUrlPickerDraft(e.target.value);
                        if (imageUrlPickerError) setImageUrlPickerError("");
                      }}
                      onKeyDown={(ke) => {
                        if (ke.key === "Enter") {
                          ke.preventDefault();
                          applyImageUrlPicker();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border-[1.5px] border-[color:var(--admin-card-border)] bg-[var(--admin-soft-alt)] px-3.5 py-2.5 text-[13px] text-[color:var(--admin-heading)] outline-none transition-[border-color,background-color] placeholder:text-[color:var(--admin-muted)] focus:border-[color:var(--admin-primary)] focus:bg-[var(--admin-card-bg)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.85)] dark:focus:bg-slate-900"
                      placeholder="https://example.com/image.jpg"
                    />
                    <button
                      type="button"
                      onClick={applyImageUrlPicker}
                      className="shrink-0 rounded-lg bg-[color:var(--admin-primary)] px-[18px] py-2.5 text-[13px] font-medium transition-opacity hover:opacity-[0.88]"
                      style={{ color: accentIsWhite ? "#0b0b0f" : "#ffffff" }}
                    >
                      Apply
                    </button>
                  </div>
                  <div className="mt-1.5 min-h-[16px] text-[11px] text-[#e03e3e] dark:text-red-400" role="status">
                    {imageUrlPickerError || ""}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={resetImageUrlPicker}
                      className="rounded-lg border-[1.5px] border-[color:var(--admin-card-border)] bg-[var(--admin-soft-alt)] px-[18px] py-2.5 text-[13px] font-medium text-[color:var(--admin-muted)] transition-[border-color,color,background-color] hover:border-[color:var(--admin-heading)] hover:bg-[var(--admin-card-bg)] hover:text-[color:var(--admin-heading)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-400 dark:hover:text-slate-100"
                    >
                      Cancel
                    </button>
                  </div>

                  <input
                    ref={addImageModalFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (e.target) e.target.value = "";
                      if (f) await applyAddImageModalFile(f);
                    }}
                  />
                </div>
              </div>,
              document.body
            )}

          <style>{`
 @keyframes shake {
 0%, 100% { transform: translateX(0); }
 25% { transform: translateX(-5px); }
 75% { transform: translateX(5px); }
 }
 .animate-shake {
 animation: shake 0.5s ease-in-out;
 }
 @keyframes modal-in {
 from {
 opacity: 0;
 transform: scale(0.95) translateY(-20px);
 }
 to {
 opacity: 1;
 transform: scale(1) translateY(0);
 }
 }
 .animate-modal-in {
 animation: modal-in 0.3s ease-out;
 }
 `}</style>
        </>
      ) : null}

      {quickCreate?.type === "category" ? (
            <AdminModal
              open
              onClose={closeQuickCreate}
              title="Add New Category"
              titleId="product-quick-category-title"
              maxWidthClass="max-w-3xl"
              zIndexClass="z-[60]"
            >
              <CategoryCreateForm
                onCancel={closeQuickCreate}
                onSuccess={(created) => handleQuickCreateSuccess("category", created)}
              />
            </AdminModal>
          ) : null}

          {quickCreate?.type === "brand" ? (
            <AdminModal
              open
              onClose={closeQuickCreate}
              title="Add Brand"
              titleId="product-quick-brand-title"
              maxWidthClass="max-w-3xl"
              zIndexClass="z-[60]"
            >
              <BrandCreateForm
                onCancel={closeQuickCreate}
                onSuccess={(created) => handleQuickCreateSuccess("brand", created)}
              />
            </AdminModal>
          ) : null}

          {quickCreate?.type === "supplier" ? (
            <AdminModal
              open
              onClose={closeQuickCreate}
              title="Add Supplier"
              titleId="product-quick-supplier-title"
              maxWidthClass="max-w-3xl"
              zIndexClass="z-[60]"
            >
              <SupplierCreateForm
                existingSuppliers={suppliers}
                onCancel={closeQuickCreate}
                onSuccess={(created) => handleQuickCreateSuccess("supplier", created)}
                idPrefix="product-qc-supplier"
              />
            </AdminModal>
          ) : null}

          {quickCreate?.type === "stockLabel" ? (
            <AdminModal
              open
              onClose={closeQuickCreate}
              title="Add stock item"
              titleId="product-quick-stock-title"
              maxWidthClass="max-w-2xl"
              zIndexClass="z-[60]"
            >
              <StockLabelCreateForm
                catalogCategories={catalogCategories}
                onCancel={closeQuickCreate}
                onSuccess={(created) => handleQuickCreateSuccess("stockLabel", created)}
              />
            </AdminModal>
          ) : null}
    </>
  );
}

