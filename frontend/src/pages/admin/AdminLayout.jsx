import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import AdminTopbar from "../../components/admin/AdminTopbar";
import Logo from "../../components/Logo.jsx";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { errorAlert, toastSuccess } from "../../lib/swal";
import { useTheme } from "../../state/theme.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
/** Pinned = full width; unpinned = narrow rail — label tooltip on hover (rail); light bubble in dark mode. */
const SB_W_PINNED = "md:!w-[260px]";
const SB_W_RAIL = "md:w-20";
const SIDEBAR_WIDTH_EASE = "md:transition-[width] md:duration-150 md:ease-out";
const SIDEBAR_ACCORDION_EASE = "duration-200 ease-out";

/** Inline label in the rail (hidden on desktop when unpinned; tooltips show names instead). */
function navLabelClass(pinnedOpen) {
  if (pinnedOpen) return "min-w-0 flex-1 truncate";
  return "min-w-0 flex-1 truncate md:hidden";
}

/** Tooltip: parent must use `group/rail-tip relative` (wrapper around control + this span — hover bridge, zero delay). */
const RAIL_TIP_WRAP = "group/rail-tip relative isolate";
/** Portaled tooltip (fixed); left caret; position from full rail-row wrapper rect. */
const RAIL_SIDEBAR_TOOLTIP_BUBBLE =
  "pointer-events-none fixed z-[240] min-w-max max-w-[min(272px,calc(100vw-12px))] -translate-y-1/2 rounded-md border-0 bg-black px-3 py-[7px] text-left text-[13px] font-semibold leading-snug tracking-tight text-white shadow-none transition-opacity duration-150 ease-out before:pointer-events-none before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-y-[7px] before:border-y-transparent before:border-r-[8px] before:border-r-black before:content-[''] dark:bg-white dark:text-black dark:before:border-r-white";

/** Always wrap with rail-tip group so tooltip is available in both pinned & icon modes. */
const ALWAYS_RAIL_TIP_WRAP = RAIL_TIP_WRAP;

/** Tooltip bubble portaled to `document.body`; anchor = rail tooltip wrapper bounds. */
function RailSidebarBubble({ anchorRef, open, children }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const syncPosition = useCallback(() => {
    const el = anchorRef?.current;
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return;
    setPos({
      top: r.top + r.height / 2,
      left: r.right + 10,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    syncPosition();

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      syncPosition();
      raf2 = requestAnimationFrame(() => syncPosition());
    });

    const delays = [0, 180, 360];
    const tIds = delays.map((ms) => window.setTimeout(syncPosition, ms));

    let ro = null;
    const el = anchorRef.current;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => syncPosition());
      ro.observe(el);
      const aside = el.closest?.("aside");
      if (aside) ro.observe(aside);
    }

    const capture = true;
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, capture);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      tIds.forEach((id) => window.clearTimeout(id));
      ro?.disconnect();
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, capture);
    };
  }, [open, syncPosition]);

  if (!open) return null;

  return createPortal(
    <div
      role="tooltip"
      className={`${RAIL_SIDEBAR_TOOLTIP_BUBBLE} opacity-100`}
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
    >
      {children}
    </div>,
    document.body
  );
}

