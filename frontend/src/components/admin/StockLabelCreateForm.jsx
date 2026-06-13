import React, { useRef, useState } from "react";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import { getAdminValidationMessage } from "../../lib/adminValidation.js";
import { BARCODE_QR_TYPE } from "../../lib/stockLabelReceipts";
import CategoryPicker from "./CategoryPicker.jsx";

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const applySecondHandBundleDefaults = (state) => {
  if ((state.product_condition || "new") !== "second_hand") {
    return {
      ...state,
      second_hand_sale_type: "single",
      bundle_total_cost: "",
      bundle_total_quantity: "",
    };
  }
  return {
    ...state,
    product_condition: "second_hand",
    second_hand_sale_type: "single",
    price: "",
    compare_at_price: "",
    cost: "",
    bundle_total_cost: "",
    bundle_total_quantity: "",
    manage_stock: true,
  };
};

const normalizeSaleFieldsForPayload = (state) => {
  const normalized = applySecondHandBundleDefaults(state);
  if ((normalized.product_condition || "new") !== "second_hand") {
    return {
      ...normalized,
      product_condition: "new",
      second_hand_sale_type: null,
      price: null,
      compare_at_price: null,
      cost: null,
      bundle_total_cost: null,
      bundle_total_quantity: null,
    };
  }
  return {
    ...normalized,
    product_condition: "second_hand",
    second_hand_sale_type: "single",
    price: null,
    compare_at_price: null,
    cost: null,
    bundle_total_cost: null,
    bundle_total_quantity: null,
  };
};

const validateSaleFields = (state) => {
  const stock = parseInt(String(state.stock ?? "").trim(), 10);
  if (!Number.isFinite(stock) || stock < 0) {
    return "Please enter the total stock for this item.";
  }
  return "";
};

const buildCategoryStockPayload = (form) => {
  const manage = !!form.manage_stock;
  const qty = manage && form.stock !== "" ? parseInt(form.stock, 10) : null;
  const min = manage && form.min_stock !== "" ? parseInt(form.min_stock, 10) : null;
  return { manage_stock: manage, stock: qty, min_stock: min };
};

const EMPTY = {
  name: "",
  description: "",
  category_id: "",
  product_condition: "new",
  image_url: "",
  unit: "",
  date_in: todayYmd(),
  stock: "0",
  manage_stock: true,
  min_stock: "",
  is_active: true,
};

