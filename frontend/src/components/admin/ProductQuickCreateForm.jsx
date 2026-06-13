import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import { getAdminValidationMessage } from "../../lib/adminValidation.js";
import { supplierInputClass } from "./SupplierFormFields.jsx";
import AdminModal from "./AdminModal.jsx";
import CategoryCreateForm from "./CategoryCreateForm.jsx";
import BrandCreateForm from "./BrandCreateForm.jsx";
import { CreateNewSelectOption, QUICK_CREATE_OPTION } from "./FieldWithQuickCreate.jsx";

const EMPTY = {
  name: "",
  category_id: "",
  brand_id: "",
  size: "",
  color: "",
  qty: "1",
  cost_price: "",
  price: "",
};

function parseSizesForApi(size) {
  const s = String(size ?? "").trim();
  return s ? [s] : [];
}

function parseColorsForApi(color) {
  const c = String(color ?? "").trim();
  return c ? [{ name: c, image_url: null }] : null;
}

function lineDefaultsFromForm(form) {
  return {
    size: String(form.size ?? "").trim(),
    color: String(form.color ?? "").trim(),
    qty: Math.max(1, Number(form.qty) || 1),
    cost_per_unit:
      form.cost_price === "" || form.cost_price == null
        ? ""
        : String(Number(form.cost_price)),
    sell_price:
      form.price === "" || form.price == null ? "" : String(Number(form.price)),
  };
}

function FieldLabel({ children, htmlFor, required = false }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </label>
  );
}

