import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import { getAdminValidationMessage } from "../../lib/adminValidation.js";
import SupplierFormFields from "./SupplierFormFields.jsx";

const EMPTY = {
  supplier_code: "",
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  is_active: true,
};

export default function SupplierCreateForm({
  onSuccess,
  onCancel,
  showToast = true,
  existingSuppliers = [],
  idPrefix = "qc",
  nameFirst = false,
  submitLabel = "Create Supplier",
}) {
  const { primaryColor, mode } = useTheme();
  const accentColor = mode === "dark" ? "#FFFFFF" : primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";
  const [form, setForm] = useState(EMPTY);
  const [nextSupplierCode, setNextSupplierCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const duplicateCodeMessage = "This Supplier ID is already in use. Please choose a different one.";

  const isDuplicateSupplierCode = (code) => {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return false;
    return existingSuppliers.some(
      (s) => String(s.supplier_code || "").trim().toUpperCase() === normalized,
    );
  };

  const createCodeError = isDuplicateSupplierCode(form.supplier_code) ? duplicateCodeMessage : "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/admin/suppliers");
        if (cancelled) return;
        const code = data?.next_supplier_code || "";
        setNextSupplierCode(code);
        setForm((p) => ({ ...p, supplier_code: p.supplier_code || code }));
      } catch {
        /* keep empty */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const payloadFromValues = (values) => ({
    supplier_code: values.supplier_code?.trim() || "",
    name: values.name.trim(),
    contact_person: values.contact_person?.trim() || null,
    email: values.email.trim(),
    phone: values.phone.trim(),
    address: values.address?.trim() || null,
    city: values.city?.trim() || null,
    country: values.country?.trim() || null,
    is_active: !!values.is_active,
  });

  const create = async (e) => {
    e.preventDefault();
    if (isCreating) return;
    setCreateError("");
    if (isDuplicateSupplierCode(form.supplier_code)) {
      setCreateError(duplicateCodeMessage);
      return;
    }
    setIsCreating(true);
    loadingAlert({
      khTitle: "កំពុងបង្កើតអ្នកផ្គត់ផ្គង់",
      enTitle: "Creating supplier",
      khText: "សូមរង់ចាំបន្តិច",
      enText: "Please wait",
    });
    try {
      const response = await api.post("/admin/suppliers", payloadFromValues(form));
      if (![200, 201].includes(response?.status)) {
        throw new Error("Create failed.");
      }
      const created = response?.data?.data || response?.data;
      closeSwal();
      if (showToast) {
        await toastSuccess({
          khText: "បានបង្កើតអ្នកផ្គត់ផ្គង់ដោយជោគជ័យ",
          enText: "Supplier created!",
        });
      }
      onSuccess?.(created);
    } catch (e2) {
      closeSwal();
      const detail = getAdminValidationMessage(e2);
      setCreateError(detail);
      await errorAlert({
        khTitle: "បង្កើតអ្នកផ្គត់ផ្គង់បរាជ័យ",
        enTitle: "Create failed",
        detail,
      });
    } finally {
      closeSwal();
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={create} className="pt-1">
      <SupplierFormFields
        values={form}
        onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        suggestedCode={nextSupplierCode}
        onRegenerateCode={() => setForm((p) => ({ ...p, supplier_code: nextSupplierCode }))}
        codeError={createCodeError || (createError && String(createError).toLowerCase().includes("supplier") ? createError : "")}
        idPrefix={idPrefix}
        nameFirst={nameFirst}
      />
      <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-end gap-3">
        {createError && !createCodeError ? (
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
          className={`px-6 py-2.5 rounded-lg font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed border text-sm ${accentIsWhite ? "border-slate-300" : ""}`}
          style={{
            backgroundColor: accentColor,
            color: accentIsWhite ? "#0b0b0f" : "#FFFFFF",
            borderColor: accentIsWhite ? "#cbd5e1" : accentColor,
          }}
        >
          {isCreating ? "Creating…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
