import React from "react";

function RequiredMark() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

function FormSection({ title, children }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldLabel({ children, required = false, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}

export const supplierInputClass =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-slate-200/80 dark:focus:ring-slate-700/80";

export default function SupplierFormFields({
  values,
  onChange,
  suggestedCode,
  onRegenerateCode,
  isEdit = false,
  codeError = "",
  idPrefix = "",
  /** Purchase order inline create: supplier name before ID. */
  nameFirst = false,
}) {
  const showRegenerate =
    !isEdit &&
    suggestedCode &&
    String(values.supplier_code || "").trim().toUpperCase() !== String(suggestedCode).trim().toUpperCase();

  const pid = (name) => (idPrefix ? `${idPrefix}-${name}` : name);

  const supplierNameField = (
    <div>
      <FieldLabel htmlFor={pid("supplier_name")} required>
        Supplier name
      </FieldLabel>
      <input
        id={pid("supplier_name")}
        className={supplierInputClass}
        value={values.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="e.g. ABC Trading Co."
        required
      />
    </div>
  );

  const supplierIdField = (
    <div>
      <FieldLabel htmlFor={pid("supplier_code")} required>
        Supplier ID
      </FieldLabel>
      <input
        id={pid("supplier_code")}
        className={`${supplierInputClass} ${codeError ? "border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-200/80 dark:focus:ring-red-900/40" : ""}`}
        value={values.supplier_code || ""}
        onChange={(e) => onChange({ supplier_code: e.target.value.toUpperCase() })}
        placeholder="e.g. SUP-001"
        required
        minLength={2}
      />
      {codeError ? (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{codeError}</p>
      ) : !isEdit ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
          <span>Auto-generated — must be unique</span>
          {showRegenerate && onRegenerateCode ? (
            <button
              type="button"
              onClick={onRegenerateCode}
              className="font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline-offset-2 hover:underline"
            >
              Use {suggestedCode}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Must be unique across all suppliers</p>
      )}
    </div>
  );

  const statusField = (
    <div>
      <FieldLabel htmlFor={pid("supplier_status")}>Status</FieldLabel>
      <select
        id={pid("supplier_status")}
        className={supplierInputClass}
        value={values.is_active ? "active" : "inactive"}
        onChange={(e) => onChange({ is_active: e.target.value === "active" })}
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );

  const basicFields = nameFirst ? (
    <div className="space-y-4">
      {supplierNameField}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {supplierIdField}
        {statusField}
      </div>
    </div>
  ) : (
    <FormSection title="Basic Information">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {supplierIdField}
        {statusField}
      </div>
      {supplierNameField}
    </FormSection>
  );

  return (
    <div className="space-y-7">
      {basicFields}

      <FormSection title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor={pid("contact_person")}>Contact person</FieldLabel>
            <input
              id={pid("contact_person")}
              className={supplierInputClass}
              value={values.contact_person || ""}
              onChange={(e) => onChange({ contact_person: e.target.value })}
              placeholder="e.g. John Smith"
            />
          </div>
          <div>
            <FieldLabel htmlFor={pid("supplier_phone")} required>
              Phone
            </FieldLabel>
            <input
              id={pid("supplier_phone")}
              className={supplierInputClass}
              value={values.phone || ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="+855 XX XXX XXX"
              required
            />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor={pid("supplier_email")} required>
            Email
          </FieldLabel>
          <input
            id={pid("supplier_email")}
            type="email"
            className={supplierInputClass}
            value={values.email || ""}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="supplier@example.com"
            required
          />
        </div>
      </FormSection>

      <FormSection title="Location">
        <div>
          <FieldLabel htmlFor={pid("supplier_address")}>Address</FieldLabel>
          <textarea
            id={pid("supplier_address")}
            rows={3}
            className={`${supplierInputClass} resize-y min-h-[88px]`}
            value={values.address || ""}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Street address, building, floor..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor={pid("supplier_city")}>City</FieldLabel>
            <input
              id={pid("supplier_city")}
              className={supplierInputClass}
              value={values.city || ""}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="e.g. Phnom Penh"
            />
          </div>
          <div>
            <FieldLabel htmlFor={pid("supplier_country")}>Country</FieldLabel>
            <input
              id={pid("supplier_country")}
              className={supplierInputClass}
              value={values.country || ""}
              onChange={(e) => onChange({ country: e.target.value })}
              placeholder="e.g. Cambodia"
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}