export default function ProductQuickCreateForm({
  onSuccess,
  onCancel,
  showToast = true,
  defaultSupplierId = null,
}) {
  const { primaryColor, mode } = useTheme();
  const accentColor = mode === "dark" ? "#FFFFFF" : primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [nestedQuickCreate, setNestedQuickCreate] = useState(null);

  const loadCatalog = async () => {
    const [catRes, brandRes] = await Promise.all([
      api.get("/admin/categories", { params: { per_page: 500 } }),
      api.get("/admin/brands", { params: { per_page: 500 } }),
    ]);
    setCategories(Array.isArray(catRes.data?.data) ? catRes.data.data : []);
    setBrands(Array.isArray(brandRes.data?.data) ? brandRes.data.data : []);
  };

  useEffect(() => {
    loadCatalog().catch(() => {});
  }, []);

  const tryOpenNested = (type, value) => {
    if (value !== QUICK_CREATE_OPTION) return false;
    setNestedQuickCreate(type);
    return true;
  };

  const onCategoryChange = (e) => {
    const v = e.target.value;
    if (tryOpenNested("category", v)) return;
    setForm((p) => ({ ...p, category_id: v }));
  };

  const onBrandChange = (e) => {
    const v = e.target.value;
    if (tryOpenNested("brand", v)) return;
    setForm((p) => ({ ...p, brand_id: v }));
  };

  const handleNestedSuccess = async (type, created) => {
    await loadCatalog();
    if (type === "category" && created?.id != null) {
      setForm((p) => ({ ...p, category_id: String(created.id) }));
    }
    if (type === "brand" && created?.id != null) {
      setForm((p) => ({ ...p, brand_id: String(created.id) }));
    }
    setNestedQuickCreate(null);
  };

  const create = async (e) => {
    e.preventDefault();
    if (isCreating) return;
    setCreateError("");

    const name = form.name.trim();
    if (!name) {
      setCreateError("Product name is required.");
      return;
    }
    if (!form.category_id) {
      setCreateError("Please select a category.");
      return;
    }
    const price = form.price === "" ? NaN : Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setCreateError("Sell price is required.");
      return;
    }

    setIsCreating(true);
    loadingAlert({
      khTitle: "កំពុងបង្កើតទំនិញ",
      enTitle: "Creating product",
      khText: "សូមរង់ចាំបន្តិច",
      enText: "Please wait",
    });
    try {
      const costPrice =
        form.cost_price === "" || form.cost_price == null ? null : Number(form.cost_price);
      const sizes = parseSizesForApi(form.size);
      const colors = parseColorsForApi(form.color);
      const lineDefaults = lineDefaultsFromForm(form);
      const response = await api.post("/admin/products", {
        name,
        category_id: Number(form.category_id),
        brand_id: form.brand_id ? Number(form.brand_id) : null,
        supplier_id: defaultSupplierId ? Number(defaultSupplierId) : null,
        price,
        cost_price: Number.isFinite(costPrice) ? costPrice : null,
        stock: 0,
        is_active: true,
        sizes,
        colors,
        variant_matrix: null,
        payment_methods: [],
        gallery: [],
      });
      if (![200, 201].includes(response?.status)) {
        throw new Error("Create failed.");
      }
      const created = response?.data?.data || response?.data;
      closeSwal();
      if (showToast) {
        await toastSuccess({
          khText: "បានបង្កើតទំនិញដោយជោគជ័យ",
          enText: "Product created!",
        });
      }
      onSuccess?.(created, lineDefaults);
    } catch (err) {
      closeSwal();
      const detail = getAdminValidationMessage(err, "Could not create product.");
      setCreateError(detail);
      await errorAlert({
        khTitle: "បង្កើតទំនិញបរាជ័យ",
        enTitle: "Create failed",
        detail,
      });
    } finally {
      closeSwal();
      setIsCreating(false);
    }
  };

  return (
    <>
      <form onSubmit={create} className="space-y-4 pt-1">
        <div>
          <FieldLabel htmlFor="po-qc-product-name" required>
            Product name
          </FieldLabel>
          <input
            id="po-qc-product-name"
            className={supplierInputClass}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Classic fit tee"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="po-qc-product-category" required>
              Category
            </FieldLabel>
            <select
              id="po-qc-product-category"
              className={supplierInputClass}
              value={form.category_id}
              onChange={onCategoryChange}
              required
            >
              <CreateNewSelectOption label="+ Create new category…" />
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="po-qc-product-brand">Brand</FieldLabel>
            <select
              id="po-qc-product-brand"
              className={supplierInputClass}
              value={form.brand_id}
              onChange={onBrandChange}
            >
              <CreateNewSelectOption label="+ Create new brand…" />
              <option value="">— Optional —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Line on this purchase order
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <FieldLabel htmlFor="po-qc-product-size">Size</FieldLabel>
            <input
              id="po-qc-product-size"
              className={supplierInputClass}
              value={form.size}
              onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
              placeholder="e.g. M"
            />
          </div>
          <div>
            <FieldLabel htmlFor="po-qc-product-color">Color</FieldLabel>
            <input
              id="po-qc-product-color"
              className={supplierInputClass}
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              placeholder="e.g. Black"
            />
          </div>
          <div>
            <FieldLabel htmlFor="po-qc-product-qty">Qty</FieldLabel>
            <input
              id="po-qc-product-qty"
              type="number"
              min={1}
              step={1}
              className={supplierInputClass}
              value={form.qty}
              onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel htmlFor="po-qc-product-cost">Cost/unit ($)</FieldLabel>
            <input
              id="po-qc-product-cost"
              type="number"
              min={0}
              step="0.01"
              className={supplierInputClass}
              value={form.cost_price}
              onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div>
            <FieldLabel htmlFor="po-qc-product-price" required>
              Sell price ($)
            </FieldLabel>
            <input
              id="po-qc-product-price"
              type="number"
              min={0}
              step="0.01"
              className={supplierInputClass}
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-3">
          {createError ? (
            <div className="mr-auto rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-100">
              {createError}
            </div>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isCreating}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-50 transition font-semibold text-sm disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
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
            {isCreating ? "Creating…" : "Create product"}
          </button>
        </div>
      </form>

      {nestedQuickCreate === "category" ? (
        <AdminModal
          open
          onClose={() => setNestedQuickCreate(null)}
          title="Add New Category"
          titleId="po-qc-category-title"
          maxWidthClass="max-w-3xl"
          zIndexClass="z-[70]"
        >
          <CategoryCreateForm
            onCancel={() => setNestedQuickCreate(null)}
            onSuccess={(created) => handleNestedSuccess("category", created)}
          />
        </AdminModal>
      ) : null}

      {nestedQuickCreate === "brand" ? (
        <AdminModal
          open
          onClose={() => setNestedQuickCreate(null)}
          title="Add Brand"
          titleId="po-qc-brand-title"
          maxWidthClass="max-w-3xl"
          zIndexClass="z-[70]"
        >
          <BrandCreateForm
            onCancel={() => setNestedQuickCreate(null)}
            onSuccess={(created) => handleNestedSuccess("brand", created)}
          />
        </AdminModal>
      ) : null}
    </>
  );
}
