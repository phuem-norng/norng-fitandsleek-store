import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AlertTriangle, ClipboardList, Copy, Info, Package, Plus, Search, Trash2, Truck } from "lucide-react";
import api from "../../lib/api";
import { loadPoApplyProduct, loadPoCreateDraft } from "../../lib/poCreateBridge.js";
import AdminModal from "./AdminModal.jsx";
import AdminProducts from "../../pages/admin/Products.jsx";
import { useTheme } from "../../state/theme.jsx";
import { useAuth } from "../../state/auth.jsx";
import { getAdminValidationMessage } from "../../lib/adminValidation.js";
import { CreateNewSelectOption, QUICK_CREATE_OPTION } from "./FieldWithQuickCreate.jsx";
import SupplierCreateForm from "./SupplierCreateForm.jsx";
import {
  createEmptyPoItem,
  createPoItemVariantFromLine,
  formatPoMoney,
  lineMoney,
  parseProductColors,
  parseProductSizes,
  poAvailableColorsForLine,
  poAvailableSizesForLine,
  poCatalogOptionsForLine,
  poIsFirstSameProductLine,
  poIsLastSameProductLine,
  poMaxQtyForLineInput,
  poMaxQtyForProduct,
  poPruneProductQtyLimits,
  poProductQtyLimitPayload,
  poProductQtyLimitsFromOrder,
  poProductsOverQtyLimit,
  poQtyUsedForProduct,
  poTakenVariantKeysForProduct,
  poVariantKey,
  poFormItemsFromOrder,
  validatePoFormItems,
  productPartOptionLabel,
  productPartStockHint,
  todayIsoDate,
} from "../../lib/purchaseOrderHelpers.js";

const poFieldClass =
  "w-full min-w-0 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb,59,130,246),0.18)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-[rgba(var(--admin-primary-rgb,59,130,246),0.25)]";

const poFieldReadOnlyClass =
  "w-full min-w-0 h-10 px-3.5 rounded-lg border border-slate-200/80 bg-slate-50 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300";

const poTableFieldClass =
  "w-full min-w-0 h-9 px-2 rounded-md border border-slate-200 bg-white text-sm text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb,59,130,246),0.18)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-[rgba(var(--admin-primary-rgb,59,130,246),0.25)]";

const poTableReadOnlyClass =
  "flex h-9 w-full min-w-0 items-center justify-end rounded-md border border-slate-200/80 bg-slate-50 px-2 text-sm font-semibold tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";

function FieldLabel({ children, required = false, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400"
    >
      {children}
      {required ? <span className="normal-case tracking-normal text-red-500 ml-0.5">*</span> : null}
    </label>
  );
}

