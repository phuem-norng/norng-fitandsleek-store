import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import AdminListQueryToolbar from "../../components/admin/AdminListQueryToolbar.jsx";
import SupplierFormFields from "../../components/admin/SupplierFormFields.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { pushAdminModalChrome, popAdminModalChrome } from "../../lib/adminDarkChrome.js";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import {
  filterAndSortSuppliers,
  sliceAdminListPage,
  SUPPLIER_LIST_SORT_OPTIONS,
} from "../../lib/adminListQuery.js";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";

const emptyForm = {
  supplier_code: "",
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  is_active: true,
};

function formatLocation(row) {
  const parts = [row.city, row.country].filter(Boolean);
  if (row.address && parts.length) return `${row.address} · ${parts.join(", ")}`;
  if (row.address) return row.address;
  if (parts.length) return parts.join(", ");
  return "—";
}

function supplierCanDelete(row) {
  return row?.can_delete !== false;
}

function supplierDeleteBlockReason(row) {
  if (supplierCanDelete(row)) return "";
  const parts = [];
  const poCount = Number(row?.purchase_order_count) || 0;
  const productCount = Number(row?.product_count) || 0;
  if (poCount > 0) parts.push(`${poCount} purchase order${poCount === 1 ? "" : "s"}`);
  if (productCount > 0) parts.push(`${productCount} product${productCount === 1 ? "" : "s"}`);
  return `Linked to ${parts.join(" and ")}`;
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 text-sm text-slate-800 dark:text-slate-100 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function SupplierDetailDrawer({ supplier, open, onClose }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    pushAdminModalChrome();
    const onKey = (ev) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      popAdminModalChrome();
    };
  }, [open, onClose]);

  if (!open || !supplier) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex justify-end">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200/90 bg-white shadow-2xl dark:border-slate-700/90 dark:bg-slate-900"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 px-5 py-4 dark:border-slate-700/90">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Supplier Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Supplier ID" value={supplier.supplier_code} mono />
              <DetailRow label="Status" value={supplier.is_active ? "Active" : "Inactive"} />
            </div>
            <DetailRow label="Supplier name" value={supplier.name} />
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">
              Contact
            </h3>
            <DetailRow label="Contact person" value={supplier.contact_person} />
            <DetailRow label="Phone" value={supplier.phone} />
            <DetailRow label="Email" value={supplier.email} />
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">
              Location
            </h3>
            <DetailRow label="Address" value={supplier.address} />
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="City" value={supplier.city} />
              <DetailRow label="Country" value={supplier.country} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">
              Record
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow
                label="Created"
                value={supplier.created_at ? new Date(supplier.created_at).toLocaleString() : "—"}
              />
              <DetailRow
                label="Updated"
                value={supplier.updated_at ? new Date(supplier.updated_at).toLocaleString() : "—"}
              />
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body
  );
}

