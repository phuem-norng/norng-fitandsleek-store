import React, { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Columns2Icon, LayoutGridIcon, ListIcon } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useTheme } from "../../state/theme.jsx";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import { resolveImageUrl } from "../../lib/images";
import { closeSwal, errorAlert, loadingAlert, toastSuccess, warningConfirm } from "../../lib/swal";
import { AdminContentSkeleton, AdminDashboardLoader, AdminSectionLoader } from "@/components/admin/AdminLoading";

export default function AdminProducts() {
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
 name: "", sku: "", barcode_code: "", description: "", price: "", stock: "", category_id: "", brand_id: "", image_url: "", gender: "", is_active: true,
 model_info: "", colors: "", sizes: [], size_guide: "", delivery_info: "", support_phone: "", payment_methods: "", gallery: ""
 });
 const [editing, setEditing] = useState(null);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [animate, setAnimate] = useState(false);
 const [isUploading, setIsUploading] = useState(false);
 const [showCreateForm, setShowCreateForm] = useState(false);
 const [createSection, setCreateSection] = useState("basic");
 const [search, setSearch] = useState("");
 const [selectedGenders, setSelectedGenders] = useState([]); // [] = All
 const [selectedSections, setSelectedSections] = useState([]); // [] = All types
 const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
 const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
 const genderDropdownRef = useRef(null);
 const sectionDropdownRef = useRef(null);
 const [selectedIds, setSelectedIds] = useState([]);
 const [viewMode, setViewMode] = useState("list");
 const [galleryError, setGalleryError] = useState("");
 const [editGalleryError, setEditGalleryError] = useState("");
 const galleryInputRef = useRef(null);
 const editGalleryInputRef = useRef(null);
 const [productType, setProductType] = useState("Clothes");
 const [customSize, setCustomSize] = useState("");
 const [editProductType, setEditProductType] = useState("Clothes");
 const [editCustomSize, setEditCustomSize] = useState("");
 const [isCreating, setIsCreating] = useState(false);
 const [createError, setCreateError] = useState("");

 const getValidationMessage = (error) => {
 const responseMessage = error?.response?.data?.message;
 const errors = error?.response?.data?.errors;
 if (errors && typeof errors === "object") {
 const first = Object.values(errors).flat().find(Boolean);
 return first || responseMessage || "Validation failed.";
 }
 return responseMessage || error?.message || "Create failed.";
 };

 const PRODUCT_TYPES = ["Clothes", "Shoes", "Bags", "Accessories", "Other"];

 const SIZE_PRESETS = {
 clothes: ["XS", "S", "M", "L", "XL", "XXL"],
 shoes: ["38", "39", "40", "41", "42", "43"],
 bag: ["One Size", "Free Size"],
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
 if (category.type) return normalizeType(category.type);
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

 const formBarcodeOrphan = useMemo(() => {
 const code = (form.barcode_code || "").trim();
 if (!code) return false;
 return !barcodeLabelOptions.some((b) => String(b.slug || "") === code);
 }, [form.barcode_code, barcodeLabelOptions]);

 const editBarcodeOrphan = useMemo(() => {
 if (!editing) return false;
 const code = (editing.barcode_code || "").trim();
 if (!code) return false;
 return !barcodeLabelOptions.some((b) => String(b.slug || "") === code);
 }, [editing, barcodeLabelOptions]);

 const selectedCategory = categories.find((c) => String(c.id) === String(form.category_id));
 const selectedEditCategory = categories.find((c) => String(c.id) === String(editing?.category_id));
 const sizeOptions = getSizePreset(normalizeType(productType));
 const editSizeOptions = getSizePreset(normalizeType(editProductType));

 const parseGallery = (value) => {
 if (Array.isArray(value)) {
 return value.map((v) => String(v).trim()).filter(Boolean);
 }
 if (typeof value === "string") {
 return value
 .split(/\r?\n+/)
 .map((v) => v.trim())
 .filter(Boolean);
 }
 return [];
 };

 const stringifyGallery = (value) => {
 if (Array.isArray(value)) return value.filter(Boolean).join("\n");
 return value || "";
 };

 const uploadGalleryFile = async (file) => {
 const fd = new FormData();
 fd.append("image", file);
 const { data } = await api.post("/admin/products/gallery-upload", fd, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 return data?.image_url;
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
 return e?.response?.data?.message || "Failed to load/save data.";
 };

 const load = async () => {
 setLoading(true);
 try {
 const { data: productsData } = await api.get("/admin/products");
 const { data: categoriesData } = await api.get("/categories");
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

 useEffect(() => {
 setSelectedIds((prev) => prev.filter((id) => rows.some((p) => p.id === id)));
 }, [rows]);

 useEffect(() => {
 if (!form.category_id) return;
 if (!selectedCategory) return;
 const inferred = inferTypeFromCategory(selectedCategory);
 if (!inferred) return;
 const nextType = inferred === "shoes" ? "Shoes" : inferred === "clothes" ? "Clothes" : inferred === "bag" ? "Bags" : inferred === "accessory" ? "Accessories" : "Other";
 setProductType(nextType);
 }, [form.category_id, selectedCategory]);

 useEffect(() => {
 if (!editing) return;
 if (!editing.category_id) return;
 if (!selectedEditCategory) return;
 const inferred = inferTypeFromCategory(selectedEditCategory);
 if (!inferred) return;
 const nextType = inferred === "shoes" ? "Shoes" : inferred === "clothes" ? "Clothes" : inferred === "bag" ? "Bags" : inferred === "accessory" ? "Accessories" : "Other";
 setEditProductType(nextType);
 }, [editing, selectedEditCategory]);

 const showSuccess = (msg) => {
 setSuccess(msg);
 setAnimate(true);
 setTimeout(() => {
 setAnimate(false);
 setTimeout(() => setSuccess(""), 300);
 }, 3000);
 };

 const handleImageUpload = async (e) => {
 const file = e.target.files[0];
 if (!file) return;

 setIsUploading(true);
 try {
 // For demo, we'll use a simple URL or base64
 // In production, you'd upload to a server/cloud storage
 const reader = new FileReader();
 reader.onloadend = () => {
 setForm((s) => ({ ...s, image_url: reader.result }));
 };
 reader.readAsDataURL(file);
 } catch (error) {
 setErr("Failed to upload image");
 } finally {
 setIsUploading(false);
 }
 };

 const handleEditImageUpload = async (e) => {
 const file = e.target.files[0];
 if (!file) return;

 setIsUploading(true);
 try {
 const reader = new FileReader();
 reader.onloadend = () => {
 setEditing((s) => ({ ...s, image_url: reader.result }));
 };
 reader.readAsDataURL(file);
 } catch (error) {
 setErr("Failed to upload image");
 } finally {
 setIsUploading(false);
 }
 };

 const handleGalleryUpload = async (e) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;

 setIsUploading(true);
 setGalleryError("");
 try {
 const urls = [];
 for (const file of Array.from(files)) {
 const url = await uploadGalleryFile(file);
 if (url) urls.push(url);
 }
 setForm((s) => {
 const current = parseGallery(s.gallery);
 const merged = [...current, ...urls].filter(Boolean);
 return { ...s, gallery: merged.join("\n") };
 });
 } catch (error) {
 setGalleryError(extractErr(error));
 setErr(extractErr(error));
 } finally {
 if (e.target) e.target.value = "";
 setIsUploading(false);
 }
 };

 const handleEditGalleryUpload = async (e) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;

 setIsUploading(true);
 setEditGalleryError("");
 try {
 const urls = [];
 for (const file of Array.from(files)) {
 const url = await uploadGalleryFile(file);
 if (url) urls.push(url);
 }
 setEditing((s) => {
 const current = parseGallery(s?.gallery);
 const merged = [...current, ...urls].filter(Boolean);
 return { ...s, gallery: merged.join("\n") };
 });
 } catch (error) {
 setEditGalleryError(extractErr(error));
 setErr(extractErr(error));
 } finally {
 if (e.target) e.target.value = "";
 setIsUploading(false);
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

 if (!form.sku) {
 const detail = "Please enter a SKU";
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

 setIsCreating(true);
 loadingAlert({
 khTitle: "កំពុងបង្កើតទំនិញ",
 enTitle: "Creating product",
 khText: "សូមរង់ចាំបន្តិច",
 enText: "Please wait",
 });
 try {
 const response = await api.post("/admin/products", {
 ...form,
 brand_id: form.brand_id || null,
 barcode_code: (form.barcode_code || "").trim() || null,
 price: parseFloat(form.price),
 stock: parseInt(form.stock || 0),
 colors: form.colors ? form.colors.split(',').map(c => c.trim()).filter(Boolean) : [],
 sizes: Array.isArray(form.sizes) ? form.sizes : (form.sizes ? form.sizes.split(',').map(s => s.trim()).filter(Boolean) : []),
 payment_methods: form.payment_methods ? form.payment_methods.split(',').map(p => p.trim()).filter(Boolean) : [],
 gallery: parseGallery(form.gallery),
 });
 if (![200, 201].includes(response?.status)) {
 throw new Error("Create failed.");
 }
 closeSwal();
 setForm({ name: "", sku: "", barcode_code: "", description: "", price: "", stock: "", category_id: "", brand_id: "", image_url: "", gender: "", is_active: true, model_info: "", colors: "", sizes: [], size_guide: "", delivery_info: "", support_phone: "", payment_methods: "", gallery: "" });
 setShowCreateForm(false);
 setCreateSection("basic");
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

 const startEdit = (p) =>
 setEditing({
 ...p,
 barcode_code: p.barcode_code ?? "",
 sizes: normalizeSizes(p.sizes),
 gallery: stringifyGallery(p.gallery),
 });

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

 try {
 await api.patch(`/admin/products/${editing.id}`, {
 ...editing,
 brand_id: editing.brand_id || null,
 barcode_code: (editing.barcode_code || "").trim() || null,
 price: parseFloat(editing.price),
 stock: parseInt(editing.stock || 0),
 colors: editing.colors && typeof editing.colors === 'string' ? editing.colors.split(',').map(c => c.trim()).filter(Boolean) : (editing.colors || []),
 sizes: Array.isArray(editing.sizes) ? editing.sizes : (editing.sizes && typeof editing.sizes === 'string' ? editing.sizes.split(',').map(s => s.trim()).filter(Boolean) : (editing.sizes || [])),
 payment_methods: editing.payment_methods && typeof editing.payment_methods === 'string' ? editing.payment_methods.split(',').map(p => p.trim()).filter(Boolean) : (editing.payment_methods || []),
 gallery: parseGallery(editing.gallery),
 });
 setEditing(null);
 showSuccess("Product updated successfully!");
 await load();
 } catch (e2) {
 setErr(extractErr(e2));
 }
 };

 const del = async (id) => {
 const confirmRes = await warningConfirm({
 enTitle: "Delete this product?",
 enText: "This action cannot be undone. The product will be removed from your catalog.",
 enConfirm: "Delete",
 intent: "destructive",
 });
 if (!confirmRes.isConfirmed) return;
 try {
 await api.delete(`/admin/products/${id}`);
 showSuccess("Product deleted successfully!");
 await load();
 } catch (e2) {
 setErr(extractErr(e2));
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

 const deleteSelected = async () => {
 if (selectedIds.length === 0) return;
 const confirmRes = await warningConfirm({
 enTitle: "Delete selected products?",
 enText: `Permanently remove ${selectedIds.length} selected product(s)? This cannot be undone.`,
 enConfirm: "Delete",
 intent: "destructive",
 });
 if (!confirmRes.isConfirmed) return;
 try {
 await Promise.all(selectedIds.map((id) => api.delete(`/admin/products/${id}`)));
 showSuccess("Selected products deleted successfully!");
 setSelectedIds([]);
 await load();
 } catch (e2) {
 setErr(extractErr(e2));
 }
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
 onClick={() => setShowCreateForm(true)}
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

 {/* Create Form Modal — portaled so it stacks above AdminLayout main (z-[1]) / topbar / mobile nav */}
 {showCreateForm &&
 createPortal(
 <div className="admin-theme fixed inset-0 z-[100] flex items-center justify-center p-4">
 <div
 className="absolute inset-0 bg-black/50 backdrop-blur-sm"
 onClick={() => !isCreating && setShowCreateForm(false)}
 />
 <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40">
 <div className="max-h-[90vh] overflow-y-auto overscroll-contain p-6 sm:p-8">
 <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
 <div>
 <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl flex items-center gap-2">
 <svg className="h-6 w-6 shrink-0 text-[color:var(--admin-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
 </svg>
 Add new product
 </h2>
 <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Required fields are marked with an asterisk (*).</p>
 </div>
 <button
 type="button"
 onClick={() => !isCreating && setShowCreateForm(false)}
 className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
 disabled={isCreating}
 aria-label="Close"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="mt-6 border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Product form sections">
 <div className="flex flex-wrap gap-1 -mb-px">
 {[
 { id: "basic", label: "Basic info" },
 { id: "gallery", label: "Gallery" },
 { id: "details", label: "Details & sizing" },
 ].map((tab) => {
 const selected = createSection === tab.id;
 return (
 <button
 key={tab.id}
 type="button"
 role="tab"
 aria-selected={selected}
 onClick={() => setCreateSection(tab.id)}
 className={`relative rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
 selected
 ? "text-[color:var(--admin-primary)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[color:var(--admin-primary)]"
 : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
 }`}
 >
 {tab.label}
 </button>
 );
 })}
 </div>
 </div>

 <form onSubmit={create} className="mt-8 space-y-8">
 {createSection === "basic" && (
 <div className="space-y-8">
 <fieldset className="min-w-0 space-y-6 border-0 p-0">
 <legend className="sr-only">Basic product information</legend>

 <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
 <div className="sm:col-span-2 lg:col-span-7">
 <label htmlFor="create-product-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 Product name <span className="text-red-500" aria-hidden>*</span>
 </label>
 <input
 id="create-product-name"
 value={form.name}
 onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
 required
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="e.g. Classic fit tee"
 />
 </div>
 <div className="sm:col-span-2 lg:col-span-5">
 <label htmlFor="create-product-sku" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 SKU <span className="text-red-500" aria-hidden>*</span>
 </label>
 <input
 id="create-product-sku"
 value={form.sku}
 onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))}
 required
 autoComplete="off"
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="e.g. SKU-001"
 />
 </div>
 </div>

 <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-6">
 <div>
 <label htmlFor="create-product-category" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 Category <span className="text-red-500" aria-hidden>*</span>
 </label>
 <select
 id="create-product-category"
 value={form.category_id}
 onChange={(e) => setForm((s) => ({ ...s, category_id: e.target.value }))}
 required
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">Select a category</option>
 {catalogCategories.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label htmlFor="create-product-brand" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 Brand
 </label>
 <select
 id="create-product-brand"
 value={form.brand_id}
 onChange={(e) => setForm((s) => ({ ...s, brand_id: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 >
 <option value="">No brand</option>
 {brands.map((b) => (
 <option key={b.id} value={b.id}>{b.name}</option>
 ))}
 </select>
 </div>
 </div>

 <div>
 <label htmlFor="create-product-barcode" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 Barcode label <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
 </label>
 <select
 id="create-product-barcode"
 value={(form.barcode_code || "").trim()}
 onChange={(e) => setForm((s) => ({ ...s, barcode_code: e.target.value }))}
 className="w-full min-h-[44px] max-w-2xl rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
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
 <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
 {barcodeLabelOptions.length === 0
 ? "Create labels under Admin → Barcode & QR."
 : "If this label tracks stock, paid orders reduce that stock as well."}
 </p>
 </div>

 <div className="grid max-w-md grid-cols-2 gap-5">
 <div>
 <label htmlFor="create-product-price" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 Price (USD) <span className="text-red-500" aria-hidden>*</span>
 </label>
 <div className="relative">
 <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
 <input
 id="create-product-price"
 type="number"
 step="0.01"
 min="0"
 inputMode="decimal"
 value={form.price}
 onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
 required
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0.00"
 />
 </div>
 </div>
 <div>
 <label htmlFor="create-product-stock" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
 Stock <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
 </label>
 <input
 id="create-product-stock"
 type="number"
 min="0"
 inputMode="numeric"
 value={form.stock}
 onChange={(e) => setForm((s) => ({ ...s, stock: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="0"
 />
 </div>
 </div>
 </fieldset>

 <div>
 <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Main image</p>
 <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
 <div className="relative mx-auto shrink-0 sm:mx-0">
 <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
 {form.image_url ? (
 <img src={resolveImageUrl(form.image_url)} alt="" className="h-full w-full object-cover" />
 ) : (
 <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 )}
 <input
 type="file"
 accept="image/*"
 onChange={handleImageUpload}
 className="absolute inset-0 cursor-pointer opacity-0"
 aria-label="Upload product image"
 />
 </div>
 <p className="mt-2 text-center text-xs text-slate-500 sm:text-left dark:text-slate-400">Click to upload</p>
 </div>
 <div className="min-w-0 flex-1 space-y-1.5">
 <label htmlFor="create-product-image-url" className="text-sm font-medium text-slate-700 dark:text-slate-200">
 Or paste image URL
 </label>
 <input
 id="create-product-image-url"
 type="url"
 value={form.image_url.startsWith('data:') ? '' : form.image_url}
 onChange={(e) => setForm((s) => ({ ...s, image_url: e.target.value }))}
 className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[rgba(var(--admin-primary-rgb),0.55)]"
 placeholder="https://…"
 disabled={form.image_url.startsWith('data:')}
 />
 <p className="text-xs text-slate-500 dark:text-slate-400">Use a direct link to an image file (JPG, PNG, or WebP).</p>
 {isUploading && (
 <div className="flex items-center gap-2 pt-1 text-sm text-slate-600 dark:text-slate-300">
 <AdminDashboardLoader size={20} />
 Uploading…
 </div>
 )}
 </div>
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
 </div>
 )}

 {createSection === "gallery" && (
 <div className="w-full">
 <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
 <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Gallery thumbnails</h3>
 <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">One image URL per line, or upload multiple files.</p>
 {/* Gallery Thumbnails */}
 <div className="md:col-span-12">
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Gallery Thumbnails (Vertical List)</label>
 <div className="grid md:grid-cols-12 gap-4">
 <div className="md:col-span-7">
 <textarea
 value={form.gallery}
 onChange={(e) => setForm((s) => ({ ...s, gallery: e.target.value }))}
 rows={4}
 className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300 placeholder-slate-400"
 placeholder="Paste image URLs (one per line)"
 />
 <div className="mt-2 flex items-center gap-3">
 <button
 type="button"
 onClick={() => galleryInputRef.current?.click()}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] border border-slate-200 text-sm text-slate-600 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Upload gallery images
 </button>
 <input
 ref={galleryInputRef}
 type="file"
 accept="image/*"
 multiple
 onChange={handleGalleryUpload}
 className="hidden"
 />
 <span className="text-xs text-slate-500">Uploads are stored on the server.</span>
 </div>
 {galleryError && (
 <div className="mt-2 text-xs text-[#dc2626] dark:text-[#f87171]">{galleryError}</div>
 )}
 </div>
 <div className="md:col-span-5">
 <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
 <p className="text-xs font-semibold text-slate-600 mb-2">Preview (Vertical)</p>
 <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-2 scrollbar-hide">
 {parseGallery(form.gallery).length === 0 ? (
 <p className="text-xs text-slate-400">No thumbnails yet</p>
 ) : (
 parseGallery(form.gallery).map((url, idx) => (
 <div key={`${url}-${idx}`} className="flex items-center gap-2">
 <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden">
 <img src={resolveImageUrl(url)} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
 </div>
 <p className="text-xs text-slate-500 truncate">{url}</p>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {createSection === "details" && (
 <div className="w-full">
 <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
 <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Details & sizing</h3>
 <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Shown on the product page where applicable.</p>
 <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
 {/* Product Type */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Product Type</label>
 <select
 value={productType}
 onChange={(e) => setProductType(e.target.value)}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 {PRODUCT_TYPES.map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 </div>
 {/* Model Info */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Model Info</label>
 <input
 value={form.model_info}
 onChange={(e) => setForm((s) => ({ ...s, model_info: e.target.value }))}
 list="model-info-options"
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Model is 161cm tall / 43kg, wearing size XS"
 />
 </div>

 {/* Colors */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Available Colors</label>
 <input
 value={form.colors}
 onChange={(e) => setForm((s) => ({ ...s, colors: e.target.value }))}
 list="colors-options"
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Black, White, Red (comma separated)"
 />
 </div>

 {/* Sizes */}
 <div className="md:col-span-2">
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Available Sizes</label>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
 {sizeOptions.length === 0 && (
 <span className="text-xs text-slate-400">No presets for this type. Add custom sizes.</span>
 )}
 {sizeOptions.map((size) => (
 <label
 key={size}
 className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${form.sizes.includes(size)
 ? "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
 : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
 }`}
 >
 <input
 type="checkbox"
 checked={form.sizes.includes(size)}
 onChange={() =>
 setForm((s) => ({
 ...s,
 sizes: s.sizes.includes(size)
 ? s.sizes.filter((v) => v !== size)
 : [...s.sizes, size],
 }))
 }
 className="h-4 w-4"
 />
 {size}
 </label>
 ))}
 </div>
 {Array.isArray(form.sizes) && form.sizes.length > 0 && (
 <div className="mt-3 flex flex-wrap gap-2">
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
 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[5px] text-xs font-semibold border"
 style={{ backgroundColor: accentIsWhite ? '#0b0b0f' : accentColor, color: '#FFFFFF', borderColor: 'transparent' }}
 title="Remove"
 >
 {size}
 <span>×</span>
 </button>
 ))}
 </div>
 )}
 <div className="mt-3 flex items-center gap-2">
 <input
 value={customSize}
 onChange={(e) => setCustomSize(e.target.value)}
 placeholder="Add custom size (e.g., XXXL)"
 className="h-10 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400"
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
 className={`px-3 py-2 rounded-[5px] text-sm font-semibold ${accentIsWhite ? "border border-slate-300" : ""}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 Add
 </button>
 </div>
 </div>

 {/* Size Guide */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Size Guide</label>
 <input
 value={form.size_guide}
 onChange={(e) => setForm((s) => ({ ...s, size_guide: e.target.value }))}
 list="size-guide-options"
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Size guide text or URL"
 />
 </div>

 {/* Delivery Info */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Delivery Info</label>
 <input
 value={form.delivery_info}
 onChange={(e) => setForm((s) => ({ ...s, delivery_info: e.target.value }))}
 list="delivery-options"
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="From 1 - 3 days"
 />
 </div>

 {/* Support Phone */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Support Hotline</label>
 <input
 value={form.support_phone}
 onChange={(e) => setForm((s) => ({ ...s, support_phone: e.target.value }))}
 list="support-phone-options"
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="+855 12 345 678"
 />
 </div>

 {/* Payment Methods */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Payment Methods</label>
 <input
 value={form.payment_methods}
 onChange={(e) => setForm((s) => ({ ...s, payment_methods: e.target.value }))}
 list="payment-options"
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Cash, ABA, Wing, Credit Card (comma separated)"
 />
 </div>
 <datalist id="model-info-options">
 <option value="Model is 161cm tall / 43kg, wearing size XS" />
 <option value="Model is 170cm tall / 55kg, wearing size S" />
 <option value="Model is 175cm tall / 62kg, wearing size M" />
 </datalist>
 <datalist id="colors-options">
 <option value="Black, White, Red" />
 <option value="Black, White, Gray" />
 <option value="Blue, Navy, Sky" />
 <option value="Green, Olive, Khaki" />
 </datalist>
 <datalist id="size-guide-options">
 <option value="See size guide in description" />
 <option value="https://example.com/size-guide" />
 </datalist>
 <datalist id="delivery-options">
 <option value="From 1 - 3 days" />
 <option value="From 3 - 5 days" />
 <option value="Same day (Phnom Penh)" />
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
 </div>
 )}

 <footer className="mt-2 border-t border-slate-200 pt-6 dark:border-slate-800">
 {createError ? (
 <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
 {createError}
 </div>
 ) : null}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <button
 type="button"
 onClick={() => !isCreating && setShowCreateForm(false)}
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
 </div>
 </div>
 </div>,
 document.body
 )}

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
 placeholder="Search products..."
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
 <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">SKU</th>
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
 <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">{p.sku}</td>
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
 <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.sku} • ${p.price}</p>
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
 <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">{p.sku}</p>

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

 {/* Edit Modal — portaled so overlays are clickable above admin chrome */}
 {editing &&
 createPortal(
 <div className="admin-theme fixed inset-0 z-[100] flex items-center justify-center p-4">
 <div
 className="absolute inset-0 bg-black/50 backdrop-blur-sm"
 onClick={() => setEditing(null)}
 />
 <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl p-6 animate-modal-in max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
 <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 Edit Product
 </h3>
 <button
 onClick={() => setEditing(null)}
 className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[5px] transition-colors"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="grid md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Product Name *</label>
 <input
 value={editing.name}
 onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">SKU *</label>
 <input
 value={editing.sku}
 onChange={(e) => setEditing((s) => ({ ...s, sku: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 />
 </div>

 <div className="md:col-span-2">
 <label className="block text-sm font-semibold text-slate-600 mb-2">Barcode label</label>
 <select
 value={(editing.barcode_code || "").trim()}
 onChange={(e) => setEditing((s) => ({ ...s, barcode_code: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 <option value="">None (not linked)</option>
 {editBarcodeOrphan && (
 <option value={(editing.barcode_code || "").trim()}>
 {(editing.barcode_code || "").trim()} (missing from list)
 </option>
 )}
 {barcodeLabelOptions.map((c) => (
 <option key={c.id} value={c.slug || ""}>
 {c.name || c.slug}
 {c.slug ? ` · ${c.slug}` : ""}
 </option>
 ))}
 </select>
 <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
 {barcodeLabelOptions.length === 0
 ? "Create labels under Admin → Barcode & QR."
 : "When paid, stock is also reduced on that label if it tracks stock."}
 </p>
 </div>

 <div className="md:col-span-2">
 <label className="block text-sm font-semibold text-slate-600 mb-2">Description</label>
 <textarea
 value={editing.description || ''}
 onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))}
 rows={3}
 className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Price ($)</label>
 <input
 type="number"
 step="0.01"
 value={editing.price}
 onChange={(e) => setEditing((s) => ({ ...s, price: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Stock</label>
 <input
 type="number"
 value={editing.stock}
 onChange={(e) => setEditing((s) => ({ ...s, stock: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Category *</label>
 <select
 value={editing.category_id || ""}
 onChange={(e) => setEditing((s) => ({ ...s, category_id: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 <option value="">Select category</option>
 {catalogCategories.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Brand</label>
 <select
 value={editing.brand_id || ""}
 onChange={(e) => setEditing((s) => ({ ...s, brand_id: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 <option value="">Select brand</option>
 {brands.map((b) => (
 <option key={b.id} value={b.id}>{b.name}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Product Image</label>
 <div className="flex gap-3 items-center">
 <div className="relative w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
 {editing.image_url ? (
 <img src={resolveImageUrl(editing.image_url)} alt="Preview" className="w-full h-full object-cover" />
 ) : (
 <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 )}
 <input
 type="file"
 accept="image/*"
 onChange={handleEditImageUpload}
 className="absolute inset-0 opacity-0 cursor-pointer"
 />
 </div>
 <input
 type="url"
 value={editing.image_url?.startsWith('data:') ? '' : (editing.image_url || '')}
 onChange={(e) => setEditing((s) => ({ ...s, image_url: e.target.value }))}
 className="flex-1 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Or paste image URL..."
 disabled={editing.image_url?.startsWith('data:')}
 />
 </div>
 </div>

 <div className="md:col-span-2">
 <label className="block text-sm font-semibold text-slate-600 mb-2">Gallery Thumbnails (Vertical List)</label>
 <div className="grid md:grid-cols-12 gap-4">
 <div className="md:col-span-7">
 <textarea
 value={editing.gallery || ''}
 onChange={(e) => setEditing((s) => ({ ...s, gallery: e.target.value }))}
 rows={4}
 className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Paste image URLs (one per line)"
 />
 <div className="mt-2 flex items-center gap-3">
 <button
 type="button"
 onClick={() => editGalleryInputRef.current?.click()}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] border border-slate-200 text-sm text-slate-600 bg-slate-50 cursor-pointer hover:bg-white transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 Upload gallery images
 </button>
 <input
 ref={editGalleryInputRef}
 type="file"
 accept="image/*"
 multiple
 onChange={handleEditGalleryUpload}
 className="hidden"
 />
 <span className="text-xs text-slate-500">Uploads are stored on the server.</span>
 </div>
 {editGalleryError && (
 <div className="mt-2 text-xs text-[#dc2626] dark:text-[#f87171]">{editGalleryError}</div>
 )}
 </div>
 <div className="md:col-span-5">
 <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
 <p className="text-xs font-semibold text-slate-600 mb-2">Preview (Vertical)</p>
 <div className="max-h-40 overflow-y-auto overflow-x-hidden space-y-2 scrollbar-hide">
 {parseGallery(editing.gallery).length === 0 ? (
 <p className="text-xs text-slate-400">No thumbnails yet</p>
 ) : (
 parseGallery(editing.gallery).map((url, idx) => (
 <div key={`${url}-${idx}`} className="flex items-center gap-2">
 <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden">
 <img src={resolveImageUrl(url)} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
 </div>
 <p className="text-xs text-slate-500 truncate">{url}</p>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 </div>

 <div className="flex items-center">
 <button
 type="button"
 onClick={() => setEditing((s) => ({ ...s, is_active: !s.is_active }))}
 className="relative inline-flex h-9 w-16 items-center rounded-[5px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-slate-300 dark:focus:ring-slate-600 dark:focus:ring-offset-slate-900"
 style={{ backgroundColor: editing.is_active ? accentColor : (mode === 'dark' ? '#21262d' : '#e2e8f0') }}
 >
 <span
 className="inline-block h-7 w-7 rounded-full bg-white transform transition-transform duration-300"
 style={{ transform: editing.is_active ? 'translateX(28px)' : 'translateX(4px)' }}
 />
 <span className="sr-only">Toggle active status</span>
 </button>
 <span className="ml-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Active Status</span>
 </div>

 <div className="md:col-span-2 flex gap-3 mt-4">
 <button
 onClick={() => setEditing(null)}
 className="flex-1 h-12 rounded-[5px] border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm hover:border-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300"
 >
 Cancel
 </button>
 <button
 onClick={saveEdit}
 className={`flex-1 h-12 rounded-[5px] font-semibold transition-all duration-300 ${accentIsWhite ? "border border-slate-300" : ""}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 Save Changes
 </button>
 </div>
 </div>

 {/* Product Detail Settings Section */}
 <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
 <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
 <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 Product Detail Settings
 </h4>
 <div className="grid md:grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Product Type</label>
 <select
 value={editProductType}
 onChange={(e) => setEditProductType(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 {PRODUCT_TYPES.map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 </div>
 {/* Model Info */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Model Info</label>
 <input
 value={editing.model_info || ''}
 onChange={(e) => setEditing((s) => ({ ...s, model_info: e.target.value }))}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Model is 161cm tall / 43kg, wearing size XS"
 />
 </div>

 {/* Colors */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Available Colors</label>
 <input
 value={typeof editing.colors === 'string' ? editing.colors : (editing.colors?.join(', ') || '')}
 onChange={(e) => setEditing((s) => ({ ...s, colors: e.target.value }))}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Black, White, Red"
 />
 </div>

 {/* Sizes */}
 <div className="md:col-span-2">
 <label className="block text-xs font-semibold text-slate-600 mb-2">Available Sizes</label>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
 {editSizeOptions.length === 0 && (
 <span className="text-xs text-slate-400">No presets for this type. Add custom sizes.</span>
 )}
 {editSizeOptions.map((size) => (
 <label
 key={size}
 className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${(editing.sizes || []).includes(size)
 ? "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
 : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
 }`}
 >
 <input
 type="checkbox"
 checked={(editing.sizes || []).includes(size)}
 onChange={() =>
 setEditing((s) => ({
 ...s,
 sizes: (s.sizes || []).includes(size)
 ? s.sizes.filter((v) => v !== size)
 : [...(s.sizes || []), size],
 }))
 }
 className="h-4 w-4"
 />
 {size}
 </label>
 ))}
 </div>
 {Array.isArray(editing.sizes) && editing.sizes.length > 0 && (
 <div className="mt-3 flex flex-wrap gap-2">
 {editing.sizes.map((size) => (
 <button
 key={size}
 type="button"
 onClick={() =>
 setEditing((s) => ({
 ...s,
 sizes: s.sizes.filter((v) => v !== size),
 }))
 }
 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[5px] text-xs font-semibold border"
 style={{ backgroundColor: accentIsWhite ? '#0b0b0f' : accentColor, color: '#FFFFFF', borderColor: 'transparent' }}
 title="Remove"
 >
 {size}
 <span>×</span>
 </button>
 ))}
 </div>
 )}
 <div className="mt-3 flex items-center gap-2">
 <input
 value={editCustomSize}
 onChange={(e) => setEditCustomSize(e.target.value)}
 placeholder="Add custom size (e.g., XXXL)"
 className="h-10 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400"
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
 className={`px-3 py-2 rounded-[5px] text-sm font-semibold ${accentIsWhite ? "border border-slate-300" : ""}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 Add
 </button>
 </div>
 </div>

 {/* Size Guide */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Size Guide</label>
 <input
 value={editing.size_guide || ''}
 onChange={(e) => setEditing((s) => ({ ...s, size_guide: e.target.value }))}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Size guide text or URL"
 />
 </div>

 {/* Delivery Info */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Delivery Info</label>
 <input
 value={editing.delivery_info || ''}
 onChange={(e) => setEditing((s) => ({ ...s, delivery_info: e.target.value }))}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="From 1 - 3 days"
 />
 </div>

 {/* Support Phone */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Support Hotline</label>
 <input
 value={editing.support_phone || ''}
 onChange={(e) => setEditing((s) => ({ ...s, support_phone: e.target.value }))}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="+855 12 345 678"
 />
 </div>

 {/* Payment Methods */}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-2">Payment Methods</label>
 <input
 value={typeof editing.payment_methods === 'string' ? editing.payment_methods : (editing.payment_methods?.join(', ') || '')}
 onChange={(e) => setEditing((s) => ({ ...s, payment_methods: e.target.value }))}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 placeholder="Cash, ABA, Wing, Credit Card"
 />
 </div>

 </div>
 </div>
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

