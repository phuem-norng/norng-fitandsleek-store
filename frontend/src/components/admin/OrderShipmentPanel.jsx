import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import {
  applyCourierTemplate,
  COURIER_URL_PRESETS,
} from "../../lib/courierTracking.js";

const DEFAULT_PROVIDERS = [
  "J&T Express",
  "Vireak Buntham Express",
  "Grab Express",
  "Ninja Van",
  "Kerry Express",
  "Other",
];

export default function OrderShipmentPanel({ orderId, shipment, canEdit, onSaved }) {
  const [provider, setProvider] = useState("J&T Express");
  const [trackingCode, setTrackingCode] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [presetId, setPresetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!shipment) return;
    setProvider(shipment.provider && shipment.provider !== "Internal" ? shipment.provider : "J&T Express");
    setTrackingCode(shipment.tracking_code || shipment.tracking_number || "");
    setExternalUrl(shipment.external_tracking_url || "");
  }, [shipment, orderId]);

  const applyPreset = (presetKey) => {
    setPresetId(presetKey);
    const preset = COURIER_URL_PRESETS.find((p) => p.id === presetKey);
    if (!preset) return;
    setProvider(preset.label);
    if (trackingCode.trim()) {
      setExternalUrl(applyCourierTemplate(preset.template, trackingCode));
    }
  };

  useEffect(() => {
    if (!presetId || !trackingCode.trim()) return;
    const preset = COURIER_URL_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setExternalUrl(applyCourierTemplate(preset.template, trackingCode));
    }
  }, [trackingCode, presetId]);

  const save = async () => {
    if (!canEdit || !orderId) return;
    const code = trackingCode.trim();
    const url = externalUrl.trim();
    if (!code) {
      setError("Tracking number is required.");
      return;
    }
    if (!url) {
      setError("Courier tracking URL is required to mark the order as shipped.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/admin/shipments", {
        order_id: orderId,
        provider,
        tracking_code: code,
        external_tracking_url: url,
        mark_shipped: true,
      });
      setSuccess("Courier tracking saved. Order marked as shipped.");
      onSaved?.(data?.data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save courier tracking.");
    } finally {
      setSaving(false);
    }
  };

  if (!orderId) return null;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <h4 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Courier tracking</h4>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Paste the courier tracking link from J&amp;T, Vireak Buntham, etc. Customers will see a &quot;Track package&quot; button on My Orders.
      </p>

      {shipment?.status ? (
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
          Shipment status: <span className="font-semibold capitalize">{shipment.status}</span>
          {shipment.tracking_code ? (
            <span className="ml-2 font-mono text-[11px]">{shipment.tracking_code}</span>
          ) : null}
        </p>
      ) : null}

      {canEdit ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Courier</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--admin-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {DEFAULT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">URL preset</label>
              <select
                value={presetId}
                onChange={(e) => applyPreset(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--admin-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Manual URL</option>
                {COURIER_URL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} template</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tracking number</label>
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="e.g. JT1234567890"
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-mono text-slate-900 outline-none focus:border-[var(--admin-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Courier tracking URL</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => {
                setPresetId("");
                setExternalUrl(e.target.value);
              }}
              placeholder="https://..."
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--admin-primary)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
          {success ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{success}</p> : null}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-11 rounded-xl bg-[color:var(--admin-primary)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & mark shipped"}
          </button>
        </div>
      ) : shipment?.external_tracking_url ? (
        <a
          href={shipment.external_tracking_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-[color:var(--admin-primary)] hover:underline"
        >
          Open courier tracking
        </a>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">No external courier link yet.</p>
      )}
    </div>
  );
}
