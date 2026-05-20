import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useTheme } from "../../state/theme.jsx";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import {
 buildAllColumnsVisibility,
 loadTableColumnVisibility,
 TableColumnVisibilityMenu,
} from "../../components/admin/TableColumnVisibilityMenu.jsx";

const SALES_TABLE_COLUMNS = [
 { id: "product", label: "Product" },
 { id: "discount", label: "Discount" },
 { id: "salePrice", label: "Sale Price" },
 { id: "startDate", label: "Start Date" },
 { id: "endDate", label: "End Date" },
 { id: "status", label: "Status" },
 { id: "actions", label: "Actions" },
];

const SALES_COLUMNS_STORAGE_KEY = "fitandsleek-sales-columns";

export default function AdminSales() {
 const { refresh: refreshAuth } = useAuth();
 const { primaryColor, mode } = useTheme();
 const isDark = mode === "dark";
 const accentColor = primaryColor;
 const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
 const deleteButtonStyle = {
 backgroundColor: isDark ? "rgba(127, 29, 29, 0.22)" : "#fef2f2",
 color: isDark ? "#fecdd3" : "#991b1b",
 border: `1px solid ${isDark ? "rgba(248, 113, 113, 0.45)" : "#fecdd3"}`,
 borderRadius: "0.5rem",
 width: "2.5rem",
 height: "2.5rem",
 display: "inline-flex",
 alignItems: "center",
 justifyContent: "center",
 transition: "all 150ms ease",
 };
 const [rows, setRows] = useState([]);
 const [loading, setLoading] = useState(true);
 const [products, setProducts] = useState([]);
 const [form, setForm] = useState({
 product_id: "",
 discount_type: "percentage",
 discount_value: "",
 sale_price: "",
 start_date: "",
 end_date: "",
 is_active: true,
 description: "",
 });
 const [editing, setEditing] = useState(null);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [animate, setAnimate] = useState(false);
 const [showCreateForm, setShowCreateForm] = useState(false);
 const [deleteTarget, setDeleteTarget] = useState(null);
 const [deleteBusy, setDeleteBusy] = useState(false);
 const [search, setSearch] = useState("");
 const [columnVisibility, setColumnVisibility] = useState(() =>
 loadTableColumnVisibility(SALES_COLUMNS_STORAGE_KEY, SALES_TABLE_COLUMNS),
 );

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
 const { data: salesData } = await api.get("/admin/sales");
 const { data: productsData } = await api.get("/products");
 setRows(salesData?.data || []);
 setProducts(Array.isArray(productsData) ? productsData : (productsData?.data || []));
 } catch (e) {
 setErr(extractErr(e));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 load();
 }, []);

 useEffect(() => {
 try {
 localStorage.setItem(SALES_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
 } catch { /* ignore quota */ }
 }, [columnVisibility]);

 const isColVisible = (columnId) => columnVisibility[columnId] !== false;

 const toggleTableColumn = (columnId) => {
 setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
 };

 const setAllTableColumnsVisible = (visible) => {
 setColumnVisibility(buildAllColumnsVisibility(SALES_TABLE_COLUMNS, visible, "product"));
 };

 const showSuccess = (msg) => {
 setSuccess(msg);
 setAnimate(true);
 setTimeout(() => setSuccess(""), 3000);
 setTimeout(() => setAnimate(false), 2800);
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 setErr("");

 if (!form.product_id || !form.discount_value || !form.start_date || !form.end_date) {
 setErr("Please fill in all required fields");
 return;
 }

 try {
 if (editing) {
 await api.put(`/admin/sales/${editing}`, form);
 showSuccess("Sale updated successfully");
 } else {
 await api.post("/admin/sales", form);
 showSuccess("Sale created successfully");
 }
 resetForm();
 setShowCreateForm(false);
 load();
 } catch (e) {
 setErr(extractErr(e));
 }
 };

 const resetForm = () => {
 setForm({
 product_id: "",
 discount_type: "percentage",
 discount_value: "",
 sale_price: "",
 start_date: "",
 end_date: "",
 is_active: true,
 description: "",
 });
 setEditing(null);
 };

 const handleEdit = (sale) => {
 setForm({
 product_id: sale.product_id,
 discount_type: sale.discount_type,
 discount_value: sale.discount_value,
 sale_price: sale.sale_price,
 start_date: sale.start_date?.split('T')[0],
 end_date: sale.end_date?.split('T')[0],
 is_active: sale.is_active,
 description: sale.description,
 });
 setEditing(sale.id);
 setShowCreateForm(true);
 };

 const closeCreateForm = () => {
 setShowCreateForm(false);
 resetForm();
 };

 const handleDelete = (id) => {
 setDeleteTarget(id);
 };

 const confirmDelete = async () => {
 if (!deleteTarget) return;
 setDeleteBusy(true);
 setErr("");
 try {
 await api.delete(`/admin/sales/${deleteTarget}`);
 setDeleteTarget(null);
 showSuccess("Sale deleted successfully");
 load();
 } catch (e) {
 setErr(extractErr(e));
 } finally {
 setDeleteBusy(false);
 }
 };

 const toggleActive = async (ids, isActive) => {
 try {
 await api.post("/admin/sales/bulk-toggle", {
 ids,
 is_active: isActive,
 });
 showSuccess("Sales updated successfully");
 load();
 } catch (e) {
 setErr(extractErr(e));
 }
 };

 // Calculate sale price if percentage
 const calculateSalePrice = () => {
 if (!form.product_id || !form.discount_value) return "";
 const product = products.find(p => p.id === parseInt(form.product_id));
 if (!product) return "";

 if (form.discount_type === "percentage") {
 return (product.price * (1 - form.discount_value / 100)).toFixed(2);
 } else {
 return Math.max(0, product.price - form.discount_value).toFixed(2);
 }
 };

 const filteredRows = rows.filter((sale) => {
 const q = search.trim().toLowerCase();
 if (!q) return true;
 return (
 String(sale.product?.name || "").toLowerCase().includes(q) ||
 String(sale.discount_type || "").toLowerCase().includes(q) ||
 String(sale.description || "").toLowerCase().includes(q)
 );
 });

 if (loading) return <AdminContentSkeleton lines={3} imageHeight={220} />;

 return (
 <div className="w-full min-w-0 min-h-0 bg-slate-50 dark:bg-slate-950">
 <div className="mb-6 flex items-start justify-between gap-4">
 <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white">Manage Product Sales</h1>
 <button
 onClick={() => setShowCreateForm(true)}
 className={`px-6 py-3 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${accentIsWhite ? "border border-slate-300" : "text-white"}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Create New Sale
 </button>
 </div>

 <AdminConfirmDialog
 open={deleteTarget != null}
 onClose={() => !deleteBusy && setDeleteTarget(null)}
 onConfirm={confirmDelete}
 title="Delete this sale?"
 message="This action cannot be undone."
 confirmLabel="Delete"
 cancelLabel="Cancel"
 destructive
 busy={deleteBusy}
 />

 <AdminModal
 open={showCreateForm}
 onClose={closeCreateForm}
 title={editing ? "Edit Sale" : "Create New Sale"}
 titleId="sale-form-title"
 >
 {err && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">{err}</div>}
 {success && (
 <div className={`bg-slate-900 text-white p-4 rounded-xl mb-4 transition-opacity ${animate ? 'opacity-100' : 'opacity-0'}`}>
 {success}
 </div>
 )}

 <form onSubmit={handleSubmit} className="grid gap-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Product *</label>
 <select
 value={form.product_id}
 onChange={(e) => setForm({ ...form, product_id: e.target.value, sale_price: "" })}
 className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 required
 >
 <option value="">Select Product</option>
 {products.map(p => (
 <option key={p.id} value={p.id}>{p.name} - ${p.price}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Discount Type *</label>
 <select
 value={form.discount_type}
 onChange={(e) => setForm({ ...form, discount_type: e.target.value, sale_price: "" })}
 className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 >
 <option value="percentage">Percentage (%)</option>
 <option value="fixed">Fixed Amount ($)</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
 Discount Value {form.discount_type === "percentage" ? "(%)" : "($)"} *
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={form.discount_value}
 onChange={(e) => setForm({ ...form, discount_value: e.target.value, sale_price: "" })}
 className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 10.99"}
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Sale Price ($)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={form.sale_price || calculateSalePrice()}
 onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
 className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 placeholder="Auto-calculated"
 />
 {calculateSalePrice() && !form.sale_price && (
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Auto: ${calculateSalePrice()}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Start Date *</label>
 <input
 type="date"
 value={form.start_date}
 onChange={(e) => setForm({ ...form, start_date: e.target.value })}
 className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">End Date *</label>
 <input
 type="date"
 value={form.end_date}
 onChange={(e) => setForm({ ...form, end_date: e.target.value })}
 className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 required
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Description</label>
 <textarea
 value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 rows="3"
 placeholder="Sale details, special notes, etc."
 />
 </div>

 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="is_active"
 checked={form.is_active}
 onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
 className="w-4 h-4"
 />
 <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-200">Active</label>
 </div>

 <div className="flex gap-2">
 <button
 type="submit"
 className="px-4 py-2 bg-[color:var(--admin-primary)] text-white rounded-xl hover:brightness-110 font-semibold"
 >
 {editing ? "Update Sale" : "Create Sale"}
 </button>
 {editing && (
 <button
 type="button"
 onClick={resetForm}
 className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
 >
 Cancel
 </button>
 )}
 </div>
 </form>
 </AdminModal>

 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
 <div className="relative z-10 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <h3 className="text-lg font-semibold text-slate-900 dark:text-white">All Sales</h3>
 <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search sales..."
 className="h-10 w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
 />
 <TableColumnVisibilityMenu
 columns={SALES_TABLE_COLUMNS}
 visibility={columnVisibility}
 onToggle={toggleTableColumn}
 onShowAll={() => setAllTableColumnsVisible(true)}
 onHideAll={() => setAllTableColumnsVisible(false)}
 />
 </div>
 </div>
 <div className="overflow-x-auto rounded-b-2xl">
 <table className="w-full min-w-[900px]">
 <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200">
 <tr>
 {isColVisible("product") ? <th className="px-4 py-2 text-left">Product</th> : null}
 {isColVisible("discount") ? <th className="px-4 py-2 text-left">Discount</th> : null}
 {isColVisible("salePrice") ? <th className="px-4 py-2 text-left">Sale Price</th> : null}
 {isColVisible("startDate") ? <th className="px-4 py-2 text-left">Start Date</th> : null}
 {isColVisible("endDate") ? <th className="px-4 py-2 text-left">End Date</th> : null}
 {isColVisible("status") ? <th className="px-4 py-2 text-left">Status</th> : null}
 {isColVisible("actions") ? <th className="px-4 py-2 text-left">Actions</th> : null}
 </tr>
 </thead>
 <tbody>
 {filteredRows.map(sale => (
 <tr key={sale.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
 {isColVisible("product") ? (
 <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{sale.product?.name}</td>
 ) : null}
 {isColVisible("discount") ? (
 <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
 {sale.discount_type === "percentage"
 ? `${sale.discount_value}%`
 : `$${parseFloat(sale.discount_value).toFixed(2)}`}
 </td>
 ) : null}
 {isColVisible("salePrice") ? (
 <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">${parseFloat(sale.sale_price).toFixed(2)}</td>
 ) : null}
 {isColVisible("startDate") ? (
 <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{new Date(sale.start_date).toLocaleDateString()}</td>
 ) : null}
 {isColVisible("endDate") ? (
 <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{new Date(sale.end_date).toLocaleDateString()}</td>
 ) : null}
 {isColVisible("status") ? (
 <td className="px-4 py-2">
 <button
 onClick={() => toggleActive([sale.id], !sale.is_active)}
 className={`px-3 py-1 rounded-full text-xs font-semibold border ${sale.is_active ? "bg-[rgba(var(--admin-primary-rgb),0.14)] text-[color:var(--admin-primary)] border-[rgba(var(--admin-primary-rgb),0.4)] dark:bg-[rgba(var(--admin-primary-rgb),0.22)] dark:text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)]" : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
 }`}
 >
 {sale.is_active ? "Active" : "Inactive"}
 </button>
 </td>
 ) : null}
 {isColVisible("actions") ? (
 <td className="px-4 py-2 flex gap-2">
 <button
 onClick={() => handleEdit(sale)}
 className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
 title="Edit"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 <button
 onClick={() => handleDelete(sale.id)}
 className="transition-colors"
 style={deleteButtonStyle}
 aria-label="Delete sale"
 title="Delete"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </td>
 ) : null}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {filteredRows.length === 0 && (
 <div className="p-4 text-center text-slate-500 dark:text-slate-400">No sales found</div>
 )}
 </div>
 </div>
 );
}
