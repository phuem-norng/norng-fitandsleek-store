import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { resolveImageUrl } from "../../lib/images";
import api from "../../lib/api";
import { errorAlert, promptEnglish, toastSuccess, warningConfirm } from "../../lib/swal";
import AdminModal from "../../components/admin/AdminModal.jsx";
import { AdminSectionLoader, AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { useTheme } from "@/state/theme";
import { ReplacementCaseItemsList } from "../../components/ReplacementRequestModal.jsx";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";

function adminPrimaryRgbTriplet() {
 if (typeof document === "undefined") return "107, 126, 115";
 return document.documentElement.style.getPropertyValue("--admin-primary-rgb").trim()
  || getComputedStyle(document.documentElement).getPropertyValue("--admin-primary-rgb").trim()
  || "107, 126, 115";
}

function orderItemQty(orderItem) {
 return Number(orderItem?.qty ?? orderItem?.quantity ?? 1);
}

function orderLineItems(caseItem) {
 return caseItem?.order?.items || [];
}

function hasCaseLineItems(caseItem) {
 return (caseItem?.items || []).length > 0;
}

function emptyLegacyFulfillment(orderItems = []) {
 return Object.fromEntries(
  orderItems.map((item) => [
   item.id,
   {
    selected: false,
    quantity: orderItemQty(item),
    requested_size: "",
    requested_color: "",
    customer_returning: false,
   },
  ]),
 );
}

function caseProductSummary(caseItem) {
 const rows = caseItem?.items || [];
 if (rows.length) {
  return rows
   .map((row) => {
    const orderItem = row.order_item || row.orderItem;
    const name = orderItem?.product?.name || orderItem?.name || "Product";
    return `${name} ×${row.quantity}`;
   })
   .join(", ");
 }
 const orderItems = orderLineItems(caseItem);
 if (!orderItems.length) return "—";
 return orderItems
  .map((item) => {
   const name = item.product?.name || item.name || "Product";
   return `${name} ×${orderItemQty(item)}`;
  })
  .join(", ");
}

export default function AdminReplacementCases() {
 const { user, can, permissionsReady } = useAdminPermissions();
 const canViewReplacements = can("replacements", "view");
 const canEditReplacements = can("replacements", "edit");
 const { mode, primaryColor } = useTheme();
 const [cases, setCases] = useState([]);
 const [loading, setLoading] = useState(true);
 const [filters, setFilters] = useState({ status: "all" });
 const [currentPage, setCurrentPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [selectedCase, setSelectedCase] = useState(null);
 const [showDetails, setShowDetails] = useState(false);
 const [showCompleteForm, setShowCompleteForm] = useState(false);
 const [returnItemIds, setReturnItemIds] = useState({});
 const [legacyFulfillment, setLegacyFulfillment] = useState({});
 const [actionInProgress, setActionInProgress] = useState(false);
 const [search, setSearch] = useState("");

 const loadCases = useCallback(async (page = 1) => {
 if (!canViewReplacements) {
 setCases([]);
 setLoading(false);
 return;
 }
 setLoading(true);
 try {
 const params = new URLSearchParams();
 if (filters.status !== "all") params.append("status", filters.status);
 params.append("page", page);
 params.append("per_page", 15);
 const { data } = await api.get(`/admin/replacement-cases?${params}`);
 setCases(data.data.data || []);
 setTotalPages(data.data.last_page || 1);
 setCurrentPage(page);
 } catch (e) {
 console.error("Failed to load cases", e);
 } finally {
 setLoading(false);
 }
 }, [canViewReplacements, filters.status]);

 useEffect(() => {
 if (!permissionsReady) return;
 loadCases(1);
 }, [loadCases, permissionsReady]);

 const handleApprove = async () => {
 if (!canEditReplacements) return;
 const confirmRes = await warningConfirm({
 enTitle: "Approve this replacement?",
 enText: "The customer will be notified according to your workflow.",
 enConfirm: "Approve",
 intent: "primary",
 });
 if (!confirmRes.isConfirmed) return;
 setActionInProgress(true);
 try {
 const { data } = await api.post(`/admin/replacement-cases/${selectedCase.id}/approve`);
 loadCases(currentPage);
 setSelectedCase(data.data || selectedCase);
 await toastSuccess({ enTitle: "Approved", enText: "Replacement case approved." });
 } catch (e) {
 errorAlert({ enTitle: "Approve failed", detail: e.response?.data?.message || e.message });
 } finally { setActionInProgress(false); }
 };

 const handleReject = async () => {
 if (!canEditReplacements) return;
 const inputRes = await promptEnglish({
 title: "Rejection reason",
 inputPlaceholder: "Briefly explain why this case is rejected…",
 confirmText: "Reject",
 cancelText: "Cancel",
 });
 const reason = inputRes.value?.trim();
 if (!inputRes.isConfirmed || !reason) return;
 setActionInProgress(true);
 try {
 await api.post(`/admin/replacement-cases/${selectedCase.id}/reject`, { notes: reason });
 loadCases(currentPage);
 setShowDetails(false);
 await toastSuccess({ enTitle: "Rejected", enText: "Replacement case rejected." });
 } catch (e) {
 errorAlert({ enTitle: "Reject failed", detail: e.response?.data?.message || e.message });
 } finally { setActionInProgress(false); }
 };

 const handleComplete = async () => {
 if (!canEditReplacements) return;
 const isLegacy = !hasCaseLineItems(selectedCase);
 const orderItems = orderLineItems(selectedCase);
 const payload = {};

 if (isLegacy) {
  const fulfillmentItems = orderItems
   .filter((item) => legacyFulfillment[item.id]?.selected)
   .map((item) => ({
    order_item_id: item.id,
    quantity: Number(legacyFulfillment[item.id]?.quantity || orderItemQty(item)),
    requested_size: legacyFulfillment[item.id]?.requested_size?.trim() || null,
    requested_color: legacyFulfillment[item.id]?.requested_color?.trim() || null,
    customer_returning: !!legacyFulfillment[item.id]?.customer_returning,
   }));
  if (!fulfillmentItems.length) {
   errorAlert({
    enTitle: "Select products",
    enText: "Choose at least one product from the order to send as replacement.",
   });
   return;
  }
  payload.fulfillment_items = fulfillmentItems;
 } else {
  const items = selectedCase?.items || [];
  payload.return_item_ids = items
   .filter((row) => returnItemIds[row.id])
   .map((row) => row.id);
 }

 const confirmRes = await warningConfirm({
 enTitle: "Fulfill this replacement?",
 enText: isLegacy
  ? "You will send the selected product(s) at $0, deduct stock (FIFO), and optionally quarantine returned items."
  : "Stock will be deducted (FIFO), a $0 replacement order will be created, and a shipment will be prepared.",
 enConfirm: "Complete fulfillment",
 intent: "primary",
 });
 if (!confirmRes.isConfirmed) return;
 setActionInProgress(true);
 try {
 const { data } = await api.post(`/admin/replacement-cases/${selectedCase.id}/complete`, payload);
 loadCases(currentPage);
 const updated = data.data || selectedCase;
 setSelectedCase(updated);
 setShowCompleteForm(false);
 setReturnItemIds({});
 setLegacyFulfillment({});
 const replacementNumber = updated.replacement_order?.order_number || updated.replacementOrder?.order_number;
 await toastSuccess({
  enTitle: "Replacement fulfilled",
  enText: replacementNumber
   ? `Replacement order ${replacementNumber} created.`
   : "Case completed successfully.",
 });
 } catch (e) {
 errorAlert({ enTitle: "Complete failed", detail: e.response?.data?.message || e.message });
 } finally { setActionInProgress(false); }
 };

 const openCaseDetails = (caseItem) => {
 setSelectedCase(caseItem);
 setShowDetails(true);
 setShowCompleteForm(false);
 setReturnItemIds({});
 setLegacyFulfillment({});
 };

 const startCompleteForm = () => {
 if (hasCaseLineItems(selectedCase)) {
  const next = {};
  for (const row of selectedCase?.items || []) {
   next[row.id] = false;
  }
  setReturnItemIds(next);
  setLegacyFulfillment({});
 } else {
  setLegacyFulfillment(emptyLegacyFulfillment(orderLineItems(selectedCase)));
  setReturnItemIds({});
 }
 setShowCompleteForm(true);
 };

 const updateLegacyField = (orderItemId, field, value) => {
 setLegacyFulfillment((prev) => ({
  ...prev,
  [orderItemId]: { ...prev[orderItemId], [field]: value },
 }));
 };

 const getStatusStyles = (status) => {
 const isDark = mode === "dark";
 switch (status) {
 case "pending":
 return {
 backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fef3c7",
 color: isDark ? "#fbbf24" : "#92400e",
 borderColor: isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a",
 };
 case "approved":
 return {
 backgroundColor: primaryColor,
 color: "#ffffff",
 borderColor: primaryColor,
 };
 case "rejected":
 return {
 backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
 color: isDark ? "#f87171" : "#991b1b",
 borderColor: isDark ? "rgba(239, 68, 68, 0.4)" : "#fecaca",
 };
 case "completed": {
 const rgb = adminPrimaryRgbTriplet();
 return {
 backgroundColor: isDark ? `rgba(${rgb}, 0.16)` : `rgba(${rgb}, 0.1)`,
 color: primaryColor,
 borderColor: isDark ? `rgba(${rgb}, 0.4)` : `rgba(${rgb}, 0.32)`,
 };
 }
 default:
 return {
 backgroundColor: isDark ? "#161b22" : "#f1f5f9",
 color: isDark ? "#94a3b8" : "#475569",
 borderColor: isDark ? "#334155" : "#e2e8f0",
 };
 }
 };

 const filteredCases = cases.filter((c) => {
 const q = search.trim().toLowerCase();
 if (!q) return true;
 const productText = caseProductSummary(c).toLowerCase();
 return (
 String(c.id || "").toLowerCase().includes(q) ||
 String(c.order?.order_number || c.order_id || "").toLowerCase().includes(q) ||
 String(c.order?.user?.name || "").toLowerCase().includes(q) ||
 productText.includes(q)
 );
 });

 if (!permissionsReady || (loading && cases.length === 0)) {
 return <AdminContentSkeleton title="Replacement Cases" />;
 }

 if (!canViewReplacements) {
 return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
 }

 const showInitialSkeleton = loading && cases.length === 0;
 if (showInitialSkeleton) return <AdminContentSkeleton title="Replacement Cases" />;

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <div className="w-full min-w-0">
 <div className="mb-8">
 <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Replacement Cases</h1>
 <p className="text-slate-500 dark:text-slate-400">Manage customer replacement requests</p>
 </div>

 <div className="admin-surface border admin-border rounded-xl p-6 mb-6 ">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div>
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Status</label>
 <select
 value={filters.status}
 onChange={(e) => setFilters({ ...filters, status: e.target.value })}
 className="w-full px-4 py-2 border admin-border admin-surface rounded-lg focus:outline-none dark:text-white"
 >
 <option value="all">All Statuses</option>
 <option value="pending">Pending</option>
 <option value="approved">Approved</option>
 <option value="rejected">Rejected</option>
 <option value="completed">Completed</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Search</label>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search ID, Order #, customer, product..."
 className="w-full px-4 py-2 border admin-border admin-surface rounded-lg focus:outline-none dark:text-white"
 />
 </div>
 <div className="flex items-end">
 <button onClick={() => {setSearch(""); setFilters({status: "all"});}} className="w-full px-4 py-2 border admin-border rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition dark:text-white">Reset</button>
 </div>
 </div>
 </div>

 <div className="admin-surface border admin-border rounded-xl overflow-hidden ">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-slate-50 dark:bg-slate-800/50 border-b admin-border">
 <tr>
 <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
 <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Order</th>
 <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
 <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Products</th>
 <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
 <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
 <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
 {filteredCases.map((caseItem) => (
 <tr key={caseItem.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
 <td className="px-6 py-4 font-medium tabular-nums dark:text-white">#{caseItem.id}</td>
 <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{caseItem.order?.order_number || `#${caseItem.order_id}`}</td>
 <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{caseItem.order?.user?.name || "N/A"}</td>
 <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-xs">
 <div className="flex items-center gap-2">
 {(caseItem.items || []).slice(0, 3).map((row) => {
  const orderItem = row.order_item || row.orderItem;
  const product = orderItem?.product;
  return product?.image_url ? (
   <div key={row.id} className="h-8 w-8 rounded border admin-border overflow-hidden shrink-0">
    <img src={resolveImageUrl(product.image_url)} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} />
   </div>
  ) : null;
 })}
 <span className="text-sm line-clamp-2">{caseProductSummary(caseItem)}</span>
 </div>
 </td>
 <td className="px-6 py-4 text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={caseItem.reason}>{caseItem.reason}</td>
 <td className="px-6 py-4">
 <span
 style={getStatusStyles(caseItem.status)}
 className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border"
 >
 {caseItem.status}
 </span>
 </td>
 <td className="px-6 py-4 text-right">
 <button onClick={() => openCaseDetails(caseItem)} className="px-3 py-1.5 border admin-border rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 dark:text-white">Details</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <AdminModal
 open={showDetails && !!selectedCase}
 onClose={() => setShowDetails(false)}
 title="Case Details"
 titleId="replacement-case-details-title"
 maxWidthClass="max-w-2xl"
 >
 {selectedCase ? (
 <>
 <div className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
   <label className="text-xs leading-tight font-semibold uppercase tracking-wide text-slate-400">Order</label>
   <p className="text-slate-700 dark:text-slate-300 mt-1 font-medium">{selectedCase.order?.order_number || `#${selectedCase.order_id}`}</p>
  </div>
  <div>
   <label className="text-xs leading-tight font-semibold uppercase tracking-wide text-slate-400">Customer</label>
   <p className="text-slate-700 dark:text-slate-300 mt-1 font-medium">{selectedCase.order?.user?.name || "N/A"}</p>
   {selectedCase.order?.user?.email ? (
    <p className="text-sm text-slate-500">{selectedCase.order.user.email}</p>
   ) : null}
  </div>
 </div>

 <div className="flex justify-between border-b admin-border pb-2">
 <span className="text-slate-500 text-sm">Status</span>
 <span style={getStatusStyles(selectedCase.status)} className="px-3 py-0.5 rounded-full text-xs leading-tight font-semibold uppercase tracking-wide border">
 {selectedCase.status}
 </span>
 </div>

 <div>
 <label className="text-xs leading-tight font-semibold uppercase tracking-wide text-slate-400">Items to Replace</label>
 <div className="mt-2">
  <ReplacementCaseItemsList caseItem={selectedCase} />
 </div>
 </div>

 <div>
 <label className="text-xs leading-tight font-semibold uppercase tracking-wide text-slate-400">Reason</label>
 <p className="text-slate-700 dark:text-slate-300 mt-1 italic">"{selectedCase.reason}"</p>
 </div>

 {selectedCase.notes && (
 <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900">
 <label className="text-xs leading-tight font-semibold uppercase tracking-wide text-amber-600">Admin Notes</label>
 <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{selectedCase.notes}</p>
 </div>
 )}

 {(selectedCase.replacement_order || selectedCase.replacementOrder) && (
 <div className="p-3 rounded-lg border admin-border bg-slate-50 dark:bg-white/5">
  <label className="text-xs leading-tight font-semibold uppercase tracking-wide text-slate-400">Replacement Order</label>
  <p className="text-slate-700 dark:text-slate-300 mt-1 font-medium">
   {(selectedCase.replacement_order || selectedCase.replacementOrder)?.order_number || "—"}
  </p>
  {(selectedCase.completed_at || selectedCase.completed_by || selectedCase.completedBy) ? (
   <p className="text-xs text-slate-500 mt-1">
    Completed
    {selectedCase.completed_at ? ` · ${new Date(selectedCase.completed_at).toLocaleString()}` : ""}
    {(selectedCase.completed_by?.name || selectedCase.completedBy?.name)
     ? ` · by ${selectedCase.completed_by?.name || selectedCase.completedBy?.name}`
     : ""}
   </p>
  ) : null}
 </div>
 )}

 {showCompleteForm && selectedCase.status === "approved" && (
 <div className="p-4 rounded-xl border border-[color:var(--admin-primary)]/30 bg-[color:var(--admin-primary)]/5 space-y-3">
  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
   {hasCaseLineItems(selectedCase) ? "Confirm shipment" : "What to send"}
  </p>
  <p className="text-xs text-slate-500">
   {hasCaseLineItems(selectedCase)
    ? "Review what will be sent below. The return checkbox is optional — only use it when the customer sends the old item back."
    : "Select product(s) to ship at $0. Set the new color/size if the customer wants a change. Tick return if they send the old item back."}
  </p>
  <div className="space-y-2">
   {hasCaseLineItems(selectedCase) ? (selectedCase.items || []).map((row) => {
    const orderItem = row.order_item || row.orderItem;
    const name = orderItem?.product?.name || orderItem?.name || "Product";
    const orderedVariant = [orderItem?.color, orderItem?.size].filter(Boolean).join(" / ");
    const sendColor = row.requested_color || orderItem?.color;
    const sendSize = row.requested_size || orderItem?.size;
    const sendVariant = [sendColor, sendSize].filter(Boolean).join(" / ");
    const isVariantChange = Boolean(
     (row.requested_color && row.requested_color !== orderItem?.color)
     || (row.requested_size && row.requested_size !== orderItem?.size),
    );
    return (
     <div key={row.id} className="rounded-lg border admin-border admin-surface p-3 space-y-3">
      <div className="text-sm text-slate-700 dark:text-slate-300">
       <p className="font-semibold">{name} · qty {row.quantity}</p>
       {orderedVariant ? (
        <p className="text-xs text-slate-500 mt-1">Ordered: {orderedVariant}</p>
       ) : null}
       <p className="text-xs font-medium text-[color:var(--admin-primary)] mt-1">
        Will ship: {sendVariant || "same as ordered"}
        {isVariantChange ? " (variant change)" : ""}
       </p>
       <p className="text-xs text-slate-500 mt-1">
        Stock will be deducted automatically. A $0 replacement order and shipment will be created.
       </p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-dashed admin-border px-3 py-2.5">
       <input
        type="checkbox"
        checked={!!returnItemIds[row.id]}
        onChange={(e) => setReturnItemIds((prev) => ({ ...prev, [row.id]: e.target.checked }))}
        className="mt-0.5"
       />
       <span className="text-xs text-slate-600 dark:text-slate-400">
        <span className="block font-semibold text-slate-700 dark:text-slate-300">Customer returning the old item?</span>
        Optional — tick only if they send the defective/wrong item back (goes to quarantine, not for resale).
       </span>
      </label>
     </div>
    );
   }) : orderLineItems(selectedCase).map((orderItem) => {
    const row = legacyFulfillment[orderItem.id] || {};
    const maxQty = orderItemQty(orderItem);
    const product = orderItem.product;
    const name = product?.name || orderItem.name || "Product";
    const currentVariant = [orderItem.size, orderItem.color].filter(Boolean).join(" / ");
    return (
     <div key={orderItem.id} className={`rounded-lg border p-3 space-y-3 ${row.selected ? "border-[color:var(--admin-primary)] bg-white/60 dark:bg-white/5" : "admin-border admin-surface"}`}>
      <label className="flex items-start gap-3 cursor-pointer">
       <input
        type="checkbox"
        checked={!!row.selected}
        onChange={(e) => updateLegacyField(orderItem.id, "selected", e.target.checked)}
        className="mt-1"
       />
       <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
        <span className="font-medium">{name}</span>
        {currentVariant ? <span className="text-slate-500"> · ordered {currentVariant}</span> : null}
        <span className="text-slate-500"> · max qty {maxQty}</span>
       </span>
      </label>
      {row.selected ? (
       <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
         <label className="block text-xs font-semibold text-slate-500 mb-1">Qty to send</label>
         <input
          type="number"
          min={1}
          max={maxQty}
          value={row.quantity}
          onChange={(e) => updateLegacyField(orderItem.id, "quantity", e.target.value)}
          className="w-full px-3 py-2 border admin-border rounded-lg text-sm dark:text-white admin-surface"
         />
        </div>
        <div>
         <label className="block text-xs font-semibold text-slate-500 mb-1">New color (if changing)</label>
         <input
          type="text"
          value={row.requested_color}
          onChange={(e) => updateLegacyField(orderItem.id, "requested_color", e.target.value)}
          placeholder="e.g. Navy"
          className="w-full px-3 py-2 border admin-border rounded-lg text-sm dark:text-white admin-surface"
         />
        </div>
        <div>
         <label className="block text-xs font-semibold text-slate-500 mb-1">New size (if changing)</label>
         <input
          type="text"
          value={row.requested_size}
          onChange={(e) => updateLegacyField(orderItem.id, "requested_size", e.target.value)}
          placeholder="e.g. L"
          className="w-full px-3 py-2 border admin-border rounded-lg text-sm dark:text-white admin-surface"
         />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 sm:col-span-2">
         <input
          type="checkbox"
          checked={!!row.customer_returning}
          onChange={(e) => updateLegacyField(orderItem.id, "customer_returning", e.target.checked)}
         />
         Customer returning the old item (quarantine)
        </label>
       </div>
      ) : null}
     </div>
    );
   })}
  </div>
 </div>
 )}
 </div>
 <div className="mt-6 border-t admin-border bg-slate-50 pt-4 dark:bg-white/5 flex justify-end gap-3">
 {canEditReplacements && selectedCase.status === "pending" && (
 <>
 <button onClick={handleReject} disabled={actionInProgress} className="px-4 py-2 text-red-600 font-semibold text-xs uppercase tracking-wide">Reject</button>
 <button onClick={handleApprove} disabled={actionInProgress} className="px-6 py-2 rounded-xl font-semibold text-xs uppercase tracking-wide text-white bg-[var(--admin-primary)] hover:brightness-110">Approve</button>
 </>
 )}
 {canEditReplacements && selectedCase.status === "approved" && !showCompleteForm && (
 <button onClick={startCompleteForm} disabled={actionInProgress} className="px-6 py-2 rounded-xl font-semibold text-xs uppercase tracking-wide text-white bg-[color:var(--admin-primary)] hover:brightness-110">Complete</button>
 )}
 {canEditReplacements && selectedCase.status === "approved" && showCompleteForm && (
 <>
 <button onClick={() => setShowCompleteForm(false)} disabled={actionInProgress} className="px-4 py-2 border admin-border rounded-xl text-xs font-semibold dark:text-white">Cancel</button>
 <button onClick={handleComplete} disabled={actionInProgress} className="px-6 py-2 rounded-xl font-semibold text-xs uppercase tracking-wide text-white bg-[color:var(--admin-primary)] hover:brightness-110">
  {actionInProgress ? "Processing…" : "Confirm fulfillment"}
 </button>
 </>
 )}
 <button onClick={() => { setShowDetails(false); setShowCompleteForm(false); setLegacyFulfillment({}); }} className="px-4 py-2 border admin-border rounded-xl text-xs font-semibold dark:text-white">Close</button>
 </div>
 </>
 ) : null}
 </AdminModal>
 </div>
 </div>
 );
}
