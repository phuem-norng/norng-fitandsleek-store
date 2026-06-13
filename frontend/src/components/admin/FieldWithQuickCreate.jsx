import React from "react";

export default function FieldWithQuickCreate({
  label,
  htmlFor,
  required = false,
  optionalHint,
  invalid = false,
  children,
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className={`mb-1.5 block text-sm font-medium ${
          invalid ? "text-red-600 dark:text-red-400" : "text-[#183c6b] dark:text-slate-200"
        }`}
      >
        {label}
        {required ? <span className="text-red-500" aria-hidden> *</span> : null}
        {optionalHint ? (
          <span className="font-normal text-slate-500 dark:text-slate-400"> {optionalHint}</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

/** Sentinel value for the first “Create new…” row in product relation dropdowns. */
export const QUICK_CREATE_OPTION = "__create_new__";

export function CreateNewSelectOption({ label = "+ Create new…" }) {
  return (
    <option value={QUICK_CREATE_OPTION} className="font-semibold text-[color:var(--admin-primary)]">
      {label}
    </option>
  );
}