function ReadOnlyField({ label, value, mono = false, required = false, multiline = false, className = "" }) {
  return (
    <div className={className}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div
        className={`${poFieldReadOnlyClass} ${multiline ? "min-h-[4.5rem] items-start whitespace-pre-wrap py-2.5" : "flex items-center"} ${mono ? "font-mono text-[13px] tracking-tight" : ""}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function PoSection({ icon: Icon, title, description, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/[0.03] dark:border-slate-800 dark:bg-slate-900/40 dark:ring-white/[0.04]">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--admin-primary)]/12 text-[color:var(--admin-primary)]">
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function WorkflowHint() {
  const steps = [
    { n: "1", label: "Create draft" },
    { n: "2", label: "Mark pending" },
    { n: "3", label: "Mark received → stock" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2.5 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
      <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <span className="font-medium">Stock updates only after received.</span>
      <span className="hidden h-3 w-px bg-sky-300 sm:inline dark:bg-sky-800" aria-hidden />
      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <li key={s.n} className="flex items-center gap-1.5">
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-white/80 px-1 font-mono text-[10px] font-bold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
              {s.n}
            </span>
            <span className="text-sky-900/90 dark:text-sky-100/90">{s.label}</span>
            {i < steps.length - 1 ? (
              <span className="text-sky-400 dark:text-sky-600" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EditableField({
  label,
  htmlFor,
  value,
  onChange,
  required = false,
  mono = false,
  type = "text",
  placeholder = "",
  hint = null,
  error = "",
}) {
  return (
    <div>
      <FieldLabel htmlFor={htmlFor} required={required}>
        {label}
      </FieldLabel>
      <input
        id={htmlFor}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`${poFieldClass} ${mono ? "font-mono" : ""} ${error ? "border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-200/80 dark:focus:ring-red-900/40" : ""
          }`}
      />
      {hint ? <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

export default function PurchaseOrderCreateForm({
  onSuccess,
  onCancel,
  onCatalogRefresh,
  suppliers = [],
  products = [],
  nextPoNumber = "",
  orderToEdit = null,
}) {
  const isEditMode = Boolean(orderToEdit?.id);
  const editOrderId = orderToEdit?.id ?? null;
  const { primaryColor, mode } = useTheme();
  const { user } = useAuth();
  const accentColor = mode === "dark" ? "#FFFFFF" : primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState(nextPoNumber || "");
  const [orderDate, setOrderDate] = useState(todayIsoDate());
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [partsSearch, setPartsSearch] = useState("");
  const [partsFilter, setPartsFilter] = useState("all");
  const [items, setItems] = useState([createEmptyPoItem()]);
  const [productQtyLimits, setProductQtyLimits] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false);
  const [showProductCreateModal, setShowProductCreateModal] = useState(false);
  const [productCreateLineKey, setProductCreateLineKey] = useState(null);
  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [localProducts, setLocalProducts] = useState(products);
  const qtyLimitAlertRef = useRef(null);

  useEffect(() => {
    setLocalSuppliers(suppliers);
  }, [suppliers]);

  useEffect(() => {
    setLocalProducts((prev) => {
      const byId = new Map(prev.map((p) => [String(p.id), p]));
      for (const p of products) {
        byId.set(String(p.id), p);
      }
      return Array.from(byId.values());
    });
  }, [products]);

  const applyProductToLine = (lineKey, product, lineDefaults) => {
    if (product?.id == null || !lineKey) return;
    const productId = String(product.id);
    flushSync(() => {
      setLocalProducts((prev) => {
        const byId = new Map(prev.map((p) => [String(p.id), p]));
        byId.set(productId, product);
        return Array.from(byId.values());
      });
      setItems((prev) =>
        prev.map((r) => {
          if (r.key !== lineKey) return r;
          return {
            ...r,
            isNewProduct: false,
            product_id: productId,
            new_product_name: "",
            new_product_category_id: "",
            size: lineDefaults?.size ?? r.size ?? "",
            color: lineDefaults?.color ?? r.color ?? "",
            qty: lineDefaults?.qty ?? r.qty ?? 1,
            cost_per_unit: lineDefaults?.cost_per_unit ?? r.cost_per_unit ?? "",
            sell_price: lineDefaults?.sell_price ?? r.sell_price ?? "",
          };
        }),
      );
    });
  };

  useEffect(() => {
    if (isEditMode && orderToEdit) {
      setSupplierId(String(orderToEdit.supplier_id ?? orderToEdit.supplier?.id ?? ""));
      setPoNumber(orderToEdit.po_number ?? "");
      setOrderDate(orderToEdit.order_date ?? todayIsoDate());
      setExpectedDelivery(orderToEdit.expected_delivery ?? "");
      setNotes(orderToEdit.notes ?? "");
      setItems(poFormItemsFromOrder(orderToEdit));
      setProductQtyLimits(poProductQtyLimitsFromOrder(orderToEdit));
      setLocalProducts((prev) => {
        const byId = new Map(prev.map((p) => [String(p.id), p]));
        for (const line of orderToEdit.items || []) {
          const pid = line.product_id != null ? String(line.product_id) : "";
          if (!pid || byId.has(pid)) continue;
          byId.set(pid, {
            id: line.product_id,
            name: line.product_name || `Product #${line.product_id}`,
            sku: line.product_sku || "",
            stock: 0,
          });
        }
        return Array.from(byId.values());
      });
      setSaveError("");
      setSaveSuccessMessage("");
      return;
    }

    const draft = loadPoCreateDraft();
    if (draft) {
      setSupplierId(draft.supplierId ?? "");
      setPoNumber(draft.poNumber ?? "");
      setOrderDate(draft.orderDate ?? todayIsoDate());
      setExpectedDelivery(draft.expectedDelivery ?? "");
      setNotes(draft.notes ?? "");
      if (Array.isArray(draft.items) && draft.items.length) {
        setItems(draft.items);
      }
      if (draft.productQtyLimits && typeof draft.productQtyLimits === "object") {
        setProductQtyLimits(draft.productQtyLimits);
      }
    }
    const apply = loadPoApplyProduct();
    if (apply?.lineKey && apply?.product) {
      applyProductToLine(apply.lineKey, apply.product, apply.lineDefaults);
      onCatalogRefresh?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore when form opens or edit target changes
  }, [editOrderId, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    if (nextPoNumber && !poNumber) setPoNumber(nextPoNumber);
  }, [nextPoNumber, poNumber, isEditMode]);

  const selectedSupplier = useMemo(() => {
    const fromList = localSuppliers.find((s) => String(s.id) === String(supplierId));
    if (fromList) return fromList;
    if (
      isEditMode &&
      orderToEdit?.supplier &&
      String(orderToEdit.supplier.id) === String(supplierId)
    ) {
      return orderToEdit.supplier;
    }
    return null;
  }, [localSuppliers, supplierId, isEditMode, orderToEdit]);

  const productById = useMemo(() => {
    const map = new Map();
    for (const p of localProducts) map.set(String(p.id), p);
    return map;
  }, [localProducts]);

  const qtyLimitIssues = useMemo(
    () => poProductsOverQtyLimit(items, productById, productQtyLimits),
    [items, productById, productQtyLimits],
  );

  const qtyLimitIssueByProductId = useMemo(() => {
    const map = new Map();
    for (const issue of qtyLimitIssues) {
      map.set(issue.productId, issue);
    }
    return map;
  }, [qtyLimitIssues]);

  const closeSupplierCreateModal = () => {
    setShowSupplierCreateModal(false);
  };

  const openSupplierCreateModal = () => {
    setShowSupplierCreateModal(true);
  };

  const handleSupplierCreated = (created) => {
    if (!created?.id) return;
    setLocalSuppliers((prev) => {
      const exists = prev.some((s) => String(s.id) === String(created.id));
      if (exists) {
        return prev.map((s) => (String(s.id) === String(created.id) ? { ...s, ...created } : s));
      }
      return [...prev, created];
    });
    setSupplierId(String(created.id));
    closeSupplierCreateModal();
    onCatalogRefresh?.();
  };

  const onSupplierSelectChange = (e) => {
    const v = e.target.value;
    if (v === QUICK_CREATE_OPTION) {
      e.target.value = supplierId || "";
      openSupplierCreateModal();
      return;
    }
    setSupplierId(v);
  };

  const closeProductCreateModal = () => {
    setShowProductCreateModal(false);
    setProductCreateLineKey(null);
  };

  const openProductCreateModal = (itemKey) => {
    setProductCreateLineKey(itemKey);
    setShowProductCreateModal(true);
  };

  const onProductSelectChange = (itemKey) => (e) => {
    const v = e.target.value;
    if (v === QUICK_CREATE_OPTION) {
      const row = items.find((r) => r.key === itemKey);
      e.target.value = String(row?.product_id ?? "");
      openProductCreateModal(itemKey);
      return;
    }
    setSaveError("");
    const product = localProducts.find((p) => String(p.id) === v);
    const sizes = product ? parseProductSizes(product.sizes) : [];
    const colors = product ? parseProductColors(product.colors) : [];
    updateItem(itemKey, {
      isNewProduct: false,
      product_id: v,
      new_product_name: "",
      new_product_category_id: "",
      size: sizes.length === 1 ? sizes[0] : "",
      color: colors.length === 1 ? colors[0] : "",
    });
  };

  const totals = useMemo(() => {
    let cost = 0;
    let sell = 0;
    for (const row of items) {
      cost += lineMoney(row.qty, row.cost_per_unit);
      sell += lineMoney(row.qty, row.sell_price);
    }
    return { cost, sell };
  }, [items]);

  const applyVariantPricingToRow = async (key, productId, size, color) => {
    if (!productId) return;
    try {
      const { data } = await api.get(`/admin/products/${productId}/variant-pricing`, {
        params: { size: size || undefined, color: color || undefined },
      });
      const pricing = data?.data;
      if (!pricing) return;
      setItems((prev) =>
        prev.map((row) =>
          row.key === key
            ? {
                ...row,
                cost_per_unit: String(pricing.cost_per_unit ?? ""),
                sell_price: String(pricing.sell_price ?? ""),
              }
            : row,
        ),
      );
    } catch {
      /* keep manual values */
    }
  };

  const updateItem = (key, patch) => {
    let fetchPricing = null;
    setItems((prev) => {
      const next = prev.map((row) => {
        if (row.key !== key) return row;
        const updated = { ...row, ...patch };
        if (patch.product_id !== undefined) {
          updated.pricingLockedFromTemplate = false;
          const product = productById.get(String(patch.product_id));
          if (product) {
            const sizes = parseProductSizes(product.sizes);
            const colors = parseProductColors(product.colors);
            if (patch.size === undefined) {
              updated.size = sizes[0] || "";
            }
            if (patch.color === undefined) {
              updated.color = colors[0] || "";
            }
            if (patch.cost_per_unit === undefined) updated.cost_per_unit = "";
            if (patch.sell_price === undefined) updated.sell_price = "";
            fetchPricing = {
              productId: patch.product_id,
              size: updated.size,
              color: updated.color,
            };
          } else if (patch.product_id === "" || patch.product_id == null) {
            if (patch.size === undefined) updated.size = "";
            if (patch.color === undefined) updated.color = "";
            if (patch.cost_per_unit === undefined) updated.cost_per_unit = "";
            if (patch.sell_price === undefined) updated.sell_price = "";
          }
        } else if (patch.size !== undefined || patch.color !== undefined) {
          if (updated.product_id && !updated.pricingLockedFromTemplate) {
            fetchPricing = {
              productId: updated.product_id,
              size: updated.size,
              color: updated.color,
            };
          }
          if (patch.size !== undefined && updated.product_id) {
            const taken = poTakenVariantKeysForProduct(prev, updated.product_id, key);
            const nextSize = String(updated.size ?? "").trim();
            const nextColor = String(updated.color ?? "").trim();
            if (nextSize && nextColor && taken.has(poVariantKey(nextSize, nextColor))) {
              updated.color = "";
            }
          }
          if (patch.color !== undefined && updated.product_id) {
            const taken = poTakenVariantKeysForProduct(prev, updated.product_id, key);
            const nextSize = String(updated.size ?? "").trim();
            const nextColor = String(updated.color ?? "").trim();
            if (nextSize && nextColor && taken.has(poVariantKey(nextSize, nextColor))) {
              updated.color = "";
            }
          }
        } else if (patch.cost_per_unit !== undefined || patch.sell_price !== undefined) {
          updated.pricingLockedFromTemplate = true;
        }

        if (patch.qty !== undefined) {
          const raw = String(patch.qty ?? "");
          if (raw === "") {
            updated.qty = "";
          } else {
            const digitsOnly = raw.replace(/\D/g, "");
            if (digitsOnly === "") {
              updated.qty = "";
            } else {
              let n = parseInt(digitsOnly, 10);
              if (updated.product_id) {
                const maxForLine = poMaxQtyForLineInput(prev, key, productQtyLimits);
                if (maxForLine != null && n > maxForLine) n = maxForLine;
              }
              updated.qty = String(n);
            }
          }
        }

        return updated;
      });

      if (patch.product_id !== undefined) {
        setProductQtyLimits((limits) => poPruneProductQtyLimits(next, limits));
      }

      return next;
    });
    if (fetchPricing) {
      void applyVariantPricingToRow(key, fetchPricing.productId, fetchPricing.size, fetchPricing.color);
    }
  };

  const blurQtyItem = (key) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const raw = String(row.qty ?? "").trim();
        let n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 1) n = 1;
        const maxForLine = poMaxQtyForLineInput(prev, key, productQtyLimits);
        if (maxForLine != null && n > maxForLine) n = Math.max(1, maxForLine);
        return { ...row, qty: n };
      }),
    );
  };

  const setProductQtyLimit = (productId, value) => {
    const pid = String(productId ?? "").trim();
    if (!pid) return;
    setProductQtyLimits((prev) => {
      const nextLimits = { ...prev, [pid]: value };
      setItems((rows) =>
        rows.map((row) => {
          if (String(row.product_id ?? "") !== pid) return row;
          const maxForLine = poMaxQtyForLineInput(rows, row.key, nextLimits);
          if (maxForLine == null) return row;
          const requested = Math.max(1, Number(row.qty) || 1);
          if (requested <= maxForLine) return row;
          return { ...row, qty: maxForLine };
        }),
      );
      return nextLimits;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyPoItem()]);
  };

  const addVariantForLine = (sourceKey) => {
    const source = items.find((r) => r.key === sourceKey);
    if (!source?.product_id) return;
    const newLine = createPoItemVariantFromLine(source);
    setItems((prev) => {
      const idx = prev.findIndex((r) => r.key === sourceKey);
      if (idx === -1) return [...prev, newLine];
      const next = [...prev];
      next.splice(idx + 1, 0, newLine);
      return next;
    });
    setSaveError("");
  };

  const removeItem = (key) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((row) => row.key !== key);
      setProductQtyLimits((limits) => poPruneProductQtyLimits(next, limits));
      return next;
    });
  };

  const validItems = () =>
    items.filter(
      (row) =>
        row.product_id &&
        String(row.size ?? "").trim() &&
        String(row.color ?? "").trim() &&
        Number(row.qty) >= 1 &&
        String(row.cost_per_unit ?? "").trim() !== "" &&
        Number.isFinite(Number(row.cost_per_unit)) &&
        Number(row.cost_per_unit) >= 0,
    );

  const submit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError("");

    if (!supplierId) {
      setSaveError("Please select a supplier.");
      return;
    }
    const lineErrors = validatePoFormItems(items, productById, productQtyLimits);
    if (lineErrors.length) {
      setSaveError(lineErrors[0]);
      if (qtyLimitIssues.length) {
        qtyLimitAlertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    const rows = validItems();
    if (!rows.length) {
      setSaveError("Complete every line: product, size, color, quantity, and cost per unit.");
      return;
    }

    const productLimitsPayload = poProductQtyLimitPayload(productQtyLimits, rows);
    if (!productLimitsPayload.length) {
      setSaveError("Set total qty limit for each product on this order.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveSuccessMessage("");
    try {
      const payload = {
        supplier_id: Number(supplierId),
        po_number: poNumber.trim() || undefined,
        order_date: orderDate,
        expected_delivery: expectedDelivery.trim() || null,
        purchaser: isEditMode
          ? (orderToEdit?.purchaser?.trim() || null)
          : String(user?.name ?? "").trim() || null,
        notes: notes.trim() || null,
        items: rows.map((row) => ({
          product_id: Number(row.product_id),
          size: row.size?.trim() || null,
          color: row.color?.trim() || null,
          qty: Math.max(1, Number(row.qty) || 1),
          cost_per_unit: Number(row.cost_per_unit) || 0,
          sell_price: Number(row.sell_price) || 0,
        })),
        product_limits: productLimitsPayload,
      };
      const { data } = isEditMode
        ? await api.put(`/admin/purchase-orders/${orderToEdit.id}`, payload)
        : await api.post("/admin/purchase-orders", payload);

      const order = data?.data ?? data;
      const savedPo = order?.po_number || "";
      setSaveSuccessMessage(
        isEditMode
          ? savedPo
            ? `Purchase order ${savedPo} updated.`
            : "Purchase order updated."
          : savedPo
            ? `Purchase order ${savedPo} saved as draft. Stock will increase when marked as received.`
            : "Purchase order saved as draft.",
      );
      onCatalogRefresh?.();
      onSuccess?.(order);
    } catch (err) {
      setSaveError(
        getAdminValidationMessage(
          err,
          isEditMode ? "Could not update purchase order." : "Could not save purchase order.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-5">
        {saveSuccessMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            {saveSuccessMessage}
          </div>
        ) : null}

        <WorkflowHint />

        <PoSection
          icon={ClipboardList}
          title="Order details"
          description="Buy from a supplier — inventory stays unchanged until the PO is marked received."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyField label="PO Number" value={poNumber || nextPoNumber || "Auto-generated"} mono />
            <div>
              <FieldLabel htmlFor="po-supplier" required>
                Supplier
              </FieldLabel>
              <select
                id="po-supplier"
                className={poFieldClass}
                value={supplierId}
                onChange={onSupplierSelectChange}
                required
              >
                <CreateNewSelectOption label="+ Create new supplier…" />
                <option value="">— Select supplier —</option>
                {localSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.supplier_code ? ` (${s.supplier_code})` : ""}
                  </option>
                ))}
              </select>
              {selectedSupplier?.supplier_code ? (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Truck className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                  {selectedSupplier.supplier_code}
                </p>
              ) : null}
            </div>
            <ReadOnlyField
              label="Contact person"
              value={selectedSupplier?.contact_person}
            />
            <ReadOnlyField label="Phone" required value={selectedSupplier?.phone} />
            <ReadOnlyField label="Email" required value={selectedSupplier?.email} />
            <ReadOnlyField label="Country" value={selectedSupplier?.country} />
            <ReadOnlyField
              label="Address"
              value={selectedSupplier?.address}
              multiline
              className="sm:col-span-2"
            />
            <div>
              <FieldLabel htmlFor="po-order-date" required>
                Order Date
              </FieldLabel>
              <input
                id="po-order-date"
                type="date"
                className={`${poFieldClass} dark:[color-scheme:dark]`}
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="po-expected">Expected Date</FieldLabel>
              <input
                id="po-expected"
                type="date"
                className={`${poFieldClass} dark:[color-scheme:dark]`}
                value={expectedDelivery}
                min={orderDate || undefined}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="po-notes">Notes</FieldLabel>
              <textarea
                id="po-notes"
                rows={2}
                className={`${poFieldClass} min-h-[4.5rem] h-auto resize-y py-2.5`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>

        </PoSection>

        <PoSection icon={Package} title="Line items" description="Add products, quantities, and purchase unit prices.">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <FieldLabel htmlFor="po-parts-search">Search products</FieldLabel>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    id="po-parts-search"
                    className={`${poFieldClass} pl-9`}
                    value={partsSearch}
                    onChange={(e) => setPartsSearch(e.target.value)}
                    placeholder="Name, SKU, barcode…"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <FieldLabel htmlFor="po-parts-filter">Show</FieldLabel>
                <select
                  id="po-parts-filter"
                  className={poFieldClass}
                  value={partsFilter}
                  onChange={(e) => setPartsFilter(e.target.value)}
                >
                  <option value="all">All products</option>
                  <option value="low">Low stock</option>
                  <option value="out">Out of stock</option>
                </select>
              </div>
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-600 dark:text-sky-400">
            Order items
          </p>

          {qtyLimitIssues.length ? (
            <div
              ref={qtyLimitAlertRef}
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold">Total quantity over limit — reduce qty before saving</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-[13px]">
                    {qtyLimitIssues.map((issue) => (
                      <li key={issue.productId}>
                        <span className="font-medium">{issue.name}</span>: used{" "}
                        <span className="font-semibold tabular-nums">{issue.used}</span> / limit{" "}
                        <span className="font-semibold tabular-nums">{issue.limit}</span>
                        {" "}(over by {issue.overBy})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-sky-50/90 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                  <tr>
                    <th className="w-10 px-2 py-2.5">#</th>
                    <th className="min-w-[200px] px-2 py-2.5">
                      Product<span className="ml-0.5 text-red-500">*</span>
                    </th>
                    <th className="w-[88px] px-2 py-2.5">
                      Size<span className="ml-0.5 text-red-500">*</span>
                    </th>
                    <th className="w-[100px] px-2 py-2.5">
                      Color<span className="ml-0.5 text-red-500">*</span>
                    </th>
                    <th className="w-[72px] px-2 py-2.5">
                      Qty<span className="ml-0.5 text-red-500">*</span>
                    </th>
                    <th className="w-[108px] px-2 py-2.5">
                      Cost/unit ($)<span className="ml-0.5 text-red-500">*</span>
                    </th>
                    <th className="w-[108px] px-2 py-2.5">Sell price ($)</th>
                    <th className="w-[108px] px-2 py-2.5">Total cost</th>
                    <th className="w-[120px] px-2 py-2.5">Subtotal (sell)</th>
                    <th className="w-10 px-2 py-2.5" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950/30">
                  {items.map((row, index) => {
                    const product = productById.get(String(row.product_id));
                    const lineCost = lineMoney(row.qty, row.cost_per_unit);
                    const lineSell = lineMoney(row.qty, row.sell_price);
                    const stockHint = product ? productPartStockHint(product) : null;
                    const lineCatalog = poCatalogOptionsForLine(
                      localProducts,
                      items,
                      row.key,
                      partsSearch,
                      partsFilter,
                    );
                    const sizeOptions = poAvailableSizesForLine(items, row.key, product);
                    const colorOptions = poAvailableColorsForLine(items, row.key, product);
                    const productLimit = row.product_id
                      ? poMaxQtyForProduct(productQtyLimits, row.product_id)
                      : null;
                    const productQtyUsed = row.product_id
                      ? poQtyUsedForProduct(items, row.product_id)
                      : 0;
                    const lineQtyMax = poMaxQtyForLineInput(items, row.key, productQtyLimits);
                    const isFirstProductLine = poIsFirstSameProductLine(items, row.key);
                    const productQtyOver = row.product_id
                      ? qtyLimitIssueByProductId.get(String(row.product_id))
                      : null;
                    const lineQtyNum = Number(row.qty);
                    const lineQtyOver =
                      lineQtyMax != null &&
                      Number.isFinite(lineQtyNum) &&
                      lineQtyNum > lineQtyMax;

                    return (
                      <tr
                        key={row.key}
                        className={`align-top ${productQtyOver ? "bg-red-50/60 dark:bg-red-950/20" : ""}`}
                      >
                        <td className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-2 py-2.5">
                          <select
                            className={poTableFieldClass}
                            value={String(row.product_id ?? "")}
                            onChange={onProductSelectChange(row.key)}
                            required
                            aria-label={`Product for line ${index + 1}`}
                          >
                            <CreateNewSelectOption label="+ Create new product…" />
                            <option value="">— Select product —</option>
                            {lineCatalog.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {productPartOptionLabel(p)}
                              </option>
                            ))}
                          </select>
                          {stockHint ? (
                            <p className="mt-1 text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                              {stockHint}
                            </p>
                          ) : null}
                          {row.product_id && isFirstProductLine ? (
                            <div className="mt-1.5">
                              <label
                                htmlFor={`po-product-limit-${row.key}`}
                                className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400"
                              >
                                Total qty limit<span className="ml-0.5 text-red-500">*</span>
                              </label>
                              <input
                                id={`po-product-limit-${row.key}`}
                                type="number"
                                min={1}
                                step={1}
                                required
                                className={poTableFieldClass}
                                value={productQtyLimits[String(row.product_id)] ?? ""}
                                onChange={(e) => setProductQtyLimit(row.product_id, e.target.value)}
                                placeholder="e.g. 100"
                                aria-label={`Total quantity limit for ${product?.name || "product"}`}
                              />
                              <p
                                className={`mt-1 text-[10px] font-medium ${
                                  productQtyOver
                                    ? "font-semibold text-red-700 dark:text-red-300"
                                    : "text-sky-700 dark:text-sky-300"
                                }`}
                              >
                                Used {productQtyUsed}
                                {productLimit != null ? ` / ${productLimit}` : ""} across all sizes & colors
                                {productQtyOver ? ` — over by ${productQtyOver.overBy}` : ""}
                              </p>
                            </div>
                          ) : row.product_id && productLimit != null ? (
                            <p
                              className={`mt-1.5 text-[10px] font-medium ${
                                productQtyOver
                                  ? "font-semibold text-red-700 dark:text-red-300"
                                  : "text-sky-700 dark:text-sky-300"
                              }`}
                            >
                              Qty budget: {productQtyUsed} / {productLimit}
                              {productQtyOver ? ` — over by ${productQtyOver.overBy}` : ""}
                            </p>
                          ) : null}
                          {row.product_id && poIsLastSameProductLine(items, row.key) ? (
                            <button
                              type="button"
                              onClick={() => addVariantForLine(row.key)}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-sky-200/80 bg-sky-50/80 px-2 py-1 text-[10px] font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
                              title="Same product — only pick size, color, and qty"
                            >
                              <Copy className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                              Add same product
                            </button>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5">
                          <select
                            className={poTableFieldClass}
                            value={row.size ?? ""}
                            disabled={!row.product_id}
                            required={Boolean(row.product_id)}
                            onChange={(e) => updateItem(row.key, { size: e.target.value })}
                            aria-label={`Size for line ${index + 1}`}
                          >
                            <option value="">— Select size —</option>
                            {sizeOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2.5">
                          <select
                            className={poTableFieldClass}
                            value={row.color ?? ""}
                            disabled={!row.product_id}
                            required={Boolean(row.product_id)}
                            onChange={(e) => updateItem(row.key, { color: e.target.value })}
                            aria-label={`Color for line ${index + 1}`}
                          >
                            <option value="">— Select color —</option>
                            {colorOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            id={`po-qty-${row.key}`}
                            type="number"
                            min={1}
                            max={lineQtyMax != null && lineQtyMax >= 1 ? lineQtyMax : undefined}
                            step={1}
                            inputMode="numeric"
                            required
                            className={`${poTableFieldClass} ${
                              productQtyOver || lineQtyOver
                                ? "border-red-400 focus:border-red-500 focus:ring-red-200/80 dark:border-red-600 dark:focus:ring-red-900/40"
                                : ""
                            }`}
                            value={row.qty === "" ? "" : row.qty}
                            onChange={(e) => updateItem(row.key, { qty: e.target.value })}
                            onBlur={() => blurQtyItem(row.key)}
                            aria-label={`Quantity for line ${index + 1}`}
                            aria-invalid={productQtyOver || lineQtyOver ? true : undefined}
                          />
                          {row.product_id && productLimit != null ? (
                            <p
                              className={`mt-1 text-[10px] font-medium ${
                                productQtyOver || lineQtyOver
                                  ? "font-semibold text-red-600 dark:text-red-400"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              Max {Math.max(0, lineQtyMax ?? 0)} on this line
                              {lineQtyOver ? " — reduce qty" : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            id={`po-price-${row.key}`}
                            type="number"
                            min={0}
                            step="0.01"
                            required={Boolean(row.product_id)}
                            className={poTableFieldClass}
                            value={row.cost_per_unit}
                            onChange={(e) => updateItem(row.key, { cost_per_unit: e.target.value })}
                            aria-label={`Cost per unit for line ${index + 1}`}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            id={`po-sell-${row.key}`}
                            type="number"
                            min={0}
                            step="0.01"
                            className={poTableFieldClass}
                            value={row.sell_price}
                            onChange={(e) => updateItem(row.key, { sell_price: e.target.value })}
                            aria-label={`Sell price for line ${index + 1}`}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className={poTableReadOnlyClass}>{formatPoMoney(lineCost)}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className={poTableReadOnlyClass}>{formatPoMoney(lineSell)}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          {items.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeItem(row.key)}
                              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              aria-label={`Remove line ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--admin-primary)]/40 bg-[color:var(--admin-primary)]/[0.06] px-3 py-2 text-sm font-semibold text-[color:var(--admin-primary)] transition hover:bg-[color:var(--admin-primary)]/10 dark:text-slate-100"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Add item
              </button>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">Add item</span> — pick a product not already on this order and set its total qty limit.{" "}
                <span className="font-semibold">Add same product</span> — copy product and prices; only change size, color, and qty (shared limit).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 dark:text-slate-200">
              <span>
                Total cost:{" "}
                <strong className="tabular-nums text-slate-900 dark:text-slate-50">
                  {formatPoMoney(totals.cost)}
                </strong>
              </span>
              <span>
                Total sell:{" "}
                <strong className="tabular-nums text-slate-900 dark:text-slate-50">
                  {formatPoMoney(totals.sell)}
                </strong>
              </span>
            </div>
          </div>
        </PoSection>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3.5 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.15)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/30">
          {saveError ? (
            <div className="mr-auto max-w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
              {saveError}
            </div>
          ) : (
            <p className="mr-auto hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              {isEditMode ? (
                <>
                  Updates <span className="font-semibold text-slate-700 dark:text-slate-200">draft</span> purchase
                  order
                </>
              ) : (
                <>
                  Saves as <span className="font-semibold text-slate-700 dark:text-slate-200">draft</span>
                </>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || qtyLimitIssues.length > 0}
            title={
              qtyLimitIssues.length
                ? "Reduce total quantity to fit each product limit before saving"
                : undefined
            }
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${accentIsWhite ? "border border-slate-300 text-slate-900" : "text-white"
              }`}
            style={{ backgroundColor: accentIsWhite ? "#FFFFFF" : accentColor }}
          >
            {isSaving
              ? isEditMode
                ? "Saving…"
                : "Creating…"
              : isEditMode
                ? "Save purchase order"
                : "Create purchase order"}
          </button>
        </div>
      </form>

      <AdminModal
        open={showSupplierCreateModal}
        onClose={closeSupplierCreateModal}
        title="New supplier"
        titleId="po-embedded-supplier-create-title"
        maxWidthClass="max-w-3xl"
        zIndexClass="z-[60]"
        closeOnBackdrop={!showProductCreateModal}
      >
        {showSupplierCreateModal ? (
          <SupplierCreateForm
            existingSuppliers={localSuppliers}
            idPrefix="po-supplier"
            nameFirst
            submitLabel="Create supplier"
            onCancel={closeSupplierCreateModal}
            onSuccess={handleSupplierCreated}
          />
        ) : null}
      </AdminModal>

      <AdminModal
        open={showProductCreateModal}
        onClose={closeProductCreateModal}
        title="Add new product"
        titleId="po-embedded-product-create-title"
        maxWidthClass="max-w-5xl"
        zIndexClass="z-[61]"
        closeOnBackdrop={!showSupplierCreateModal}
      >
        {showProductCreateModal && productCreateLineKey ? (
          <AdminProducts
            embeddedInPo
            embeddedOpen={showProductCreateModal}
            embeddedSupplierId={supplierId || null}
            embeddedOnCreated={(product, lineDefaults) => {
              applyProductToLine(productCreateLineKey, product, lineDefaults);
              onCatalogRefresh?.();
              closeProductCreateModal();
            }}
            embeddedOnClose={closeProductCreateModal}
          />
        ) : null}
      </AdminModal>
    </>
  );
}
