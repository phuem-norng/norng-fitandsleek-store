import React, { useEffect, useId, useRef } from "react";
import { pushAdminModalChrome, popAdminModalChrome } from "../../lib/adminDarkChrome.js";

/**
 * Shared admin dialog shell: blurred page overlay + dimmed sidebar (data-admin-modal).
 */
export default function AdminModal({
  open,
  onClose,
  title,
  /** Optional icon node shown beside the title (e.g. lucide icon in a rounded box). */
  titleIcon = null,
  titleId: titleIdProp,
  children,
  maxWidthClass = "max-w-3xl",
  zIndexClass = "z-50",
  initialFocusSelector = "button, select, input, textarea, [href]",
  closeOnBackdrop = true,
  /** "sheet" = top-aligned, near full viewport height. */
  variant = "default",
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

  const isSheet = variant === "sheet";

  return (
    <div
      ref={ref}
      className={`fixed inset-0 ${zIndexClass} flex justify-center ${
        isSheet ? "items-start px-3 pb-3 pt-3 sm:px-4 sm:pt-4" : "items-center p-4"
      }`}
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
        className={`relative flex w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40 ${
          isSheet
            ? `${maxWidthClass} h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)]`
            : `${maxWidthClass} max-h-[90vh] overflow-y-auto`
        }`}
      >
        <div
          className={
            isSheet
              ? "flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-6"
              : "overflow-y-auto p-6"
          }
        >
          {title ? (
            <div className={`flex shrink-0 items-center justify-between gap-3 ${isSheet ? "mb-4" : "mb-6"}`}>
              <div className="flex min-w-0 items-center gap-3">
                {titleIcon ? (
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[color:var(--admin-primary)] dark:border-slate-600 dark:bg-slate-800"
                    aria-hidden
                  >
                    {titleIcon}
                  </div>
                ) : null}
                <h2
                  id={titleId}
                  className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white"
                >
                  {title}
                </h2>
              </div>
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
