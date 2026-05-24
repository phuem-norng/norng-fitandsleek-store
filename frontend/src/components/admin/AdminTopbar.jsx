import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../state/auth";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useTheme } from "../../state/theme.jsx";
import AdminAppearancePanel from "./AdminAppearancePanel.jsx";
import AdminCommandPalette from "./AdminCommandPalette.jsx";
import AdminAiAssistant, { AdminAiAssistantButton } from "./AdminAiAssistant.jsx";

const PAGE_TITLES = {
 "/admin": "Dashboard",
 "/admin/products": "Products",
 "/admin/orders": "Orders",
 "/admin/discounts": "Discount",
 "/admin/sales": "Discount",
  "/admin/checkout": "Checkout",
  "/admin/pos": "Checkout",
 "/admin/categories": "Categories",
 "/admin/brands": "Brands",
  "/admin/stock-inventory": "Stock & Inventory",
  "/admin/stock-received": "Stock Received",
  "/admin/inventory-integrity": "Inventory Integrity",
 "/admin/reports": "Reports",
 "/admin/contacts": "Contacts",
 "/admin/messages": "Messages",
 "/admin/chatbot": "Chatbot",
 "/admin/notifications": "Notifications",
 "/admin/payments": "Payments",
 "/admin/payments/sale-history": "Sale History",
 "/admin/replacement-cases": "Replacements",
 "/admin/settings": "Settings",
 "/admin/profile": "My Profile",
 "/admin/customers": "Customers",
 "/admin/administrators": "Administrators",
 "/admin/homepage": "Home Page",
 "/admin/homepage-complete": "Complete Manager",
};

