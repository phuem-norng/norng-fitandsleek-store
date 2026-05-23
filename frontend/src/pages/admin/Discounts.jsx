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

const DISCOUNTS_TABLE_COLUMNS = [
  { id: "product", label: "Product" },
  { id: "discount", label: "Discount" },
  { id: "originalPrice", label: "Original Price" },
  { id: "salePrice", label: "Discounted Price" },
  { id: "startDate", label: "Start Date" },
  { id: "endDate", label: "End Date" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions" },
];

const DISCOUNTS_COLUMNS_STORAGE_KEY = "fitandsleek-discounts-columns";

export default function AdminDiscounts() {
  const { refresh: refreshAuth } = useAuth();
  const { primaryColor, mode } = useTheme();
  const isDark = mode === "dark";
  const accentIsWhite = (primaryColor || "").toUpperCase() === "#FFFFFF";
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
    loadTableColumnVisibility(DISCOUNTS_COLUMNS_STORAGE_KEY, DISCOUNTS_TABLE_COLUMNS),
  );

  const triggerAuthRefresh = async () => {
    try {
      await refreshAuth();
    } catch (e) {
      console.warn("Auth refresh failed");
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
      const { data: discountsData } = await api.get("/admin/discounts");
      const { data: productsData } = await api.get("/products");
      setRows(discountsData?.data || []);
      setProducts(Array.isArray(productsData) ? productsData : productsData?.data || []);
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
      localStorage.setItem(DISCOUNTS_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch {
      /* ignore quota */
    }
  }, [columnVisibility]);

  const isColVisible = (columnId) => columnVisibility[columnId] !== false;

  const toggleTableColumn = (columnId) => {
    setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
  };

  const setAllTableColumnsVisible = (visible) => {
    setColumnVisibility(buildAllColumnsVisibility(DISCOUNTS_TABLE_COLUMNS, visible, "product"));
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
        await api.put(`/admin/discounts/${editing}`, form);
        showSuccess("Discount updated successfully");
      } else {
        await api.post("/admin/discounts", form);
        showSuccess("Discount created successfully");
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

  const handleEdit = (discount) => {
    setForm({
      product_id: discount.product_id,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      sale_price: discount.sale_price,
      start_date: discount.start_date?.split("T")[0],
      end_date: discount.end_date?.split("T")[0],
      is_active: discount.is_active,
      description: discount.description,
    });
    setEditing(discount.id);
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
      await api.delete(`/admin/discounts/${deleteTarget}`);
      setDeleteTarget(null);
      showSuccess("Discount deleted successfully");
      load();
    } catch (e) {
      setErr(extractErr(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleActive = async (ids, isActive) => {
    try {
      await api.post("/admin/discounts/bulk-toggle", {
        ids,
        is_active: isActive,
      });
      showSuccess("Discounts updated successfully");
      load();
    } catch (e) {
      setErr(extractErr(e));
    }
  };

  const selectedProduct = () => {
    if (!form.product_id) return null;
    return products.find((p) => p.id === parseInt(form.product_id, 10)) || null;
  };

  const formatMoney = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n.toFixed(2) : "";
  };

  const calculateSalePrice = () => {
    if (!form.product_id || !form.discount_value) return "";
    const product = selectedProduct();
    if (!product) return "";

    if (form.discount_type === "percentage") {
      return (product.price * (1 - form.discount_value / 100)).toFixed(2);
    }
    return Math.max(0, product.price - form.discount_value).toFixed(2);
  };

  const selectedOriginalPrice = selectedProduct()?.price;

  const filteredRows = rows.filter((discount) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(discount.product?.name || "").toLowerCase().includes(q) ||
      String(discount.discount_type || "").toLowerCase().includes(q) ||
      String(discount.description || "").toLowerCase().includes(q)
    );
  });

  if (loading) return <AdminContentSkeleton lines={3} imageHeight={220} />;

  return (
    <div className="w-full min-w-0 min-h-full admin-soft text-slate-800 dark:text-slate-100">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-slate-100">Manage Discounts</h1>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:brightness-110 bg-[color:var(--admin-primary)] ${accentIsWhite ? "border border-slate-300 text-slate-900" : "text-white"}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Discount
        </button>
      </div>

      <AdminConfirmDialog
        open={deleteTarget != null}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete this discount?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deleteBusy}
      />

      <AdminModal
        open={showCreateForm}
        onClose={closeCreateForm}
        title={editing ? "Edit Discount" : "Create Discount"}
        titleId="discount-form-title"
      >
        {err && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">{err}</div>}
        {success && (
          <div className={`bg-slate-900 text-white p-4 rounded-xl mb-4 transition-opacity ${animate ? "opacity-100" : "opacity-0"}`}>
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
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ${p.price}
                  </option>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Original Price ($)</label>
              <div
                className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                aria-live="polite"
              >
                {selectedOriginalPrice != null && selectedOriginalPrice !== ""
                  ? `$${formatMoney(selectedOriginalPrice)}`
                  : "Select a product"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Discounted Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.sale_price || calculateSalePrice()}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500"
                placeholder="Auto-calculated"
              />
              {calculateSalePrice() && !form.sale_price && selectedOriginalPrice != null && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Auto: ${calculateSalePrice()} (from ${formatMoney(selectedOriginalPrice)})
                </p>
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
              placeholder="Discount details, special notes, etc."
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
            <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Active
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-[color:var(--admin-primary)] text-white rounded-xl hover:brightness-110 font-semibold"
            >
              {editing ? "Update Discount" : "Create Discount"}
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

      <div className="admin-surface rounded-2xl border admin-border">
        <div className="relative z-10 flex flex-col gap-3 border-b admin-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">All Discounts</h3>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search discounts..."
              className="h-10 w-64 rounded-lg border admin-border admin-surface px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <TableColumnVisibilityMenu
              columns={DISCOUNTS_TABLE_COLUMNS}
              visibility={columnVisibility}
              onToggle={toggleTableColumn}
              onShowAll={() => setAllTableColumnsVisible(true)}
              onHideAll={() => setAllTableColumnsVisible(false)}
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full min-w-[900px]">
            <thead className="admin-bg-elevated text-slate-700 dark:text-slate-200">
              <tr>
                {isColVisible("product") ? <th className="px-4 py-2 text-left">Product</th> : null}
                {isColVisible("discount") ? <th className="px-4 py-2 text-left">Discount</th> : null}
                {isColVisible("originalPrice") ? <th className="px-4 py-2 text-left">Original Price</th> : null}
                {isColVisible("salePrice") ? <th className="px-4 py-2 text-left">Discounted Price</th> : null}
                {isColVisible("startDate") ? <th className="px-4 py-2 text-left">Start Date</th> : null}
                {isColVisible("endDate") ? <th className="px-4 py-2 text-left">End Date</th> : null}
                {isColVisible("status") ? <th className="px-4 py-2 text-left">Status</th> : null}
                {isColVisible("actions") ? <th className="px-4 py-2 text-left">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((discount) => (
                <tr key={discount.id} className="border-t admin-border hover:bg-[rgba(var(--admin-primary-rgb),0.06)] dark:hover:bg-[rgba(var(--admin-primary-rgb),0.08)]">
                  {isColVisible("product") ? (
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{discount.product?.name}</td>
                  ) : null}
                  {isColVisible("discount") ? (
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {discount.discount_type === "percentage"
                        ? `${discount.discount_value}%`
                        : `$${parseFloat(discount.discount_value).toFixed(2)}`}
                    </td>
                  ) : null}
                  {isColVisible("originalPrice") ? (
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {discount.product?.price != null
                        ? `$${parseFloat(discount.product.price).toFixed(2)}`
                        : "—"}
                    </td>
                  ) : null}
                  {isColVisible("salePrice") ? (
                    <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">
                      ${parseFloat(discount.sale_price).toFixed(2)}
                    </td>
                  ) : null}
                  {isColVisible("startDate") ? (
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {new Date(discount.start_date).toLocaleDateString()}
                    </td>
                  ) : null}
                  {isColVisible("endDate") ? (
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {new Date(discount.end_date).toLocaleDateString()}
                    </td>
                  ) : null}
                  {isColVisible("status") ? (
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleActive([discount.id], !discount.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          discount.is_active
                            ? "bg-[rgba(var(--admin-primary-rgb),0.14)] text-[color:var(--admin-primary)] border-[rgba(var(--admin-primary-rgb),0.4)] dark:bg-[rgba(var(--admin-primary-rgb),0.22)] dark:text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)]"
                            : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {discount.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                  ) : null}
                  {isColVisible("actions") ? (
                    <td className="px-4 py-2 flex gap-2">
                      <button
                        onClick={() => handleEdit(discount)}
                        className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(discount.id)}
                        className="transition-colors"
                        style={deleteButtonStyle}
                        aria-label="Delete discount"
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
          <div className="p-4 text-center text-slate-500 dark:text-slate-400">No discounts found</div>
        )}
      </div>
    </div>
  );
}
