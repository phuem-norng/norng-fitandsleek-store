import React, { useEffect, useId, useRef } from "react";
import { pushAdminModalChrome, popAdminModalChrome } from "../../lib/adminDarkChrome.js";

/**
 * Shared admin dialog shell: blurred page overlay + dimmed sidebar (data-admin-modal).
 */
export default function AdminModal({
  open,
  onClose,
  title,
  titleId: titleIdProp,
  children,
  maxWidthClass = "max-w-3xl",
  initialFocusSelector = "button, select, input, textarea, [href]",
  closeOnBackdrop = true,
}) {
  const autoId = useId();
  const titleId = titleIdProp || `admin-modal-title-${autoId}`;
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    pushAdminModalChrome();
    const t = window.setTimeout(() => {
      ref.current?.querySelector(initialFocusSelector)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      popAdminModalChrome();
    };
  }, [open, initialFocusSelector]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        className={`relative w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40`}
      >
        {title ? (
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
}) {
  return (
    <AdminModal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      maxWidthClass="max-w-md"
      initialFocusSelector="button"
      closeOnBackdrop={!busy}
    >
      {message ? (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{message}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50 ${
            destructive ? "bg-red-600 hover:bg-red-700" : "bg-[color:var(--admin-primary)]"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </AdminModal>
  );
}