export default function AdminTopbar({
 sidebarPinned,
 onTogglePinned,
 /** @deprecated */ sidebarOpen,
 /** @deprecated */ onToggleSidebar,
}) {
 const pinned =
 typeof sidebarPinned === "boolean" ? sidebarPinned : typeof sidebarOpen === "boolean" ? sidebarOpen : true;
 const onPinToggle = typeof onTogglePinned === "function" ? onTogglePinned : onToggleSidebar;
 const { user, logout } = useAuth();
 const { primaryColor, mode, saveTheme } = useTheme();
 const navigate = useNavigate();
 const location = useLocation();

 const pathNorm = (location.pathname || "/").replace(/\/+$/, "") || "/";

 const pageTitle = useMemo(() => {
 if (PAGE_TITLES[pathNorm]) return PAGE_TITLES[pathNorm];
 const matched = Object.keys(PAGE_TITLES)
 .filter((p) => p !== "/admin" && pathNorm.startsWith(p))
 .sort((a, b) => b.length - a.length)[0];
 return matched ? PAGE_TITLES[matched] : "Dashboard";
 }, [pathNorm]);

 const [paletteOpen, setPaletteOpen] = useState(false);
 const [aiOpen, setAiOpen] = useState(false);
 const [showNotif, setShowNotif] = useState(false);
 const [showProfile, setShowProfile] = useState(false);
 const [showAppearance, setShowAppearance] = useState(false);
 const [notifications, setNotifications] = useState([]);
 const [unreadCount, setUnreadCount] = useState(0);

 const notifRef = useRef(null);
 const profileRef = useRef(null);
 const appearanceRef = useRef(null);

 useEffect(() => {
 const onDocClick = (event) => {
 if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotif(false);
 if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false);
 if (appearanceRef.current && !appearanceRef.current.contains(event.target)) setShowAppearance(false);
 };
 document.addEventListener("mousedown", onDocClick);
 return () => document.removeEventListener("mousedown", onDocClick);
 }, []);

 // Global Cmd+K / Ctrl+K and "/" shortcut to open the command palette.
 useEffect(() => {
 const handler = (event) => {
 const isMeta = event.metaKey || event.ctrlKey;
 if (isMeta && (event.key === "k" || event.key === "K")) {
 event.preventDefault();
 setPaletteOpen(true);
 return;
 }
 if (event.key === "/" && !paletteOpen) {
 const tag = (event.target?.tagName || "").toLowerCase();
 const isEditable = tag === "input" || tag === "textarea" || event.target?.isContentEditable;
 if (!isEditable) {
 event.preventDefault();
 setPaletteOpen(true);
 }
 }
 };
 window.addEventListener("keydown", handler);
 return () => window.removeEventListener("keydown", handler);
 }, [paletteOpen]);

 useEffect(() => {
 if (!showNotif) return;
 (async () => {
 try {
 const { data } = await api.get("/admin/notifications");
 setNotifications(data.notifications || []);
 setUnreadCount(data.unread_count || 0);
 } catch {
 setNotifications([]);
 }
 })();
 }, [showNotif]);

 const markAllRead = async () => {
 try {
 await api.post("/admin/notifications/mark-all-read");
 setUnreadCount(0);
 setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
 } catch {
 // ignore silently
 }
 };

 const handleLogout = async () => {
 await logout();
 navigate("/login");
 };

 return (
 <header className="sticky top-0 z-40 flex h-[3.75rem] shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 admin-bg-canvas dark:border-slate-800 md:px-6">
 {/* Pin rail width (hover still expands when unpinned). */}
 {typeof onPinToggle === "function" && (
 <button
 type="button"
 onClick={onPinToggle}
 className="hidden md:inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-600 transition-colors duration-150 ease-out hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
 title={pinned ? "Unpin sidebar (Ctrl+B)" : "Pin sidebar open (Ctrl+B)"}
 aria-label={pinned ? "Unpin sidebar" : "Pin sidebar expanded"}
 >
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <rect x="3" y="3" width="18" height="18" rx="2" />
 <line x1="9" y1="3" x2="9" y2="21" />
 </svg>
 </button>
 )}

 {/* Vertical separator */}
 <div className="hidden md:block h-4 w-px bg-slate-200 dark:bg-slate-800" aria-hidden />

 {/* Page title (breadcrumb-like) */}
 <h1 className="hidden md:block text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
 {pageTitle}
 </h1>


 {/* Right-side actions (pushed to the end) */}
 <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
 {/* Smart search trigger (desktop) — opens the global command palette */}
 <button
 type="button"
 onClick={() => setPaletteOpen(true)}
 title="Search (Ctrl+K)"
 aria-label="Open search"
 className="group hidden md:flex w-[240px] items-center gap-2 h-8 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 pl-2.5 pr-1.5 text-left text-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700"
 >
 <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 <span className="flex-1 truncate">Search…</span>
 <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400">
 <span className="text-[11px] leading-none">⌘</span>K
 </kbd>
 </button>

 {/* Mobile search icon */}
 <button
 type="button"
 onClick={() => setPaletteOpen(true)}
 title="Search"
 aria-label="Open search"
 className="md:hidden h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 </button>

 {/* Ask AI — full label on sm+, icon on xs */}
 <AdminAiAssistantButton onClick={() => setAiOpen(true)} className="hidden sm:flex" />
 <button
 type="button"
 aria-label="Ask AI"
 onClick={() => setAiOpen(true)}
 className="flex sm:hidden h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-secondary text-secondary-foreground transition-colors hover:bg-slate-100 dark:border-neutral-700 dark:bg-slate-800 dark:hover:bg-neutral-800"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
 <path fillRule="evenodd" clipRule="evenodd" d="M10.7258 8.81331L13.1987 8.00002L10.7258 7.18674C9.82078 6.88908 9.11092 6.17922 8.81326 5.27416L7.99998 2.80127L7.18669 5.27416C6.88903 6.17922 6.17917 6.88908 5.27411 7.18674L2.80122 8.00002L5.27411 8.81331C6.17917 9.11097 6.88903 9.82083 7.18669 10.7259L7.99998 13.1988L8.81326 10.7259C9.11092 9.82083 9.82078 10.7259 10.7258 8.81331ZM13.6674 9.42494C15.0425 8.97267 15.0425 7.02737 13.6674 6.57511L11.1945 5.76182C10.7419 5.61299 10.387 5.25806 10.2382 4.80553L9.42489 2.33264C8.97263 0.957479 7.02732 0.957479 6.57506 2.33264L5.76177 4.80553C5.61294 5.25806 5.25801 5.61299 4.80548 5.76182L2.33259 6.57511C0.957432 7.02737 0.957434 8.97268 2.3326 9.42494L4.80548 10.2382C5.25801 10.3871 5.61294 10.742 5.76177 11.1945L6.57506 13.6674C7.02733 15.0426 8.97263 15.0426 9.42489 13.6674L10.2382 11.1945C10.387 10.742 10.7419 10.3871 11.1945 10.2382L13.6674 9.42494Z" fill="#00E599" />
 </svg>
 </button>

 {/* Go to site */}
 <button
 onClick={() => navigate("/")}
 className="hidden lg:inline-flex items-center gap-1.5 h-8 shrink-0 rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors"
 title="Go to site"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 <span>Visit site</span>
 </button>

 {/* Appearance / theme presets */}
 <div className="relative" ref={appearanceRef}>
 <button
 type="button"
 onClick={() => {
 setShowAppearance((prev) => !prev);
 setShowNotif(false);
 setShowProfile(false);
 }}
 title="Customize appearance"
 className="h-8 w-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors flex items-center justify-center"
 aria-expanded={showAppearance}
 aria-haspopup="dialog"
 >
 <svg
 className="w-4 h-4 shrink-0"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden
 >
 {/* Heroicons outline Swatch — color / theme (complete, centered) */}
 <path d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
 </svg>
 </button>
 {showAppearance && (
 <div
 className="absolute right-0 mt-1.5 z-50 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 admin-bg-elevated overflow-hidden max-h-[min(90vh,calc(100vh-6rem))] overflow-y-auto"
 role="dialog"
 aria-label="Appearance settings"
 >
 <AdminAppearancePanel />
 </div>
 )}
 </div>

 {/* Theme toggle */}
 <button
 onClick={() => saveTheme(mode === "dark" ? "light" : "dark", primaryColor)}
 title={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
 className="h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors flex items-center justify-center"
 >
 {mode === "dark" ? (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
 </svg>
 ) : (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
 </svg>
 )}
 </button>

 {/* Notifications */}
 <div className="relative" ref={notifRef}>
 <button
 onClick={() => {
 setShowNotif((prev) => !prev);
 setShowProfile(false);
 setShowAppearance(false);
 }}
 className="relative h-8 w-8 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-colors flex items-center justify-center"
 title="Notifications"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
 </svg>
 {unreadCount > 0 && (
 <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
 {unreadCount > 9 ? "9+" : unreadCount}
 </span>
 )}
 </button>

 {showNotif && (
 <div className="absolute right-0 mt-1.5 w-80 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
 <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
 <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Notifications</p>
 <button onClick={markAllRead} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
 Mark all read
 </button>
 </div>
 <div className="max-h-72 overflow-y-auto">
 {notifications.length ? (
 notifications.map((n) => (
 <button
 key={n.id}
 onClick={() => {
 if (n.link) navigate(n.link);
 setShowNotif(false);
 }}
 className={`w-full px-3 py-2.5 text-left text-sm border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${n.read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}
 >
 <p className="leading-snug">{n.message}</p>
 <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{n.time}</p>
 </button>
 ))
 ) : (
 <p className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400 text-center">No notifications yet.</p>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Profile menu */}
 <div className="relative" ref={profileRef}>
 <button
 onClick={() => {
 setShowProfile((prev) => !prev);
 setShowNotif(false);
 setShowAppearance(false);
 }}
 className="flex items-center gap-1.5 rounded-md h-8 px-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 <div className="h-6 w-6 rounded-full text-white text-[11px] font-semibold flex items-center justify-center overflow-hidden" style={{ backgroundColor: primaryColor }}>
 {user?.profile_image_url ? (
<img src={resolveImageUrl(user.profile_image_url)} alt={user?.name} className="w-full h-full object-cover" />
 ) : (
 user?.name?.charAt(0)?.toUpperCase() || "A"
 )}
 </div>
 </button>

 {showProfile && (
 <div className="absolute right-0 mt-1.5 w-56 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
 <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
 <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.name || "Admin"}</p>
 <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || ""}</p>
 </div>
 <div className="py-1">
 <button
 onClick={() => {
 navigate("/admin/profile");
 setShowProfile(false);
 }}
 className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 My Profile
 </button>
 <button
 onClick={() => {
 navigate("/admin/settings");
 setShowProfile(false);
 }}
 className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 Settings
 </button>
 </div>
 <div className="border-t border-slate-200 dark:border-slate-800 py-1">
 <button
 onClick={handleLogout}
 className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
 >
 Log out
 </button>
 </div>
 </div>
 )}
 </div>
 </div>

 <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
 <AdminAiAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
 </header>
 );
}
