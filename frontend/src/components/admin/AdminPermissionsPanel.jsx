import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import api from "../../lib/api";
import AdminModal from "./AdminModal.jsx";
import { AdminSectionLoader } from "./AdminLoading";
import { permissionActionLabel, permissionKey } from "../../lib/adminPermissions.js";
import { toastSuccess, errorAlert } from "../../lib/swal";

function PermissionToggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--admin-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 " +
        (disabled ? "cursor-not-allowed opacity-50 " : "cursor-pointer ") +
        (checked ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}

export default function AdminPermissionsPanel({ open, adminUser, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState(null);
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    if (!open || !adminUser?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/admin/superadmin/users/${adminUser.id}/permissions`);
        if (cancelled) return;
        const payload = data?.data || data;
        setMatrix(payload);
        setPermissions(payload?.permissions || {});
      } catch (err) {
        if (!cancelled) {
          await errorAlert({
            title: "Failed to load permissions",
            detail: err?.response?.data?.message || "Please try again.",
          });
          onClose?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, adminUser?.id, onClose]);

  const actions = useMemo(() => matrix?.actions || ["view", "create", "edit", "delete"], [matrix]);

  const togglePermission = (resource, action, value) => {
    const key = permissionKey(resource, action);
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const toggleResourceRow = (resourceKey, value, actionList) => {
    const list = actionList?.length ? actionList : actions;
    setPermissions((prev) => {
      const next = { ...prev };
      list.forEach((action) => {
        next[permissionKey(resourceKey, action)] = value;
      });
      return next;
    });
  };

  const handleReset = async () => {
    if (!adminUser?.id) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/superadmin/users/${adminUser.id}/permissions/reset`);
      const payload = data?.data || data;
      setMatrix(payload);
      setPermissions(payload?.permissions || {});
      toastSuccess("Permissions reset to defaults");
      onSaved?.(payload);
    } catch (err) {
      await errorAlert({
        title: "Reset failed",
        detail: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!adminUser?.id) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/admin/superadmin/users/${adminUser.id}/permissions`, {
        permissions,
      });
      const payload = data?.data || data;
      setMatrix(payload);
      setPermissions(payload?.permissions || {});
      toastSuccess("Permissions saved");
      onSaved?.(payload);
      onClose?.();
    } catch (err) {
      await errorAlert({
        title: "Save failed",
        detail: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Resource Permissions"
      titleIcon={<ShieldCheck className="h-5 w-5" aria-hidden />}
      maxWidthClass="max-w-5xl"
      variant="sheet"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{adminUser?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{adminUser?.email}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Toggle what this admin can access. Superadmin-only areas (administrator accounts, payment gateway, security audit, homepage manager) are not assignable here.
          </p>
        </div>

        {loading ? (
          <AdminSectionLoader />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Resource
                  </th>
                  {actions.map((action) => (
                    <th
                      key={action}
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {permissionActionLabel(action)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    All
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(matrix?.groups || []).map((group) => (
                  <React.Fragment key={group.key}>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                      <td
                        colSpan={actions.length + 2}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {(group.resources || []).map((resource) => {
                      const applicable = resource.action_list?.length
                        ? resource.action_list
                        : actions.filter((action) => resource.actions?.[action] !== null);
                      const rowValues = applicable.map((action) =>
                        Boolean(permissions[permissionKey(resource.key, action)]),
                      );
                      const allOn = applicable.length > 0 && rowValues.every(Boolean);
                      return (
                        <tr key={resource.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                            {resource.label}
                          </td>
                          {actions.map((action) => {
                            const isApplicable = applicable.includes(action);
                            if (!isApplicable) {
                              return (
                                <td key={action} className="px-3 py-3 text-center text-slate-300 dark:text-slate-600">
                                  —
                                </td>
                              );
                            }
                            return (
                            <td key={action} className="px-3 py-3 text-center">
                              <PermissionToggle
                                checked={Boolean(permissions[permissionKey(resource.key, action)])}
                                onChange={(value) => togglePermission(resource.key, action, value)}
                                label={`${resource.label} ${permissionActionLabel(action)}`}
                              />
                            </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center">
                            <PermissionToggle
                              checked={allOn}
                              onChange={(value) => toggleResourceRow(resource.key, value, applicable)}
                              label={`${resource.label} all permissions`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={handleReset}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset defaults
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={handleSave}
            className="rounded-lg bg-[color:var(--admin-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save permissions"}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