export default function StockLabelCreateForm({
  catalogCategories = [],
  onSuccess,
  onCancel,
  showToast = true,
}) {
  const { primaryColor, mode } = useTheme();
  const accentColor = accentIsWhite(primaryColor, mode) ? "#16a34a" : primaryColor;
  const productImageInputRef = useRef(null);
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    date_in: todayYmd(),
  }));
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [createError, setCreateError] = useState("");

  const labelCls =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400";
  const inputCls =
    "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.12)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500";
  const textareaCls =
    "min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.12)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  const uploadCategoryImage = async (file) => {
    const fd = new FormData();
    fd.append("image", file);
    const { data } = await api.post("/admin/categories/image-upload", fd);
    const raw =
      data?.image_url ||
      data?.data?.image_url ||
      (typeof data?.data === "string" ? data.data : "");
    return String(raw || "").trim();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setCreateError("");
    try {
      const url = await uploadCategoryImage(file);
      if (!url) {
        setCreateError("Upload did not return an image URL. Try again or check storage.");
        return;
      }
      setForm((s) => ({ ...s, image_url: url }));
    } catch (error) {
      setCreateError(getAdminValidationMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (isCreating) return;
    if (!form.name.trim()) {
      setCreateError("Stock name is required");
      return;
    }
    const validationError = validateSaleFields(form);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError("");
    setIsCreating(true);
    loadingAlert({
      khTitle: "កំពុងបង្កើត",
      enTitle: "Creating stock label…",
      khText: "សូមរង់ចាំ",
      enText: "Please wait",
    });
    try {
      const saleForm = normalizeSaleFieldsForPayload(form);
      const response = await api.post("/admin/categories", {
        name: saleForm.name.trim(),
        type: BARCODE_QR_TYPE,
        description: saleForm.description || null,
        image_url: saleForm.image_url || null,
        category_id: saleForm.category_id ? parseInt(saleForm.category_id, 10) : null,
        product_condition: saleForm.product_condition || "new",
        is_active: saleForm.is_active,
        sort_order: 0,
        unit: saleForm.unit || null,
        date_in: saleForm.date_in || todayYmd(),
        ...buildCategoryStockPayload(saleForm),
      });
      if (![200, 201].includes(response?.status)) {
        throw new Error("Create failed.");
      }
      const created = response?.data?.data || response?.data || {};
      closeSwal();
      if (showToast) {
        await toastSuccess({
          khText: "បង្កើតដោយជោគជ័យ",
          enText: "Stock label created!",
        });
      }
      onSuccess?.(created);
    } catch (e2) {
      closeSwal();
      const msg = e2?.response?.data?.message || getAdminValidationMessage(e2);
      setCreateError(msg);
      await errorAlert({ khTitle: "បរាជ័យ", enTitle: "Failed", detail: msg });
    } finally {
      closeSwal();
      setIsCreating(false);
    }
  };

  const productCondition = form.product_condition || "new";
  const heroPhotoUrl = String(form.image_url || "").trim();

  return (
    <form onSubmit={create} className="space-y-6">
      <input
        ref={productImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageUpload}
      />

      <div>
        <label className={labelCls} htmlFor="qc-stock-name">
          Stock name <span className="text-red-500">*</span>
        </label>
        <input
          id="qc-stock-name"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          required
          className={inputCls}
          placeholder="Enter stock name"
        />
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Stock labels track inventory only. Set barcodes on products (Variant Barcode for color/size items).
        </p>
      </div>

      <CategoryPicker
        categories={catalogCategories}
        value={form.category_id || ""}
        onChange={(id) => setForm((s) => ({ ...s, category_id: id }))}
        labelCls={labelCls}
        inputCls={inputCls}
        disabled={isUploading}
        placeholder="e.g. Electronics, Apparel..."
      />

      <div>
        <label className={labelCls}>Product condition</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { value: "new", label: "New", hint: "ទំនិញថ្មី" },
            { value: "second_hand", label: "Second-hand", hint: "ទំនិញមួយទឹក" },
          ].map((option) => {
            const selected = productCondition === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setForm((s) => applySecondHandBundleDefaults({
                  ...s,
                  product_condition: option.value,
                }))}
                className={`rounded-xl border px-4 py-4 text-left transition ${
                  selected
                    ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.06)] ring-1 ring-[rgba(var(--admin-primary-rgb),0.18)]"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${
                      selected
                        ? "border-[color:var(--admin-primary)] bg-[color:var(--admin-primary)]"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                    }`}
                  />
                  {option.label}
                </span>
                <span className="mt-1.5 block pl-6 text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Product image</label>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => productImageInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600 dark:hover:bg-slate-900/70"
        >
          {heroPhotoUrl ? (
            <img
              src={resolveImageUrl(heroPhotoUrl)}
              alt=""
              className="max-h-48 w-full rounded-lg object-contain"
            />
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Click to upload a photo</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PNG, JPG, WEBP — max 5 MB</p>
            </>
          )}
        </button>
      </div>

      <div>
        <label className={labelCls} htmlFor="qc-stock-description">
          Description
        </label>
        <textarea
          id="qc-stock-description"
          value={form.description || ""}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          rows={4}
          className={textareaCls}
          placeholder="Product description..."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="qc-stock-unit">
            Unit
          </label>
          <select
            id="qc-stock-unit"
            value={form.unit || ""}
            onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
            className={inputCls}
          >
            <option value="">Select unit</option>
            <option>Piece</option>
            <option>Pair</option>
            <option>Box</option>
            <option>Kg</option>
            <option>Liter</option>
            <option>Set</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="qc-stock-date-in">
            Date in
          </label>
          <input
            id="qc-stock-date-in"
            type="date"
            value={form.date_in || ""}
            onChange={(e) => setForm((s) => ({ ...s, date_in: e.target.value }))}
            className={inputCls}
          />
        </div>
      </div>

      {createError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {createError}
        </div>
      ) : null}

      <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 pt-6 sm:flex-row dark:border-slate-800">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isCreating || isUploading}
          className="rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {isCreating ? "Saving…" : "Save item"}
        </button>
      </div>
    </form>
  );
}

function accentIsWhite(color, mode) {
  return mode !== "dark" && (color || "").toUpperCase() === "#FFFFFF";
}
