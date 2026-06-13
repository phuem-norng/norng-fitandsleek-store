import React from "react";

/** Auto-dismiss success message (Home Page Manager style). */
export function flashAdminMessage(setter, message, ms = 3000) {
  setter(message);
  if (message) {
    window.setTimeout(() => setter(""), ms);
  }
}

/** Fixed top-right toast after save — matches Home Page Manager. */
export default function AdminSaveToast({ message }) {
  if (!message) return null;

  return (
    <div
      className="fixed top-6 right-6 z-[60] flex max-w-sm items-center gap-3 rounded-xl border border-[rgba(var(--admin-primary-rgb),0.35)] bg-[color:var(--admin-primary)] px-5 py-3 text-white shadow-lg dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:bg-[rgba(var(--admin-primary-rgb),0.88)]"
      role="status"
      aria-live="polite"
    >
      <svg className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-sm font-medium leading-snug">{message}</span>
    </div>
  );
}

/** Inline error banner below page title. */
export function AdminFormErrorBanner({ error, onDismiss }) {
  if (!error) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-700/60 dark:bg-red-900/40">
      <svg className="h-6 w-6 shrink-0 text-red-500 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="flex-1 text-sm font-medium text-red-700 dark:text-red-200">{error}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm font-semibold text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
