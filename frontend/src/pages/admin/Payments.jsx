import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { errorAlert, toastSuccess, warningConfirm } from "../../lib/swal";
import AdminModal from "../../components/admin/AdminModal.jsx";
import { AdminSectionLoader, AdminContentSkeleton } from "@/components/admin/AdminLoading";
import {
  buildAllColumnsVisibility,
  loadTableColumnVisibility,
  TableColumnVisibilityMenu,
} from "../../components/admin/TableColumnVisibilityMenu.jsx";
import { useTheme } from "../../state/theme.jsx";
import AdminListQueryToolbar from "../../components/admin/AdminListQueryToolbar.jsx";
import {
  ADMIN_LIST_PAGINATE_AT,
  PAYMENT_METHOD_FILTER_OPTIONS,
  PAYMENT_STATUS_FILTER_OPTIONS,
} from "../../lib/adminListQuery.js";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";

const PAYMENTS_TABLE_COLUMNS = [
  { id: "id", label: "ID" },
  { id: "order", label: "Order" },
  { id: "customer", label: "Customer" },
  { id: "amount", label: "Amount" },
  { id: "method", label: "Method" },
  { id: "status", label: "Status" },
  { id: "date", label: "Date" },
  { id: "actions", label: "Actions" },
];

const PAYMENTS_COLUMNS_STORAGE_KEY = "fitandsleek-payments-columns";
const PAYMENTS_PER_PAGE = 15;

