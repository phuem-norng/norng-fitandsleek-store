import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import PurchaseOrderCreateForm from "../../components/admin/PurchaseOrderCreateForm.jsx";
import PurchaseOrderDetailDrawer from "../../components/admin/PurchaseOrderDetailDrawer.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import {
  filterAndSortPurchaseOrders,
  formatPoMoney,
  PO_LIST_SORT_OPTIONS,
} from "../../lib/purchaseOrderHelpers.js";
import { sliceAdminListPage } from "../../lib/adminListQuery.js";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import AdminListQueryToolbar from "../../components/admin/AdminListQueryToolbar.jsx";

const PO_STATUS_FILTER_OPTIONS = [
  { id: "all", label: "All statuses" },
  { id: "draft", label: "Draft" },
  { id: "pending", label: "Pending" },
  { id: "received", label: "Received" },
];

/** ISO date for list tables (e.g. 2026-06-03). */
function formatPoListDate(value) {
  if (!value) return "—";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const poActionLinkClass =
  "text-sm font-semibold text-[color:var(--admin-primary)] transition hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline dark:text-[color:var(--admin-primary)]";

const PO_LIST_PER_PAGE = 15;

function PoListActions({ row, onView, onEdit, onDelete, canView, canEdit, canDelete }) {
  const status = row.status || "draft";
  const isDraft = status === "draft";
  const canDeleteRow = canDelete && row.can_delete !== false && isDraft;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {canView ? (
      <button type="button" className={poActionLinkClass} onClick={() => onView(row)}>
        View
      </button>
      ) : null}
      {isDraft && canEdit ? (
        <button type="button" className={poActionLinkClass} onClick={() => onEdit(row)}>
          Edit
        </button>
      ) : null}
      {isDraft && canDeleteRow ? (
        <button
          type="button"
          className={`${poActionLinkClass} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`}
          onClick={() => onDelete(row)}
          title="Delete draft"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

export default function PurchaseOrders() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewPo = can("purchase_orders", "view");
  const canCreatePo = can("purchase_orders", "create");
  const canEditPo = can("purchase_orders", "edit");
  const canDeletePo = can("purchase_orders", "delete");
  const { primaryColor, mode } = useTheme();
  const accentColor = primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [nextPoNumber, setNextPoNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [success, setSuccess] = useState("");
  const [animate, setAnimate] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [listSearch, setListSearch] = useAdminUiPreference("purchaseOrders.list.search", "");
  const [statusFilter, setStatusFilter] = useAdminUiPreference("purchaseOrders.list.statusFilter", "all");
  const [supplierFilter, setSupplierFilter] = useAdminUiPreference("purchaseOrders.list.supplierFilter", "all");
  const [sortBy, setSortBy] = useAdminUiPreference("purchaseOrders.list.sortBy", "order_date");
  const [sortDir, setSortDir] = useAdminUiPreference("purchaseOrders.list.sortDir", "desc");
  const [fromDate, setFromDate] = useAdminUiPreference("purchaseOrders.list.fromDate", "");
  const [toDate, setToDate] = useAdminUiPreference("purchaseOrders.list.toDate", "");
  const [page, setPage] = useState(1);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!canViewPo) {
      setRows([]);
      setSuppliers([]);
      setProducts([]);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setErr("");
    try {
      const [poRes, supplierRes, productRes] = await Promise.all([
        api.get("/admin/purchase-orders", { params: { per_page: 200 } }),
        api.get("/admin/suppliers", { params: { per_page: 500 } }),
        api.get("/admin/products", { params: { per_page: 500 } }),
      ]);
      setRows(Array.isArray(poRes.data?.data) ? poRes.data.data : []);
      setNextPoNumber(poRes.data?.next_po_number || "");
      setSuppliers(Array.isArray(supplierRes.data?.data) ? supplierRes.data.data : []);
      setProducts(Array.isArray(productRes.data?.data) ? productRes.data.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load purchase orders.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [canViewPo]);

  const refreshCatalog = useCallback(() => load({ silent: true }), [load]);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [load, permissionsReady]);

  useEffect(() => {
    if (!success) return undefined;
    setAnimate(true);
    const t = window.setTimeout(() => {
      setAnimate(false);
      setSuccess("");
    }, 3500);
    return () => window.clearTimeout(t);
  }, [success]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.is_active !== false),
    [suppliers],
  );

  const supplierFilterOptions = useMemo(() => {
    const fromRows = new Map();
    for (const row of rows) {
      const id = row.supplier_id ?? row.supplier?.id;
      if (id == null) continue;
      const name = row.supplier?.name || `Supplier #${id}`;
      fromRows.set(String(id), name);
    }
    for (const s of suppliers) {
      fromRows.set(String(s.id), s.name || `Supplier #${s.id}`);
    }
    return Array.from(fromRows.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, suppliers]);

  const hasDateRangeFilter = Boolean(fromDate || toDate);

  const supplierOptions = useMemo(
    () => [
      { id: "all", label: "All suppliers" },
      ...supplierFilterOptions.map((s) => ({ id: s.id, label: s.name })),
    ],
    [supplierFilterOptions],
  );

  const filteredRows = useMemo(
    () =>
      filterAndSortPurchaseOrders(rows, {
        search: listSearch,
        statusFilter,
        supplierFilter,
        sortBy,
        sortDir,
        fromDate,
        toDate,
      }),
    [rows, listSearch, statusFilter, supplierFilter, sortBy, sortDir, fromDate, toDate],
  );

  const listPage = useMemo(() => sliceAdminListPage(filteredRows, page), [filteredRows, page]);
  const { rows: paginatedRows, lastPage, usePagination: poUsePagination } = listPage;

  useEffect(() => {
    setPage(1);
  }, [listSearch, statusFilter, supplierFilter, sortBy, sortDir, fromDate, toDate]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const clearListFilters = useCallback(() => {
    setListSearch("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setFromDate("");
    setToDate("");
  }, [setListSearch, setStatusFilter, setSupplierFilter, setFromDate, setToDate]);

  const closePoForm = () => {
    setShowCreateForm(false);
    setEditingOrder(null);
    setEditFormLoading(false);
  };

  const openCreateForm = () => {
    if (!canCreatePo) return;
    setEditingOrder(null);
    setShowCreateForm(true);
  };

  const openEditForm = async (row) => {
    if (!canEditPo || !row?.id) return;
    setEditingOrder(null);
    setEditFormLoading(true);
    setShowCreateForm(true);
    try {
      const { data } = await api.get(`/admin/purchase-orders/${row.id}`);
      const order = data?.data ?? data;
      if ((order?.status || "draft") !== "draft") {
        closePoForm();
        errorAlert("Only draft purchase orders can be edited.");
        return;
      }
      setEditingOrder(order);
    } catch (e) {
      closePoForm();
      errorAlert(e?.response?.data?.message || "Could not load purchase order for editing.");
    } finally {
      setEditFormLoading(false);
    }
  };

  const openOrderDetail = async (row) => {
    if (!canViewPo) return;
    setViewOrder(row);
    try {
      const { data } = await api.get(`/admin/purchase-orders/${row.id}`);
      if (data?.data) setViewOrder(data.data);
    } catch {
      /* keep list row data */
    }
  };

  const handlePoFormSuccess = (order) => {
    const wasEdit = Boolean(editingOrder?.id);
    const po = order?.po_number || "";
    const msg = wasEdit
      ? po
        ? `Purchase order ${po} updated.`
        : "Purchase order updated."
      : po
        ? `Purchase order ${po} created as draft. Mark as received when stock arrives.`
        : "Purchase order created as draft.";
    setSuccess(msg);
    toastSuccess(msg);
    closePoForm();
    refreshCatalog();
    if (order?.id) {
      setViewOrder(order);
    }
  };

  const handleOrderUpdated = (order) => {
    if (!order?.id) return;
    setViewOrder(order);
    setRows((prev) => prev.map((r) => (r.id === order.id ? { ...r, ...order } : r)));
    load({ silent: true });
  };

  const requestDelete = (row) => {
    if (!canDeletePo || !row?.id) return;
    setPendingDeleteId(row.id);
  };

  const confirmDelete = async () => {
    if (!canDeletePo || !pendingDeleteId || isDeleting) return;
    setIsDeleting(true);
    loadingAlert("Deleting…");
    try {
      await api.delete(`/admin/purchase-orders/${pendingDeleteId}`);
      closeSwal();
      setPendingDeleteId(null);
      setViewOrder((current) => (current?.id === pendingDeleteId ? null : current));
      setSuccess("Purchase order deleted.");
      await load();
    } catch (e) {
      closeSwal();
      errorAlert(e?.response?.data?.message || "Could not delete purchase order.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!permissionsReady || (loading && rows.length === 0)) {
    return <AdminContentSkeleton rows={6} />;
  }

  if (!canViewPo) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  if (loading) {
    return <AdminContentSkeleton rows={6} />;
  }

  return (
    <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
      <div
        className={`fixed top-6 right-6 z-50 transition-all duration-500 ease-out transform ${animate ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          }`}
      >
        {success ? (
          <div className="bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{success}</span>
          </div>
        ) : null}
      </div>

      <div className="w-full min-w-0 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Purchase Orders</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Create draft POs from suppliers; stock increases only when marked as received.
            </p>
          </div>
          {canCreatePo ? (
          <button
            type="button"
            onClick={openCreateForm}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${accentIsWhite ? "border border-slate-300 text-slate-900" : "text-white"
              }`}
            style={{ backgroundColor: accentIsWhite ? "#FFFFFF" : accentColor }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add purchase order
          </button>
          ) : null}
        </div>

        {err ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-100 flex items-center gap-3">
            <span className="flex-1">{err}</span>
            <button type="button" onClick={load} className="font-semibold underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        ) : null}

        <div className="admin-surface rounded-xl border admin-border overflow-hidden">
          <div className="border-b admin-border px-5 py-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">All purchase orders</h2>
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
            <AdminListQueryToolbar
              search={listSearch}
              onSearchChange={setListSearch}
              searchPlaceholder="Search PO number, supplier, created by…"
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              statusOptions={PO_STATUS_FILTER_OPTIONS}
              supplierFilter={supplierFilter}
              onSupplierFilterChange={setSupplierFilter}
              supplierOptions={supplierOptions}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortOptions={PO_LIST_SORT_OPTIONS}
              sortDir={sortDir}
              onSortDirChange={setSortDir}
              showingCount={poUsePagination ? paginatedRows.length : filteredRows.length}
              totalCount={filteredRows.length}
              hasDateRangeFilter={hasDateRangeFilter}
              fromDate={fromDate}
              onFromDateChange={setFromDate}
              toDate={toDate}
              onToDateChange={setToDate}
              onClearFilters={clearListFilters}
            />
          </div>

          {rows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <svg className="h-8 w-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-slate-700 dark:text-slate-200">No purchase orders yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create your first purchase order to track supplier buying.
              </p>
              {canCreatePo ? (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Add purchase order
              </button>
              ) : null}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <p className="font-medium text-slate-700 dark:text-slate-200">No purchase orders match your filters</p>
              {hasDateRangeFilter ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Only orders within the selected date range are listed. Clear dates to see all orders.
                </p>
              ) : null}
              <button
                type="button"
                onClick={clearListFilters}
                className="mt-3 font-semibold text-[color:var(--admin-primary)] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">PO number</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Order Date</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Created By</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginatedRows.map((row) => {
                    const status = row.status || "draft";
                    return (
                      <tr
                        key={row.id}
                        className={
                          viewOrder?.id === row.id
                            ? "bg-slate-100/80 dark:bg-slate-800/60"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        }
                      >
                        <td className="px-5 py-3.5 font-mono text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                          {row.po_number}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                          {row.supplier?.name || "—"}
                        </td>
                        <td className="px-5 py-3.5 lowercase text-slate-700 dark:text-slate-200">{status}</td>
                        <td className="px-5 py-3.5 tabular-nums text-slate-700 dark:text-slate-200">
                          {formatPoListDate(row.order_date)}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                          {formatPoMoney(row.total_cost)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200">
                          {row.purchaser?.trim() || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <PoListActions
                            row={row}
                            onView={openOrderDetail}
                            onEdit={openEditForm}
                            onDelete={requestDelete}
                            canView={canViewPo}
                            canEdit={canEditPo}
                            canDelete={canDeletePo}
                          />
                        </td>
                      </tr>
                    );
                  })}
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

      <AdminModal
        open={showCreateForm}
        onClose={closePoForm}
        title={editingOrder ? "Edit purchase order" : "Add purchase order"}
        maxWidthClass="max-w-6xl"
      >
        {editFormLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Loading purchase order…
          </div>
        ) : (
          <PurchaseOrderCreateForm
            key={editingOrder?.id ?? "create"}
            orderToEdit={editingOrder}
            suppliers={activeSuppliers}
            products={products}
            nextPoNumber={nextPoNumber}
            onCatalogRefresh={refreshCatalog}
            onCancel={closePoForm}
            onSuccess={handlePoFormSuccess}
          />
        )}
      </AdminModal>

      <PurchaseOrderDetailDrawer
        order={viewOrder}
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        onUpdated={handleOrderUpdated}
      />

      <AdminConfirmDialog
        open={!!pendingDeleteId}
        onClose={() => !isDeleting && setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete purchase order?"
        message="This permanently removes the draft purchase order and its line items."
        confirmLabel="Delete"
        destructive
        busy={isDeleting}
      />
    </div>
  );
}
