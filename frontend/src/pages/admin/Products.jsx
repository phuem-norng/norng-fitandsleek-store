import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
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
import { useTheme } from "../../state/theme.jsx";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import { resolveImageUrl } from "../../lib/images";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { AdminContentSkeleton, AdminDashboardLoader, AdminSectionLoader } from "@/components/admin/AdminLoading";
import {
  parseVariantMatrix,
  variantMatrixPayloadFromUiRows,
} from "../../lib/variantMatrix.js";

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

function generateVariantSkuBarcode(productName, color, size) {
 const base = [productName, color, size].map(cleanSkuBarcodePart).filter(Boolean).join("-");
 const random = Math.random().toString(36).slice(2, 7).toUpperCase();
 return `${base || "SKU"}-${Date.now().toString(36).toUpperCase().slice(-5)}${random}`.slice(0, 120);
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

function variantMatrixRowsFromApi(raw) {
 const empty = () => [{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }];
 const m = parseVariantMatrix(raw);
 if (m.length === 0) return empty();
 return m.map((r) => ({
 id: newMatrixRowId(),
 color: r.color,
 size: r.size,
 qty: String(r.qty),
 sku_barcode: String(r.sku_barcode ?? "").trim(),
 }));
}

export default function AdminProducts() {
 const location = useLocation();
 const navigate = useNavigate();
 const { refresh: refreshAuth } = useAuth();
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
 const [form, setForm] = useState({
 name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", stock: "", allocated_stock: "", category_id: "", brand_id: "", image_url: "", gender: "", is_active: true, has_variants: false,
 model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: ""
 });
 const [editing, setEditing] = useState(null);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [animate, setAnimate] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const [showCreateForm, setShowCreateForm] = useState(false);
 const [search, setSearch] = useState("");
 const [selectedGenders, setSelectedGenders] = useState([]); // [] = All
 const [selectedSections, setSelectedSections] = useState([]); // [] = All types
 const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
 const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
 const genderDropdownRef = useRef(null);
 const sectionDropdownRef = useRef(null);
 const [selectedIds, setSelectedIds] = useState([]);
 const [viewMode, setViewMode] = useState("list");
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
 const [createVariantMatrix, setCreateVariantMatrix] = useState(() => [{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }]);
 const [editVariantMatrix, setEditVariantMatrix] = useState(() => [{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }]);
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
 const [imageUrlPickerError, setImageUrlPickerError] = useState("");
 const [addImageModalDragging, setAddImageModalDragging] = useState(false);
 const [pendingDeleteId, setPendingDeleteId] = useState(null);
 const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
 const [deleteBusy, setDeleteBusy] = useState(false);

 const closeCreateForm = () => {
 if (isCreating) return;
 setShowCreateForm(false);
 };

 const closeEditForm = () => {
 setEditing(null);
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

 const BARCODE_QR_TYPE = "barcode_qr";

 const catalogCategories = useMemo(
 () => categories.filter((c) => normalizeType(c.type) !== BARCODE_QR_TYPE),
 [categories]
 );

 const barcodeLabelOptions = useMemo(
 () =>
 [...categories.filter((c) => normalizeType(c.type) === BARCODE_QR_TYPE)].sort((a, b) =>
 String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
 ),
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

 /** When a listed barcode label matches `slug`, return its catalog price and available label stock. */
 const labelPricePoolFromSlug = (slug, options = {}) => {
 const code = String(slug || "").trim();
 if (!code) return null;
 const codeU = code.toUpperCase();
 const label = barcodeLabelOptions.find((b) => String(b.slug || "").trim().toUpperCase() === codeU);
 if (!label) return null;

 let price = "0";
 if (label.price != null && label.price !== "") {
 const n = Number(label.price);
 if (!Number.isNaN(n)) price = String(n);
 }

 let poolStock = "0";
 if (label.stock != null && label.stock !== "") {
 const st = parseInt(String(label.stock), 10);
 if (!Number.isNaN(st)) poolStock = String(st);
 }

 const condition = String(label.product_condition || "new");
 const saleType = String(label.second_hand_sale_type || "single");
 const isSecondHand = condition === "second_hand";
 const isAverageBundle = isSecondHand && saleType === "average_bundle";
 const rawPoolStock = poolStock;
 const usedStock = isAverageBundle ? 0 : usedProductStockForBarcodeLabel(code, options.ignoreProductId ?? null);
 if (!isAverageBundle) {
 const available = Math.max(0, (parseInt(rawPoolStock, 10) || 0) - usedStock);
 poolStock = String(available);
 }

 return { price, poolStock, rawPoolStock, usedStock, condition, saleType, isSecondHand, isAverageBundle };
 };

 const barcodeLabelModeText = (meta) => {
 if (!meta) return "";
 if (meta.isAverageBundle) return "Second-hand average bundle: price and stock come from the pooled label.";
 const used = Number(meta.usedStock || 0);
 const suffix = used > 0
 ? ` Available stock is label stock ${meta.rawPoolStock} minus ${used} units already linked to products.`
 : "";
 if (meta.isSecondHand) return `Second-hand single item: enter the product price manually; stock uses the remaining label stock.${suffix}`;
 return `New item: enter the product price manually; stock uses the remaining label stock.${suffix}`;
 };

 const formBarcodeOrphan = useMemo(() => {
 const code = (form.barcode_code || "").trim();
 if (!code) return false;
 const codeU = code.toUpperCase();
 return !barcodeLabelOptions.some((b) => String(b.slug || "").trim().toUpperCase() === codeU);
 }, [form.barcode_code, barcodeLabelOptions]);

 const editBarcodeOrphan = useMemo(() => {
 if (!editing) return false;
 const code = (editing.barcode_code || "").trim();
 if (!code) return false;
 const codeU = code.toUpperCase();
 return !barcodeLabelOptions.some((b) => String(b.slug || "").trim().toUpperCase() === codeU);
 }, [editing, barcodeLabelOptions]);

/** Listed barcode label selected — stock comes from that row; average-bundle price is also locked. */
 const formBarcodeLocksPriceStock = useMemo(() => {
 const code = (form.barcode_code || "").trim();
 if (!code) return false;
 const codeU = code.toUpperCase();
 return barcodeLabelOptions.some((b) => String(b.slug || "").trim().toUpperCase() === codeU);
 }, [form.barcode_code, barcodeLabelOptions]);

 const editBarcodeLocksPriceStock = useMemo(() => {
 if (!editing) return false;
 const code = (editing.barcode_code || "").trim();
 if (!code) return false;
 const codeU = code.toUpperCase();
 return barcodeLabelOptions.some((b) => String(b.slug || "").trim().toUpperCase() === codeU);
 }, [editing, barcodeLabelOptions]);

 const createRemainingLabelStock = useMemo(() => {
 if (!formBarcodeLocksPriceStock) return null;
 const pool = parseInt(String(form.stock || "0"), 10);
 const safePool = Number.isNaN(pool) ? 0 : pool;
 const raw = String(form.allocated_stock ?? "").trim();
 if (raw === "") return null;
 const alloc = parseInt(raw, 10);
 if (Number.isNaN(alloc)) return null;
 return Math.max(0, safePool - alloc);
 }, [formBarcodeLocksPriceStock, form.stock, form.allocated_stock]);

 const editRemainingLabelStock = useMemo(() => {
 if (!editBarcodeLocksPriceStock || !editing) return null;
 const pool = parseInt(String(editing.stock || "0"), 10);
 const safePool = Number.isNaN(pool) ? 0 : pool;
 const raw = String(editing.allocated_stock ?? "").trim();
 if (raw === "") return null;
 const alloc = parseInt(raw, 10);
 if (Number.isNaN(alloc)) return null;
 return Math.max(0, safePool - alloc);
 }, [editBarcodeLocksPriceStock, editing?.stock, editing?.allocated_stock]);

 const selectedFormBarcodeLabelMeta = useMemo(
 () => labelPricePoolFromSlug(form.barcode_code),
 [form.barcode_code, barcodeLabelOptions, rows]
 );

 const selectedEditBarcodeLabelMeta = useMemo(
 () => labelPricePoolFromSlug(editing?.barcode_code, { ignoreProductId: editing?.id }),
 [editing?.barcode_code, editing?.id, barcodeLabelOptions, rows]
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

 const formatLockedStockDisplay = (v) => {
 if (v === "" || v == null) return "—";
 const n = parseInt(String(v), 10);
 return Number.isNaN(n) ? String(v) : String(n);
 };

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

 const load = async () => {
 setLoading(true);
 try {
 const { data: productsData } = await api.get("/admin/products", { params: { per_page: 500 } });
 const { data: categoriesData } = await api.get("/admin/categories");
 const { data: brandsData } = await api.get("/admin/brands");
 // Handle both array and object responses
 const categories = Array.isArray(categoriesData)
 ? categoriesData
 : (categoriesData?.data || categoriesData || []);
 const brands = brandsData?.data || [];
 setRows(productsData?.data || []);
 setCategories(categories);
 setBrands(brands);
 } catch (e2) {
 setErr(extractErr(e2));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, []);

 /** After admin categories load, fill price / label pool / allocation if a barcode was already selected (avoids empty value + HTML5 required). */
 useEffect(() => {
 const code = (form.barcode_code || "").trim();
 if (!code || barcodeLabelOptions.length === 0) return;
 setForm((s) => {
 if ((s.barcode_code || "").trim().toUpperCase() !== code.toUpperCase()) return s;
 const lp = labelPricePoolFromSlug(code);
 if (!lp) return s;
 const { price, poolStock, isAverageBundle } = lp;
 const nextPrice = isAverageBundle ? price : s.price;
 const priceUnchanged = String(s.price) === String(nextPrice);
 const poolUnchanged = String(s.stock) === String(poolStock);
 if (priceUnchanged && poolUnchanged) return s;
 const nextAllocated =
 s.allocated_stock === "" || s.allocated_stock == null ? poolStock : s.allocated_stock;
 return { ...s, price: nextPrice, stock: poolStock, allocated_stock: nextAllocated };
 });
 }, [form.barcode_code, barcodeLabelOptions, rows]);

 /** Same as create: when admin categories arrive, sync edit price / label pool from barcode label; keep saved allocation. */
 useEffect(() => {
 if (!editing) return;
 const code = (editing.barcode_code || "").trim();
 if (!code || barcodeLabelOptions.length === 0) return;
 setEditing((s) => {
 if (!s) return s;
 if ((s.barcode_code || "").trim().toUpperCase() !== code.toUpperCase()) return s;
 const lp = labelPricePoolFromSlug(code, { ignoreProductId: s.id });
 if (!lp) return s;
 const { price, poolStock, isAverageBundle } = lp;
 const nextPrice = isAverageBundle ? price : s.price;
 const priceUnchanged = String(s.price) === String(nextPrice);
 const poolUnchanged = String(s.stock) === String(poolStock);
 if (priceUnchanged && poolUnchanged) return s;
 const nextAllocated =
 s.allocated_stock === "" || s.allocated_stock == null ? poolStock : s.allocated_stock;
 return { ...s, price: nextPrice, stock: poolStock, allocated_stock: nextAllocated };
 });
 }, [editing?.id, editing?.barcode_code, barcodeLabelOptions, rows]);

 useEffect(() => {
 setSelectedIds((prev) => prev.filter((id) => rows.some((p) => p.id === id)));
 }, [rows]);

 useEffect(() => {
 if (!form.category_id) return;
 if (!selectedCategory) return;
 const inferred = inferTypeFromCategory(selectedCategory);
 if (!inferred) return;
const nextType = inferred === "shoes" ? "Shoes" : inferred === "clothes" ? "Clothes" : inferred === "bag" || inferred === "bags" ? "Bags" : inferred === "hat" || inferred === "hats" ? "Hats" : inferred === "accessory" ? "Accessories" : "Other";
 setProductType(nextType);
if (inferred === "bag" || inferred === "bags" || inferred === "hat" || inferred === "hats") {
 setForm((s) => (s.has_variants ? s : { ...s, has_variants: true }));
}
 }, [form.category_id, selectedCategory]);

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

 const applyMainImageFile = (file) => {
 if (!file || !isAcceptableProductImageFile(file)) return;
 setIsUploading(true);
 try {
 const reader = new FileReader();
 reader.onloadend = () => {
 setForm((s) => ({ ...s, image_url: reader.result }));
 setIsUploading(false);
 };
 reader.onerror = () => {
 setIsUploading(false);
 setErr("Failed to read image");
 };
 reader.readAsDataURL(file);
 } catch (error) {
 setIsUploading(false);
 setErr("Failed to upload image");
 }
 };

 const applyEditMainImageFile = (file) => {
 if (!file || !isAcceptableProductImageFile(file)) return;
 setIsUploading(true);
 try {
 const reader = new FileReader();
 reader.onloadend = () => {
 setEditing((s) => ({ ...s, image_url: reader.result }));
 setIsUploading(false);
 };
 reader.onerror = () => {
 setIsUploading(false);
 setErr("Failed to read image");
 };
 reader.readAsDataURL(file);
 } catch (error) {
 setIsUploading(false);
 setErr("Failed to upload image");
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
 setCreateVariantMatrix([{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }]);
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

 if (form.price === "" || Number.isNaN(Number(form.price))) {
 const detail = "Please enter a valid price";
 setErr(detail);
 await errorAlert({
 khTitle: "ទិន្នន័យមិនត្រឹមត្រូវ",
 enTitle: "Invalid input",
 detail,
 });
 return;
 }

 if (formBarcodeLocksPriceStock) {
 const pool = parseInt(String(form.stock || "0"), 10);
 const safePool = Number.isNaN(pool) ? 0 : pool;
 const rawAlloc = String(form.allocated_stock ?? "").trim();
 const alloc = parseInt(rawAlloc, 10);
if (rawAlloc !== "" && (Number.isNaN(alloc) || alloc < 0 || alloc > safePool)) {
 const detail =
 alloc > safePool
 ? `Allocated stock cannot exceed the label pool (${safePool}).`
 : "Allocated stock must be zero or greater.";
 setErr(detail);
 await errorAlert({
 khTitle: "ទិន្នន័យមិនត្រឹមត្រូវ",
 enTitle: "Invalid allocated stock",
 detail,
 });
 return;
 }
 }

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
const createLabelPoolStock = parseInt(String(form.stock || "0"), 10);
 const stockPayload = formBarcodeLocksPriceStock
? (
String(form.allocated_stock ?? "").trim() === ""
? (Number.isNaN(createLabelPoolStock) ? 0 : createLabelPoolStock)
: parseInt(String(form.allocated_stock), 10)
)
 : parseInt(form.stock || 0);
 const createHasVariants = Boolean(form.has_variants);
 const response = await api.post("/admin/products", {
 ...form,
 sku: String(form.sku || "").trim() || null,
 brand_id: form.brand_id || null,
 barcode_code: (form.barcode_code || "").trim() || null,
 stock_label_id: (form.stock_label_id || "").trim() ? parseInt(form.stock_label_id, 10) : null,
 price: parseFloat(form.price),
 stock: stockPayload,
 colors: createHasVariants ? productColorsPayloadFromRows(createColorVariants) : null,
 variant_matrix: createHasVariants ? (() => {
 const m = variantMatrixPayloadFromUiRows(
 pruneVariantMatrixColorsToSwatches(createVariantMatrix, createColorVariants)
 );
 return m.length ? m : null;
 })() : null,
 sizes: createHasVariants ? (Array.isArray(form.sizes) ? form.sizes : (form.sizes ? form.sizes.split(',').map(s => s.trim()).filter(Boolean) : [])) : [],
 payment_methods: form.payment_methods ? form.payment_methods.split(',').map(p => p.trim()).filter(Boolean) : [],
 gallery: orderedGalleryForCreate(),
 });
 if (![200, 201].includes(response?.status)) {
 throw new Error("Create failed.");
 }
 closeSwal();
 setForm({ name: "", sku: "", barcode_code: "", stock_label_id: "", description: "", price: "", stock: "", allocated_stock: "", category_id: "", brand_id: "", image_url: "", gender: "", is_active: true, has_variants: false, model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: "" });
 setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
 setCreateVariantMatrix([{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }]);
 setShowCreateForm(false);
 await toastSuccess({
 khText: "បានបង្កើតទំនិញដោយជោគជ័យ",
 enText: "Created successfully!",
 });
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

 const startEdit = (p) => {
 const apiVariantRows = variantMatrixRowsFromApi(p.variant_matrix);
 const apiColors = colorVariantRowsFromApi(p.colors);
 const apiSizes = normalizeSizes(p.sizes);
 const hasVariants = parseVariantMatrix(p.variant_matrix).length > 0
 || apiSizes.length > 0
 || apiColors.some((row) => String(row?.name ?? "").trim() !== "");
 setEditVariantMatrix(apiVariantRows);
 setEditing({
 ...p,
 has_variants: hasVariants,
 barcode_code: p.barcode_code ?? "",
 allocated_stock: p.stock != null && p.stock !== "" ? String(p.stock) : "",
 sizes: apiSizes,
 colors: apiColors,
 gallery: joinGalleryCapped(parseGallery(p.gallery)),
 });
 };

 useEffect(() => {
 const editId = new URLSearchParams(location.search || "").get("edit");
 if (!editId || rows.length === 0) return;
 const product = rows.find((p) => String(p.id) === String(editId));
 if (!product) return;
 startEdit(product);
 navigate("/admin/products", { replace: true });
 }, [location.search, rows]);

 useEffect(() => {
 const params = new URLSearchParams(location.search || "");
 if (params.get("new") !== "1") return;

 const barcodeCode = (params.get("barcode_code") || "").trim();
 const categoryId = (params.get("category_id") || "").trim();
 const brandId = (params.get("brand_id") || "").trim();
 const stockLabelId = (params.get("stock_label_id") || "").trim();

 setCreateVariantMatrix([{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }]);
 setCreateColorVariants([{ id: newColorRowId(), name: "", image_url: "" }]);
 setForm({
 name: "", sku: "", barcode_code: barcodeCode, stock_label_id: stockLabelId, description: "", price: "", stock: "", allocated_stock: "",
 category_id: categoryId, brand_id: brandId, image_url: "", gender: "", is_active: true, has_variants: false,
 model_info: "", sizes: [], support_phone: "", payment_methods: "", gallery: "",
 });
 setShowCreateForm(true);
 navigate("/admin/products", { replace: true });
 }, [location.search, navigate]);

 const saveEdit = async () => {
 setErr("");

 if (!editing.category_id) {
 setErr("Please select a category");
 return;
 }

 if (editing.price === "" || Number.isNaN(Number(editing.price))) {
 setErr("Please enter a valid price");
 return;
 }

 if (editBarcodeLocksPriceStock) {
 const pool = parseInt(String(editing.stock || "0"), 10);
 const safePool = Number.isNaN(pool) ? 0 : pool;
 const rawAlloc = String(editing.allocated_stock ?? "").trim();
 const alloc = parseInt(rawAlloc, 10);
if (rawAlloc !== "" && (Number.isNaN(alloc) || alloc < 0 || alloc > safePool)) {
 setErr(
 alloc > safePool
 ? `Allocated stock cannot exceed the label pool (${safePool}).`
 : "Allocated stock must be zero or greater."
 );
 return;
 }
 }

 try {
const editLabelPoolStock = parseInt(String(editing.stock || "0"), 10);
 const stockPayload = editBarcodeLocksPriceStock
? (
String(editing.allocated_stock ?? "").trim() === ""
? (Number.isNaN(editLabelPoolStock) ? 0 : editLabelPoolStock)
: parseInt(String(editing.allocated_stock), 10)
)
 : parseInt(editing.stock || 0);
 const editHasVariants = Boolean(editing.has_variants);
 const skuTrim = String(editing.sku ?? "").trim();
 const patchBody = {
 ...editing,
 brand_id: editing.brand_id || null,
 barcode_code: (editing.barcode_code || "").trim() || null,
 price: parseFloat(editing.price),
 stock: stockPayload,
 colors: editHasVariants ? productColorsPayloadFromRows(Array.isArray(editing.colors) ? editing.colors : []) : null,
 variant_matrix: editHasVariants ? (() => {
 const sw = Array.isArray(editing.colors) ? editing.colors : [];
 const m = variantMatrixPayloadFromUiRows(pruneVariantMatrixColorsToSwatches(editVariantMatrix, sw));
 return m.length ? m : null;
 })() : null,
 sizes: editHasVariants ? (Array.isArray(editing.sizes) ? editing.sizes : (editing.sizes && typeof editing.sizes === 'string' ? editing.sizes.split(',').map(s => s.trim()).filter(Boolean) : (editing.sizes || []))) : [],
 payment_methods: editing.payment_methods && typeof editing.payment_methods === 'string' ? editing.payment_methods.split(',').map(p => p.trim()).filter(Boolean) : (editing.payment_methods || []),
 gallery: capGalleryUrlArray(parseGallery(editing.gallery)),
 };
 if (skuTrim === "") {
 delete patchBody.sku;
 } else {
 patchBody.sku = skuTrim;
 }
 delete patchBody.size_guide;
 patchBody.delivery_info = String(editing.delivery_info ?? "").trim() || null;
 await api.patch(`/admin/products/${editing.id}`, patchBody);
 setEditing(null);
 showSuccess("Product updated successfully!");
 await load();
 } catch (e2) {
 setErr(extractErr(e2));
 }
 };

 const del = (id) => {
 setPendingDeleteId(id);
 };

 const confirmDelete = async () => {
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

 // Close dropdowns when clicking outside
 useEffect(() => {
 const handler = (e) => {
 if (genderDropdownRef.current && !genderDropdownRef.current.contains(e.target)) {
 setGenderDropdownOpen(false);
 }
 if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target)) {
 setSectionDropdownOpen(false);
 }
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

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

 const matchesGenderFilter =
 selectedGenders.length === 0 ||
 selectedGenders.some((key) => matchesGender(catSlug, key));

 const matchesSectionFilter =
 selectedSections.length === 0 ||
 selectedSections.some(
 (key) => catName.includes(key.toLowerCase()) || catSlug.includes(key.toLowerCase())
 );

 return matchesSearch && matchesGenderFilter && matchesSectionFilter;
 });

 const splitColumns = [
 filteredRows.filter((_, index) => index % 2 === 0),
 filteredRows.filter((_, index) => index % 2 === 1),
 ];

 const allSelected =
 filteredRows.length > 0 && filteredRows.every((p) => selectedIds.includes(p.id));

 const toggleSelectAll = () => {
 if (allSelected) {
 const filteredIds = new Set(filteredRows.map((p) => p.id));
 setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
 return;
 }
 const next = new Set(selectedIds);
 filteredRows.forEach((p) => next.add(p.id));
 setSelectedIds(Array.from(next));
 };

 const deleteSelected = () => {
 if (selectedIds.length === 0) return;
 setPendingBulkDelete(true);
 };

 if (loading) return <AdminContentSkeleton lines={3} imageHeight={240} />;

 return (
 <div>
 <div className="w-full min-w-0 space-y-5">
 {/* Page header */}
 <div className="flex items-center justify-between gap-4">
 <div>
 <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Products</h1>
 <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your product catalog</p>
 </div>
 <button
 onClick={() => {
 setCreateVariantMatrix([{ id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }]);
 setShowCreateForm(true);
 }}
 className="inline-flex items-center gap-1.5 h-9 rounded-[5px] px-3 text-sm font-medium text-white transition hover:brightness-110 bg-[color:var(--admin-primary)]"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
 </svg>
 Add Product
 </button>
 </div>

 {/* Stat cards */}
 <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
 {[
 { label: "Total Sales", value: `$${Number(rows.reduce((s, p) => s + Number(p.price || 0) * (p.sold_count || 0), 0) || 0).toLocaleString()}`, sub: "+20.1%", color: primaryColor },
 { label: "Total Products", value: rows.length.toLocaleString(), sub: "+5.02%", color: primaryColor },
 { label: "Active Products", value: rows.filter((p) => p.is_active).length.toLocaleString(), sub: "+3.1%", color: "#f59e0b" },
 { label: "Out of Stock", value: rows.filter((p) => Number(p.stock) === 0).length.toLocaleString(), sub: "-3.58%", color: "#ef4444" },
 ].map((c) => (
 <div key={c.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
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

 <AdminModal
 open={showCreateForm}
 onClose={closeCreateForm}
 title="Add new product"
 titleId="create-product-form-title"
 maxWidthClass="max-w-5xl"
 closeOnBackdrop={!isCreating}
 >
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

 {/* Row 2: Category | Brand (equal width) */}
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
 <div className="min-w-0">
 <label htmlFor="create-product-category" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Category <span className="text-red-500" aria-hidden>*</span>
 </label>
 <select
 id="create-product-category"
 value={form.category_id}
 onChange={(e) => setForm((s) => ({ ...s, category_id: e.target.value }))}
 required
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">Select a category</option>
 {catalogCategories.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div className="min-w-0">
 <label htmlFor="create-product-brand" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Brand
 </label>
 <select
 id="create-product-brand"
 value={form.brand_id}
 onChange={(e) => setForm((s) => ({ ...s, brand_id: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">No brand</option>
 {brands.map((b) => (
 <option key={b.id} value={b.id}>{b.name}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Row 3: Barcode (half width, aligns with Product name / Category) | Price + Stock (half, equal sub-columns) */}
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 sm:items-start">
 <div className="min-w-0">
<label htmlFor="create-product-sku" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
Product Code / Barcode <span className="font-normal text-slate-500 dark:text-slate-400">(scan at POS)</span>
</label>
<div className="flex min-w-0 gap-2">
<input
id="create-product-sku"
value={form.sku || ""}
onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))}
autoComplete="off"
placeholder="e.g. PROD-HOODIE-001"
className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
/>
<button
type="button"
onClick={() => setForm((s) => ({ ...s, sku: generateProductSku(s.name) }))}
className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
>
Generate
</button>
</div>
<p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
For no-variant products, this is the single barcode to print and scan.
</p>
<div className="mt-4">
 <label htmlFor="create-product-barcode" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Barcode label <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
 </label>
 <select
 id="create-product-barcode"
 value={(form.barcode_code || "").trim()}
 onChange={(e) => {
 const v = e.target.value;
 setForm((s) => {
 const lp = labelPricePoolFromSlug(v);
 if (!lp) {
 return { ...s, barcode_code: v, allocated_stock: "" };
 }
 return {
 ...s,
 barcode_code: v,
 price: lp.isAverageBundle ? lp.price : s.price,
 stock: lp.poolStock,
 allocated_stock: lp.poolStock,
 };
 });
 }}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">None — not linked to a label</option>
 {formBarcodeOrphan && (
 <option value={(form.barcode_code || "").trim()}>
 {(form.barcode_code || "").trim()} (not in list — save or pick another)
 </option>
 )}
 {barcodeLabelOptions.map((c) => (
 <option key={c.id} value={c.slug || ""}>
 {c.name || c.slug}
 {c.slug ? ` · ${c.slug}` : ""}
 </option>
 ))}
 </select>
</div>
 </div>
 <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
 <div className="min-w-0">
 <label htmlFor="create-product-price" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Price (USD) <span className="text-red-500" aria-hidden>*</span>
 {formBarcodeLocksPrice ? (
 <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(from label)</span>
 ) : selectedFormBarcodeLabelMeta ? (
 <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(manual)</span>
 ) : null}
 </label>
 <div className="relative">
 {formBarcodeLocksPrice ? (
 <div
 className={`flex min-h-[44px] w-full items-center rounded-lg border border-slate-200 py-2 pl-7 pr-3 text-sm dark:border-slate-600 ${lockedPriceStockInputCls}`}
 aria-label="Price from barcode label"
 >
 <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
 <span className="pl-1 font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatLockedPriceDisplay(form.price)}</span>
 </div>
 ) : (
 <>
 <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
 <input
 id="create-product-price"
 type="number"
 step="0.01"
 min="0"
 inputMode="decimal"
 value={form.price}
 onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0.00"
 />
 </>
 )}
 </div>
 </div>
 <div className="min-w-0">
 <label htmlFor="create-product-stock" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Stock{" "}
 <span className="font-normal text-slate-500 dark:text-slate-400">
 {formBarcodeLocksPriceStock ? "(from label)" : "(optional)"}
 </span>
 </label>
 {formBarcodeLocksPriceStock ? (
 <div
 className={`flex min-h-[44px] w-full items-center rounded-lg border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-600 ${lockedPriceStockInputCls}`}
 aria-label="Stock from barcode label"
 >
 <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatLockedStockDisplay(form.stock)}</span>
 </div>
 ) : (
 <input
 id="create-product-stock"
 type="number"
 min="0"
 inputMode="numeric"
 value={form.stock}
 onChange={(e) => setForm((s) => ({ ...s, stock: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0"
 />
 )}
 </div>
 {formBarcodeLocksPriceStock ? (
 <div className="grid min-w-0 grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2 sm:gap-6">
 <div className="min-w-0">
 <label htmlFor="create-product-allocated-stock" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
Allocated Stock
<span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(optional)</span>
 </label>
 <input
 id="create-product-allocated-stock"
 type="number"
 min="0"
 inputMode="numeric"
 max={form.stock === "" ? undefined : parseInt(String(form.stock), 10) || undefined}
 value={form.allocated_stock}
 onChange={(e) => setForm((s) => ({ ...s, allocated_stock: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0"
 />
 </div>
 <div className="min-w-0">
 <label className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Remaining Label Stock <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(auto-calc)</span>
 </label>
 <div
 className={`flex min-h-[44px] w-full items-center rounded-lg border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-600 ${lockedPriceStockInputCls}`}
 aria-label="Remaining label stock after allocation"
 >
 <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
 {createRemainingLabelStock == null ? "—" : String(createRemainingLabelStock)}
 </span>
 </div>
 </div>
 </div>
 ) : null}
 </div>
 </div>

 {barcodeLabelOptions.length === 0 ? (
 <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
 Create labels under Admin → Barcode & QR.
 </p>
) : selectedFormBarcodeLabelMeta ? (
<p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
{barcodeLabelModeText(selectedFormBarcodeLabelMeta)}
</p>
 ) : null}
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
 <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-800 dark:text-slate-100 sm:text-base">Product photos</h3>
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
 className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 transition sm:w-full dark:bg-slate-800/55 ${
 createPhotoActiveSlot === 0
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
 className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 p-1.5 transition sm:w-full dark:bg-slate-800/55 ${
 createPhotoActiveSlot === si
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
 className={`group/prev relative flex h-full min-h-[240px] w-full flex-col overflow-hidden rounded-xl border-2 border-dashed border-slate-200/95 bg-slate-100/60 dark:border-slate-600 dark:bg-slate-800/40 sm:min-h-[280px] ${
 previewSrc ? "border-solid border-slate-200 dark:border-slate-600" : ""
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

 <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
 <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Details & sizing</h3>
 <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Shown on the product page where applicable.</p>
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 sm:items-start">
 {/* Row 1: Product Type | Model Info */}
 <div className="min-w-0">
 <label htmlFor="create-product-type" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Product Type
 </label>
 <select
 id="create-product-type"
 value={productType}
 onChange={(e) => setProductType(e.target.value)}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 {PRODUCT_TYPES.map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 </div>
 <div className="min-w-0">
 <label htmlFor="create-model-info" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Model Info
 </label>
 <input
 id="create-model-info"
 value={form.model_info}
 onChange={(e) => setForm((s) => ({ ...s, model_info: e.target.value }))}
 list="model-info-options"
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="Model is 161cm tall / 43kg, wearing size XS"
 />
 </div>

<div className="min-w-0 sm:col-span-2">
<button
type="button"
role="switch"
aria-checked={Boolean(form.has_variants)}
onClick={() => setForm((s) => ({ ...s, has_variants: !s.has_variants }))}
className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
form.has_variants
? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.08)]"
: "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/70"
}`}
>
<span className="min-w-0">
<span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">This product has variants</span>
<span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
Turn off for one barcode and one total stock, with no color or size selection.
</span>
</span>
<span
className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.has_variants ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-700"}`}
aria-hidden
>
<span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${form.has_variants ? "left-6" : "left-1"}`} />
</span>
</button>
</div>

{form.has_variants ? (
<>
 {/* Row 2: Colors (swatches) | Available Sizes */}
 <div className="min-w-0">
 <span className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">Colors</span>
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
 <p className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">Available Sizes</p>
 <div className="flex flex-wrap items-center gap-2">
 {sizeOptions.length === 0 && (
 <span className="text-xs text-slate-500 dark:text-slate-400">No presets for this type — use Add below.</span>
 )}
 {sizeOptions.map((size) => (
 <label
 key={size}
 className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded border text-xs font-semibold transition select-none ${
 form.sizes.includes(size)
 ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.2)]"
 : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
 }`}
 title={size}
 >
 <input
 type="checkbox"
 checked={form.sizes.includes(size)}
 onChange={() =>
 setForm((s) => ({
 ...s,
 sizes: s.sizes.includes(size) ? s.sizes.filter((v) => v !== size) : [...s.sizes, size],
 }))
 }
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
 className="h-11 min-w-[6rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:min-w-[8rem]"
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault();
 const value = customSize.trim();
 if (!value) return;
 setForm((s) => ({
 ...s,
 sizes: s.sizes.includes(value) ? s.sizes : [...s.sizes, value],
 }));
 setCustomSize("");
 }
 }}
 />
 <button
 type="button"
 onClick={() => {
 const value = customSize.trim();
 if (!value) return;
 setForm((s) => ({
 ...s,
 sizes: s.sizes.includes(value) ? s.sizes : [...s.sizes, value],
 }));
 setCustomSize("");
 }}
 className="h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
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

 <div className="min-w-0 sm:col-span-2 border-t border-slate-200/90 pt-5 dark:border-slate-700/80">
 <span className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">Variant stock (Color × Size)</span>
 <div className="space-y-2">
 {(() => {
 const createSwatchColorPicklist = variantStockColorPicklist(createColorVariants);
 const createVariantSizes = normalizeSizes(form.sizes);
 return createVariantMatrix.map((row, idx) => {
 const rawColor = String(row.color ?? "").trim();
 const matchOpt = createSwatchColorPicklist.find((n) => n.toLowerCase() === rawColor.toLowerCase());
 const selVal =
 createSwatchColorPicklist.length === 0 ? "" : matchOpt !== undefined ? matchOpt : rawColor;
 const rawSize = String(row.size ?? "").trim();
 const sizeMatch =
 createVariantSizes.find((s) => String(s).toLowerCase() === rawSize.toLowerCase());
 const selSizeVal =
 createVariantSizes.length === 0
 ? rawSize
 : sizeMatch !== undefined
 ? sizeMatch
 : rawSize;
 return (
 <div
 key={row.id}
 className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-12 sm:items-end sm:gap-3"
 >
<div className="min-w-0 sm:col-span-3">
 <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`create-vm-color-${row.id}`}>
 Color
 </label>
 <VariantMatrixColorSelect
 swatchRows={createColorVariants}
 picklist={createSwatchColorPicklist}
 value={selVal}
 onChange={(v) => {
 setCreateVariantMatrix((prev) => {
 const n = [...prev];
 if (n[idx]) n[idx] = { ...n[idx], color: v };
 return n;
 });
 }}
 disabled={isCreating || createSwatchColorPicklist.length === 0}
 id={`create-vm-color-${row.id}`}
 emptyLabel={
 createSwatchColorPicklist.length === 0
 ? "↑ Add color name(s) in “Colors” first"
 : "Pick from colors above…"
 }
 orphanValue={
 rawColor && matchOpt === undefined && createSwatchColorPicklist.length > 0 ? rawColor : ""
 }
 orphanLabel={
 rawColor && matchOpt === undefined && createSwatchColorPicklist.length > 0
 ? `${rawColor} — add this name under Colors or pick another`
 : ""
 }
 />
 </div>
<div className="min-w-0 sm:col-span-2">
 <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`create-vm-size-${row.id}`}>
 Size
 </label>
 <select
 id={`create-vm-size-${row.id}`}
 value={selSizeVal}
 disabled={isCreating || createVariantSizes.length === 0}
 onChange={(e) => {
 const v = e.target.value;
 setCreateVariantMatrix((prev) => {
 const n = [...prev];
 if (n[idx]) n[idx] = { ...n[idx], size: v };
 return n;
 });
 }}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
 >
 <option value="">
 {createVariantSizes.length === 0
 ? "↑ Add sizes under Available Sizes first"
 : "Pick a size…"}
 </option>
 {createVariantSizes.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 {rawSize && createVariantSizes.length === 0 ? (
 <option value={rawSize}>
 {rawSize} — add this under Available Sizes, then pick again
 </option>
 ) : null}
 {rawSize && sizeMatch === undefined && createVariantSizes.length > 0 ? (
 <option value={rawSize}>{rawSize} — not in Available Sizes; add it there or pick another</option>
 ) : null}
 </select>
 </div>
 <div className="min-w-0 sm:col-span-2">
 <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`create-vm-qty-${row.id}`}>
 Qty
 </label>
 <input
 id={`create-vm-qty-${row.id}`}
 type="number"
 min="0"
 inputMode="numeric"
 value={row.qty}
 onChange={(e) => {
 const v = e.target.value;
 setCreateVariantMatrix((prev) => {
 const n = [...prev];
 if (n[idx]) n[idx] = { ...n[idx], qty: v };
 return n;
 });
 }}
 autoComplete="off"
 placeholder="0"
 disabled={isCreating}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
 />
 </div>
<div className="min-w-0 sm:col-span-3">
<label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`create-vm-sku-barcode-${row.id}`}>
Variant Barcode
</label>
<div className="flex min-w-0 gap-2">
<input
id={`create-vm-sku-barcode-${row.id}`}
value={row.sku_barcode || ""}
onChange={(e) => {
const v = e.target.value;
setCreateVariantMatrix((prev) => {
const n = [...prev];
if (n[idx]) n[idx] = { ...n[idx], sku_barcode: v };
return n;
});
}}
autoComplete="off"
placeholder="Scan/generate"
disabled={isCreating}
className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
/>
<button
type="button"
disabled={isCreating}
onClick={() => {
setCreateVariantMatrix((prev) => {
const n = [...prev];
if (n[idx]) {
n[idx] = {
...n[idx],
sku_barcode: generateVariantSkuBarcode(form.name, n[idx].color, n[idx].size),
};
}
return n;
});
}}
className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
>
Generate
</button>
</div>
</div>
<div className="flex justify-end sm:col-span-2">
 {createVariantMatrix.length > 1 ? (
 <button
 type="button"
 onClick={() => setCreateVariantMatrix((prev) => prev.filter((_, i) => i !== idx))}
 disabled={isCreating}
 className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-400 dark:hover:bg-red-950/40"
 >
 Remove row
 </button>
 ) : null}
 </div>
 </div>
 );
 });
 })()}
 <button
 type="button"
 onClick={() =>
 setCreateVariantMatrix((prev) => [...prev, { id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }])
 }
 disabled={isCreating}
 className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--admin-primary)] hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
 >
 <Plus className="h-4 w-4 shrink-0" aria-hidden />
 Add variant row
 </button>
 </div>
 </div>

</>
) : (
<div className="min-w-0 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 sm:col-span-2">
No variants enabled. POS scans will use Product Code / Barcode and deduct from the single Stock field.
</div>
)}

 {/* Row 3: Support Hotline | Payment Methods */}
 <div className="min-w-0">
 <label htmlFor="create-support-phone" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Support Hotline
 </label>
 <input
 id="create-support-phone"
 value={form.support_phone}
 onChange={(e) => setForm((s) => ({ ...s, support_phone: e.target.value }))}
 list="support-phone-options"
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="+855 12 345 678"
 />
 </div>
 <div className="min-w-0">
 <label htmlFor="create-payment-methods" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Payment Methods
 </label>
 <input
 id="create-payment-methods"
 value={form.payment_methods}
 onChange={(e) => setForm((s) => ({ ...s, payment_methods: e.target.value }))}
 list="payment-options"
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="Cash, ABA, Wing, Credit Card (comma separated)"
 />
 </div>
 </div>
 <datalist id="model-info-options">
 <option value="Model is 161cm tall / 43kg, wearing size XS" />
 <option value="Model is 170cm tall / 55kg, wearing size S" />
 <option value="Model is 175cm tall / 62kg, wearing size M" />
 </datalist>
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
 <datalist id="support-phone-options">
 <option value="+855 12 345 678" />
 <option value="+855 10 888 999" />
 </datalist>
 <datalist id="payment-options">
 <option value="Cash, ABA, Wing, Credit Card" />
 <option value="Cash, ABA" />
 <option value="Cash on Delivery" />
 </datalist>
 </div>
 </div>

 <footer className="mt-2 border-t border-slate-200 pt-6 dark:border-slate-800">
 {createError ? (
 <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
 {createError}
 </div>
 ) : null}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <button
 type="button"
 onClick={closeCreateForm}
 disabled={isCreating}
 className="order-2 inline-flex h-11 min-w-[7rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:order-1"
 >
 Cancel
 </button>
 <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row sm:items-center sm:gap-4">
 <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
 <span className="text-sm font-medium text-slate-700 dark:text-slate-200" id="create-product-active-label">
 Active listing
 </span>
 <button
 type="button"
 role="switch"
 aria-checked={form.is_active}
 aria-labelledby="create-product-active-label"
 onClick={() => setForm((s) => ({ ...s, is_active: !s.is_active }))}
 className={`flex h-9 w-[3.75rem] shrink-0 items-center rounded-full p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--admin-primary-rgb),0.45)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
 form.is_active ? "justify-end" : "justify-start bg-slate-300 dark:bg-slate-600"
 }`}
 style={form.is_active ? { backgroundColor: accentColor } : undefined}
 >
 <span
 className="pointer-events-none block h-7 w-7 shrink-0 rounded-full bg-white shadow-md ring-1 ring-black/5 dark:ring-white/10"
 aria-hidden
 />
 </button>
 </div>
 <button
 type="submit"
 disabled={isCreating}
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
 </div>
 </footer>
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
 </AdminModal>


 {/* Products table card */}
 <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
 <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
 <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
 <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
 <div className="shrink-0">
 <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
 {selectedGenders.length === 0 && selectedSections.length === 0
 ? "All Products"
 : [
 ...selectedGenders.map((k) => GENDER_OPTIONS.find((g) => g.key === k)?.label ?? k),
 ...selectedSections.map((k) => sectionTabs.find((t) => t.key === k)?.title ?? k),
 ].join(" · ")}
 </p>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{filteredRows.length} product{filteredRows.length !== 1 ? "s" : ""}</p>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 {/* Gender filter */}
 <div className="relative" ref={genderDropdownRef}>
 <button
 type="button"
 onClick={() => { setGenderDropdownOpen((o) => !o); setSectionDropdownOpen(false); }}
 className="inline-flex h-8 min-w-[9.5rem] shrink-0 items-center justify-between gap-2 rounded-[5px] border px-3.5 text-xs font-medium transition-all duration-150"
 style={{
 backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
 borderColor: selectedGenders.length > 0
 ? (accentIsWhite ? "#cbd5e1" : accentColor)
 : (isDark ? "rgba(255,255,255,0.14)" : "#e2e8f0"),
 color: isDark ? "#e2e8f0" : "#334155",
 boxShadow: genderDropdownOpen ? "0 0 0 2px " + (accentIsWhite ? "#94a3b8" : accentColor) + "44" : undefined,
 }}
 >
 <span className="truncate text-left">
 {selectedGenders.length === 0
 ? "All Genders"
 : selectedGenders.map((k) => GENDER_OPTIONS.find((g) => g.key === k)?.label ?? k).join(", ")}
 </span>
 <svg
 className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200"
 style={{ transform: genderDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
 fill="none" stroke="currentColor" viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {genderDropdownOpen && (
 <div
 className="absolute left-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border"
 style={{
 minWidth: "200px",
 backgroundColor: isDark ? "#161b22" : "#ffffff",
 borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0",
 boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
 }}
 >
 <button
 type="button"
 onClick={() => setSelectedGenders([])}
 className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors"
 style={{
 backgroundColor: selectedGenders.length === 0
 ? (isDark ? "rgba(255,255,255,0.07)" : "#f8fafc")
 : "transparent",
 color: selectedGenders.length === 0
 ? (accentIsWhite ? (isDark ? "#e2e8f0" : "#0b0b0f") : accentColor)
 : (isDark ? "#cbd5e1" : "#475569"),
 }}
 >
 <span>All Genders</span>
 {selectedGenders.length === 0 && (
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </button>

 <div style={{ height: "1px", backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9", margin: "2px 0" }} />

 {GENDER_OPTIONS.map((opt) => {
 const isChecked = selectedGenders.includes(opt.key);
 const count = rows.filter((p) => matchesGender(String(p.category?.slug || "").toLowerCase(), opt.key)).length;
 return (
 <button
 type="button"
 key={opt.key}
 onClick={() =>
 setSelectedGenders((prev) =>
 prev.includes(opt.key) ? prev.filter((k) => k !== opt.key) : [...prev, opt.key]
 )
 }
 className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors"
 style={{
 backgroundColor: isChecked
 ? (isDark ? "rgba(255,255,255,0.07)" : "#f8fafc")
 : "transparent",
 color: isChecked
 ? (accentIsWhite ? (isDark ? "#e2e8f0" : "#0b0b0f") : accentColor)
 : (isDark ? "#cbd5e1" : "#475569"),
 fontWeight: isChecked ? 600 : 400,
 }}
 >
 <span className="flex items-center gap-2">
 {opt.label}
 <span
 className="rounded-full px-1.5 py-0.5 text-xs"
 style={{
 backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#f1f5f9",
 color: isDark ? "#94a3b8" : "#64748b",
 }}
 >
 {count}
 </span>
 </span>
 {isChecked && (
 <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </button>
 );
 })}
 </div>
 )}
 </div>

 {/* Section / Type filter */}
 {sectionTabs.length > 0 && (
 <div className="relative" ref={sectionDropdownRef}>
 <button
 type="button"
 onClick={() => { setSectionDropdownOpen((o) => !o); setGenderDropdownOpen(false); }}
 className="inline-flex h-8 min-w-[9.5rem] shrink-0 items-center justify-between gap-2 rounded-[5px] border px-3.5 text-xs font-medium transition-all duration-150"
 style={{
 backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
 borderColor: selectedSections.length > 0
 ? (accentIsWhite ? "#cbd5e1" : accentColor)
 : (isDark ? "rgba(255,255,255,0.14)" : "#e2e8f0"),
 color: isDark ? "#e2e8f0" : "#334155",
 boxShadow: sectionDropdownOpen ? "0 0 0 2px " + (accentIsWhite ? "#94a3b8" : accentColor) + "44" : undefined,
 }}
 >
 <span className="truncate text-left">
 {selectedSections.length === 0
 ? "All Types"
 : selectedSections.map((k) => sectionTabs.find((t) => t.key === k)?.title ?? k).join(", ")}
 </span>
 <svg
 className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200"
 style={{ transform: sectionDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
 fill="none" stroke="currentColor" viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {sectionDropdownOpen && (
 <div
 className="absolute left-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border"
 style={{
 minWidth: "200px",
 backgroundColor: isDark ? "#161b22" : "#ffffff",
 borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0",
 boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
 }}
 >
 <button
 type="button"
 onClick={() => setSelectedSections([])}
 className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors"
 style={{
 backgroundColor: selectedSections.length === 0
 ? (isDark ? "rgba(255,255,255,0.07)" : "#f8fafc")
 : "transparent",
 color: selectedSections.length === 0
 ? (accentIsWhite ? (isDark ? "#e2e8f0" : "#0b0b0f") : accentColor)
 : (isDark ? "#cbd5e1" : "#475569"),
 }}
 >
 <span>All Types</span>
 {selectedSections.length === 0 && (
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </button>

 <div style={{ height: "1px", backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9", margin: "2px 0" }} />

 {sectionTabs.map((tab) => {
 const isChecked = selectedSections.includes(tab.key);
 const count = rows.filter(
 (p) =>
 String(p.category?.name || "").toLowerCase().includes(tab.key.toLowerCase()) ||
 String(p.category?.slug || "").toLowerCase().includes(tab.key.toLowerCase())
 ).length;
 return (
 <button
 type="button"
 key={tab.key}
 onClick={() =>
 setSelectedSections((prev) =>
 prev.includes(tab.key) ? prev.filter((k) => k !== tab.key) : [...prev, tab.key]
 )
 }
 className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors"
 style={{
 backgroundColor: isChecked
 ? (isDark ? "rgba(255,255,255,0.07)" : "#f8fafc")
 : "transparent",
 color: isChecked
 ? (accentIsWhite ? (isDark ? "#e2e8f0" : "#0b0b0f") : accentColor)
 : (isDark ? "#cbd5e1" : "#475569"),
 fontWeight: isChecked ? 600 : 400,
 }}
 >
 <span className="flex items-center gap-2">
 {tab.title}
 <span
 className="rounded-full px-1.5 py-0.5 text-xs"
 style={{
 backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#f1f5f9",
 color: isDark ? "#94a3b8" : "#64748b",
 }}
 >
 {count}
 </span>
 </span>
 {isChecked && (
 <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </button>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search products, barcode, SKU…"
 className="h-8 min-w-[10rem] flex-1 rounded-[5px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-600 sm:max-w-[14rem] sm:flex-initial sm:min-w-0 sm:w-44"
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
 className={`h-7 px-2 rounded-[5px] text-xs font-medium flex items-center gap-1.5 transition-colors ${
 viewMode === v.mode ? "" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
 }`}
 style={viewMode === v.mode ? { backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#fff" } : undefined}
 >
 {v.icon}{v.label}
 </button>
 ))}
 </div>

 <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={toggleSelectAll}
 className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
 />
 Select all
 </label>

 {selectedIds.length > 0 && (
 <button
 onClick={deleteSelected}
 className="h-8 rounded-[5px] border border-[#fecaca] bg-transparent px-3 text-xs font-medium text-[#b91c1c] transition-colors hover:bg-[#fef2f2] dark:border-[#7f1d1d]/55 dark:text-[#fca5a5] dark:hover:bg-[#450a0a]/40"
 >
 Delete ({selectedIds.length})
 </button>
 )}

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
 </div>
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
 ) : viewMode === "list" ? (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-slate-200 dark:border-slate-800">
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 w-8"></th>
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Product Name</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Barcode</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Category</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Price</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Stock</th>
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
 <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400"></th>
 </tr>
 </thead>
 <tbody>
 {filteredRows.map((p) => (
 <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
 <td className="px-4 py-3">
 <input
 type="checkbox"
 checked={selectedIds.includes(p.id)}
 onChange={() => toggleSelect(p.id)}
 className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
 />
 </td>
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
 <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{p.name}</p>
 <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{p.brand?.name || ""}</p>
 </div>
 </div>
 </td>
 <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">{p.barcode_code || "—"}</td>
 <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{p.category?.name}</td>
 <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">${p.price}</td>
 <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{p.stock}</td>
 <td className="px-4 py-3">
 <span
 className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${
 p.is_active
 ? "border-[rgba(var(--admin-primary-rgb),0.35)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-[color:var(--admin-primary)]"
 : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-300"
 }`}
 >
 {p.is_active ? "Active" : "Inactive"}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-1">
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
 </div>
 </td>
 </tr>
 ))}
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
 columnRows.map((p) => (
 <div key={p.id} className="px-4 py-3 flex items-center gap-3">
 <input
 type="checkbox"
 checked={selectedIds.includes(p.id)}
 onChange={() => toggleSelect(p.id)}
 className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-0"
 />
 <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs overflow-hidden shrink-0">
 {p.image_url ? (
 <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
 ) : (
 p.name?.charAt(0)?.toUpperCase()
 )}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
 <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.barcode_code || "—"} • ${p.price}</p>
 </div>
 <span
 className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
 p.is_active
 ? "border-[rgba(var(--admin-primary-rgb),0.35)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-[color:var(--admin-primary)]"
 : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-300"
 }`}
 >
 {p.is_active ? "Active" : "Inactive"}
 </span>
 <div className="flex items-center gap-1">
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
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
 {filteredRows.map((p) => (
 <div
 key={p.id}
 className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
 >
 {/* Image */}
 <div className="relative aspect-square bg-slate-50 dark:bg-slate-800">
 {p.image_url ? (
 <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-300 dark:text-slate-600">
 {p.name?.charAt(0)?.toUpperCase()}
 </div>
 )}
 <div className="absolute top-2 right-2 flex items-center gap-1.5">
 <input
 type="checkbox"
 checked={selectedIds.includes(p.id)}
 onChange={() => toggleSelect(p.id)}
 className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white/90"
 />
 <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
 p.is_active
 ? "border border-[rgba(var(--admin-primary-rgb),0.45)] bg-[var(--admin-primary)] text-white"
 : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-200"
 }`}>
 {p.is_active ? "Active" : "Inactive"}
 </span>
 </div>
 </div>

 {/* Info */}
 <div className="p-3">
 <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate leading-snug">{p.name}</p>
 <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{p.brand?.name || p.category?.name}</p>
 <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">{p.barcode_code || "—"}</p>

 <div className="flex items-center justify-between mt-2">
 <div>
 <p className="text-base font-bold text-slate-900 dark:text-slate-100">${p.price}</p>
 <p className="text-[10px] text-slate-400 dark:text-slate-500">{p.stock} in stock</p>
 </div>
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
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

 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
 <div className="min-w-0 sm:col-span-2">
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
 placeholder="Product name"
 />
 </div>
 <div className="min-w-0">
 <label htmlFor="edit-product-category" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Category <span className="text-red-500" aria-hidden>*</span>
 </label>
 <select
 id="edit-product-category"
 value={editing.category_id || ""}
 onChange={(e) => setEditing((s) => ({ ...s, category_id: e.target.value }))}
 required
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">Select a category</option>
 {catalogCategories.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div className="min-w-0">
 <label htmlFor="edit-product-brand" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Brand
 </label>
 <select
 id="edit-product-brand"
 value={editing.brand_id || ""}
 onChange={(e) => setEditing((s) => ({ ...s, brand_id: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">No brand</option>
 {brands.map((b) => (
 <option key={b.id} value={b.id}>{b.name}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 sm:items-start">
 <div className="min-w-0">
<label htmlFor="edit-product-sku" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
Product Code / Barcode <span className="font-normal text-slate-500 dark:text-slate-400">(scan at POS)</span>
</label>
<div className="flex min-w-0 gap-2">
<input
id="edit-product-sku"
value={editing.sku || ""}
onChange={(e) => setEditing((s) => ({ ...s, sku: e.target.value }))}
autoComplete="off"
placeholder="e.g. PROD-HOODIE-001"
className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
/>
<button
type="button"
onClick={() => setEditing((s) => ({ ...s, sku: generateProductSku(s?.name) }))}
className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
>
Generate
</button>
</div>
<p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
For no-variant products, this is the single barcode to print and scan.
</p>
<div className="mt-4">
 <label htmlFor="edit-product-barcode" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Barcode label <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
 </label>
 <select
 id="edit-product-barcode"
 value={(editing.barcode_code || "").trim()}
 onChange={(e) => {
 const v = e.target.value;
 setEditing((s) => {
 if (!s) return s;
 const lp = labelPricePoolFromSlug(v, { ignoreProductId: s.id });
 if (!lp) {
 return { ...s, barcode_code: v, allocated_stock: "" };
 }
 return {
 ...s,
 barcode_code: v,
 price: lp.isAverageBundle ? lp.price : s.price,
 stock: lp.poolStock,
 allocated_stock: lp.poolStock,
 };
 });
 }}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">None — not linked to a label</option>
 {editBarcodeOrphan && (
 <option value={(editing.barcode_code || "").trim()}>
 {(editing.barcode_code || "").trim()} (not in list — save or pick another)
 </option>
 )}
 {barcodeLabelOptions.map((c) => (
 <option key={c.id} value={c.slug || ""}>
 {c.name || c.slug}
 {c.slug ? ` · ${c.slug}` : ""}
 </option>
 ))}
 </select>
</div>
 </div>
 <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
 <div className="min-w-0">
 <label htmlFor="edit-product-price" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Price (USD) <span className="text-red-500" aria-hidden>*</span>
 {editBarcodeLocksPrice ? (
 <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(from label)</span>
 ) : selectedEditBarcodeLabelMeta ? (
 <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(manual)</span>
 ) : null}
 </label>
 <div className="relative">
 {editBarcodeLocksPrice ? (
 <div
 className={`flex min-h-[44px] w-full items-center rounded-lg border border-slate-200 py-2 pl-7 pr-3 text-sm dark:border-slate-600 ${lockedPriceStockInputCls}`}
 aria-label="Price from barcode label"
 >
 <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
 <span className="pl-1 font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatLockedPriceDisplay(editing.price)}</span>
 </div>
 ) : (
 <>
 <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
 <input
 id="edit-product-price"
 type="number"
 step="0.01"
 min="0"
 inputMode="decimal"
 value={editing.price}
 onChange={(e) => setEditing((s) => ({ ...s, price: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0.00"
 />
 </>
 )}
 </div>
 </div>
 <div className="min-w-0">
 <label htmlFor="edit-product-stock" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Stock{" "}
 <span className="font-normal text-slate-500 dark:text-slate-400">
 {editBarcodeLocksPriceStock ? "(from label)" : "(optional)"}
 </span>
 </label>
 {editBarcodeLocksPriceStock ? (
 <div
 className={`flex min-h-[44px] w-full items-center rounded-lg border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-600 ${lockedPriceStockInputCls}`}
 aria-label="Stock from barcode label"
 >
 <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{formatLockedStockDisplay(editing.stock)}</span>
 </div>
 ) : (
 <input
 id="edit-product-stock"
 type="number"
 min="0"
 inputMode="numeric"
 value={editing.stock}
 onChange={(e) => setEditing((s) => ({ ...s, stock: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0"
 />
 )}
 </div>
 {editBarcodeLocksPriceStock ? (
 <div className="grid min-w-0 grid-cols-1 gap-5 sm:col-span-2 sm:grid-cols-2 sm:gap-6">
 <div className="min-w-0">
 <label htmlFor="edit-product-allocated-stock" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
Allocated Stock
<span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(optional)</span>
 </label>
 <input
 id="edit-product-allocated-stock"
 type="number"
 min="0"
 inputMode="numeric"
 max={editing.stock === "" ? undefined : parseInt(String(editing.stock), 10) || undefined}
 value={editing.allocated_stock ?? ""}
 onChange={(e) => setEditing((s) => (s ? { ...s, allocated_stock: e.target.value } : s))}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0"
 />
 </div>
 <div className="min-w-0">
 <label className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Remaining Label Stock <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">(auto-calc)</span>
 </label>
 <div
 className={`flex min-h-[44px] w-full items-center rounded-lg border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-600 ${lockedPriceStockInputCls}`}
 aria-label="Remaining label stock after allocation"
 >
 <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
 {editRemainingLabelStock == null ? "—" : String(editRemainingLabelStock)}
 </span>
 </div>
 </div>
 </div>
 ) : null}
 </div>
 </div>

 <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
 {barcodeLabelOptions.length === 0
 ? "Create labels under Admin → Barcode & QR."
: selectedEditBarcodeLabelMeta
? barcodeLabelModeText(selectedEditBarcodeLabelMeta)
: "Choosing a listed label sets Price and label pool Stock from that row (read-only). Allocated Stock is optional; leave it blank to use the full label pool. Remaining Label Stock is label pool minus allocation. Clear the label or pick “None” to type price and stock manually."}
 </p>
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
 <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-800 dark:text-slate-100 sm:text-base">Product photos</h3>
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
 className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 transition sm:w-full dark:bg-slate-800/55 ${
 editPhotoActiveSlot === 0
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
 className={`relative flex aspect-[3/4] w-[3.375rem] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed bg-slate-100/80 p-1.5 transition sm:w-full dark:bg-slate-800/55 ${
 editPhotoActiveSlot === si
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
 className={`group/prev relative flex h-full min-h-[240px] w-full flex-col overflow-hidden rounded-xl border-2 border-dashed border-slate-200/95 bg-slate-100/60 dark:border-slate-600 dark:bg-slate-800/40 sm:min-h-[280px] ${
 previewSrc ? "border-solid border-slate-200 dark:border-slate-600" : ""
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

 <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
 <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Details & sizing</h3>
 <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Shown on the product page where applicable.</p>
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 sm:items-start">
 <div className="min-w-0">
 <label htmlFor="edit-product-type" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Product Type
 </label>
 <select
 id="edit-product-type"
 value={editProductType}
 onChange={(e) => setEditProductType(e.target.value)}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 {PRODUCT_TYPES.map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 </div>
 <div className="min-w-0">
 <label htmlFor="edit-model-info" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Model Info
 </label>
 <input
 id="edit-model-info"
 value={editing.model_info || ""}
 onChange={(e) => setEditing((s) => ({ ...s, model_info: e.target.value }))}
 list="model-info-options"
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="Model is 161cm tall / 43kg, wearing size XS"
 />
 </div>

<div className="min-w-0 sm:col-span-2">
<button
type="button"
role="switch"
aria-checked={Boolean(editing.has_variants)}
onClick={() => setEditing((s) => ({ ...s, has_variants: !s.has_variants }))}
className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
editing.has_variants
? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.08)]"
: "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/70"
}`}
>
<span className="min-w-0">
<span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">This product has variants</span>
<span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
Turn off for one barcode and one total stock, with no color or size selection.
</span>
</span>
<span
className={`relative h-6 w-11 shrink-0 rounded-full transition ${editing.has_variants ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-700"}`}
aria-hidden
>
<span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${editing.has_variants ? "left-6" : "left-1"}`} />
</span>
</button>
</div>

{editing.has_variants ? (
<>
<div className="min-w-0">
 <span className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">Colors</span>
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
 <p className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">Available Sizes</p>
 <div className="flex flex-wrap items-center gap-2">
 {editSizeOptions.length === 0 && (
 <span className="text-xs text-slate-500 dark:text-slate-400">No presets for this type — use Add below.</span>
 )}
 {editSizeOptions.map((size) => (
 <label
 key={size}
 className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded border text-xs font-semibold transition select-none ${
 (editing.sizes || []).includes(size)
 ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.2)]"
 : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
 }`}
 title={size}
 >
 <input
 type="checkbox"
 checked={(editing.sizes || []).includes(size)}
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
 className="h-11 min-w-[6rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:min-w-[8rem]"
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
 onClick={() => {
 const value = editCustomSize.trim();
 if (!value) return;
 setEditing((s) => ({
 ...s,
 sizes: (s.sizes || []).includes(value) ? s.sizes : [...(s.sizes || []), value],
 }));
 setEditCustomSize("");
 }}
 className="h-11 shrink-0 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
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

 <div className="min-w-0 sm:col-span-2 border-t border-slate-200/90 pt-5 dark:border-slate-700/80">
 <span className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">Variant stock (Color × Size)</span>
 <div className="space-y-2">
 {(() => {
 const editSwatchColorPicklist = variantStockColorPicklist(Array.isArray(editing?.colors) ? editing.colors : []);
 const editVariantSizes = normalizeSizes(editing?.sizes);
 return editVariantMatrix.map((row, idx) => {
 const rawColor = String(row.color ?? "").trim();
 const matchOpt = editSwatchColorPicklist.find((n) => n.toLowerCase() === rawColor.toLowerCase());
 const selVal =
 editSwatchColorPicklist.length === 0 ? "" : matchOpt !== undefined ? matchOpt : rawColor;
 const rawSize = String(row.size ?? "").trim();
 const sizeMatch =
 editVariantSizes.find((s) => String(s).toLowerCase() === rawSize.toLowerCase());
 const selSizeVal =
 editVariantSizes.length === 0
 ? rawSize
 : sizeMatch !== undefined
 ? sizeMatch
 : rawSize;
 return (
 <div
 key={row.id}
 className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-12 sm:items-end sm:gap-3"
 >
<div className="min-w-0 sm:col-span-3">
 <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`edit-vm-color-${row.id}`}>
 Color
 </label>
 <VariantMatrixColorSelect
 swatchRows={Array.isArray(editing?.colors) ? editing.colors : []}
 picklist={editSwatchColorPicklist}
 value={selVal}
 onChange={(v) => {
 setEditVariantMatrix((prev) => {
 const n = [...prev];
 if (n[idx]) n[idx] = { ...n[idx], color: v };
 return n;
 });
 }}
 disabled={editSwatchColorPicklist.length === 0}
 id={`edit-vm-color-${row.id}`}
 emptyLabel={
 editSwatchColorPicklist.length === 0
 ? "↑ Add color name(s) in “Colors” first"
 : "Pick from colors above…"
 }
 orphanValue={
 rawColor && matchOpt === undefined && editSwatchColorPicklist.length > 0 ? rawColor : ""
 }
 orphanLabel={
 rawColor && matchOpt === undefined && editSwatchColorPicklist.length > 0
 ? `${rawColor} — add this name under Colors or pick another`
 : ""
 }
 />
 </div>
<div className="min-w-0 sm:col-span-2">
 <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`edit-vm-size-${row.id}`}>
 Size
 </label>
 <select
 id={`edit-vm-size-${row.id}`}
 value={selSizeVal}
 disabled={editVariantSizes.length === 0}
 onChange={(e) => {
 const v = e.target.value;
 setEditVariantMatrix((prev) => {
 const n = [...prev];
 if (n[idx]) n[idx] = { ...n[idx], size: v };
 return n;
 });
 }}
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
 >
 <option value="">
 {editVariantSizes.length === 0
 ? "↑ Add sizes under Available Sizes first"
 : "Pick a size…"}
 </option>
 {editVariantSizes.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 {rawSize && editVariantSizes.length === 0 ? (
 <option value={rawSize}>
 {rawSize} — add this under Available Sizes, then pick again
 </option>
 ) : null}
 {rawSize && sizeMatch === undefined && editVariantSizes.length > 0 ? (
 <option value={rawSize}>{rawSize} — not in Available Sizes; add it there or pick another</option>
 ) : null}
 </select>
 </div>
 <div className="min-w-0 sm:col-span-2">
 <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`edit-vm-qty-${row.id}`}>
 Qty
 </label>
 <input
 id={`edit-vm-qty-${row.id}`}
 type="number"
 min="0"
 inputMode="numeric"
 value={row.qty}
 onChange={(e) => {
 const v = e.target.value;
 setEditVariantMatrix((prev) => {
 const n = [...prev];
 if (n[idx]) n[idx] = { ...n[idx], qty: v };
 return n;
 });
 }}
 autoComplete="off"
 placeholder="0"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
 />
 </div>
<div className="min-w-0 sm:col-span-3">
<label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={`edit-vm-sku-barcode-${row.id}`}>
Variant Barcode
</label>
<div className="flex min-w-0 gap-2">
<input
id={`edit-vm-sku-barcode-${row.id}`}
value={row.sku_barcode || ""}
onChange={(e) => {
const v = e.target.value;
setEditVariantMatrix((prev) => {
const n = [...prev];
if (n[idx]) n[idx] = { ...n[idx], sku_barcode: v };
return n;
});
}}
autoComplete="off"
placeholder="Scan/generate"
className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
/>
<button
type="button"
onClick={() => {
setEditVariantMatrix((prev) => {
const n = [...prev];
if (n[idx]) {
n[idx] = {
...n[idx],
sku_barcode: generateVariantSkuBarcode(editing?.name, n[idx].color, n[idx].size),
};
}
return n;
});
}}
className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
>
Generate
</button>
</div>
</div>
<div className="flex justify-end sm:col-span-2">
 {editVariantMatrix.length > 1 ? (
 <button
 type="button"
 onClick={() => setEditVariantMatrix((prev) => prev.filter((_, i) => i !== idx))}
 className="inline-flex h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-900/50 dark:bg-red-400 dark:hover:bg-red-950/40"
 >
 Remove row
 </button>
 ) : null}
 </div>
 </div>
 );
 });
 })()}
 <button
 type="button"
 onClick={() =>
 setEditVariantMatrix((prev) => [...prev, { id: newMatrixRowId(), color: "", size: "", qty: "", sku_barcode: "" }])
 }
 className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--admin-primary)] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
 >
 <Plus className="h-4 w-4 shrink-0" aria-hidden />
 Add variant row
 </button>
 </div>
 </div>

</>
) : (
<div className="min-w-0 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 sm:col-span-2">
No variants enabled. POS scans will use Product Code / Barcode and deduct from the single Stock field.
</div>
)}

 <div className="min-w-0">
 <label htmlFor="edit-support-phone" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Support Hotline
 </label>
 <input
 id="edit-support-phone"
 value={editing.support_phone || ""}
 onChange={(e) => setEditing((s) => ({ ...s, support_phone: e.target.value }))}
 list="support-phone-options"
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="+855 12 345 678"
 />
 </div>
 <div className="min-w-0">
 <label htmlFor="edit-payment-methods" className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
 Payment Methods
 </label>
 <input
 id="edit-payment-methods"
 value={typeof editing.payment_methods === "string" ? editing.payment_methods : (editing.payment_methods?.join(", ") || "")}
 onChange={(e) => setEditing((s) => ({ ...s, payment_methods: e.target.value }))}
 list="payment-options"
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="Cash, ABA, Wing, Credit Card (comma separated)"
 />
 </div>
 </div>
 <datalist id="model-info-options">
 <option value="Model is 161cm tall / 43kg, wearing size XS" />
 <option value="Model is 170cm tall / 55kg, wearing size S" />
 <option value="Model is 175cm tall / 62kg, wearing size M" />
 </datalist>
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
 <datalist id="support-phone-options">
 <option value="+855 12 345 678" />
 <option value="+855 10 888 999" />
 </datalist>
 <datalist id="payment-options">
 <option value="Cash, ABA, Wing, Credit Card" />
 <option value="Cash, ABA" />
 <option value="Cash on Delivery" />
 </datalist>
 </div>
</div>

 <footer className="mt-2 border-t border-slate-200 pt-6 dark:border-slate-800">
 {err ? (
 <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
 {err}
 </div>
 ) : null}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <button
 type="button"
 onClick={closeEditForm}
 className="order-2 inline-flex h-11 min-w-[7rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:order-1"
 >
 Cancel
 </button>
 <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row sm:items-center sm:gap-4">
 <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
 <span className="text-sm font-medium text-slate-700 dark:text-slate-200" id="edit-product-active-label">
 Active listing
 </span>
 <button
 type="button"
 role="switch"
 aria-checked={editing.is_active}
 aria-labelledby="edit-product-active-label"
 onClick={() => setEditing((s) => (s ? { ...s, is_active: !s.is_active } : s))}
 className={`flex h-9 w-[3.75rem] shrink-0 items-center rounded-full p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--admin-primary-rgb),0.45)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
 editing.is_active ? "justify-end" : "justify-start bg-slate-300 dark:bg-slate-600"
 }`}
 style={editing.is_active ? { backgroundColor: accentColor } : undefined}
 >
 <span
 className="pointer-events-none block h-7 w-7 shrink-0 rounded-full bg-white shadow-md ring-1 ring-black/5 dark:ring-white/10"
 aria-hidden
 />
 </button>
 </div>
 <button
 type="submit"
 className="inline-flex h-11 min-w-[10rem] items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 Save changes
 </button>
 </div>
 </div>
 </footer>
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
 className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed border-[color:var(--admin-card-border)] px-5 py-7 text-center transition-[border-color,background-color] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--admin-primary)] focus-visible:ring-offset-2 dark:border-slate-600 dark:focus-visible:ring-[color:var(--admin-primary)] dark:focus-visible:ring-offset-slate-900 ${
 addImageModalDragging
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
 </div>
 </div>
 );
}