function RailGroupFlyout({ group, pos, onClose }) {
  if (!group || !pos) return null;

  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
  const panelGap = 12;
  const estimatedHeight = Math.min(
    viewportHeight - panelGap * 2,
    54 + group.children.length * 48 + Math.max(0, group.children.length - 1) * 4,
  );
  const panelTop = Math.max(
    panelGap,
    Math.min(pos.top - estimatedHeight / 2, viewportHeight - estimatedHeight - panelGap),
  );
  const arrowTop = Math.max(22, Math.min(pos.top - panelTop, estimatedHeight - 22));

  return createPortal(
    <div
      data-sidebar-group-flyout
      className="fixed z-[260] flex w-[min(19rem,calc(100vw-7rem))] flex-col rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-slate-950/[0.04] before:absolute before:right-full before:top-[var(--flyout-arrow-top)] before:-translate-y-1/2 before:border-y-[10px] before:border-y-transparent before:border-r-[11px] before:border-r-white before:content-[''] dark:border-white/10 dark:bg-slate-900 dark:text-white dark:shadow-black/40 dark:ring-white/10 dark:before:border-r-slate-900"
      style={{
        top: `${panelTop}px`,
        left: `${pos.left}px`,
        maxHeight: `calc(100vh - ${panelGap * 2}px)`,
        "--flyout-arrow-top": `${arrowTop}px`,
      }}
    >
      <div className="shrink-0 px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {group.label}
      </div>
      <div className="min-h-0 space-y-1 overflow-y-auto pr-1">
        {group.children.map((child) => (
          <NavLink
            key={child.path}
            to={child.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${isActive
                ? "bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)]"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
              }`
            }
          >
            {child.icon ? (
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={child.icon} />
              </svg>
            ) : (
              <span className="h-1 w-1 shrink-0 rounded-[1px] bg-current opacity-45" aria-hidden />
            )}
            <span className="truncate">{child.label}</span>
          </NavLink>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Narrow-rail tooltip host: mouse hover only when unpinned (`labelsVisible` = false).
 * Does not portal when pinned (sidebar expanded shows labels).
 */
function RailTooltipWrap({ labelsVisible, tip, children, className = "" }) {
  const anchorRef = useRef(null);
  const [hover, setHover] = useState(false);

  const pinnedOpen = !!labelsVisible;
  const open = !pinnedOpen && hover;

  return (
    <>
      <div
        ref={anchorRef}
        className={`${ALWAYS_RAIL_TIP_WRAP} ${className}`.trim()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {children}
      </div>
      <RailSidebarBubble anchorRef={anchorRef} open={open}>
        {tip}
      </RailSidebarBubble>
    </>
  );
}

function brandBlockClass(pinnedOpen) {
  if (pinnedOpen) return "min-w-0 flex-1 text-left";
  return "hidden";
}

function groupChevronClass(pinnedOpen, isOpen) {
  const rot = isOpen ? "-rotate-90" : "rotate-90";
  if (pinnedOpen) return `h-4 w-4 shrink-0 transition-transform ${SIDEBAR_ACCORDION_EASE} ${rot}`;
  return `hidden h-4 w-4 shrink-0 ${rot} md:hidden`;
}

function NavSectionHeader({ children, pinnedOpen }) {
  if (!pinnedOpen) return null;
  return (
    <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}

function NavSectionDivider({ pinnedOpen }) {
  if (!pinnedOpen) return null;
  return <div className="mx-2 my-2 border-t border-slate-200 dark:border-slate-800" aria-hidden />;
}

function NavBadge({ count, tone = "primary" }) {
  if (!count || count < 1) return null;
  const display = count > 99 ? "99+" : String(count);
  const toneCls =
    tone === "alert"
      ? "bg-red-500 text-white"
      : "bg-[color:var(--admin-primary)] text-white";
  return (
    <span
      className={`ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none ${toneCls}`}
    >
      {display}
    </span>
  );
}

function sidebarNavRowClass(pinnedOpen, isActive) {
  const base =
    `touch-manipulation relative flex min-h-[52px] w-full shrink-0 cursor-pointer items-center gap-3 rounded-xl text-sm outline-none transition-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-[rgba(var(--admin-primary-rgb),0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[color:var(--admin-canvas)]`;
  const layout = pinnedOpen
    ? "justify-start px-3 py-2.5"
    : "justify-center px-2 py-2";
  const inactiveHover =
    "text-slate-600 hover:bg-[rgba(var(--admin-primary-rgb),0.1)] hover:text-[color:var(--admin-primary)] dark:text-slate-300 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)] dark:hover:text-[color:var(--admin-primary)]";
  const activeCls = isActive
    ? "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r before:bg-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] font-semibold dark:bg-[rgba(var(--admin-primary-rgb),0.18)] dark:text-[color:var(--admin-primary)]"
    : inactiveHover;
  return `${base} ${layout} ${activeCls}`;
}

function sidebarSubLinkClass(isActive) {
  const base =
    `relative flex w-full cursor-pointer items-center rounded-lg text-[13px] outline-none transition-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--admin-primary-rgb),0.3)]`;
  const layout = "min-h-[42px] px-2.5 py-2";
  const inactiveHover =
    "text-slate-600 hover:bg-[rgba(var(--admin-primary-rgb),0.08)] hover:text-[color:var(--admin-primary)] dark:text-slate-300 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.1)] dark:hover:text-[color:var(--admin-primary)]";
  const activeCls = isActive
    ? "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.1)] text-[color:var(--admin-primary)] font-semibold dark:bg-[rgba(var(--admin-primary-rgb),0.16)] dark:text-[color:var(--admin-primary)]"
    : inactiveHover;
  return `${base} ${layout} ${activeCls}`;
}

const NAV_ICON_CLASS = "h-6 w-6 shrink-0";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { settings, loading: settingsLoading, reloadSettings } = useHomepageSettings();
  const { primaryColor, contentLayout, sidebarMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    users: false,
    settings: false,
  });
  const [railGroupFlyout, setRailGroupFlyout] = useState(null);
  const [navBadges, setNavBadges] = useState({ orders: 0, messages: 0 });
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef(null);
  const logoSrc = settings?.header?.logo_url || "/logo.png";

  const onLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    setLogoUploading(true);
    try {
      await api.post("/admin/homepage-settings/logo-upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await reloadSettings?.();
      await toastSuccess({ enText: "Store logo updated. It will show on the storefront header too." });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (Array.isArray(err?.response?.data?.errors?.logo) ? err.response.data.errors.logo[0] : null) ||
        err?.message ||
        "Upload failed.";
      await errorAlert({ enTitle: "Logo upload failed", enText: String(msg) });
    } finally {
      setLogoUploading(false);
    }
  };

  useEffect(() => {
    if (!sidebarOpen) setOpenGroups({ users: false, settings: false });
    if (sidebarOpen) setRailGroupFlyout(null);
  }, [sidebarOpen]);

  useEffect(() => {
    document.documentElement.classList.add("admin-dashboard");
    return () => document.documentElement.classList.remove("admin-dashboard");
  }, []);

  useEffect(() => {
    setSidebarOpen(sidebarMode !== "icon");
  }, [sidebarMode]);

  useEffect(() => {
    setRailGroupFlyout(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!railGroupFlyout) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (target?.closest?.("[data-sidebar-group-flyout]")) return;
      if (target?.closest?.("[data-sidebar-group-trigger]")) return;
      setRailGroupFlyout(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setRailGroupFlyout(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [railGroupFlyout]);

  if (settingsLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col p-6">
        <AdminContentSkeleton lines={2} imageHeight={160} className="mx-auto w-full max-w-4xl flex-1" />
      </div>
    );
  }

  const dashboardItems = useMemo(
    () => [
      {
        path: "/admin",
        icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
        label: "Dashboard",
      },
    ],
    []
  );

  const commerceNavItems = useMemo(
    () => [
      { path: "/admin/products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", label: "Products" },
      {
        path: "/admin/orders",
        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
        label: "Orders",
        badgeKey: "orders",
        badgeTone: "alert",
      },
      { path: "/admin/discounts", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Discount" },
      { path: "/admin/checkout", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", label: "Checkout" },
      { path: "/admin/categories", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", label: "Categories" },
      { path: "/admin/brands", icon: "M7 4h10M7 8h10M7 12h10M7 16h10M7 20h10", label: "Brands" },
      { path: "/admin/stock-inventory", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4", label: "Stock & Inventory" },
      { path: "/admin/stock-received", icon: "M20 13V7a2 2 0 00-2-2h-3.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 0011.172 3H6a2 2 0 00-2 2v8m16 0l-4 4m4-4l-4-4m4 4H8m-4 4h6m-6 4h12", label: "Stock Received" },
      { path: "/admin/payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", label: "Payments" },
    ],
    []
  );

  const operationsNavItems = useMemo(
    () => [
      { path: "/admin/reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Reports" },
      { path: "/admin/contacts", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", label: "Contacts" },
      {
        path: "/admin/messages",
        icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
        label: "Messages",
        badgeKey: "messages",
      },
      { path: "/admin/notifications", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", label: "Notifications" },
      { path: "/admin/replacement-cases", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", label: "Replacements" },
    ],
    []
  );

  const peopleNavGroup = useMemo(
    () => ({
      key: "users",
      label: "Users",
      icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
      children: [
        { path: "/admin/customers", label: "Customers" },
        { path: "/admin/administrators", label: "Administrators" },
      ],
    }),
    []
  );

  const configNavGroup = useMemo(
    () => ({
      key: "settings",
      label: "Settings",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
      children: [
        { path: "/admin/settings", label: "General" },
        { path: "/admin/homepage", label: "Home Page" },
        { path: "/admin/homepage-complete", label: "Complete Manager" },
        { path: "/admin/chatbot", label: "Chatbot" },
        { path: "/admin/profile", label: "My Profile" },
      ],
    }),
    []
  );

  const accordionNavGroups = useMemo(
    () => [peopleNavGroup, configNavGroup],
    [peopleNavGroup, configNavGroup]
  );

  const allNavItems = useMemo(() => {
    const groupsFlat = accordionNavGroups.flatMap((g) => g.children);
    return [...dashboardItems, ...commerceNavItems, ...operationsNavItems, ...groupsFlat];
  }, [dashboardItems, commerceNavItems, operationsNavItems, accordionNavGroups]);

  const bottomNavPaths = ["/admin", "/admin/reports", "/admin/orders", "/admin/payments"];

  const activeBottomIndex = useMemo(() => {
    const idx = bottomNavPaths.findIndex((p) => location.pathname.startsWith(p));
    return idx >= 0 ? idx : 0;
  }, [location.pathname]);

  const bottomNavItems = useMemo(
    () =>
      bottomNavPaths
        .map((path) => allNavItems.find((item) => item.path === path))
        .filter(Boolean),
    [allNavItems]
  );

  const otherNavItems = useMemo(
    () => allNavItems.filter((item) => !bottomNavPaths.includes(item.path)),
    [allNavItems]
  );

  const activeRailGroup = useMemo(
    () => accordionNavGroups.find((group) => group.key === railGroupFlyout?.key) || null,
    [accordionNavGroups, railGroupFlyout?.key]
  );

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      accordionNavGroups.forEach((group) => {
        if (group.children.some((child) => location.pathname.startsWith(child.path))) {
          next[group.key] = true;
        }
      });
      return next;
    });
  }, [accordionNavGroups, location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const loadBadges = async () => {
      try {
        const { data } = await api.get("/admin/nav-badges");
        if (cancelled) return;
        setNavBadges({
          orders: Number(data?.orders) || 0,
          messages: Number(data?.messages) || 0,
        });
      } catch {
        /* badges are optional */
      }
    };
    loadBadges();
    const intervalId = window.setInterval(loadBadges, 120000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleGroup = (groupKey, event) => {
    if (!sidebarOpen) {
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      if (rect) {
        setRailGroupFlyout((prev) => (
          prev?.key === groupKey
            ? null
            : {
              key: groupKey,
              top: rect.top + rect.height / 2,
              left: rect.right + 14,
            }
        ));
      }
      return;
    }
    setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  /** Full-screen POS uses its own bottom actions; the tab bar would cover them (z-40 vs z-30). */
  const hideMobileBottomNav =
    location.pathname.startsWith("/admin/checkout") || location.pathname.startsWith("/admin/pos");

  const renderFlatNavItem = (item) => {
    const badgeCount = item.badgeKey ? navBadges[item.badgeKey] : 0;
    return (
      <li key={item.path} className="relative">
        <RailTooltipWrap className="w-full" labelsVisible={sidebarOpen} tip={item.label}>
          <NavLink
            to={item.path}
            end={item.path === "/admin"}
            className={({ isActive }) => `${sidebarNavRowClass(sidebarOpen, isActive)} w-full`}
            aria-label={!sidebarOpen ? item.label : undefined}
          >
            <svg className={NAV_ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className={`${navLabelClass(sidebarOpen)} text-left`}>{item.label}</span>
            {sidebarOpen ? <NavBadge count={badgeCount} tone={item.badgeTone || "primary"} /> : null}
          </NavLink>
        </RailTooltipWrap>
      </li>
    );
  };

  const renderAccordionGroup = (group) => {
    const groupHasActive = group.children.some((child) => location.pathname.startsWith(child.path));
    const isOpen = !!openGroups[group.key] && sidebarOpen;

    return (
      <li key={group.key} className="relative">
        <RailTooltipWrap
          className="w-full"
          labelsVisible={sidebarOpen || railGroupFlyout?.key === group.key}
          tip={group.label}
        >
          <button
            type="button"
            data-sidebar-group-trigger
            onClick={(event) => toggleGroup(group.key, event)}
            className={`${sidebarNavRowClass(sidebarOpen, groupHasActive)} w-full`}
            aria-label={!sidebarOpen ? group.label : undefined}
            aria-expanded={sidebarOpen ? isOpen : railGroupFlyout?.key === group.key}
          >
            <svg className={NAV_ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={group.icon} />
            </svg>
            <span className={`${navLabelClass(sidebarOpen)} text-left`}>{group.label}</span>
            <svg className={groupChevronClass(sidebarOpen, isOpen)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </RailTooltipWrap>

        {sidebarOpen && (
          <div
            className={`overflow-hidden transition-[max-height,opacity] ${SIDEBAR_ACCORDION_EASE}`}
            style={{
              maxHeight: isOpen
                ? `${group.children.length * 48 + Math.max(0, group.children.length - 1) * 4 + 8}px`
                : "0px",
              opacity: isOpen ? 1 : 0,
            }}
          >
            <ul className="ml-4 mt-1 space-y-1 border-l border-slate-200 pb-1 pl-3 dark:border-slate-800">
              {group.children.map((child) => (
                <li key={child.path}>
                  <NavLink to={child.path} className={({ isActive }) => sidebarSubLinkClass(isActive)}>
                    <span
                      className="mr-2.5 inline-block h-1 w-1 shrink-0 rounded-[1px] bg-current opacity-45"
                      aria-hidden
                    />
                    <span className="truncate">{child.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="admin-theme admin-root admin-gemini-shell flex min-h-screen font-sans text-slate-800 dark:text-slate-100 admin-soft">
      <input
        ref={logoFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml,image/avif,.jpg,.jpeg,.png,.webp,.svg,.avif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onLogoFileChange}
      />
      <div
        className={`admin-sidebar relative z-30 hidden min-w-0 shrink-0 flex-col overflow-x-hidden overflow-y-hidden border-r border-slate-200 bg-white admin-bg-canvas dark:border-slate-700 md:sticky md:top-0 md:flex md:h-screen ${SIDEBAR_WIDTH_EASE} ${sidebarOpen ? SB_W_PINNED : SB_W_RAIL}`}
      >
        <aside className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">
          <div className="flex h-[3.75rem] min-w-0 shrink-0 items-center border-b border-slate-200 px-3 dark:border-slate-800">
            <div
              className={`flex min-w-0 w-full cursor-default items-center gap-3 rounded-xl py-2 ${sidebarOpen ? "" : "justify-center"}`}
            >
              <RailTooltipWrap
                className="shrink-0"
                labelsVisible={sidebarOpen}
                tip={
                  <>
                    <span className="block leading-tight text-white">Fit &amp; Sleek</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-white/75">Admin</span>
                    <span className="mt-1 block text-[11px] font-normal text-white/70">Click logo to upload a new image</span>
                  </>
                }
              >
                <button
                  type="button"
                  disabled={logoUploading || settingsLoading}
                  onClick={() => logoFileInputRef.current?.click()}
                  title="Upload store logo"
                  aria-label="Upload store logo"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-0 bg-transparent p-0 text-xs font-bold text-white ring-offset-2 transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:pointer-events-none disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt="" className="h-full w-full object-cover pointer-events-none" />
                  ) : (
                    "FS"
                  )}
                </button>
              </RailTooltipWrap>
              <div className={brandBlockClass(sidebarOpen)}>
                <p className="truncate text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">Fit & Sleek</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">Admin Console</p>
              </div>
            </div>
          </div>

          <nav className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-2 pb-2 pt-2">
            <ul className="scrollbar-hover min-h-0 min-w-0 flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto overscroll-y-contain">
              <li className={sidebarOpen ? "pointer-events-none select-none" : "hidden"} aria-hidden>
                <NavSectionHeader pinnedOpen={sidebarOpen}>Platform</NavSectionHeader>
              </li>
              {dashboardItems.map(renderFlatNavItem)}

              <li className={sidebarOpen ? "pointer-events-none select-none" : "hidden"} aria-hidden>
                <NavSectionDivider pinnedOpen={sidebarOpen} />
                <NavSectionHeader pinnedOpen={sidebarOpen}>Commerce</NavSectionHeader>
              </li>

              {commerceNavItems.map(renderFlatNavItem)}

              <li className={sidebarOpen ? "pointer-events-none select-none" : "hidden"} aria-hidden>
                <NavSectionDivider pinnedOpen={sidebarOpen} />
                <NavSectionHeader pinnedOpen={sidebarOpen}>Operations</NavSectionHeader>
              </li>

              {operationsNavItems.map(renderFlatNavItem)}

              <li className={sidebarOpen ? "pointer-events-none select-none" : "hidden"} aria-hidden>
                <NavSectionDivider pinnedOpen={sidebarOpen} />
                <NavSectionHeader pinnedOpen={sidebarOpen}>People</NavSectionHeader>
              </li>
              {renderAccordionGroup(peopleNavGroup)}

              <li className={sidebarOpen ? "pointer-events-none select-none" : "hidden"} aria-hidden>
                <NavSectionDivider pinnedOpen={sidebarOpen} />
                <NavSectionHeader pinnedOpen={sidebarOpen}>Configuration</NavSectionHeader>
              </li>
              {renderAccordionGroup(configNavGroup)}
            </ul>

            <div className="mt-1 shrink-0 border-t border-slate-200 p-2 pt-3 dark:border-slate-800">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-[rgba(var(--admin-primary-rgb),0.08)] hover:text-[color:var(--admin-primary)] dark:text-slate-200 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.1)] dark:hover:text-[color:var(--admin-primary)]"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {user?.profile_image_url ? (
                      <img src={resolveImageUrl(user.profile_image_url)} alt={user?.name} className="w-full h-full object-cover" />
                    ) : (
                      (() => {
                        const parts = (user?.name || "").trim().split(/\s+/).filter(Boolean);
                        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                        return "VC";
                      })()
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-medium truncate leading-none">{user?.name || "VCNH Team"}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email || "teamvcnh@gmail.com"}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
              ) : (
                <RailTooltipWrap
                  className="w-full"
                  labelsVisible={sidebarOpen}
                  tip={
                    <>
                      <span className="block text-white">Logout</span>
                      <span className="mt-0.5 block text-[11px] font-normal text-white/75">{user?.name || "Account"}</span>
                    </>
                  }
                >
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label={`Logout: ${user?.name || "Account"}`}
                    className="flex h-[52px] w-full touch-manipulation cursor-pointer items-center justify-center rounded-xl text-slate-600 transition-none [-webkit-tap-highlight-color:transparent] hover:bg-[rgba(var(--admin-primary-rgb),0.08)] hover:text-[color:var(--admin-primary)] active:bg-[rgba(var(--admin-primary-rgb),0.12)] dark:text-slate-300 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.1)] dark:hover:text-[color:var(--admin-primary)]"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {user?.profile_image_url ? (
                        <img src={resolveImageUrl(user.profile_image_url)} alt={user?.name} className="w-full h-full object-cover" />
                      ) : (
                        (user?.name || "V").charAt(0).toUpperCase()
                      )}
                    </div>
                  </button>
                </RailTooltipWrap>
              )}
            </div>
          </nav>

          {/* SidebarRail — hover edge to toggle (shadcn-style) */}
          <button
            type="button"
            aria-label={sidebarOpen ? "Unpin — icon bar + name tooltips" : "Pin full menu"}
            title={sidebarOpen ? "Unpin (narrow bar, hover each icon for name)" : "Pin open (show all labels)"}
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="absolute inset-y-0 right-0 z-20 hidden w-2 cursor-pointer items-center justify-center bg-transparent transition-colors duration-150 ease-out hover:bg-slate-200/50 dark:hover:bg-slate-800/70 md:flex"
            tabIndex={-1}
          />
        </aside>
      </div>

      <main className="relative z-[1] ml-0 flex min-h-screen min-w-0 flex-1 flex-col admin-soft">
        {/* Mobile header with overflow menu */}
        <div className="sticky top-0 z-40 flex shrink-0 items-center gap-3 border-b admin-border admin-surface px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            disabled={logoUploading || settingsLoading}
            onClick={() => logoFileInputRef.current?.click()}
            title="Upload store logo"
            aria-label="Upload store logo"
            className="shrink-0 rounded-lg p-0.5 ring-offset-2 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--admin-primary-rgb),0.45)] disabled:pointer-events-none disabled:opacity-50"
          >
            <Logo className="h-10 w-auto max-h-10" src={logoSrc} alt="Fit&Sleek" />
          </button>
          <div className="flex-1">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search..."
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.25)]"
              />
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="h-10 w-10 rounded-xl border admin-border admin-surface text-slate-600 dark:text-slate-200 flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <AdminTopbar sidebarPinned={sidebarOpen} onTogglePinned={() => setSidebarOpen((p) => !p)} />
        <div
          className={`admin-outlet flex min-h-0 flex-1 flex-col p-4 text-base leading-relaxed admin-soft md:p-6 ${contentLayout === "centered" ? "max-w-[min(100%,88rem)] mx-auto w-full" : ""
            } ${hideMobileBottomNav
              ? "pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:pb-8"
              : "pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:pb-8"
            }`}
        >
          <Outlet />
        </div>
      </main>

      {!sidebarOpen && activeRailGroup && (
        <RailGroupFlyout
          group={activeRailGroup}
          pos={railGroupFlyout}
          onClose={() => setRailGroupFlyout(null)}
        />
      )}

      {/* Mobile bottom navigation: 4 tabs + center scan (barcode / QR) */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t admin-border admin-surface backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] ${hideMobileBottomNav ? "hidden" : ""
          }`}
      >
        <div className="grid grid-cols-5 gap-1 px-2 py-2.5">
          {bottomNavItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-1 text-[10px] font-semibold transition-colors duration-200 ${isActive
                  ? "text-[var(--admin-primary)] dark:text-white"
                  : "text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white"
                }`
              }
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/5 dark:ring-white/8 backdrop-blur-sm ${location.pathname.startsWith(item.path)
                  ? "bg-[rgba(var(--admin-primary-rgb),0.14)] text-[var(--admin-primary)] dark:bg-white/12 dark:text-white"
                  : "bg-white/80 dark:bg-slate-800/80 dark:text-white"
                  }`}
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </span>
              <span className="truncate max-w-full">{item.label}</span>
            </NavLink>
          ))}

          <div className="flex flex-col items-center justify-end gap-0.5 pb-0.5">
            <button
              type="button"
              onClick={() => navigate("/admin/checkout?pickup=1")}
              className={`flex h-12 w-12 -mt-5 items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-900 transition-transform active:scale-95 ${location.pathname.startsWith("/admin/checkout") || location.pathname.startsWith("/admin/pos")
                ? "bg-[color:var(--admin-primary)] text-white ring-[rgba(var(--admin-primary-rgb),0.45)]"
                : "bg-[color:var(--admin-primary)] text-white hover:brightness-110"
                }`}
              aria-label="Scan barcode or QR code"
              title="Scan barcode or QR"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10v10H7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
              </svg>
            </button>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">Scan</span>
          </div>

          {bottomNavItems.slice(2).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-1 text-[10px] font-semibold transition-colors duration-200 ${isActive
                  ? "text-[var(--admin-primary)] dark:text-white"
                  : "text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white"
                }`
              }
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/5 dark:ring-white/8 backdrop-blur-sm ${location.pathname.startsWith(item.path)
                  ? "bg-[rgba(var(--admin-primary-rgb),0.14)] text-[var(--admin-primary)] dark:bg-white/12 dark:text-white"
                  : "bg-white/80 dark:bg-slate-800/80 dark:text-white"
                  }`}
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </span>
              <span className="truncate max-w-full">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mobile overflow menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 admin-surface border-l admin-border p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Menu</h3>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="h-10 w-10 rounded-xl border admin-border admin-surface text-slate-600 dark:text-slate-200 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="space-y-2">
              {otherNavItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? "text-[var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)]" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`
                    }
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}