export default function AdminPayments() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewPayments = can("payments", "view");
  const canEditPayments = can("payments", "edit");
  const { mode } = useTheme();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useAdminUiPreference("payments.list.search", "");
  const [statusFilter, setStatusFilter] = useAdminUiPreference("payments.list.status", "all");
  const [methodFilter, setMethodFilter] = useAdminUiPreference("payments.list.method", "all");
  const [fromDate, setFromDate] = useAdminUiPreference("payments.list.fromDate", "");
  const [toDate, setToDate] = useAdminUiPreference("payments.list.toDate", "");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(() =>
    loadTableColumnVisibility(PAYMENTS_COLUMNS_STORAGE_KEY, PAYMENTS_TABLE_COLUMNS),
  );

  const hasDateRangeFilter = Boolean(fromDate || toDate);

  const loadPayments = useCallback(async (page = 1) => {
    if (!canViewPayments) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (methodFilter !== "all") params.append("method", methodFilter);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      params.append("page", page);
      params.append("per_page", PAYMENTS_PER_PAGE);

      const { data } = await api.get(`/admin/payments?${params}`);
      const paginator = data?.data;
      setPayments(paginator?.data || []);
      setTotalPages(paginator?.last_page || 1);
      setTotalItems(paginator?.total || 0);
      setCurrentPage(paginator?.current_page || page);
    } catch (e) {
      console.error("Failed to load payments", e);
    } finally {
      setLoading(false);
    }
  }, [canViewPayments, statusFilter, methodFilter, fromDate, toDate]);

  useEffect(() => {
    if (!permissionsReady) return;
    loadPayments(1);
  }, [loadPayments, permissionsReady]);

  useEffect(() => {
    try {
      localStorage.setItem(PAYMENTS_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
    } catch {
      /* ignore quota */
    }
  }, [columnVisibility]);

  const isColVisible = (columnId) => columnVisibility[columnId] !== false;

  const toggleTableColumn = (columnId) => {
    setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
  };

  const setAllTableColumnsVisible = (visible) => {
    setColumnVisibility(buildAllColumnsVisibility(PAYMENTS_TABLE_COLUMNS, visible, "id"));
  };

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMethodFilter("all");
    setFromDate("");
    setToDate("");
  };

  const handleVerify = async (payment) => {
    if (!canEditPayments) return;
    const confirmRes = await warningConfirm({
      enTitle: "Verify payment?",
      enText: `Mark payment #${payment.id} as successful? Customers will see a completed status.`,
      enConfirm: "Verify",
      intent: "primary",
    });
    if (!confirmRes.isConfirmed) return;
    try {
      await api.post(`/admin/payments/${payment.id}/verify`);
      loadPayments(currentPage);
      setShowDetails(false);
      setSelectedPayment(null);
      await toastSuccess({
        khText: "បានបញ្ជាក់ការទូទាត់ដោយជោគជ័យ",
        enText: "Payment verified successfully",
      });
    } catch (e) {
      console.error("Failed to verify payment", e);
      await errorAlert({
        khTitle: "បញ្ជាក់ការទូទាត់បរាជ័យ",
        enTitle: "Verification failed",
        detail: "Failed to verify payment: " + (e.response?.data?.message || e.message),
      });
    }
  };

  const handleReject = async (payment) => {
    if (!canEditPayments) return;
    const confirmRes = await warningConfirm({
      enTitle: "Reject payment?",
      enText: `Mark payment #${payment.id} as failed? This may affect fulfillment.`,
      enConfirm: "Reject",
      intent: "destructive",
    });
    if (!confirmRes.isConfirmed) return;
    try {
      await api.post(`/admin/payments/${payment.id}/reject`);
      loadPayments(currentPage);
      setShowDetails(false);
      setSelectedPayment(null);
      await toastSuccess({
        khText: "បានបដិសេធការទូទាត់ដោយជោគជ័យ",
        enText: "Payment rejected successfully",
      });
    } catch (e) {
      console.error("Failed to reject payment", e);
      await errorAlert({
        khTitle: "បដិសេធការទូទាត់បរាជ័យ",
        enTitle: "Rejection failed",
        detail: "Failed to reject payment: " + (e.response?.data?.message || e.message),
      });
    }
  };

  const showPaymentDetails = async (payment) => {
    if (!canViewPayments) return;
    try {
      const { data } = await api.get(`/admin/payments/${payment.id}`);
      setSelectedPayment(data.data);
      setShowDetails(true);
    } catch (e) {
      console.error("Failed to fetch payment details", e);
    }
  };

  const closePaymentDetails = () => {
    setShowDetails(false);
    setSelectedPayment(null);
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    const isDark = mode === "dark";
    if (s === "success" || s === "paid")
      return {
        backgroundColor: isDark ? "#14532d" : "#dcfce7",
        color: isDark ? "#bbf7d0" : "#166534",
        borderColor: isDark ? "#16a34a" : "#86efac",
      };
    if (s === "pending")
      return {
        backgroundColor: isDark ? "#422006" : "#fef9c3",
        color: isDark ? "#fcd34d" : "#854d0e",
        borderColor: isDark ? "#f59e0b" : "#fde68a",
      };
    if (s === "failed")
      return {
        backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
        color: isDark ? "#fecdd3" : "#991b1b",
        borderColor: isDark ? "#f87171" : "#fecaca",
      };
    if (s === "refunded")
      return {
        backgroundColor: isDark ? "#0f172a" : "#dbeafe",
        color: isDark ? "#bfdbfe" : "#1d4ed8",
        borderColor: isDark ? "#38bdf8" : "#bfdbfe",
      };
    return {
      backgroundColor: isDark ? "#334155" : "#f1f5f9",
      color: isDark ? "#e2e8f0" : "#0f172a",
      borderColor: isDark ? "#475569" : "#cbd5e1",
    };
  };

  const formatAmount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(2) : "0.00";
  };

  const getMethodBadge = (method) => {
    const methodMap = {
      card: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
      bank: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
      wallet:
        "bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.18)] dark:text-[color:var(--admin-primary)]",
      crypto: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
      bakong_khqr: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
    };
    return methodMap[method] || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100";
  };

  const filteredPayments = payments.filter((payment) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(payment.id || "").toLowerCase().includes(q) ||
      String(payment.order?.order_number || "").toLowerCase().includes(q) ||
      String(payment.order?.user?.name || "").toLowerCase().includes(q) ||
      String(payment.method || "").toLowerCase().includes(q) ||
      String(payment.status || "").toLowerCase().includes(q)
    );
  });

  if (!permissionsReady || (loading && payments.length === 0)) {
    return <AdminContentSkeleton title="Payments" />;
  }

  if (!canViewPayments) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  const showInitialSkeleton = loading && payments.length === 0;
  if (showInitialSkeleton) return <AdminContentSkeleton title="Payments" />;

  return (
    <div className="w-full min-w-0 space-y-5 text-slate-800 dark:text-slate-100">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Payments Management</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          View and manage all payment transactions
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">All payments</h2>
            <button
              type="button"
              onClick={() => loadPayments(currentPage)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          <AdminListQueryToolbar
            controlsAlign="right"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search ID, order, customer, method…"
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusOptions={PAYMENT_STATUS_FILTER_OPTIONS}
            methodFilter={methodFilter}
            onMethodFilterChange={setMethodFilter}
            methodOptions={PAYMENT_METHOD_FILTER_OPTIONS}
            showingCount={filteredPayments.length}
            totalCount={totalItems}
            hasDateRangeFilter={hasDateRangeFilter}
            fromDate={fromDate}
            onFromDateChange={setFromDate}
            toDate={toDate}
            onToDateChange={setToDate}
            onClearFilters={clearAllFilters}
          />
        </div>

        <div className="relative">
          {loading ? <AdminSectionLoader rows={6} className="absolute inset-0 z-10 bg-white/70 dark:bg-slate-900/70" /> : null}

          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {totalItems >= ADMIN_LIST_PAGINATE_AT ? (
                <>
                  {filteredPayments.length} on this page
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    {" "}
                    · {totalItems} total
                  </span>
                </>
              ) : totalItems > 0 ? (
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  Showing {totalItems} of {totalItems}
                </span>
              ) : (
                "No payments"
              )}
            </p>
            <TableColumnVisibilityMenu
              columns={PAYMENTS_TABLE_COLUMNS}
              visibility={columnVisibility}
              onToggle={toggleTableColumn}
              onShowAll={() => setAllTableColumnsVisible(true)}
              onHideAll={() => setAllTableColumnsVisible(false)}
            />
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <p>No payments found</p>
              {hasDateRangeFilter ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Only payments within the selected date range are listed. Clear dates to see all payments.
                </p>
              ) : null}
              {search.trim() || hasDateRangeFilter || statusFilter !== "all" || methodFilter !== "all" ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-2 font-semibold text-[color:var(--admin-primary)] hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50/95 text-sm dark:border-slate-800 dark:bg-slate-950/90">
                    <tr>
                      {isColVisible("id") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          ID
                        </th>
                      ) : null}
                      {isColVisible("order") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Order
                        </th>
                      ) : null}
                      {isColVisible("customer") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Customer
                        </th>
                      ) : null}
                      {isColVisible("amount") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Amount
                        </th>
                      ) : null}
                      {isColVisible("method") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Method
                        </th>
                      ) : null}
                      {isColVisible("status") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Status
                        </th>
                      ) : null}
                      {isColVisible("date") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Date
                        </th>
                      ) : null}
                      {isColVisible("actions") ? (
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Actions
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="transition hover:bg-[rgba(var(--admin-primary-rgb),0.06)] dark:hover:bg-[rgba(var(--admin-primary-rgb),0.1)]"
                      >
                        {isColVisible("id") ? (
                          <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                            #{payment.id}
                          </td>
                        ) : null}
                        {isColVisible("order") ? (
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                            {payment.order?.order_number || "N/A"}
                          </td>
                        ) : null}
                        {isColVisible("customer") ? (
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                            {payment.order?.user?.name || "N/A"}
                          </td>
                        ) : null}
                        {isColVisible("amount") ? (
                          <td className="px-6 py-4 text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                            ${formatAmount(payment.amount)}
                          </td>
                        ) : null}
                        {isColVisible("method") ? (
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${getMethodBadge(payment.method)}`}
                            >
                              {payment.method}
                            </span>
                          </td>
                        ) : null}
                        {isColVisible("status") ? (
                          <td className="px-6 py-4 text-sm">
                            <span
                              className="inline-flex rounded-full border px-3 py-1 text-xs font-medium"
                              style={getStatusBadge(payment.status)}
                            >
                              {payment.status}
                            </span>
                          </td>
                        ) : null}
                        {isColVisible("date") ? (
                          <td className="px-6 py-4 text-sm tabular-nums text-slate-500 dark:text-slate-300">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                        ) : null}
                        {isColVisible("actions") ? (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => showPaymentDetails(payment)}
                                title="View details"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </button>
                              {payment.status === "pending" && canEditPayments ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleVerify(payment)}
                                    title="Verify payment"
                                    aria-label="Verify payment"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReject(payment)}
                                    title="Reject payment"
                                    aria-label="Reject payment"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
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
                page={currentPage}
                lastPage={totalPages}
                total={totalItems}
                onPageChange={loadPayments}
              />
            </>
          )}
        </div>
      </div>

      <AdminModal
        open={showDetails && !!selectedPayment}
        onClose={closePaymentDetails}
        title="Payment Details"
        titleId="payment-details-title"
        maxWidthClass="max-w-md"
      >
        {selectedPayment ? (
          <>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Payment ID</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">#{selectedPayment.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Order</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPayment.order?.order_number}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Customer</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPayment.order?.user?.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Amount</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  ${formatAmount(selectedPayment.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Method</p>
                <p className="text-lg capitalize text-slate-900 dark:text-slate-100">{selectedPayment.method}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                <span
                  className="inline-flex rounded-full border px-3 py-1 text-sm font-medium"
                  style={getStatusBadge(selectedPayment.status)}
                >
                  {selectedPayment.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Transaction ID</p>
                <p className="break-all font-mono text-sm text-slate-900 dark:text-slate-100">
                  {selectedPayment.transaction_id || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Date</p>
                <p className="text-sm text-slate-900 dark:text-slate-100">
                  {new Date(selectedPayment.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              {selectedPayment.status === "pending" && canEditPayments ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerify(selectedPayment)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[rgba(var(--admin-primary-rgb),0.4)] px-4 text-sm font-medium text-[color:var(--admin-primary)] transition hover:bg-[rgba(var(--admin-primary-rgb),0.08)] dark:border-[rgba(var(--admin-primary-rgb),0.5)]"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedPayment)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={closePaymentDetails}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}
