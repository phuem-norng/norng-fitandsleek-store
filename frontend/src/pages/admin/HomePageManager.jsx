// ✅ FILE: frontend/src/pages/admin/HomePageManager.jsx
// Fixes:
// 1) Correctly reads Laravel responses: { data: [...] }
// 2) Uses FormData + real file upload (NOT base64) for banners/collections
// 3) Separate editing states for banners vs collections
// 4) Robust error messages (401/422/500)
// 5) Handles 401 by triggering auth refresh
// 6) Keeps your UI exactly (only logic fixed)

import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useAuth } from "../../state/auth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { useTheme } from "../../state/theme.jsx";
import { AdminSectionLoader, AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { useAdminUiPreference } from "../../lib/adminUiPreferences";

const BANNER_AUDIENCE_OPTIONS = [
 { value: "all", label: "All users" },
 { value: "guest", label: "Guests" },
 { value: "bronze", label: "Bronze" },
 { value: "silver", label: "Silver" },
 { value: "gold", label: "Gold" },
 { value: "vip", label: "VIP" },
];
const BANNER_PRIORITY_SEGMENTS = ["guest", "bronze", "silver", "gold", "vip"];
const BANNER_PRIORITY_PRESETS = {
 VIP_FIRST: { guest: 50, bronze: 40, silver: 30, gold: 20, vip: 10 },
 GUEST_ACQUISITION: { guest: 10, bronze: 20, silver: 30, gold: 40, vip: 50 },
 BALANCED: { guest: 100, bronze: 100, silver: 100, gold: 100, vip: 100 },
};
const DEFAULT_PRIORITY_PRESET_KEY = "BALANCED";

const normalizeAudienceTargets = (targets) => {
 if (!Array.isArray(targets) || targets.length === 0) return ["all"];
 const normalized = targets
 .map((value) => String(value || "").trim().toLowerCase())
 .filter((value) => BANNER_AUDIENCE_OPTIONS.some((option) => option.value === value));
 if (normalized.length === 0) return ["all"];
 if (normalized.includes("all")) return ["all"];
 return Array.from(new Set(normalized));
};

const normalizeAudiencePriorityMap = (priorityMap) => {
 const map = priorityMap && typeof priorityMap === "object" ? priorityMap : {};
 const normalized = {};
 BANNER_PRIORITY_SEGMENTS.forEach((segment) => {
 const raw = Number(map[segment]);
 normalized[segment] = Number.isFinite(raw) ? Math.min(9999, Math.max(0, Math.round(raw))) : 100;
 });
 return normalized;
};

const resolvePriorityMapByPreset = (presetKey) => {
 const key = String(presetKey || DEFAULT_PRIORITY_PRESET_KEY).toUpperCase();
 return normalizeAudiencePriorityMap(
 BANNER_PRIORITY_PRESETS[key] || BANNER_PRIORITY_PRESETS[DEFAULT_PRIORITY_PRESET_KEY]
 );
};

const buildWinningOrderPreview = (priorityMap) => {
 const normalized = normalizeAudiencePriorityMap(priorityMap);
 return [...BANNER_PRIORITY_SEGMENTS]
 .sort((a, b) => {
 if (normalized[a] === normalized[b]) {
 return BANNER_PRIORITY_SEGMENTS.indexOf(a) - BANNER_PRIORITY_SEGMENTS.indexOf(b);
 }
 return normalized[a] - normalized[b];
 })
 .map((segment) => ({ segment, value: normalized[segment] }));
};

const pickList = (res) => {
 // supports: {data:[...]} OR {data:{data:[...]}} OR [...]
 const d = res?.data;
 if (Array.isArray(d)) return d;
 if (Array.isArray(d?.data)) return d.data;
 if (Array.isArray(d?.items)) return d.items;
 if (Array.isArray(d?.results)) return d.results;
 return [];
};

const extractErr = (e, refreshAuth) => {
 const status = e?.response?.status;
 if (status === 401) {
 // Try to refresh auth before showing error
 refreshAuth?.();
 return "Unauthorized (401). Please login again.";
 }
 if (status === 403) return "Forbidden (403). Admin permission required.";
 if (status === 404) return "Not found (404). API route missing.";
 if (status === 413) return "File too large (413). Please upload a smaller video/GIF.";
 if (status === 422) {
 const msg = e?.response?.data?.message || "Validation failed (422).";
 const errs = e?.response?.data?.errors;
 if (errs && typeof errs === "object") {
 const flat = Object.entries(errs)
 .map(([k, v]) => `${k}: ${(Array.isArray(v) ? v.join(", ") : v)}`)
 .join(" | ");
 return `${msg} ${flat}`;
 }
 return msg;
 }
 return e?.response?.data?.message || e?.message || "Failed to load/save data.";
};

export default function HomePageManager() {
 const { refresh: refreshAuth } = useAuth();
 const { user: sessionUser, can, permissionsReady } = useAdminPermissions();
 const canViewHomepage = can("homepage", "view");
 const canCreateHomepage = can("homepage", "create");
 const canEditHomepage = can("homepage", "edit");
 const canDeleteHomepage = can("homepage", "delete");
 const homepageCanMutate = canCreateHomepage || canEditHomepage || canDeleteHomepage;
 const { primaryColor, mode } = useTheme();
 const [defaultPriorityPreset, setDefaultPriorityPreset] = useAdminUiPreference(
 "banners.defaultPriorityPreset",
 DEFAULT_PRIORITY_PRESET_KEY
 );
 const accentColor = primaryColor;
 const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
 const accentText = accentIsWhite ? "#0b0b0f" : "#FFFFFF";
 const [activeTab, setActiveTab] = useState("banners");
 const [banners, setBanners] = useState([]);
 const [collections, setCollections] = useState([]);
 const [categories, setCategories] = useState([]);
 const [loading, setLoading] = useState(true);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [showBannerForm, setShowBannerForm] = useState(false);
 const [showCollectionForm, setShowCollectionForm] = useState(false);
 const [pendingDelete, setPendingDelete] = useState(null);
 const [deleteBusy, setDeleteBusy] = useState(false);
 const [bannerViewMode, setBannerViewMode] = useState("list");
 const [collectionViewMode, setCollectionViewMode] = useState("list");

 // ----- Banner form -----
 const [bannerEditingId, setBannerEditingId] = useState(null);
 const [bannerFile, setBannerFile] = useState(null);
 const [bannerPreview, setBannerPreview] = useState(""); // preview URL (either from server or local blob)

 const defaultBannerForm = {
 title: "",
 subtitle: "",
 link_url: "",
 position: "hero",
 is_active: true,
 order: 0,
 media_url: "",
 show_badge: true,
 show_title: true,
 show_subtitle: true,
 show_cta: true,
 audience_targets: ["all"],
 audience_priority_map: resolvePriorityMapByPreset(defaultPriorityPreset),
 };

 const [bannerForm, setBannerForm] = useState(defaultBannerForm);

 // ----- Collection form -----
 const [collectionEditingId, setCollectionEditingId] = useState(null);
 const [collectionFile, setCollectionFile] = useState(null);
 const [collectionPreview, setCollectionPreview] = useState("");

 const [collectionForm, setCollectionForm] = useState({
 name: "",
 gender: "women",
 link: "",
 text_position: "overlay",
 is_active: true,
 sort_order: 0,
 });

 const triggerAuthRefresh = async () => {
 try {
 await refreshAuth();
 } catch (e) {
 console.warn('Auth refresh failed');
 }
 };

 const resetBannerForm = () => {
 setShowBannerForm(false);
 setBannerEditingId(null);
 setBannerFile(null);
 setBannerPreview("");
 setBannerForm({
 ...defaultBannerForm,
 order: banners.length,
 });
 };

 const resetCollectionForm = () => {
 setShowCollectionForm(false);
 setCollectionEditingId(null);
 setCollectionFile(null);
 setCollectionPreview("");
 setCollectionForm({
 name: "",
 gender: "women",
 link: "",
 text_position: "overlay",
 is_active: true,
 sort_order: collections.length,
 });
 };

 const showSuccess = (msg) => {
 setSuccess(msg);
 setTimeout(() => setSuccess(""), 3000);
 };

 const load = async () => {
 if (!canViewHomepage) {
 setBanners([]);
 setCollections([]);
 setCategories([]);
 setLoading(false);
 return;
 }
 setLoading(true);
 setErr("");
 try {
 const [bannersRes, collectionsRes, categoriesRes] = await Promise.all([
 api.get("/admin/banners"),
 api.get("/admin/collections"),
 api.get("/categories"),
 ]);

 setBanners(pickList(bannersRes));
 setCollections(pickList(collectionsRes));
 setCategories(pickList(categoriesRes));
 } catch (e) {
 setErr(extractErr(e, triggerAuthRefresh));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (!permissionsReady) return;
 if (!canViewHomepage) {
 setLoading(false);
 return;
 }
 load();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [permissionsReady, canViewHomepage]);

 // -------- FILE PREVIEW HELPERS --------
 const makeLocalPreview = (file) => (file ? URL.createObjectURL(file) : "");

 const onPickBannerFile = (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setBannerFile(file);
 setBannerPreview(makeLocalPreview(file));
 };

 const onPickCollectionFile = (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setCollectionFile(file);
 setCollectionPreview(makeLocalPreview(file));
 };

 // -------- SAVE BANNER (multipart) --------
 const saveBanner = async (e) => {
 e.preventDefault();
 if (bannerEditingId ? !canEditHomepage : !canCreateHomepage) return;
 setErr("");

 try {
 const fd = new FormData();
 fd.append("title", bannerForm.title || "");
 fd.append("subtitle", bannerForm.subtitle || "");
 fd.append("link_url", bannerForm.link_url || "");
 fd.append("position", bannerForm.position || "hero");
 fd.append("is_active", bannerForm.is_active ? "1" : "0");
 fd.append("order", String(bannerForm.order ?? 0));
 fd.append("show_badge", bannerForm.show_badge ? "1" : "0");
 fd.append("show_title", bannerForm.show_title ? "1" : "0");
 fd.append("show_subtitle", bannerForm.show_subtitle ? "1" : "0");
 fd.append("show_cta", bannerForm.show_cta ? "1" : "0");
 normalizeAudienceTargets(bannerForm.audience_targets).forEach((target) => {
 fd.append("audience_targets[]", target);
 });
 const priorityMap = normalizeAudiencePriorityMap(bannerForm.audience_priority_map);
 BANNER_PRIORITY_SEGMENTS.forEach((segment) => {
 fd.append(`audience_priority_map[${segment}]`, String(priorityMap[segment]));
 });
 if (bannerForm.media_url) fd.append("media_url", bannerForm.media_url);

 // backend usually expects: image (file). If your backend uses "image", keep "image".
 if (bannerFile) fd.append("image", bannerFile);

 if (bannerEditingId) {
 // Laravel PUT with multipart: use POST + _method=PUT
 fd.append("_method", "PUT");
 await api.post(`/admin/banners/${bannerEditingId}`, fd, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 showSuccess("Banner updated!");
 } else {
 await api.post("/admin/banners", fd, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 showSuccess("Banner created!");
 }

 resetBannerForm();
 await load();
 } catch (e2) {
 setErr(extractErr(e2, triggerAuthRefresh));
 }
 };

 // -------- SAVE COLLECTION (multipart) --------
 const saveCollection = async (e) => {
 e.preventDefault();
 if (collectionEditingId ? !canEditHomepage : !canCreateHomepage) return;
 setErr("");

 try {
 const fd = new FormData();
 fd.append("name", collectionForm.name || "");
 fd.append("gender", collectionForm.gender || "women");
 fd.append("text_position", collectionForm.text_position || "overlay");
 fd.append("link", collectionForm.link || "");
 fd.append("is_active", collectionForm.is_active ? "1" : "0");
 fd.append("sort_order", String(collectionForm.sort_order ?? 0));

 // backend usually expects: image (file)
 if (collectionFile) fd.append("image", collectionFile);

 if (collectionEditingId) {
 fd.append("_method", "PUT");
 await api.post(`/admin/collections/${collectionEditingId}`, fd, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 showSuccess("Collection updated!");
 } else {
 await api.post("/admin/collections", fd, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 showSuccess("Collection created!");
 }

 resetCollectionForm();
 await load();
 } catch (e2) {
 setErr(extractErr(e2, triggerAuthRefresh));
 }
 };

 // -------- DELETE --------
 const deleteBanner = (id) => {
 if (!canDeleteHomepage) return;
 setPendingDelete({ type: "banner", id });
 };

 const deleteCollection = (id) => {
 if (!canDeleteHomepage) return;
 setPendingDelete({ type: "collection", id });
 };

 const confirmDelete = async () => {
 if (!pendingDelete || !canDeleteHomepage) return;
 setDeleteBusy(true);
 setErr("");
 try {
 if (pendingDelete.type === "banner") {
 await api.delete(`/admin/banners/${pendingDelete.id}`);
 showSuccess("Banner deleted");
 } else {
 await api.delete(`/admin/collections/${pendingDelete.id}`);
 showSuccess("Collection deleted");
 }
 await load();
 } catch (e) {
 setErr(extractErr(e, triggerAuthRefresh));
 } finally {
 setDeleteBusy(false);
 setPendingDelete(null);
 }
 };

 // -------- EDIT --------
 const editBanner = (b) => {
 if (!canEditHomepage) return;
 setActiveTab("banners");
 setShowBannerForm(true);
 setBannerEditingId(b.id);
 setBannerFile(null);
 setBannerPreview(resolveImageUrl(b.image_url || b.image || b.image_path || ""));
 // Ensure position is always set to a valid value from dropdown
 const validPositions = ["hero", "mid", "sidebar", "popup", "promo"];
 const bannerPosition = b.position && validPositions.includes(b.position) ? b.position : "hero";
 setBannerForm({
 title: b.title || "",
 subtitle: b.subtitle || "",
 link_url: b.link_url || b.link || "",
 position: bannerPosition,
 is_active: !!b.is_active,
 order: b.order ?? 0,
 media_url: b.image_url || "",
 show_badge: b.show_badge !== false,
 show_title: b.show_title !== false,
 show_subtitle: b.show_subtitle !== false,
 show_cta: b.show_cta !== false,
 audience_targets: normalizeAudienceTargets(b.audience_targets),
 audience_priority_map: normalizeAudiencePriorityMap(b.audience_priority_map),
 });
 };

 const editCollection = (c) => {
 if (!canEditHomepage) return;
 setActiveTab("collections");
 setShowCollectionForm(true);
 setCollectionEditingId(c.id);
 setCollectionFile(null);
 setCollectionPreview(resolveImageUrl(c.image_url || c.image || c.image_path || ""));
 setCollectionForm({
 name: c.name || "",
 gender: c.gender || "women",
 link: c.link || "",
 text_position: c.text_position || "overlay",
 is_active: !!c.is_active,
 sort_order: c.sort_order ?? 0,
 });
 };

 if (!permissionsReady || (loading && canViewHomepage)) {
 return <AdminContentSkeleton title="Home Page Manager" />;
 }

 if (!canViewHomepage) {
 return <Navigate to={getFirstAccessibleAdminPath(sessionUser)} replace />;
 }

 if (loading) return <AdminContentSkeleton title="Home Page Manager" />;

 // -------- UI --------
 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <AdminConfirmDialog
 open={!!pendingDelete}
 onClose={() => {
 if (deleteBusy) return;
 setPendingDelete(null);
 }}
 onConfirm={confirmDelete}
 title={pendingDelete?.type === "collection" ? "Delete this collection?" : "Delete this banner?"}
 message="This action cannot be undone."
 confirmLabel="Delete"
 cancelLabel="Cancel"
 destructive
 busy={deleteBusy}
 />
 {success && (
 <div className="fixed top-6 right-6 z-50 rounded-xl border border-[rgba(var(--admin-primary-rgb),0.35)] dark:border-[rgba(var(--admin-primary-rgb),0.45)] bg-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.88)] px-5 py-3 text-white flex items-center gap-3 shadow-lg">
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 <span className="font-medium">{success}</span>
 </div>
 )}

 <div className="w-full min-w-0">
 <div className="mb-8">
 <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-2">
 Home Page Manager
 </h1>
 <p className="text-slate-500 dark:text-slate-400">Manage banners and collection tiles for your homepage</p>
 </div>

 {err && (
 <div className="mb-6 rounded-xl border border-red-200 dark:border-red-700/60 bg-red-50 dark:bg-red-900/40 p-4 flex items-center gap-3">
 <svg className="w-6 h-6 text-red-500 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-red-700 dark:text-red-200 font-medium">{err}</span>
 <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
 </div>
 )}

 <div className="mb-6 flex items-center justify-between gap-3">
 <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
 {["banners", "collections"].map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab
 ? "bg-[color:var(--admin-primary)] text-white"
 : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70"
 }`}
 >
 {tab.charAt(0).toUpperCase() + tab.slice(1)}
 </button>
 ))}
 </div>

 {activeTab === "banners" ? (
 canCreateHomepage ? (
 <button
 onClick={() => {
 setBannerEditingId(null);
 setShowBannerForm(true);
 setBannerFile(null);
 setBannerPreview("");
 setBannerForm({
 ...defaultBannerForm,
 order: banners.length,
 });
 }}
 className="h-11 px-4 rounded-xl bg-[color:var(--admin-primary)] text-white text-sm font-semibold hover:brightness-110"
 >
 New Banner
 </button>
 ) : null
 ) : (
 canCreateHomepage ? (
 <button
 onClick={() => {
 setCollectionEditingId(null);
 setShowCollectionForm(true);
 setCollectionFile(null);
 setCollectionPreview("");
 setCollectionForm({
 name: "",
 gender: "women",
 link: "",
 text_position: "overlay",
 is_active: true,
 sort_order: collections.length,
 });
 }}
 className="h-11 px-4 rounded-xl bg-[color:var(--admin-primary)] text-white text-sm font-semibold hover:brightness-110"
 >
 New Collection
 </button>
 ) : null
 )}
 </div>

 {/* ---------------- BANNERS ---------------- */}
 {activeTab === "banners" && (
 <div className="grid lg:grid-cols-3 gap-6">
 {(showBannerForm || bannerEditingId) && (bannerEditingId ? canEditHomepage : canCreateHomepage) && (
 <div className="lg:col-span-3">
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <h2 className="text-lg font-semibold text-slate-900 mb-4">
 {bannerEditingId ? "Edit Banner" : "New Banner"}
 </h2>

 <form onSubmit={saveBanner} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Title</label>
 <input
 value={bannerForm.title}
 onChange={(e) => setBannerForm((s) => ({ ...s, title: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 placeholder="Banner title"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Subtitle</label>
 <input
 value={bannerForm.subtitle}
 onChange={(e) => setBannerForm((s) => ({ ...s, subtitle: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 placeholder="Banner subtitle"
 />
 </div>

 <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
 <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Show on homepage banner</p>
 <p className="text-xs text-slate-500 dark:text-slate-400">Control which text appears over the hero image on the storefront.</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {[
 { key: "show_badge", label: "Top badge (title)" },
 { key: "show_title", label: "Main heading" },
 { key: "show_subtitle", label: "Subtitle" },
 { key: "show_cta", label: "Shop button" },
 ].map(({ key, label }) => (
 <label key={key} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={!!bannerForm[key]}
 onChange={(e) => setBannerForm((s) => ({ ...s, [key]: e.target.checked }))}
 className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />
 <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
 </label>
 ))}
 </div>
 <button
 type="button"
 onClick={() =>
 setBannerForm((s) => ({
 ...s,
 show_badge: false,
 show_title: false,
 show_subtitle: false,
 show_cta: false,
 }))
 }
 className="text-xs font-semibold text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white"
 >
 Hide all text
 </button>
 <button
 type="button"
 onClick={() =>
 setBannerForm((s) => ({
 ...s,
 show_badge: true,
 show_title: true,
 show_subtitle: true,
 show_cta: true,
 }))
 }
 className="ml-3 text-xs font-semibold text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white"
 >
 Show all text
 </button>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Link URL</label>
 <input
 value={bannerForm.link_url}
 onChange={(e) => setBannerForm((s) => ({ ...s, link_url: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 placeholder="/products"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Position</label>
 <select
 value={bannerForm.position}
 onChange={(e) => setBannerForm((s) => ({ ...s, position: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 >
 <option value="hero">Hero (Main Banner)</option>
 <option value="mid">Mid Page</option>
 <option value="sidebar">Sidebar</option>
 <option value="popup">Popup</option>
 <option value="promo">Promo Slider</option>
 <option value="discounts">Discounts page banner</option>
 </select>
 </div>

<div>
<label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Audience targeting</label>
<div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 p-3 space-y-2">
{BANNER_AUDIENCE_OPTIONS.map((option) => {
 const currentTargets = normalizeAudienceTargets(bannerForm.audience_targets);
 const checked = currentTargets.includes(option.value);
 const disableSpecific = option.value !== "all" && currentTargets.includes("all");
 return (
 <label key={option.value} className={`flex items-center gap-2 text-sm ${disableSpecific ? "opacity-60" : ""}`}>
 <input
 type="checkbox"
 checked={checked}
 disabled={disableSpecific}
 onChange={(e) => {
 setBannerForm((s) => {
 const current = normalizeAudienceTargets(s.audience_targets);
 if (option.value === "all") {
 return { ...s, audience_targets: e.target.checked ? ["all"] : ["guest"] };
 }
 const withoutAll = current.filter((value) => value !== "all");
 const next = e.target.checked
 ? [...withoutAll, option.value]
 : withoutAll.filter((value) => value !== option.value);
 return { ...s, audience_targets: next.length > 0 ? Array.from(new Set(next)) : ["all"] };
 });
 }}
 className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />
 <span className="text-slate-800 dark:text-slate-100">{option.label}</span>
 </label>
 );
})}
</div>
<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
If no tier-specific banner matches, storefront uses banners targeted to All users.
</p>
</div>

<div>
<label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tier priority (lower number shows first)</label>
<div className="mb-2 flex flex-wrap gap-2">
<button
 type="button"
 onClick={() => setBannerForm((s) => ({ ...s, audience_priority_map: resolvePriorityMapByPreset("VIP_FIRST") }))}
 className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
>
 VIP First
</button>
<button
 type="button"
 onClick={() => setBannerForm((s) => ({ ...s, audience_priority_map: resolvePriorityMapByPreset("GUEST_ACQUISITION") }))}
 className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
>
 Guest Acquisition
</button>
<button
 type="button"
 onClick={() => setBannerForm((s) => ({ ...s, audience_priority_map: resolvePriorityMapByPreset("BALANCED") }))}
 className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
>
 Balanced
</button>
<button
 type="button"
 onClick={() => {
 const currentMap = normalizeAudiencePriorityMap(bannerForm.audience_priority_map);
 const detectedPreset =
 Object.entries(BANNER_PRIORITY_PRESETS).find(([, presetMap]) => {
 const normalizedPreset = normalizeAudiencePriorityMap(presetMap);
 return BANNER_PRIORITY_SEGMENTS.every((segment) => normalizedPreset[segment] === currentMap[segment]);
 })?.[0] || DEFAULT_PRIORITY_PRESET_KEY;
 setDefaultPriorityPreset(detectedPreset);
 }}
 className="h-8 px-3 rounded-md border border-[color:var(--admin-primary)] text-xs font-semibold text-[color:var(--admin-primary)] hover:bg-[rgba(var(--admin-primary-rgb),0.08)]"
>
 Save as default preset
</button>
<button
 type="button"
 onClick={() =>
 setBannerForm((s) => ({
 ...s,
 audience_priority_map: resolvePriorityMapByPreset(defaultPriorityPreset),
 }))
 }
 className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
>
 Use default now
</button>
<button
 type="button"
 onClick={() =>
 setBannerForm((s) => ({
 ...s,
 audience_priority_map: resolvePriorityMapByPreset("BALANCED"),
 }))
 }
 className="h-8 px-3 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
>
 Reset to 100
</button>
</div>
<p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
Current default preset: {String(defaultPriorityPreset || DEFAULT_PRIORITY_PRESET_KEY).replaceAll("_", " ")}
</p>
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
{BANNER_PRIORITY_SEGMENTS.map((segment) => (
 <label key={segment} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900/40">
 <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">{segment}</span>
 <input
 type="number"
 min={0}
 max={9999}
 value={normalizeAudiencePriorityMap(bannerForm.audience_priority_map)[segment]}
 onChange={(e) => {
 const value = Number(e.target.value || 0);
 setBannerForm((s) => ({
 ...s,
 audience_priority_map: {
 ...normalizeAudiencePriorityMap(s.audience_priority_map),
 [segment]: Number.isFinite(value) ? Math.max(0, Math.min(9999, value)) : 100,
 },
 }));
 }}
 className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 px-2 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </label>
))}
</div>
<div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
<p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Winning order preview (current form)</p>
<div className="flex flex-wrap gap-2">
{buildWinningOrderPreview(bannerForm.audience_priority_map).map((item, idx) => (
 <span
 key={item.segment}
 className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
 >
 <span className="font-semibold">{idx + 1}.</span>
 <span className="uppercase">{item.segment}</span>
 <span className="text-slate-500 dark:text-slate-400">({item.value})</span>
 </span>
))}
</div>
</div>
</div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Media URL (Image/GIF/Video)</label>
 <input
 value={bannerForm.media_url}
 onChange={(e) => setBannerForm((s) => ({ ...s, media_url: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 placeholder="https://..."
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Image</label>
 <div className="flex gap-2">
 <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-900/40">
 {bannerPreview ? (
 <img
 src={resolveImageUrl(bannerPreview)}
 alt="Preview"
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 </div>
 )}
 </div>

 <input
 type="file"
 accept="image/*,video/*"
 onChange={onPickBannerFile}
 className="flex-1 text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 dark:file:border-slate-600 file:bg-white dark:file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 dark:file:text-slate-200"
 />
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Tip: select a new image only when you want to replace it.</p>
 </div>

 <div className="flex items-center gap-3">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={bannerForm.is_active}
 onChange={(e) => setBannerForm((s) => ({ ...s, is_active: e.target.checked }))}
 className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />
 <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Active</span>
 </label>
 </div>

 <div className="flex gap-2">
 <button
 type="submit"
 style={{
 backgroundColor: accentColor,
 color: accentText,
 borderColor: accentColor,
 }}
 className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 border"
 >
 {bannerEditingId ? "Edit Banner" : "Create Banner"}
 </button>

 {(showBannerForm || bannerEditingId) && (bannerEditingId ? canEditHomepage : canCreateHomepage) && (
 <button
 type="button"
 onClick={resetBannerForm}
 className="px-4 h-11 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 Cancel
 </button>
 )}
 </div>
 </form>
 </div>
 </div>
 )}

 {(!showBannerForm && !bannerEditingId) && (
 <div className="lg:col-span-3">
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
 <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Banners ({banners.length})</h2>
 <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
 {[
 { value: "list", label: "List" },
 { value: "grid", label: "Grid" },
 { value: "split", label: "Split" },
 ].map((mode) => (
 <button
 key={mode.value}
 type="button"
 onClick={() => setBannerViewMode(mode.value)}
 className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${bannerViewMode === mode.value
 ? "bg-[color:var(--admin-primary)] text-white"
 : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70"
 }`}
 >
 {mode.label}
 </button>
 ))}
 </div>
 </div>

 {loading ? (
 <AdminSectionLoader rows={4} />
 ) : banners.length === 0 ? (
 <div className="text-center py-12 text-slate-500 dark:text-slate-400">No banners yet</div>
 ) : (
 <div className={bannerViewMode === "list" ? "space-y-4" : bannerViewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 lg:grid-cols-2"}>
 {banners.map((b) => {
 const img = b.image_url || b.image || b.image_path || "";
 return (
 <div
 key={b.id}
 className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${bannerViewMode === "list" ? "flex items-center gap-4 p-4" : bannerViewMode === "grid" ? "p-3" : "flex items-start gap-4 p-4"}`}
 >
 <img
 src={resolveImageUrl(img)}
 alt={b.title}
 className={`${bannerViewMode === "grid" ? "w-full h-44 mb-3" : "w-24 h-16"} object-cover rounded-lg`}
 />

 <div className={bannerViewMode === "grid" ? "space-y-2" : "flex-1"}>
 <h3 className="font-semibold text-slate-900 dark:text-white">{b.title || "Untitled"}</h3>
 <p className="text-sm text-slate-500 dark:text-slate-400">{(b.position || "hero")} • Order: {b.order ?? 0}</p>
<p className="text-xs text-slate-400 dark:text-slate-500">
Audience: {normalizeAudienceTargets(b.audience_targets).join(", ")}
</p>
<p className="text-xs text-slate-400 dark:text-slate-500">
Priority map: {BANNER_PRIORITY_SEGMENTS.map((segment) => `${segment}:${normalizeAudiencePriorityMap(b.audience_priority_map)[segment]}`).join(" • ")}
</p>

 {bannerViewMode === "grid" && (
 <span
 className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${b.is_active ? "border-[color:var(--admin-primary)] bg-[color:var(--admin-primary)] text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300"}`}
 >
 {b.is_active ? "Active" : "Inactive"}
 </span>
 )}
 </div>

 {bannerViewMode !== "grid" && (
 <span
 className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${b.is_active ? "border-[color:var(--admin-primary)] bg-[color:var(--admin-primary)] text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300"}`}
 >
 {b.is_active ? "Active" : "Inactive"}
 </span>
 )}

 {homepageCanMutate ? (
 <div className={`flex gap-2 ${bannerViewMode === "grid" ? "mt-3" : ""}`}>
 {canEditHomepage ? (
 <button
 onClick={() => editBanner(b)}
 className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 ) : null}
 {canDeleteHomepage ? (
 <button
 onClick={() => deleteBanner(b.id)}
 className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 ) : null}
 </div>
 ) : null}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )}

 {/* ---------------- COLLECTIONS ---------------- */}
 {activeTab === "collections" && (
 <div className="grid lg:grid-cols-3 gap-6">
 {(showCollectionForm || collectionEditingId) && (collectionEditingId ? canEditHomepage : canCreateHomepage) && (
 <div className="lg:col-span-3">
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <h2 className="text-lg font-semibold text-slate-900 mb-4">
 {collectionEditingId ? "Edit Collection" : "New Collection"}
 </h2>

 <form onSubmit={saveCollection} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Name *</label>
 <input
 value={collectionForm.name}
 onChange={(e) => setCollectionForm((s) => ({ ...s, name: e.target.value }))}
 required
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 placeholder="Collection name"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gender *</label>
 <select
 value={collectionForm.gender}
 onChange={(e) => setCollectionForm((s) => ({ ...s, gender: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 >
 <option value="women">Women</option>
 <option value="men">Men</option>
 <option value="boys">Boys</option>
 <option value="girls">Girls</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Link (optional)</label>
 <input
 value={collectionForm.link}
 onChange={(e) => setCollectionForm((s) => ({ ...s, link: e.target.value }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 placeholder="/search?parent_category=Women"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Sort Order</label>
 <input
 type="number"
 value={collectionForm.sort_order}
 onChange={(e) => setCollectionForm((s) => ({ ...s, sort_order: Number(e.target.value || 0) }))}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 min={0}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Image</label>
 <div className="flex gap-2">
 <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-900/40">
 {collectionPreview ? (
 <img
 src={resolveImageUrl(collectionPreview)}
 alt="Preview"
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 </div>
 )}
 </div>

 <input
 type="file"
 accept="image/*"
 onChange={onPickCollectionFile}
 className="flex-1 text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 dark:file:border-slate-600 file:bg-white dark:file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 dark:file:text-slate-200"
 />
 </div>
 </div>

 <div className="flex items-center gap-3">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={collectionForm.is_active}
 onChange={(e) => setCollectionForm((s) => ({ ...s, is_active: e.target.checked }))}
 className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />
 <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Active</span>
 </label>
 </div>

 <div className="flex gap-2">
 <button
 type="submit"
 style={{
 backgroundColor: accentColor,
 color: accentText,
 borderColor: accentColor,
 }}
 className="flex-1 h-12 rounded-xl text-sm font-semibold transition-all duration-200 border"
 >
 {collectionEditingId ? "Edit Collection" : "Create Collection"}
 </button>

 {(showCollectionForm || collectionEditingId) && (collectionEditingId ? canEditHomepage : canCreateHomepage) && (
 <button
 type="button"
 onClick={resetCollectionForm}
 className="px-4 h-11 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 Cancel
 </button>
 )}
 </div>
 </form>
 </div>
 </div>
 )}

 {(!showCollectionForm && !collectionEditingId) && (
 <div className="lg:col-span-3">
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
 <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Collections ({collections.length})</h2>
 <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
 {[
 { value: "list", label: "List" },
 { value: "grid", label: "Grid" },
 { value: "split", label: "Split" },
 ].map((mode) => (
 <button
 key={mode.value}
 type="button"
 onClick={() => setCollectionViewMode(mode.value)}
 className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${collectionViewMode === mode.value
 ? "bg-[color:var(--admin-primary)] text-white"
 : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70"
 }`}
 >
 {mode.label}
 </button>
 ))}
 </div>
 </div>

 {loading ? (
 <AdminSectionLoader rows={4} />
 ) : collections.length === 0 ? (
 <div className="text-center py-12 text-slate-500 dark:text-slate-400">No collections yet</div>
 ) : (
 <div className={collectionViewMode === "list" ? "space-y-4" : collectionViewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 lg:grid-cols-2"}>
 {collections.map((c) => {
 const img = c.image_url || c.image || c.image_path || "";
 return (
 <div
 key={c.id}
 className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${collectionViewMode === "list" ? "flex items-center gap-4 p-4" : collectionViewMode === "grid" ? "p-3" : "flex items-start gap-4 p-4"}`}
 >
 <img
 src={resolveImageUrl(img)}
 alt={c.name}
 className={`${collectionViewMode === "grid" ? "w-full h-56 mb-3" : collectionViewMode === "split" ? "w-40 h-28" : "w-32 h-24"} object-cover rounded-lg border border-slate-200`}
 />

 <div className={collectionViewMode === "grid" ? "space-y-2" : "flex-1"}>
 <h3 className="font-semibold text-slate-900 dark:text-white">{c.name}</h3>
 <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{(c.gender || "women").toUpperCase()} • Order: {c.sort_order ?? 0}</p>

 {collectionViewMode === "grid" && (
 <span
 className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${c.is_active ? "border-[color:var(--admin-primary)] bg-[color:var(--admin-primary)] text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300"}`}
 >
 {c.is_active ? "Active" : "Inactive"}
 </span>
 )}
 </div>

 {collectionViewMode !== "grid" && (
 <span
 className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${c.is_active ? "border-[color:var(--admin-primary)] bg-[color:var(--admin-primary)] text-white" : "border-slate-300 dark:border-slate-600 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300"}`}
 >
 {c.is_active ? "Active" : "Inactive"}
 </span>
 )}

 {homepageCanMutate ? (
 <div className={`flex gap-2 ${collectionViewMode === "grid" ? "mt-3" : ""}`}>
 {canEditHomepage ? (
 <button
 onClick={() => editCollection(c)}
 className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 ) : null}
 {canDeleteHomepage ? (
 <button
 onClick={() => deleteCollection(c.id)}
 className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 ) : null}
 </div>
 ) : null}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