export default function AdminSuppliers() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewSuppliers = can("suppliers", "view");
  const canCreateSupplier = can("suppliers", "create");
  const canEditSupplier = can("suppliers", "edit");
  const canDeleteSupplier = can("suppliers", "delete");
  const { primaryColor, mode } = useTheme();
  const accentColor = primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
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
  const [nextSupplierCode, setNextSupplierCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [animate, setAnimate] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useAdminUiPreference("suppliers.list.search", "");
  const [statusFilter, setStatusFilter] = useAdminUiPreference("suppliers.list.statusFilter", "all");
  const [sortBy, setSortBy] = useAdminUiPreference("suppliers.list.sortBy", "name");
  const [sortDir, setSortDir] = useAdminUiPreference("suppliers.list.sortDir", "asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [page, setPage] = useState(1);

  const getValidationMessage = (error) => {
    const responseMessage = error?.response?.data?.message;
    const errors = error?.response?.data?.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors).flat().find(Boolean);
      return first || responseMessage || "Validation failed.";
    }
    return responseMessage || error?.message || "Request failed.";
  };

  const extractErr = (e) => e?.response?.data?.message || getValidationMessage(e) || "Failed to load/save data.";

  const duplicateCodeMessage = "This Supplier ID is already in use. Please choose a different one.";

  const isDuplicateSupplierCode = (code, ignoreId = null) => {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return false;
    return rows.some(
      (s) => s.id !== ignoreId && String(s.supplier_code || "").trim().toUpperCase() === normalized
    );
  };

  const createCodeError = isDuplicateSupplierCode(form.supplier_code) ? duplicateCodeMessage : "";
  const editCodeError = editing && isDuplicateSupplierCode(editing.supplier_code, editing.id) ? duplicateCodeMessage : "";

  const payloadFromValues = (values) => ({
    supplier_code: values.supplier_code?.trim() || "",
    name: values.name.trim(),
    contact_person: values.contact_person?.trim() || null,
    email: values.email.trim(),
    phone: values.phone.trim(),
    address: values.address?.trim() || null,
    city: values.city?.trim() || null,
    country: values.country?.trim() || null,
    is_active: !!values.is_active,
  });

  const load = useCallback(async () => {
    if (!canViewSuppliers) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/admin/suppliers");
      setRows(data?.data || []);
      setNextSupplierCode(data?.next_supplier_code || "");
      setErr("");
    } catch (e2) {
      setErr(extractErr(e2));
    } finally {
      setLoading(false);
    }
  }, [canViewSuppliers]);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [load, permissionsReady]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((s) => s.id === id)));
  }, [rows]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setAnimate(true);
    setTimeout(() => {
      setAnimate(false);
      setTimeout(() => setSuccess(""), 300);
    }, 2500);
  };

  const openCreateForm = async () => {
    if (!canCreateSupplier) return;
    setCreateError("");
    try {
      const { data } = await api.get("/admin/suppliers");
      const code = data?.next_supplier_code || nextSupplierCode || "";
      setNextSupplierCode(code);
      setForm({ ...emptyForm, supplier_code: code });
    } catch {
      setForm({ ...emptyForm, supplier_code: nextSupplierCode });
    }
    setShowCreateForm(true);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!canCreateSupplier || isCreating) return;
    setErr("");
    setCreateError("");
    if (isDuplicateSupplierCode(form.supplier_code)) {
      setCreateError(duplicateCodeMessage);
      return;
    }
    setIsCreating(true);
    loadingAlert({
      khTitle: "កំពុងបង្កើតអ្នកផ្គត់ផ្គង់",
      enTitle: "Creating supplier",
      khText: "សូមរង់ចាំបន្តិច",
      enText: "Please wait",
    });
    try {
      const response = await api.post("/admin/suppliers", payloadFromValues(form));
      if (![200, 201].includes(response?.status)) {
        throw new Error("Create failed.");
      }
      closeSwal();
      setForm(emptyForm);
      setShowCreateForm(false);
      await toastSuccess({
        khText: "បានបង្កើតអ្នកផ្គត់ផ្គង់ដោយជោគជ័យ",
        enText: "Supplier created successfully!",
      });
      await load();
    } catch (e2) {
      closeSwal();
      const detail = getValidationMessage(e2);
      setErr(detail);
      setCreateError(detail);
      await errorAlert({
        khTitle: "បង្កើតអ្នកផ្គត់ផ្គង់បរាជ័យ",
        enTitle: "Create failed",
        detail,
      });
    } finally {
      closeSwal();
      setIsCreating(false);
    }
  };

  const startEdit = (row) => {
    if (!canEditSupplier) return;
    setViewSupplier(null);
    setEditing({ ...row });
  };

  const openSupplierDetails = (row) => {
    if (!canViewSuppliers) return;
    setViewSupplier(row);
  };

  const saveEdit = async () => {
    if (!canEditSupplier || !editing?.id) return;
    setErr("");
    if (isDuplicateSupplierCode(editing.supplier_code, editing.id)) {
      setErr(duplicateCodeMessage);
      return;
    }
    try {
      await api.patch(`/admin/suppliers/${editing.id}`, payloadFromValues(editing));
      setEditing(null);
      showSuccess("Supplier updated successfully!");
      await load();
    } catch (e2) {
      setErr(extractErr(e2));
    }
  };

  const del = (id) => {
    if (!canDeleteSupplier) return;
    setViewSupplier((prev) => (prev?.id === id ? null : prev));
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!canDeleteSupplier) return;
    setDeleteBusy(true);
    setErr("");
    try {
      if (pendingBulkDelete) {
        const ids = selectedIds.filter((id) => supplierCanDelete(rows.find((s) => s.id === id)));
        const deleted = [];
        const blocked = [];

        for (const id of ids) {
          try {
            await api.delete(`/admin/suppliers/${id}`);
            deleted.push(id);
          } catch (e2) {
            const row = rows.find((s) => s.id === id);
            blocked.push(row?.name || row?.supplier_code || `#${id}`);
          }
        }

        setSelectedIds((prev) => prev.filter((id) => !deleted.includes(id)));

        if (deleted.length > 0) {
          showSuccess(
            deleted.length === 1
              ? "Supplier deleted successfully!"
              : `${deleted.length} supplier(s) deleted successfully!`,
          );
        }
        if (blocked.length > 0) {
          setErr(
            blocked.length === 1
              ? `Could not delete ${blocked[0]} because it is linked to purchase orders or products.`
              : `Could not delete ${blocked.length} supplier(s) because they are linked to purchase orders or products.`,
          );
        }
      } else if (pendingDeleteId != null) {
        const row = rows.find((s) => s.id === pendingDeleteId);
        if (!supplierCanDelete(row)) {
          setErr(supplierDeleteBlockReason(row) || "This supplier cannot be deleted.");
          return;
        }
        await api.delete(`/admin/suppliers/${pendingDeleteId}`);
        showSuccess("Supplier deleted successfully!");
        if (editing?.id === pendingDeleteId) setEditing(null);
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

  const filteredRows = useMemo(
    () => filterAndSortSuppliers(rows, { search, statusFilter, sortBy, sortDir }),
    [rows, search, statusFilter, sortBy, sortDir],
  );

  const listPage = useMemo(() => sliceAdminListPage(filteredRows, page), [filteredRows, page]);
  const { rows: paginatedRows, lastPage, usePagination: supplierUsePagination } = listPage;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const supplierStatusOptions = [
    { id: "all", label: "All statuses" },
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
  ];

  const clearListFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const deletablePaginatedRows = useMemo(
    () => paginatedRows.filter((s) => supplierCanDelete(s)),
    [paginatedRows],
  );

  const selectedDeletableCount = useMemo(
    () => selectedIds.filter((id) => supplierCanDelete(rows.find((s) => s.id === id))).length,
    [selectedIds, rows],
  );

  const toggleSelect = (id) => {
    const row = rows.find((s) => s.id === id);
    if (!supplierCanDelete(row)) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allSelected =
    deletablePaginatedRows.length > 0
    && deletablePaginatedRows.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const pageIds = new Set(deletablePaginatedRows.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    const next = new Set(selectedIds);
    deletablePaginatedRows.forEach((s) => next.add(s.id));
    setSelectedIds(Array.from(next));
  };

  const deleteSelected = () => {
    if (!canDeleteSupplier || selectedIds.length === 0) return;
    setPendingBulkDelete(true);
  };

  if (!permissionsReady || (loading && rows.length === 0)) {
    return <AdminContentSkeleton lines={3} imageHeight={200} className="mt-4" />;
  }

  if (!canViewSuppliers) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  if (loading) return <AdminContentSkeleton lines={3} imageHeight={200} className="mt-4" />;

  return (
    <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
      <div
        className={`fixed top-6 right-6 z-50 transition-all duration-500 ease-out transform ${
          animate ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }`}
      >
        {success && (
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{success}</span>
          </div>
        )}
      </div>

      <div className="w-full min-w-0">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 dark:text-white mb-2">Suppliers</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Manage vendor contacts for stock receiving and purchasing
            </p>
          </div>
          {canCreateSupplier ? (
          <button
            onClick={openCreateForm}
            className={`px-6 py-3 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${
              accentIsWhite ? "border border-slate-300" : "text-white"
            }`}
            style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Supplier
          </button>
          ) : null}
        </div>

        {err && (
          <div className="mb-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-red-700 dark:text-red-100 font-medium">{err}</span>
            <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600" type="button">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">All Suppliers</h2>
              <div className="flex flex-wrap items-center gap-3">
                {canDeleteSupplier ? (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-0"
                  />
                  Select all
                </label>
                ) : null}
                {canDeleteSupplier && selectedDeletableCount > 0 ? (
                  <button type="button" onClick={deleteSelected} style={deleteButtonStyle} className="transition-all">
                    Delete Selected ({selectedDeletableCount})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={load}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>
            </div>
            <AdminListQueryToolbar
              controlsAlign="right"
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search name, ID, email, phone, location…"
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              statusOptions={supplierStatusOptions}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortOptions={SUPPLIER_LIST_SORT_OPTIONS}
              sortDir={sortDir}
              onSortDirChange={setSortDir}
              showingCount={supplierUsePagination ? paginatedRows.length : filteredRows.length}
              totalCount={filteredRows.length}
              onClearFilters={clearListFilters}
            />
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-slate-500 dark:text-slate-300">No suppliers yet.</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-300">
              <p>No suppliers match your filters.</p>
              <button
                type="button"
                onClick={clearListFilters}
                className="mt-2 font-semibold text-[color:var(--admin-primary)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-sm text-slate-500 dark:text-slate-400">
                  <tr>
                    {canDeleteSupplier ? <th className="px-6 py-4 w-10" /> : null}
                    <th className="px-6 py-4">Supplier ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Status</th>
                    {(canEditSupplier || canDeleteSupplier) ? (
                    <th className="px-6 py-4 text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedRows.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => openSupplierDetails(s)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        viewSupplier?.id === s.id ? "bg-slate-100/80 dark:bg-slate-800/60" : ""
                      }`}
                    >
                      {canDeleteSupplier ? (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          disabled={!supplierCanDelete(s)}
                          title={supplierDeleteBlockReason(s) || undefined}
                          className="h-4 w-4 rounded border-slate-300 disabled:opacity-40 dark:border-slate-600 text-slate-900 focus:ring-0"
                        />
                      </td>
                      ) : null}
                      <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-slate-300">
                        {s.supplier_code || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</div>
                        {!supplierCanDelete(s) ? (
                          <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            {supplierDeleteBlockReason(s)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{s.contact_person || "—"}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{s.email || "—"}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">{s.phone || "—"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                        {formatLocation(s)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="text-xs px-2 py-1 rounded-full border font-semibold"
                          style={
                            s.is_active
                              ? {
                                  backgroundColor: accentIsWhite ? "#0b0b0f" : accentColor,
                                  color: "#FFFFFF",
                                  borderColor: accentIsWhite ? "#cbd5e1" : accentColor,
                                }
                              : {
                                  backgroundColor: mode === "dark" ? "#1f2937" : "#f1f5f9",
                                  color: mode === "dark" ? "#e2e8f0" : "#0f172a",
                                  borderColor: mode === "dark" ? "#334155" : "#cbd5e1",
                                }
                          }
                        >
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {(canEditSupplier || canDeleteSupplier) ? (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {canEditSupplier ? (
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          ) : null}
                          {canDeleteSupplier ? (
                          <button
                            type="button"
                            onClick={() => del(s.id)}
                            disabled={!supplierCanDelete(s)}
                            style={deleteIconButtonStyle}
                            className="transition-all disabled:cursor-not-allowed disabled:opacity-40"
                            title={supplierDeleteBlockReason(s) || "Delete"}
                            aria-label="Delete supplier"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                          ) : null}
                        </div>
                      </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminListPaginationBar
              page={page}
              lastPage={lastPage}
              total={filteredRows.length}
              onPageChange={setPage}
            />
            </>
          )}
        </div>
      </div>

      <SupplierDetailDrawer
        supplier={viewSupplier}
        open={!!viewSupplier}
        onClose={() => setViewSupplier(null)}
      />

      <AdminModal
        open={showCreateForm}
        onClose={() => !isCreating && setShowCreateForm(false)}
        title="Add Supplier"
        size="lg"
      >
        <form onSubmit={create} className="pt-1">
          <SupplierFormFields
            values={form}
            onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
            suggestedCode={nextSupplierCode}
            onRegenerateCode={() => setForm((p) => ({ ...p, supplier_code: nextSupplierCode }))}
            codeError={createCodeError || (createError && String(createError).toLowerCase().includes("supplier") ? createError : "")}
          />
          <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
            {createError ? (
              <div className="mr-auto rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-100">
                {createError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => !isCreating && setShowCreateForm(false)}
              disabled={isCreating}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-50 transition font-semibold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className={`px-6 py-2.5 rounded-lg font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed border text-sm ${
                accentIsWhite ? "border-slate-300" : ""
              }`}
              style={{
                backgroundColor: accentColor,
                color: accentIsWhite ? "#0b0b0f" : "#FFFFFF",
                borderColor: accentIsWhite ? "#cbd5e1" : accentColor,
              }}
            >
              {isCreating ? "Creating..." : "Create Supplier"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal open={!!editing} onClose={() => setEditing(null)} title="Edit Supplier" size="lg">
        {editing ? (
          <>
            <div className="pt-1">
              <SupplierFormFields
                values={editing}
                onChange={(patch) => setEditing((p) => ({ ...p, ...patch }))}
                suggestedCode={editing.supplier_code}
                isEdit
                codeError={editCodeError}
              />
            </div>
            <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-50 transition font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className={`px-6 py-2.5 rounded-lg font-bold transition-all duration-200 border text-sm ${
                  accentIsWhite ? "border-slate-300" : ""
                }`}
                style={{
                  backgroundColor: accentColor,
                  color: accentIsWhite ? "#0b0b0f" : "#FFFFFF",
                  borderColor: accentIsWhite ? "#cbd5e1" : accentColor,
                }}
              >
                Save Changes
              </button>
            </div>
          </>
        ) : null}
      </AdminModal>

      <AdminConfirmDialog
        open={pendingDeleteId != null || pendingBulkDelete}
        onClose={() => {
          if (deleteBusy) return;
          setPendingDeleteId(null);
          setPendingBulkDelete(false);
        }}
        onConfirm={confirmDelete}
        title={pendingBulkDelete ? "Delete selected suppliers?" : "Delete supplier?"}
        message={
          pendingBulkDelete
            ? `This will permanently delete ${selectedDeletableCount} supplier(s). Suppliers linked to purchase orders or products will be skipped.`
            : supplierDeleteBlockReason(rows.find((s) => s.id === pendingDeleteId))
              || "This will permanently delete this supplier."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={deleteBusy}
      />
    </div>
  );
}
