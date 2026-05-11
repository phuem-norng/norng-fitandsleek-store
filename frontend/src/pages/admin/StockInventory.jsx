import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useTheme } from "../../state/theme.jsx";
import { resolveImageUrl } from "../../lib/images";
import { closeSwal, errorAlert, loadingAlert, toastSuccess, warningConfirm } from "../../lib/swal";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
const BARCODE_QR_TYPE = "barcode_qr";

const PRODUCT_TYPES = ["Clothes", "Shoes", "Bags", "Accessories", "Other"];

const SIZE_PRESETS = {
 Clothes: ["XS", "S", "M", "L", "XL", "XXL"],
 Shoes: ["38", "39", "40", "41", "42", "43"],
 Bags: ["One Size", "Free Size"],
 Accessories: ["One Size", "Free Size"],
 Other: [],
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
 brand_id: "",
 category_id: "",
 barcode_code: "",
 is_active: true,
 manage_stock: false,
 stock: "",
 min_stock: "",
 show_stock_movement: false,
 has_variation: false,
 variation_product_type: "Clothes",
 variation_colors: "",
 variation_sizes: [],
 variation_custom_size: "",
};

const parseGallery = (v) =>
 String(v || "").split("\n").map((s) => s.trim()).filter(Boolean);

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

function mapItemToEditForm(item) {
 if (!item) return null;
 return {
 ...item,
 barcode_code: item.slug || "",
 compare_at_price: item.compare_at_price ?? "",
 category_id: item.category_id != null ? String(item.category_id) : "",
 brand_id: item.brand_id != null ? String(item.brand_id) : "",
 manage_stock: item.manage_stock ?? false,
 stock: item.stock != null ? String(item.stock) : "",
 min_stock: item.min_stock != null ? String(item.min_stock) : "",
 show_stock_movement: false,
 has_variation: item.has_variation ?? false,
 variation_product_type: item.variation_product_type || "Clothes",
 variation_colors: item.variation_colors || "",
 variation_sizes: Array.isArray(item.variation_sizes) ? item.variation_sizes : [],
 variation_custom_size: "",
 };
}

