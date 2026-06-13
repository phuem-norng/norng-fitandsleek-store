import { useSyncExternalStore } from "react";

function subscribe(onChange) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-admin-sidebar-pinned"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.adminSidebarPinned !== "false";
}

function getServerSnapshot() {
  return true;
}

/** True when the admin sidebar is pinned open (full labels, ~260px). */
export function useAdminSidebarPinned() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
