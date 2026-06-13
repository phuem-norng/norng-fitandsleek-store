import React, { useMemo, useState } from "react";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import { getAdminValidationMessage } from "../../lib/adminValidation.js";

const EMPTY = {
  name: "",
  slug: "",
  sort_order: 0,
  is_active: true,
  logo_source: "local",
  logo: null,
  logo_url: "",
};

function slugifyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function brandLogoSrc(url) {
  if (!url) return null;
  if (/^(blob:|data:)/i.test(url)) return url;
  return resolveImageUrl(url);
}

export default function BrandCreateForm({ onSuccess, onCancel, showToast = true }) {
  const { primaryColor, mode } = useTheme();
  const accentColor = mode === "dark" ? "#FFFFFF" : primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
  const [form, setForm] = useState(EMPTY);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const previewCreate = useMemo(() => {
    if (form.logo_source === "url" && form.logo_url) return brandLogoSrc(form.logo_url);
    if (form.logo) return URL.createObjectURL(form.logo);
    return null;
  }, [form.logo, form.logo_source, form.logo_url]);

  const onPickFile = (file) => {
    setForm((p) => ({ ...p, logo: file, logo_source: "local" }));
  };

  const create = async (e) => {
    e.preventDefault();
    if (isCreating) return;
    setCreateError("");
    setIsCreating(true);
    loadingAlert({
      khTitle: "កំពុងបង្កើតម៉ាក",
      enTitle: "Creating brand",
      khText: "សូមរង់ចាំបន្តិច",
      enText: "Please wait",
    });
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("slug", (form.slug || slugifyName(form.name)).trim());
      fd.append("sort_order", String(form.sort_order ?? 0));
      fd.append("is_active", form.is_active ? "1" : "0");
      if (form.logo_source === "url") {
        if (form.logo_url?.trim()) fd.append("logo_url", form.logo_url.trim());
      } else if (form.logo) {
        fd.append("logo", form.logo);
      }

      const response = await api.post("/admin/brands", fd);
      if (![200, 201].includes(response?.status)) {
        throw new Error("Create failed.");
      }
      const created = response?.data?.data || response?.data;
      closeSwal();
      if (showToast) {
        await toastSuccess({
          khText: "បានបង្កើតម៉ាកដោយជោគជ័យ",
          enText: "Brand created!",
        });
      }
      onSuccess?.(created);
    } catch (e2) {
      closeSwal();
      const detail = getAdminValidationMessage(e2);
      const slugHint = String(detail).toLowerCase().includes("slug") ? `សូមបំពេញ Slug - ${detail}` : detail;
      setCreateError(slugHint);
      await errorAlert({
        khTitle: "បង្កើតម៉ាកបរាជ័យ",
        enTitle: "Create failed",
        detail: slugHint,
      });
    } finally {
      closeSwal();
      setIsCreating(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500";

  return (
    <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Name</label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Nike"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Slug (optional)</label>
        <input
          className={inputClass}
          value={form.slug}
          onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
          placeholder="nike"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Sort order</label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={form.sort_order}
          onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
        />
      </div>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
            className="relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-slate-300 dark:focus:ring-slate-600 dark:focus:ring-offset-slate-800"
            style={{
              backgroundColor: form.is_active ? (mode === "dark" ? "#3b82f6" : "#2563eb") : (mode === "dark" ? "#334155" : "#e2e8f0"),
            }}
          >
            <span
              className="w-6 h-6 bg-white rounded-full shadow-lg transform transition-transform duration-300"
              style={{ transform: form.is_active ? "translateX(24px)" : "translateX(4px)" }}
            />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Active</span>
        </label>
      </div>

      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Logo (optional)</label>
          <div className="flex items-center gap-4 mb-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="radio"
                name="brand-create-logo-source"
                checked={form.logo_source === "local"}
                onChange={() => setForm((p) => ({ ...p, logo_source: "local", logo_url: "" }))}
              />
              Upload local file
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="radio"
                name="brand-create-logo-source"
                checked={form.logo_source === "url"}
                onChange={() => setForm((p) => ({ ...p, logo_source: "url", logo: null }))}
              />
              Use image URL
            </label>
          </div>

          {form.logo_source === "url" ? (
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
              placeholder="https://example.com/brand-logo.png"
              className={inputClass}
            />
          ) : (
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-black file:bg-white file:text-black"
            />
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Optional — upload a file or paste a public image URL.
          </p>
        </div>
        <div className="h-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
          {previewCreate ? (
            <img src={previewCreate} alt="Preview" className="h-16 w-auto object-contain" />
          ) : (
            <span className="text-slate-400 text-sm">No logo</span>
          )}
        </div>
      </div>

      <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
        {createError ? (
          <div className="mr-auto rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-100">
            {createError}
          </div>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isCreating}
          className={`px-8 py-3 font-bold rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed border ${accentIsWhite ? "border-slate-300" : ""}`}
          style={{
            backgroundColor: accentColor,
            color: accentIsWhite ? "#0b0b0f" : "#FFFFFF",
            borderColor: accentIsWhite ? "#cbd5e1" : accentColor,
          }}
        >
          {isCreating ? "Creating..." : "Add Brand"}
        </button>
      </div>
    </form>
  );
}