export default function AdminBarcodeQR() {
 const navigate = useNavigate();
 const location = useLocation();
 const { id: editRouteId } = useParams();
 const pathname = (location.pathname || "").replace(/\/$/, "");
 const isNewPage = pathname.endsWith("/barcode-qr/new");
 const isEditPage = Boolean(editRouteId && pathname.endsWith("/edit"));

 const { user, refresh: refreshAuth } = useAuth();
 const [createHighlight, setCreateHighlight] = useState(false);
 const { primaryColor, mode } = useTheme();
 const isDark = mode === "dark";
 const accentColor = primaryColor;
 const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

 const deleteButtonStyle = {
 backgroundColor: isDark ? "rgba(127,29,29,0.22)" : "#fef2f2",
 color: isDark ? "#ffffff" : "#991b1b",
 border: `1px solid ${isDark ? "rgba(248,113,113,0.45)" : "#fecdd3"}`,
 padding: "8px 12px",
 borderRadius: "10px",
 fontWeight: 600,
 fontSize: "0.875rem",
 transition: "all 150ms ease",
 display: "inline-flex",
 alignItems: "center",
 gap: "6px",
 };

 const [rows, setRows] = useState([]);
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
 const [selectedIds, setSelectedIds] = useState(() => new Set());
 const [favorites, setFavorites] = useState(() => {
 try {
 const raw = localStorage.getItem("bqr_favorites");
 const arr = raw ? JSON.parse(raw) : [];
 return Array.isArray(arr) ? arr.map(Number) : [];
 } catch {
 return [];
 }
 });
 const [previewItem, setPreviewItem] = useState(null);
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
 try { await refreshAuth(); } catch {}
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

 const load = async () => {
 setLoading(true);
 try {
 const [catRes, brandRes] = await Promise.all([
 api.get("/admin/categories"),
 api.get("/admin/brands"),
 ]);
 const all = catRes?.data?.data || [];
 setRows(all.filter((c) => c.type === BARCODE_QR_TYPE));
 setCategories(all.filter((c) => c.type !== BARCODE_QR_TYPE));
 setBrands(brandRes?.data?.data || []);
 } catch (e) {
 setErr(extractErr(e));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load(); }, []);

 useEffect(() => {
 if (!isNewPage) return;
 let fromSession = null;
 try {
 const raw = sessionStorage.getItem("bqr_duplicate_once");
 if (raw) {
 fromSession = JSON.parse(raw);
 sessionStorage.removeItem("bqr_duplicate_once");
 }
 } catch {
 /* ignore */
 }
 if (fromSession && typeof fromSession === "object") {
 setForm({ ...EMPTY_FORM, ...fromSession, barcode_code: fromSession.barcode_code || "" });
 } else {
 setForm({ ...EMPTY_FORM });
 }
 setCreateHighlight(false);
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
 navigate("/admin/barcode-qr", { replace: true });
 return;
 }
 setEditing(mapItemToEditForm(item));
 } catch {
 if (!cancelled) navigate("/admin/barcode-qr", { replace: true });
 }
 })();
 return () => { cancelled = true; };
 }, [isEditPage, editRouteId, navigate]);

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
 try { localStorage.setItem(key, JSON.stringify(appearance)); } catch {}
 }, [appearance, previewItem?.id]);

 const resetForm = () => setForm({ ...EMPTY_FORM });

 const generateCode = () => {
 const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
 return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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

 const sizeOptionsFor = (data) => SIZE_PRESETS[data.variation_product_type || "Clothes"] || SIZE_PRESETS.Other;

 /* ── CRUD ── */
 const create = async (e) => {
 e.preventDefault();
 if (!form.name.trim()) { setErr("Product name is required"); return; }
 setIsCreating(true);
 loadingAlert({ khTitle: "កំពុងបង្កើត", enTitle: "Creating…", khText: "សូមរង់ចាំ", enText: "Please wait" });
 try {
 const finalCode = form.barcode_code.trim() ? sanitizeCode(form.barcode_code) : generateCode();
 await api.post("/admin/categories", {
 name: form.name.trim(),
 slug: finalCode,
 type: BARCODE_QR_TYPE,
 description: form.description || null,
 details: form.details || null,
 price: form.price || null,
 compare_at_price: form.compare_at_price || null,
 label_color: form.label_color || null,
 image_url: form.image_url || null,
 gallery: form.gallery || null,
 sku: form.sku || null,
 cost: form.cost || null,
 unit: form.unit || null,
 brand_id: form.brand_id || null,
 category_id: form.category_id ? parseInt(form.category_id, 10) : null,
 is_active: form.is_active,
 sort_order: 0,
 manage_stock: !!form.manage_stock,
 stock: form.manage_stock && form.stock !== "" ? parseInt(form.stock, 10) : null,
 min_stock: form.manage_stock && form.min_stock !== "" ? parseInt(form.min_stock, 10) : null,
 has_variation: !!form.has_variation,
 variation_product_type: form.has_variation ? (form.variation_product_type || null) : null,
 variation_colors: form.has_variation ? (form.variation_colors || null) : null,
 variation_sizes: form.has_variation && Array.isArray(form.variation_sizes) && form.variation_sizes.length ? form.variation_sizes : null,
 });
 closeSwal();
 resetForm();
 await toastSuccess({ khText: "បង្កើតដោយជោគជ័យ", enText: "Created successfully!" });
 await load();
 navigate("/admin/barcode-qr");
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
 const editCode = editing.barcode_code?.trim()
 ? sanitizeCode(editing.barcode_code)
 : (editing.slug || generateCode());
 try {
 await api.patch(`/admin/categories/${editing.id}`, {
 name: editing.name,
 slug: editCode,
 description: editing.description || null,
 details: editing.details || null,
 price: editing.price || null,
 compare_at_price: editing.compare_at_price || null,
 label_color: editing.label_color || null,
 image_url: editing.image_url || null,
 gallery: editing.gallery || null,
 sku: editing.sku || null,
 cost: editing.cost || null,
 unit: editing.unit || null,
 brand_id: editing.brand_id || null,
 category_id: editing.category_id ? parseInt(editing.category_id, 10) : null,
 is_active: editing.is_active,
 type: BARCODE_QR_TYPE,
 manage_stock: !!editing.manage_stock,
 stock: editing.manage_stock && editing.stock !== "" ? parseInt(editing.stock, 10) : null,
 min_stock: editing.manage_stock && editing.min_stock !== "" ? parseInt(editing.min_stock, 10) : null,
 has_variation: !!editing.has_variation,
 variation_product_type: editing.has_variation ? (editing.variation_product_type || null) : null,
 variation_colors: editing.has_variation ? (editing.variation_colors || null) : null,
 variation_sizes: editing.has_variation && Array.isArray(editing.variation_sizes) && editing.variation_sizes.length ? editing.variation_sizes : null,
 });
 showSuccess("Updated successfully!");
 await load();
 navigate("/admin/barcode-qr");
 } catch (e2) {
 setErr(extractErr(e2));
 }
 };

 const del = async (id, navigateAfter = false) => {
 const res = await warningConfirm({
 enTitle: "Delete this preset?",
 enText: "This action cannot be undone.",
 enConfirm: "Delete",
 intent: "destructive",
 });
 if (!res.isConfirmed) return;
 try {
 await api.delete(`/admin/categories/${id}`);
 showSuccess("Deleted successfully!");
 await load();
 if (navigateAfter) navigate("/admin/barcode-qr");
 } catch (e2) {
 setErr(extractErr(e2));
 }
 };

 const duplicateCurrentEdit = () => {
 if (!editing) return;
 const copy = mapItemToEditForm({
 ...editing,
 name: `${editing.name || "Item"} (copy)`,
 barcode_code: "",
 slug: "",
 });
 const { id: _omitId, ...copyWithoutId } = copy;
 try {
 sessionStorage.setItem("bqr_duplicate_once", JSON.stringify(copyWithoutId));
 } catch {
 /* ignore */
 }
 navigate("/admin/barcode-qr/new");
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

 const displayRows = useMemo(() => {
 let list = searchFiltered;
 if (stockFilter === "low") {
 list = list.filter((r) => {
 if (!r.manage_stock) return false;
 const st = parseInt(r.stock, 10) || 0;
 const mn = parseInt(r.min_stock, 10) || 0;
 return st > 0 && mn > 0 && st <= mn;
 });
 } else if (stockFilter === "out") {
 list = list.filter((r) => r.manage_stock && (parseInt(r.stock, 10) || 0) === 0);
 } else if (stockFilter === "inactive") {
 list = list.filter((r) => !r.is_active);
 }
 return list;
 }, [searchFiltered, stockFilter]);

 const inventoryStats = useMemo(() => {
 let totalValue = 0;
 let totalCost = 0;
 let lowStock = 0;
 let outStock = 0;
 let units = 0;
 for (const r of displayRows) {
 const price = parseFloat(r.price) || 0;
 const cost = parseFloat(r.cost) || 0;
 if (r.manage_stock) {
 const st = parseInt(r.stock, 10) || 0;
 const mn = parseInt(r.min_stock, 10) || 0;
 totalValue += price * st;
 totalCost += cost * st;
 units += st;
 if (st === 0) outStock += 1;
 else if (mn > 0 && st <= mn) lowStock += 1;
 }
 }
 return {
 totalValue,
 totalCost,
 projectedProfit: totalValue - totalCost,
 lowStock,
 outStock,
 units,
 };
 }, [displayRows]);

 const toggleFavorite = (id) => {
 setFavorites((prev) => {
 const n = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
 try { localStorage.setItem("bqr_favorites", JSON.stringify(n)); } catch {}
 return n;
 });
 };

 const toggleCatalogActive = async (item) => {
 try {
 await api.patch(`/admin/categories/${item.id}`, {
 name: item.name,
 slug: item.slug,
 type: BARCODE_QR_TYPE,
 is_active: !item.is_active,
 });
 await load();
 } catch (e2) {
 setErr(extractErr(e2));
 }
 };

 const exportCsv = () => {
 const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
 const header = ["Name", "Code", "Category", "Stock", "Price", "Active"];
 const lines = [header.join(",")];
 for (const r of displayRows) {
 const cat = categories.find((c) => String(c.id) === String(r.category_id));
 const st = r.manage_stock ? (parseInt(r.stock, 10) || 0) : "";
 lines.push([esc(r.name), esc(r.slug || r.sku || ""), esc(cat?.name || ""), st, r.price ?? "", r.is_active ? "yes" : "no"].join(","));
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
 const highlightOn = data.id ? favorites.includes(data.id) : createHighlight;
 const toggleHighlight = () => {
 if (data.id) toggleFavorite(data.id);
 else setCreateHighlight((v) => !v);
 };

 return (
 <div className="w-full min-w-0 pb-1">
 <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 ring-1 ring-slate-950/[0.02] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.03] sm:px-5">
 <button
 type="button"
 onClick={toggleHighlight}
 className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
 highlightOn
 ? "border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
 : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
 }`}
 >
 <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
 <path
 className={
 highlightOn
 ? "fill-slate-600 stroke-none dark:fill-slate-300"
 : "fill-none stroke-slate-400 dark:stroke-slate-500"
 }
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
 />
 </svg>
 Highlight product
 </button>
 <div className="flex items-center gap-3 sm:ml-auto">
 <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Show on Online Catalog</span>
 <button
 type="button"
 role="switch"
 aria-checked={data.is_active}
 onClick={() => setData((s) => ({ ...s, is_active: !s.is_active }))}
 className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${data.is_active ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600"}`}
 >
 <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${data.is_active ? "translate-x-5" : "translate-x-0"}`} />
 </button>
 </div>
 </div>

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
 className="min-h-[6.75rem] rounded-t-2xl bg-[#ffddcb] px-6 pt-9 pb-[4.75rem] dark:bg-[#3d2922]/85 sm:min-h-[7.25rem] sm:px-10 sm:pt-10 sm:pb-[5.75rem]"
 aria-hidden
 />
 <div className="relative z-[1] -mt-[7.25rem] flex justify-center px-4 pb-5 sm:-mt-[8rem] sm:px-8 sm:pb-6">
 <div className="flex w-full max-w-[min(100%,240px)] flex-col overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-[0_22px_50px_rgba(15,23,42,0.16),0_4px_12px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04] dark:border-white/12 dark:bg-slate-900 dark:shadow-black/45 dark:ring-white/[0.05]">
 <div className="aspect-square w-full shrink-0 overflow-hidden rounded-t-xl bg-neutral-100 dark:bg-slate-800/80">
 {heroPhotoUrl ? (
 <img src={resolveImageUrl(heroPhotoUrl)} alt="" className="h-full w-full object-cover object-center" />
 ) : (
 <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-400 dark:text-slate-500">
 <svg className="h-9 w-9 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span className="text-[11px] font-medium leading-snug">Add a photo below.</span>
 </div>
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
title="Replace this photo"
aria-label="Replace this gallery photo"
onClick={() => {
 pendingReplaceGalleryIndexRef.current = galleryRmIndex;
 replaceGalleryInputRef.current?.click();
}}
className="absolute inset-0 z-0 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--admin-primary)] disabled:opacity-50"
/>
 <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
 <button
 type="button"
 disabled={isUploading}
 onClick={() =>
 setData((s) => {
 const next = parseGallery(s.gallery).filter((_, i) => i !== galleryRmIndex);
 return { ...s, gallery: next.join("\n") };
 })
 }
 className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
 title="Remove from gallery"
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

 {/* Details */}
 <div>
 <label className={labelCls}>Details</label>
 <textarea
 value={data.details || ""}
 onChange={(e) => setData((s) => ({ ...s, details: e.target.value }))}
 rows={2}
 className={textareaCls}
 placeholder="Short product details or notes…"
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

 {/* Category */}
 <div>
 <label className={labelCls}>Category</label>
 <select
 value={data.category_id != null && data.category_id !== "" ? String(data.category_id) : ""}
 onChange={(e) => setData((s) => ({ ...s, category_id: e.target.value }))}
 className={selectCls}
 >
 <option value="">Select category</option>
 {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
 </select>
 </div>

 {/* Label name (Brand) */}
 <div>
 <label className={labelCls}>Label name (Brand)</label>
 <select
 value={data.brand_id != null && data.brand_id !== "" ? String(data.brand_id) : ""}
 onChange={(e) => setData((s) => ({ ...s, brand_id: e.target.value }))}
 className={selectCls}
 >
 <option value="">Select brand</option>
 {brands.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
 </select>
 </div>

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
 <button
 type="button"
 onClick={() => {
 if (!data.name) return;
 const cat = categories.find((c) => String(c.id) === String(data.category_id));
 const brand = brands.find((b) => String(b.id) === String(data.brand_id));
 const suggested = [
 `${data.name}${brand ? ` by ${brand.name}` : ""}${cat ? ` — ${cat.name}` : ""}.`,
 "Premium quality product crafted for everyday comfort and style.",
 data.price ? `Available at $${parseFloat(data.price).toFixed(2)}.` : "",
 ].filter(Boolean).join(" ");
 setData((s) => ({ ...s, description: suggested }));
 }}
 className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 Suggest description
 </button>
 </div>

 {/* Product code */}
 <div>
 <label className={labelCls}>Product code (SKU)</label>
 <input
 value={data.sku || ""}
 onChange={(e) => setData((s) => ({ ...s, sku: e.target.value }))}
 className={`${inputCls} font-mono`}
 placeholder="SKU-001"
 />
 </div>

 {/* Barcode Code */}
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

 {/* Cost */}
 <div>
 <label className={labelCls}>Cost ($)</label>
 <input
 type="number"
 step="0.01"
 value={data.cost || ""}
 onChange={(e) => setData((s) => ({ ...s, cost: e.target.value }))}
 className={inputCls}
 placeholder="Cost price (internal)"
 />
 </div>

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

 </div>

 <div className="min-w-0 space-y-6 xl:col-span-5">
 {/* ── Automatic registration (BETA) ── */}
 <div className="relative space-y-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 ring-1 ring-slate-950/[0.02] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.03]">
 <span className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" title="Uses image similarity to suggest fields from your catalog.">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
 </span>
 <div className="flex flex-col gap-4 pr-6">
 <div className="relative shrink-0">
 <input ref={aiPhotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleAutoRegisterPhoto(e, setData)} />
 <button
 type="button"
 disabled={aiBusy}
 onClick={() => aiPhotoInputRef.current?.click()}
 className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
 >
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 {aiBusy ? "…" : "Select a photo"}
 </button>
 </div>
 <div className="min-w-0">
 <div className="mb-1 flex flex-wrap items-center gap-2">
 <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Automatic registration</h3>
 <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-700 dark:text-slate-200">BETA</span>
 </div>
 <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
 Just upload a photo: the AI quickly fills in the name, price, category, and description. Everything&apos;s ready in seconds, and you can still adjust it as you like.
 </p>
 </div>
 </div>
 </div>

 {/* ── Stock ── */}
 <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 ring-1 ring-slate-950/[0.02] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.03]">
 <div className="flex items-center justify-between gap-3">
 <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Stock</h3>
 <div className="flex items-center gap-2">
 <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-right max-w-[140px] sm:max-w-none">Manage stock for this product</span>
 <button
 type="button"
 onClick={() => setData((s) => ({ ...s, manage_stock: !s.manage_stock, show_stock_movement: s.manage_stock ? false : s.show_stock_movement }))}
 className={`w-11 h-6 rounded-full transition-all flex items-center shrink-0 ${data.manage_stock ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600"}`}
 >
 <span className={`w-4 h-4 bg-white rounded-full transform transition-transform mx-0.5 ${data.manage_stock ? "translate-x-5" : "translate-x-0"}`} />
 </button>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className={labelCls}>On hand</label>
 <input
 type="number"
 min={0}
 value={data.stock ?? ""}
 onChange={(e) => setData((s) => ({ ...s, stock: e.target.value }))}
 disabled={!data.manage_stock}
 className={`${inputCls} ${!data.manage_stock ? "opacity-50 cursor-not-allowed" : ""}`}
 placeholder="0"
 />
 </div>
 <div>
 <label className={labelCls}>Minimum</label>
 <input
 type="number"
 min={0}
 value={data.min_stock ?? ""}
 onChange={(e) => setData((s) => ({ ...s, min_stock: e.target.value }))}
 disabled={!data.manage_stock}
 className={`${inputCls} ${!data.manage_stock ? "opacity-50 cursor-not-allowed" : ""}`}
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

 {/* ── Product with variation (NEW) ── */}
 <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 ring-1 ring-slate-950/[0.02] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.03]">
 <div className="flex items-start gap-4">
 <div className="shrink-0 w-[100px] flex flex-col items-center gap-1">
 <div className="relative w-full flex justify-center">
 <div className="w-14 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] text-slate-400 text-center px-1">tee</div>
 <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-pink-500 text-lg">→</span>
 <div className="flex flex-col gap-0.5 ml-2">
 <div className="w-7 h-5 rounded-sm bg-[color:var(--admin-primary)]" />
 <div className="w-7 h-5 rounded-sm bg-slate-200 dark:bg-slate-600" />
 <div className="w-7 h-5 rounded-sm bg-slate-700" />
 </div>
 </div>
 <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">T-Shirts</span>
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Product with variation</h3>
 <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md text-white bg-[color:var(--admin-primary)]">NEW</span>
 </div>
 <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
 Add variations like color, size, voltage, or flavor to your products, keep your stock organized, and make sales easier.
 </p>
 <button
 type="button"
 onClick={() => setData((s) => ({ ...s, has_variation: true }))}
 className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:brightness-110 bg-[color:var(--admin-primary)]"
 >
 Add variation
 </button>
 </div>
 </div>
 <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
 <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Enable variation fields</span>
 <button
 type="button"
 onClick={() => setData((s) => ({ ...s, has_variation: !s.has_variation }))}
 className={`w-11 h-6 rounded-full transition-all flex items-center ${data.has_variation ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600"}`}
 >
 <span className={`w-4 h-4 bg-white rounded-full transform transition-transform mx-0.5 ${data.has_variation ? "translate-x-5" : "translate-x-0"}`} />
 </button>
 </div>
 {data.has_variation && (
 <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
 <div>
 <label className={labelCls}>Product type</label>
 <select
 value={data.variation_product_type || "Clothes"}
 onChange={(e) => setData((s) => ({ ...s, variation_product_type: e.target.value, variation_sizes: [] }))}
 className={selectCls}
 >
 {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 <div>
 <label className={labelCls}>Colors</label>
 <input
 value={data.variation_colors || ""}
 onChange={(e) => setData((s) => ({ ...s, variation_colors: e.target.value }))}
 className={inputCls}
 placeholder="Black, White, Red"
 />
 </div>
 <div>
 <label className={labelCls}>Sizes</label>
 <div className="flex flex-wrap gap-2 mb-2">
 {sizeOptionsFor(data).map((size) => {
 const sizes = Array.isArray(data.variation_sizes) ? data.variation_sizes : [];
 const on = sizes.includes(size);
 return (
 <label key={size} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition ${on ? "border-slate-400 bg-slate-100 dark:bg-slate-700 dark:border-slate-500 font-semibold" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
 <input
 type="checkbox"
 className="hidden"
 checked={on}
 onChange={() => setData((s) => {
 const cur = Array.isArray(s.variation_sizes) ? s.variation_sizes : [];
 return { ...s, variation_sizes: cur.includes(size) ? cur.filter((v) => v !== size) : [...cur, size] };
 })}
 />
 {size}
 </label>
 );
 })}
 </div>
 <div className="flex gap-2">
 <input
 value={data.variation_custom_size || ""}
 onChange={(e) => setData((s) => ({ ...s, variation_custom_size: e.target.value }))}
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 e.preventDefault();
 const v = (data.variation_custom_size || "").trim();
 if (!v) return;
 setData((s) => {
 const cur = Array.isArray(s.variation_sizes) ? s.variation_sizes : [];
 return { ...s, variation_sizes: cur.includes(v) ? cur : [...cur, v], variation_custom_size: "" };
 });
 }
 }}
 placeholder="Custom size…"
 className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm outline-none"
 />
 <button
 type="button"
 onClick={() => {
 const v = (data.variation_custom_size || "").trim();
 if (!v) return;
 setData((s) => {
 const cur = Array.isArray(s.variation_sizes) ? s.variation_sizes : [];
 return { ...s, variation_sizes: cur.includes(v) ? cur : [...cur, v], variation_custom_size: "" };
 });
 }}
 className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white shrink-0"
 style={{ backgroundColor: accentIsWhite ? "#0b0b0f" : accentColor, color: accentIsWhite ? "#fff" : "#fff" }}
 >
 Add
 </button>
 </div>
 </div>
 </div>
 )}
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
 <div className="min-h-screen w-full min-w-0 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
 {successToast}
 <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
 <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-4 py-4">
 <div className="flex min-w-0 items-center gap-3 sm:gap-4">
 <button
 type="button"
 onClick={() => navigate("/admin/barcode-qr")}
 disabled={isCreating}
 className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
 >
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 Back
 </button>
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">Add a product</h1>
 <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
Stock &amp; Inventory
                  </span>
 </div>
 <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Fill in the details below, then create your catalog item.</p>
 </div>
 </div>
 <button
 type="button"
 className="hidden rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 sm:inline-flex dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
 title="Form tips: use a clear product name and price. Barcode can be auto-generated."
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </button>
 </div>
 </header>
 <main className="w-full min-w-0 py-8 pb-28">
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
 onClick={() => navigate("/admin/barcode-qr")}
 disabled={isCreating}
 className={`flex-1 rounded-xl border py-3.5 text-sm font-semibold transition disabled:opacity-50 ${
 isDark
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
 </main>
 </div>
 );
 }

 if (isEditPage && !editing) {
 return (
 <div className="flex min-h-screen min-h-0 flex-col bg-slate-50 dark:bg-slate-950">
 {successToast}
 <AdminContentSkeleton lines={5} imageHeight={120} className="min-h-0 flex-1 px-4" />
 </div>
 );
 }

 if (isEditPage) {
 return (
 <div className="min-h-screen w-full min-w-0 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
 {successToast}
 <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
 <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-4 py-4">
 <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
 <button
 type="button"
 onClick={() => navigate("/admin/barcode-qr")}
 className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
 >
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 Back
 </button>
 <div className="min-w-0">
 <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">Edit product</h1>
 <p className="truncate text-sm text-slate-500 dark:text-slate-400">{editing.name}</p>
 </div>
 </div>
 <div className="flex flex-wrap items-center justify-end gap-2">
 <button
 type="button"
 className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
 title="Help"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </button>
 <button
 type="button"
 onClick={duplicateCurrentEdit}
 className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
 Duplicate
 </button>
 <button
 type="button"
 onClick={() => del(editing.id, true)}
 className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold ${
 isDark
 ? "border-red-900/60 bg-red-950/40 text-white hover:bg-red-950/70"
 : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
 }`}
 >
 <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 Delete
 </button>
 </div>
 </div>
 </header>
 <main className="w-full min-w-0 py-8 pb-28">
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
 onClick={() => navigate("/admin/barcode-qr")}
 className={`flex-1 rounded-xl border py-3.5 text-sm font-semibold transition ${
 isDark
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
 </main>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
 {successToast}

 <div className="w-full min-w-0">
 {/* Title row */}
 <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-5 ring-1 ring-slate-950/[0.03] backdrop-blur-sm dark:border-slate-700/90 dark:bg-slate-900/95 dark:ring-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:p-6">
 <div className="min-w-0 space-y-2">
 <div className="flex flex-wrap items-center gap-2 gap-y-1">
 <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">Items</h1>
 <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
Stock &amp; Inventory
                </span>
 </div>
 <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
 <span className="font-semibold text-slate-800 dark:text-slate-200">{rows.length}</span> registered item{rows.length !== 1 ? "s" : ""}
 {stockFilter !== "all" ? (
 <span className="text-slate-500 dark:text-slate-500"> · showing {displayRows.length} after filter</span>
 ) : null}
 <span className="text-slate-500 dark:text-slate-500"> · manage labels and scan sales from one place.</span>
 </p>
 </div>
 <button
 type="button"
 onClick={() => navigate("/admin/barcode-qr/new")}
 className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[color:var(--admin-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--admin-primary)] hover:opacity-95 active:scale-[0.99]"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add product
 </button>
 </div>

 {/* Error */}
 {err && (
 <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/95 p-4 dark:border-red-900/60 dark:bg-red-950/40">
 <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-red-700 dark:text-red-200 text-sm font-medium flex-1">{err}</span>
 <button type="button" onClick={() => setErr("")} className="text-red-400 hover:text-red-600">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 )}

 {/* Toolbar */}
 <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 ring-1 ring-slate-950/[0.02] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.03] lg:flex-row lg:items-center lg:gap-4 lg:p-5">
 <div className="relative min-w-0 flex-1 max-w-xl">
 <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search by name, SKU, or code…"
 className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-500/50 focus:bg-white focus:ring-2 focus:ring-slate-500/15 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500/50 dark:focus:bg-slate-900"
 />
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <select
 value={stockFilter}
 onChange={(e) => setStockFilter(e.target.value)}
 className={`h-11 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-slate-500/40 focus:ring-2 focus:ring-slate-500/15 dark:border-slate-600 dark:bg-slate-800 dark:focus:border-slate-500/40 ${isDark ? "text-white" : "text-slate-700"}`}
 title="Filter catalog"
 >
 <option value="all">All items</option>
 <option value="low">Low in stock</option>
 <option value="out">Out of stock</option>
 <option value="inactive">Inactive catalog</option>
 </select>
 <button
 type="button"
 onClick={() => document.getElementById("bqr-category-anchor")?.scrollIntoView({ behavior: "smooth" })}
 className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/80"
 >
 Categories
 </button>
 <button
 type="button"
 onClick={exportCsv}
 className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/80"
 >
 Generate report
 </button>
 <button
 type="button"
 onClick={() => setPreviewItem(displayRows[0] || null)}
 disabled={!displayRows.length}
 className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700/80 dark:hover:text-slate-100"
 title="Preview label (first item in list)"
 >
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
 <path
 className="fill-none stroke-slate-600 dark:stroke-slate-400"
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.243m-6.243 0H6m6 0V9m0 3v3"
 />
 </svg>
 </button>
 <button
 type="button"
 onClick={exportCsv}
 className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80"
 title="Export CSV"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
 </svg>
 </button>
 </div>
 </div>

 {/* Inventory summary */}
 {rows.length > 0 && (
 <div className="mb-5 rounded-2xl border border-slate-200/90 bg-white p-4 ring-1 ring-slate-950/[0.02] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.03] sm:p-5">
 <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory snapshot</p>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
 <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
 <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total in stock</span>
 <span className="mt-1 block text-lg font-bold tabular-nums text-slate-900 dark:text-white">${inventoryStats.totalValue.toFixed(2)}</span>
 </div>
 <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
 <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost of stock</span>
 <span className="mt-1 block text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">${inventoryStats.totalCost.toFixed(2)}</span>
 </div>
 <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
 <span className="block text-[10px] font-semibold uppercase tracking-wide text-black dark:text-white">Projected profit</span>
 <span className="mt-1 block text-lg font-semibold tabular-nums text-black dark:text-white">${inventoryStats.projectedProfit.toFixed(2)}</span>
 </div>
 <div className="flex flex-col justify-center rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
 <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-black dark:text-white">
 <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden />
 Low in stock
 </span>
 <span className="mt-1 text-lg font-bold tabular-nums text-black dark:text-white">{inventoryStats.lowStock}</span>
 </div>
 <div className="flex flex-col justify-center rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
 <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-white" : "text-slate-700"}`}>
 <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden />
 Out of stock
 </span>
 <span className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{inventoryStats.outStock}</span>
 </div>
 <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700/80 dark:bg-slate-800/50">
 <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">In stock (units)</span>
 <span className="mt-1 block text-lg font-bold tabular-nums text-slate-900 dark:text-white">{inventoryStats.units}</span>
 </div>
 </div>
 </div>
 )}

 {/* Table */}
 {rows.length === 0 ? (
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
 <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
 <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" aria-hidden>
 <path
 className="fill-none stroke-slate-400 dark:stroke-slate-500"
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={1.5}
 d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.243m-6.243 0H6m6 0V9m0 3v3"
 />
 </svg>
 </div>
 <p className="text-slate-500 dark:text-slate-300 font-medium">No items yet</p>
 <p className="mt-1 text-sm text-slate-400">Use &quot;Add product&quot; above to create a label.</p>
 </div>
 ) : displayRows.length === 0 ? (
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
 <p className="text-slate-600 dark:text-slate-300 font-medium">No items match this filter</p>
 <button type="button" onClick={() => setStockFilter("all")} className="mt-3 text-sm font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200">Show all</button>
 </div>
 ) : (
 <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white ring-1 ring-slate-950/[0.02] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.03]">
 <div className="overflow-x-auto">
 <table className="min-w-[860px] w-full text-sm">
 <thead>
 <tr className="border-b border-slate-200/90 bg-slate-100/95 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
 <th className="w-10 px-3 py-3.5">
 <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
 </th>
 <th className="w-10 px-1 py-3.5" aria-label="Favorite" />
 <th className="min-w-[240px] px-4 py-3.5">
 <span className="block">Products</span>
 <span className="mt-0.5 block font-sans text-[10px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">Tap a row to open label preview</span>
 </th>
 <th id="bqr-category-anchor" className="w-32 px-4 py-3.5">
 Category
 </th>
 <th className="w-24 px-4 py-3.5 text-right">Stock</th>
 <th className="w-28 px-4 py-3.5 text-right">Price</th>
 <th className="w-28 px-4 py-3.5 text-center">Catalog</th>
 <th className="w-28 px-4 py-3.5 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800/90">
 {displayRows.map((item) => {
 const barcodeVal = item.slug || slugify(item.name) || "ITEM";
 const cat = categories.find((c) => String(c.id) === String(item.category_id));
 const st = item.manage_stock ? (parseInt(item.stock, 10) || 0) : null;
 const mn = item.manage_stock ? (parseInt(item.min_stock, 10) || 0) : 0;
 const stockClass = st === null ? "text-slate-400" : st === 0 ? "text-red-600 font-bold" : mn > 0 && st <= mn ? "text-amber-600 font-semibold" : "text-slate-800 dark:text-slate-100 font-medium";
 return (
 <tr key={item.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
 <td className="px-3 py-3 align-middle">
 <input type="checkbox" className="rounded border-slate-300" checked={selectedIds.has(item.id)} onChange={() => toggleRowSelect(item.id)} aria-label={`Select ${item.name}`} />
 </td>
 <td className="px-1 py-3 align-middle">
 <button
 type="button"
 onClick={() => toggleFavorite(item.id)}
 className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
 aria-label="Favorite"
 >
 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
 <path
 className={
 favorites.includes(item.id)
 ? "fill-slate-600 stroke-none dark:fill-slate-300"
 : "fill-none stroke-slate-400 dark:stroke-slate-500"
 }
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
 />
 </svg>
 </button>
 </td>
 <td className="px-3 py-3 align-middle">
 <button
 type="button"
 onClick={() => setPreviewItem(item)}
 className="group flex w-full max-w-xl min-w-0 items-center gap-3 rounded-xl border border-transparent p-1.5 text-left transition hover:border-slate-200 hover:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
 title="Click to preview label"
 aria-label={`Preview label: ${item.name || "item"}`}
 >
 <div className="relative w-[72px] h-[52px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white transition group-hover:border-slate-300 group-hover:shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:group-hover:border-slate-500">
 {item.image_url ? (
 <img src={resolveImageUrl(item.image_url)} alt="" className="h-full w-full object-cover" />
 ) : (
 <div className="flex h-full w-full origin-center scale-[0.85] items-center justify-center">
 <Barcode value={barcodeVal} width={0.9} height={22} fontSize={8} margin={0} displayValue={false} format="CODE128" background="#ffffff" lineColor={isDark ? "#e2e8f0" : "#1e293b"} />
 </div>
 )}
 <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/35 group-hover:opacity-100">
 <svg className="h-7 w-7 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 </span>
 </div>
 <div className="min-w-0 flex-1">
 <div className="truncate font-semibold text-slate-900 underline decoration-transparent decoration-2 underline-offset-2 transition group-hover:decoration-slate-400/60 dark:text-slate-100 dark:group-hover:decoration-slate-500/60">
 {item.name}
 </div>
 <div className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{barcodeVal}</div>
 <p className="mt-0.5 hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">Preview label</p>
 </div>
 </button>
 </td>
 <td className="px-3 py-3 align-middle text-slate-600 dark:text-slate-300 truncate max-w-[8rem]" title={cat?.name || ""}>
 {cat?.name || "—"}
 </td>
 <td className={`px-3 py-3 align-middle text-right tabular-nums ${stockClass}`}>
 {st === null ? "—" : st}
 </td>
 <td className="px-3 py-3 align-middle text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
 {item.price != null && item.price !== "" ? `$${parseFloat(item.price).toFixed(2)}` : "—"}
 </td>
 <td className="px-3 py-3 align-middle text-center">
 <button
 type="button"
 role="switch"
 aria-checked={item.is_active}
 onClick={() => toggleCatalogActive(item)}
 className={`relative mx-auto h-6 w-11 rounded-full transition-colors ${item.is_active ? "bg-slate-700 dark:bg-slate-300" : "bg-slate-300 dark:bg-slate-600"}`}
 >
 <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${item.is_active ? "translate-x-5" : "translate-x-0"}`} />
 </button>
 </td>
 <td className="px-3 py-3 align-middle text-right">
 <div className="inline-flex items-center gap-1 justify-end">
 <button
 type="button"
 onClick={() => setPreviewItem(item)}
 className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
 title="Open label preview & print"
 >
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
 </svg>
 </button>
 <button
 type="button"
 onClick={() => navigate(`/admin/barcode-qr/${item.id}/edit`)}
 className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
 title="Edit"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
 </button>
 <button type="button" onClick={() => del(item.id)} style={{ ...deleteButtonStyle, padding: "6px" }} title="Delete">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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

 {/* ── Print Preview Modal ── */}
 {previewItem && (() => {
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
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
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
 </div>
 );
 })()}
 </div>
 );
}
