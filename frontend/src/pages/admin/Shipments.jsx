import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import DeliveryFeeSettingsPanel from "../../components/admin/DeliveryFeeSettingsPanel.jsx";
import AdminModal from "../../components/admin/AdminModal.jsx";

export default function AdminShipments() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewShipments = can("shipments", "view");
  const canEditShipments = can("shipments", "edit");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deliveryFeesOpen, setDeliveryFeesOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canViewShipments) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/admin/shipments", { params: { per_page: 50 } });
      const paginator = data?.data;
      setRows(Array.isArray(paginator?.data) ? paginator.data : []);
    } catch (e) {
      console.error("Failed to load shipments", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canViewShipments]);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [load, permissionsReady]);

  if (!permissionsReady || (loading && rows.length === 0)) {
    return <AdminContentSkeleton title="Shipments" />;
  }

  if (!canViewShipments) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  if (loading) return <AdminContentSkeleton title="Shipments" />;

  return (
    <div className="w-full min-w-0 space-y-5 text-slate-800 dark:text-slate-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Shipments</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Courier tracking and shipment status for customer orders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeliveryFeesOpen(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg className="h-4 w-4 text-[color:var(--admin-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Delivery fees
        </button>
      </div>

      <AdminModal
        open={deliveryFeesOpen}
        onClose={() => setDeliveryFeesOpen(false)}
        title="Delivery fees"
        titleId="delivery-fees-modal-title"
        maxWidthClass="max-w-lg"
      >
        {deliveryFeesOpen ? (
          <DeliveryFeeSettingsPanel canEdit={canEditShipments} inModal />
        ) : null}
      </AdminModal>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">No shipments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Tracking</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Provider</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-[13px]">{row.tracking_code || row.tracking_number || "—"}</td>
                    <td className="px-5 py-3">{row.order?.order_number || `#${row.order_id}`}</td>
                    <td className="px-5 py-3">{row.order?.user?.name || "—"}</td>
                    <td className="px-5 py-3">{row.provider || "—"}</td>
                    <td className="px-5 py-3 capitalize">{row.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
