import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { DEFAULT_DELIVERY_RATES } from "../../lib/deliveryFee.js";

export default function DeliveryFeeSettingsPanel({ canEdit, inModal = false, onSaved }) {
  const [phnomPenh, setPhnomPenh] = useState(String(DEFAULT_DELIVERY_RATES.phnom_penh));
  const [province, setProvince] = useState(String(DEFAULT_DELIVERY_RATES.province));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const { data } = await api.get("/admin/delivery-fees");
        if (!mounted) return;
        const rates = data?.data || {};
        setPhnomPenh(String(rates.phnom_penh ?? DEFAULT_DELIVERY_RATES.phnom_penh));
        setProvince(String(rates.province ?? DEFAULT_DELIVERY_RATES.province));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load delivery fees.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.put("/admin/delivery-fees", {
        phnom_penh: Number(phnomPenh),
        province: Number(province),
      });
      const rates = data?.data || {};
      setPhnomPenh(String(rates.phnom_penh ?? phnomPenh));
      setProvince(String(rates.province ?? province));
      setMessage("Delivery fees saved. New checkout orders will use these rates.");
      onSaved?.(rates);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save delivery fees.");
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
      {!inModal ? (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Delivery fees</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Auto-applied at checkout from the customer&apos;s address province. Applies to all new orders — not per order.
          </p>
        </div>
      ) : (
        <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
          Auto-applied at checkout from the customer&apos;s address province. Applies to all new orders — not per order.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading rates…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phnom Penh (USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={phnomPenh}
              disabled={!canEdit}
              onChange={(e) => setPhnomPenh(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--admin-primary)] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Other provinces (USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={province}
              disabled={!canEdit}
              onChange={(e) => setProvince(e.target.value)}
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--admin-primary)] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}

      {canEdit ? (
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="mt-4 h-11 rounded-xl bg-[color:var(--admin-primary)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save delivery fees"}
        </button>
      ) : null}
    </>
  );

  if (inModal) {
    return <div className="text-slate-800 dark:text-slate-100">{body}</div>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      {body}
    </section>
  );
}
