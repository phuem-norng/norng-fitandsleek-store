import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { AdminContentSkeleton, AdminDashboardLoader } from "@/components/admin/AdminLoading";

export default function AdminCategories() {
 const { refresh: refreshAuth } = useAuth();
 const { user, can, permissionsReady } = useAdminPermissions();
 const canViewCategories = can("categories", "view");
 const canCreateCategories = can("categories", "create");
 const canEditCategories = can("categories", "edit");
 const canDeleteCategories = can("categories", "delete");
 const { primaryColor, mode } = useTheme();
 const accentColor = primaryColor;
 const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
 const headerIconColor = accentIsWhite ? "#0b0b0f" : "#FFFFFF";
 const deleteButtonStyle = {
 backgroundColor: mode === "dark" ? "rgba(127, 29, 29, 0.22)" : "#fef2f2",
 color: mode === "dark" ? "#fecdd3" : "#991b1b",
 border: `1px solid ${mode === "dark" ? "rgba(248, 113, 113, 0.45)" : "#fecdd3"}`,
 padding: "8px 12px",
 borderRadius: "10px",
 fontWeight: 600,
 fontSize: "0.875rem",
 transition: "all 150ms ease",
 display: "inline-flex",
 alignItems: "center",
 gap: "8px",
 };
 const deleteIconButtonStyle = {
 ...deleteButtonStyle,
 padding: "8px",
 borderRadius: "10px",
 fontWeight: 500,
 fontSize: "0.85rem",
 };
 const [rows, setRows] = useState([]);
 const [loading, setLoading] = useState(true);
 const [form, setForm] = useState({ name: "", gender: "", type: "", is_active: true });
 const [editing, setEditing] = useState(null);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [animate, setAnimate] = useState(false);
 const [showCreateForm, setShowCreateForm] = useState(false);
 const [search, setSearch] = useState("");
 const [selectedIds, setSelectedIds] = useState([]);
 const [isCreating, setIsCreating] = useState(false);
 const [createError, setCreateError] = useState("");
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

 const isCatalogCategory = (c) => String(c?.type || "").toLowerCase() !== "barcode_qr";

 const load = async () => {
 if (!canViewCategories) {
 setRows([]);
 setLoading(false);
 return;
 }
 setLoading(true);
 try {
 const { data } = await api.get("/admin/categories");
 setRows((data?.data || []).filter(isCatalogCategory));
 } catch (e2) {
 setErr(extractErr(e2));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 if (!permissionsReady) return;
 load();
 }, [permissionsReady, canViewCategories]);

 useEffect(() => {
 setSelectedIds((prev) => prev.filter((id) => rows.some((c) => c.id === id)));
 }, [rows]);

 if (!permissionsReady || loading) return <AdminContentSkeleton lines={3} imageHeight={220} />;

 if (!canViewCategories) {
 return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
 }

 const showSuccess = (msg) => {
 setSuccess(msg);
 setAnimate(true);
 setTimeout(() => {
 setAnimate(false);
 setTimeout(() => setSuccess(""), 300);
 }, 3000);
 };

 const create = async (e) => {
 e.preventDefault();
 if (!canCreateCategories) {
 await errorAlert({
 khTitle: "គ្មានសិទ្ធិ",
 enTitle: "Not allowed",
 detail: "You don't have permission to create categories.",
 });
 return;
 }
 if (isCreating) return;
 setErr("");
 setCreateError("");
 setIsCreating(true);
 loadingAlert({
 khTitle: "កំពុងបង្កើតប្រភេទ",
 enTitle: "Creating category",
 khText: "សូមរង់ចាំបន្តិច",
 enText: "Please wait",
 });
 try {
 const response = await api.post("/admin/categories", {
 name: form.name,
 gender: form.gender || null,
 type: form.type || null,
 is_active: !!form.is_active,
 });
 if (![200, 201].includes(response?.status)) {
 throw new Error("Create failed.");
 }
 closeSwal();
 setForm({ name: "", gender: "", type: "", is_active: true });
 setShowCreateForm(false);
 await toastSuccess({
 khText: "បានបង្កើតប្រភេទដោយជោគជ័យ",
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
 khTitle: "បង្កើតប្រភេទបរាជ័យ",
 enTitle: "Create failed",
 detail: slugHint,
 });
 } finally {
 closeSwal();
 setIsCreating(false);
 }
 };

 const startEdit = (c) => {
 if (!canEditCategories) return;
 setEditing({ ...c });
 };

 const saveEdit = async () => {
 if (!canEditCategories) {
 setErr("You don't have permission to edit categories.");
 return;
 }
 if (!editing?.id) return;
 setErr("");
 try {
 await api.patch(`/admin/categories/${editing.id}`, {
 name: editing.name,
 gender: editing.gender || null,
 type: editing.type || null,
 is_active: !!editing.is_active,
 });
 closeEditForm();
 showSuccess("Category updated successfully!");
 await load();
 } catch (e2) {
 setErr(extractErr(e2));
 }
 };

 const del = (id) => {
 if (!canDeleteCategories) return;
 setPendingDeleteId(id);
 };

 const confirmDelete = async () => {
 if (!canDeleteCategories) return;
 setDeleteBusy(true);
 setErr("");
 try {
 if (pendingBulkDelete) {
 await Promise.all(selectedIds.map((id) => api.delete(`/admin/categories/${id}`)));
 showSuccess("Selected categories deleted successfully!");
 setSelectedIds([]);
 } else if (pendingDeleteId != null) {
 await api.delete(`/admin/categories/${pendingDeleteId}`);
 showSuccess("Category deleted successfully!");
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

 const filteredRows = rows.filter((c) => {
 const q = search.trim().toLowerCase();
 if (!q) return true;
 return (
 String(c.name || "").toLowerCase().includes(q) ||
 String(c.slug || "").toLowerCase().includes(q) ||
 String(c.gender || "").toLowerCase().includes(q) ||
 String(c.type || "").toLowerCase().includes(q)
 );
 });

 const toggleSelect = (id) => {
 setSelectedIds((prev) =>
 prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
 );
 };

 const allSelected =
 filteredRows.length > 0 && filteredRows.every((c) => selectedIds.includes(c.id));

 const toggleSelectAll = () => {
 if (allSelected) {
 const filteredIds = new Set(filteredRows.map((c) => c.id));
 setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
 return;
 }
 const next = new Set(selectedIds);
 filteredRows.forEach((c) => next.add(c.id));
 setSelectedIds(Array.from(next));
 };

 const deleteSelected = () => {
 if (!canDeleteCategories || selectedIds.length === 0) return;
 setPendingBulkDelete(true);
 };

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 {/* Success Toast */}
 <div className={`fixed top-6 right-6 z-50 transition-all duration-500 ease-out transform ${animate ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
 {success && (
 <div className="bg-[color:var(--admin-primary)] text-white px-6 py-4 rounded-xl flex items-center gap-3 animate-pulse">
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 <span className="font-medium">{success}</span>
 </div>
 )}
 </div>

 <div className="w-full min-w-0">
 {/* Header */}
 <div className="mb-8 flex items-start justify-between gap-4">
 <div>
 <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-2">
 Categories
 </h1>
 <p className="text-slate-500 dark:text-slate-400 text-lg">Manage your product categories with full CRUD operations</p>
 </div>
 {canCreateCategories ? (
 <button
 onClick={() => setShowCreateForm(true)}
 className={`px-6 py-3 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${accentIsWhite ? "border border-slate-300" : "text-white"}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add New Category
 </button>
 ) : null}
 </div>

 {/* Error Alert */}
 {err && (
 <div className="mb-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3 animate-shake">
 <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-red-700 dark:text-red-100 font-medium">{err}</span>
 <button onClick={() => setErr("")} className="ml-auto text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200 transition-colors">
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
 title={pendingBulkDelete ? "Delete selected categories?" : "Delete this category?"}
 message={
 pendingBulkDelete
 ? `Permanently remove ${selectedIds.length} categor${selectedIds.length === 1 ? "y" : "ies"}? This cannot be undone.`
 : "This action cannot be undone. Ensure no products rely on this category."
 }
 confirmLabel="Delete"
 cancelLabel="Cancel"
 destructive
 busy={deleteBusy}
 />

 <AdminModal
 open={showCreateForm}
 onClose={closeCreateForm}
 title="Add New Category"
 titleId="category-create-title"
 maxWidthClass="max-w-3xl"
 closeOnBackdrop={!isCreating}
 >
 <form onSubmit={create} className="grid md:grid-cols-12 gap-4 items-end">
 <label className="md:col-span-6">
 <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Category Name</span>
 <input
 value={form.name}
 onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
 required
 className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200 placeholder-slate-400"
 placeholder="e.g., Summer Collection"
 />
 </label>

 <label className="md:col-span-3">
 <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Gender (Optional)</span>
 <select
 value={form.gender}
 onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
 className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200"
 >
 <option value="">All Genders</option>
 <option value="MEN">Men</option>
 <option value="WOMEN">Women</option>
 <option value="BOY">Boy</option>
 <option value="GIRL">Girl</option>
 </select>
 </label>

 <label className="md:col-span-3">
 <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Category Type</span>
 <select
 value={form.type}
 onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
 className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200"
 >
 <option value="">Select type</option>
 <option value="clothes">Clothes</option>
 <option value="shoes">Shoes</option>
 <option value="belt">Belt</option>
 <option value="hat">Hat</option>
 <option value="bag">Bag</option>
 <option value="accessory">Accessory</option>
 <option value="other">Other</option>
 </select>
 </label>

 <label className="md:col-span-6 flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
 <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Active Status</span>
 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={() => setForm((s) => ({ ...s, is_active: !s.is_active }))}
 className="relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-slate-300 dark:focus:ring-slate-600 dark:focus:ring-offset-slate-800"
 style={{ backgroundColor: form.is_active ? accentColor : (mode === 'dark' ? '#334155' : '#e2e8f0') }}
 >
 <span className="w-6 h-6 bg-white rounded-full transform transition-transform duration-300" style={{ transform: form.is_active ? 'translateX(24px)' : 'translateX(4px)' }} />
 </button>
 <span className="text-sm font-medium text-black dark:text-white min-w-[30px] text-right">
 {form.is_active ? 'Yes' : 'No'}
 </span>
 </div>
 </label>

 <div className="md:col-span-12 flex justify-end">
 <button
 type="submit"
 disabled={isCreating || !canCreateCategories}
 className={`h-12 min-w-44 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed border ${accentIsWhite ? 'border-slate-300' : ''}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? '#0b0b0f' : '#FFFFFF', borderColor: accentIsWhite ? '#cbd5e1' : accentColor }}
 >
 {isCreating ? (
 <AdminDashboardLoader size={22} />
 ) : (
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
 </svg>
 )}
 {isCreating ? "Creating..." : "Add Category"}
 </button>
 </div>
 {createError ? (
 <div className="md:col-span-12 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-100">
 {createError}
 </div>
 ) : null}
 </form>
 </AdminModal>

 {/* Categories Table */}
 <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
 {/* Table Header */}
 <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: headerIconColor }}>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
 </svg>
 </div>
 <div>
 <h3 className="text-slate-900 dark:text-white font-semibold">All Categories</h3>
 <p className="text-slate-500 dark:text-slate-400 text-sm">{filteredRows.length} total categories</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search categories..."
 className="h-10 w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-slate-500"
 />
 {canDeleteCategories ? (
 <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={toggleSelectAll}
 className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 focus:ring-0"
 />
 Select all
 </label>
 ) : null}
 {canDeleteCategories && selectedIds.length > 0 ? (
 <button
 onClick={deleteSelected}
 style={deleteButtonStyle}
 className="transition-all"
 >
 Delete Selected ({selectedIds.length})
 </button>
 ) : null}
 <button
 onClick={load}
 className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
 >
 {loading ? (
 <AdminDashboardLoader size={18} />
 ) : (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 )}
 Refresh
 </button>
 </div>
 </div>

 {/* Table Content */}
 {loading ? (
 <div className="p-12 text-center">
 <div className="mx-auto mb-4 flex justify-center py-6">
 <AdminDashboardLoader />
 </div>
 </div>
 ) : filteredRows.length === 0 ? (
 <div className="p-12 text-center">
 <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
 </svg>
 </div>
 <p className="text-slate-500 dark:text-slate-200 text-lg">No categories yet</p>
 <p className="text-slate-400 dark:text-slate-400 text-sm mt-1">Create your first category above</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-200 dark:divide-slate-800">
 {filteredRows.map((c, index) => (
 <div
 key={c.id}
 className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200"
 style={{ animationDelay: `${index * 50}ms` }}
 >
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-lg">
 {c.name.charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
 <p className="text-sm text-slate-500 dark:text-slate-400">/{c.slug}</p>
 </div>
 </div>

 <div className="flex items-center gap-6">
 {canDeleteCategories ? (
 <input
 type="checkbox"
 checked={selectedIds.includes(c.id)}
 onChange={() => toggleSelect(c.id)}
 className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-0"
 />
 ) : null}
 <span
 className="px-3 py-1 rounded-full text-xs font-semibold border"
 style={c.gender
 ? { backgroundColor: accentIsWhite ? '#0b0b0f' : accentColor, color: '#FFFFFF', borderColor: accentIsWhite ? '#cbd5e1' : accentColor }
 : { backgroundColor: mode === 'dark' ? '#1f2937' : '#f8fafc', color: mode === 'dark' ? '#e2e8f0' : '#0f172a', borderColor: mode === 'dark' ? '#334155' : '#cbd5e1' }
 }
 >
 {c.gender || 'All'}
 </span>

 <span
 className="px-3 py-1 rounded-full text-xs font-semibold border"
 style={c.is_active
 ? { backgroundColor: accentIsWhite ? '#0b0b0f' : accentColor, color: '#FFFFFF', borderColor: accentIsWhite ? '#cbd5e1' : accentColor }
 : { backgroundColor: mode === 'dark' ? '#1f2937' : '#f1f5f9', color: mode === 'dark' ? '#e2e8f0' : '#0f172a', borderColor: mode === 'dark' ? '#334155' : '#cbd5e1' }
 }
 >
 {c.is_active ? 'Active' : 'Inactive'}
 </span>

 <div className="flex items-center gap-2">
 {canEditCategories ? (
 <button
 type="button"
 onClick={() => startEdit(c)}
 className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
 title="Edit"
 aria-label="Edit category"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 ) : null}
 {canDeleteCategories ? (
 <button
 type="button"
 onClick={() => del(c.id)}
 style={deleteIconButtonStyle}
 className="transition-all"
 title="Delete"
 aria-label="Delete category"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 ) : null}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 <AdminModal
 open={!!editing}
 onClose={closeEditForm}
 title="Edit Category"
 titleId="category-edit-title"
 maxWidthClass="max-w-md"
 >
 {editing ? (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Category Name</label>
 <input
 value={editing.name}
 onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Gender</label>
 <select
 value={editing.gender || ""}
 onChange={(e) => setEditing((s) => ({ ...s, gender: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 <option value="">All Genders</option>
 <option value="MEN">Men</option>
 <option value="WOMEN">Women</option>
 <option value="BOY">Boy</option>
 <option value="GIRL">Girl</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-600 mb-2">Category Type</label>
 <select
 value={editing.type || ""}
 onChange={(e) => setEditing((s) => ({ ...s, type: e.target.value }))}
 className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-all duration-300"
 >
 <option value="">Select type</option>
 <option value="clothes">Clothes</option>
 <option value="shoes">Shoes</option>
 <option value="belt">Belt</option>
 <option value="hat">Hat</option>
 <option value="bag">Bag</option>
 <option value="accessory">Accessory</option>
 <option value="other">Other</option>
 </select>
 </div>

 <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
 <button
 type="button"
 onClick={() => setEditing((s) => ({ ...s, is_active: !s.is_active }))}
 className="relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-slate-300 dark:focus:ring-slate-600 dark:focus:ring-offset-slate-900"
 style={{ backgroundColor: editing.is_active ? accentColor : (mode === 'dark' ? '#334155' : '#e2e8f0') }}
 >
 <span className="w-5 h-5 bg-white rounded-full transform transition-transform duration-300" style={{ transform: editing.is_active ? 'translateX(20px)' : 'translateX(4px)' }} />
 </button>
 <span className="text-sm font-medium text-black dark:text-white">Active Status</span>
 </div>

 <div className="flex gap-3 mt-6">
 <button
 type="button"
 onClick={closeEditForm}
 className="flex-1 h-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-100 font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300"
 >
 Cancel
 </button>
 {canEditCategories ? (
 <button
 type="button"
 onClick={saveEdit}
 className={`flex-1 h-12 rounded-xl font-semibold transition-all duration-300 border ${accentIsWhite ? 'border-slate-300' : ''}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? '#0b0b0f' : '#FFFFFF', borderColor: accentIsWhite ? '#cbd5e1' : accentColor }}
 >
 Save Changes
 </button>
 ) : null}
 </div>
 </div>
 ) : null}
 </AdminModal>

 <style>{`
 @keyframes shake {
 0%, 100% { transform: translateX(0); }
 25% { transform: translateX(-5px); }
 75% { transform: translateX(5px); }
 }
 .animate-shake {
 animation: shake 0.5s ease-in-out;
 }
 `}</style>
 </div>
 );
}

