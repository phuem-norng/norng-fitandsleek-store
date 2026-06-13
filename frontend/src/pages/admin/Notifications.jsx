import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { warningConfirm } from "../../lib/swal";
import { AdminSectionLoader, AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { useTheme } from "../../state/theme.jsx";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";

export default function AdminNotifications() {
 const { user, can, permissionsReady } = useAdminPermissions();
 const canViewNotifications = can("notifications", "view");
 const canEditNotifications = can("notifications", "edit");
 const canDeleteNotifications = can("notifications", "delete");
 const canBulkSelect = canDeleteNotifications;
 const { mode, primaryColor } = useTheme();
 const [notifications, setNotifications] = useState([]);
 const [loading, setLoading] = useState(true);
 const [unreadCount, setUnreadCount] = useState(0);
 const [filter, setFilter] = useState("all"); // all, unread
 const [markingAllRead, setMarkingAllRead] = useState(false);
 const [search, setSearch] = useState("");
 const [selectedIds, setSelectedIds] = useState([]);

 const loadNotifications = useCallback(async () => {
 if (!canViewNotifications) {
 setNotifications([]);
 setUnreadCount(0);
 setLoading(false);
 return;
 }
 setLoading(true);
 try {
 const { data } = await api.get("/admin/notifications?limit=50");
 setNotifications(data.notifications || []);
 setUnreadCount(data.unread_count || 0);
 } catch (e) {
 console.error("Failed to load notifications", e);
 } finally {
 setLoading(false);
 }
 }, [canViewNotifications]);

 useEffect(() => {
 if (!permissionsReady) return;
 loadNotifications();
 }, [loadNotifications, permissionsReady]);

 useEffect(() => {
 setSelectedIds((prev) => prev.filter((id) => notifications.some((n) => n.id === id)));
 }, [notifications]);

 const handleMarkAllRead = async () => {
 if (!canEditNotifications || markingAllRead) return;
 setMarkingAllRead(true);
 try {
 await api.post("/admin/notifications/mark-all-read");
 setNotifications(notifications.map(n => ({ ...n, read: true })));
 setUnreadCount(0);
 } catch (e) {
 console.error("Failed to mark all as read", e);
 } finally {
 setMarkingAllRead(false);
 }
 };

 const handleMarkAsRead = async (id) => {
 if (!canEditNotifications) return;
 try {
 await api.patch(`/admin/notifications/${id}/read`);
 setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
 setUnreadCount(Math.max(0, unreadCount - 1));
 } catch (e) {
 console.error("Failed to mark as read", e);
 }
 };

 const handleDelete = async (id) => {
 if (!canDeleteNotifications) return;
 try {
 await api.delete(`/admin/notifications/${id}`);
 const wasUnread = notifications.find(n => n.id === id && !n.read);
 setNotifications(notifications.filter(n => n.id !== id));
 if (wasUnread) setUnreadCount(Math.max(0, unreadCount - 1));
 } catch (e) {
 console.error("Failed to delete notification", e);
 }
 };

 const toggleSelect = (id) => {
 setSelectedIds((prev) =>
 prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
 );
 };

 const getIcon = (type) => {
 switch (type) {
 case "order":
 return (
 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center dark:bg-slate-800">
 <svg className="w-5 h-5 text-slate-600 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
 </svg>
 </div>
 );
 case "stock":
 return (
 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center dark:bg-slate-800">
 <svg className="w-5 h-5 text-slate-600 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 </div>
 );
 case "customer":
 return (
 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center dark:bg-slate-800">
 <svg className="w-5 h-5 text-slate-600 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </div>
 );
 default:
 return (
 <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center dark:bg-slate-800">
 <svg className="w-5 h-5 text-slate-600 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>
 );
 }
 };

 const filteredNotifications = (filter === "unread"
 ? notifications.filter(n => !n.read)
 : notifications
 ).filter((n) => {
 const q = search.trim().toLowerCase();
 if (!q) return true;
 return (
 String(n.message || "").toLowerCase().includes(q) ||
 String(n.type || "").toLowerCase().includes(q)
 );
 });

 const allSelected =
 filteredNotifications.length > 0 && filteredNotifications.every((n) => selectedIds.includes(n.id));

 const toggleSelectAll = () => {
 if (allSelected) {
 const filteredIds = new Set(filteredNotifications.map((n) => n.id));
 setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
 return;
 }
 const next = new Set(selectedIds);
 filteredNotifications.forEach((n) => next.add(n.id));
 setSelectedIds(Array.from(next));
 };

 const isDark = mode === "dark";

 const deleteButtonStyle = {
 backgroundColor: isDark ? "rgba(127, 29, 29, 0.22)" : "#fef2f2",
 color: isDark ? "#fecdd3" : "#991b1b",
 border: `1px solid ${isDark ? "rgba(248, 113, 113, 0.45)" : "#fecdd3"}`,
 borderRadius: "0.5rem",
 padding: "0.5rem",
 display: "inline-flex",
 alignItems: "center",
 justifyContent: "center",
 transition: "all 150ms ease",
 };

 const deleteSelected = async () => {
 if (!canDeleteNotifications || selectedIds.length === 0) return;
 const confirmRes = await warningConfirm({
 enTitle: "Delete selected notifications?",
 enText: `Permanently remove ${selectedIds.length} notification(s)? This cannot be undone.`,
 enConfirm: "Delete",
 intent: "destructive",
 });
 if (!confirmRes.isConfirmed) return;
 try {
 await Promise.all(selectedIds.map((id) => api.delete(`/admin/notifications/${id}`)));
 const removedUnread = notifications.filter(n => selectedIds.includes(n.id) && !n.read).length;
 setNotifications(notifications.filter(n => !selectedIds.includes(n.id)));
 setUnreadCount(Math.max(0, unreadCount - removedUnread));
 setSelectedIds([]);
 } catch (e) {
 console.error("Failed to delete selected notifications", e);
 }
 };

 if (!permissionsReady || (loading && notifications.length === 0)) {
 return <AdminContentSkeleton title="Notifications" />;
 }

 if (!canViewNotifications) {
 return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
 }

 if (loading) return <AdminContentSkeleton title="Notifications" />;

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <div className="w-full min-w-0">
 <div className="mb-8">
 <h1 className="text-2xl md:text-4xl font-semibold text-slate-800 dark:text-white mb-2">Notifications</h1>
 <p className="text-slate-500 dark:text-slate-400 text-lg">
 Monitor orders, customer updates, and important store alerts.
 </p>
 </div>

 <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-3xl p-4 md:p-5 mb-6 backdrop-blur-xl notif-enter">
 <div className="flex flex-col lg:flex-row lg:items-center gap-3">
 <div className="flex gap-2">
 <button
 onClick={() => setFilter("all")}
 className={"px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 " + (filter === "all"
 ? "text-white "
 : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
 )}
 style={filter === "all" ? { backgroundColor: primaryColor } : undefined}
 >
 All ({notifications.length})
 </button>
 <button
 onClick={() => setFilter("unread")}
 className={"px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 " + (filter === "unread"
 ? "text-white "
 : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
 )}
 style={filter === "unread" ? { backgroundColor: primaryColor } : undefined}
 >
 Unread ({unreadCount})
 </button>
 </div>
 <div className="flex-1 min-w-[220px]">
 <div className="relative">
 <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search notifications..."
 className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 text-sm text-slate-700 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)]"
 />
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 {canBulkSelect ? (
 <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={toggleSelectAll}
 className="rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900"
 />
 Select all
 </label>
 ) : null}
 {canDeleteNotifications && selectedIds.length > 0 && (
 <button
 onClick={deleteSelected}
 className="px-4 py-2 rounded-xl font-semibold text-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors dark:border-red-400/60 dark:text-red-200 dark:hover:bg-red-900/30"
 >
 Delete ({selectedIds.length})
 </button>
 )}
 {canEditNotifications && unreadCount > 0 && (
 <button
 onClick={handleMarkAllRead}
 disabled={markingAllRead}
 className="px-4 py-2 rounded-xl font-semibold text-sm border border-[rgba(var(--admin-primary-rgb),0.35)] text-[color:var(--admin-primary)] hover:bg-[rgba(var(--admin-primary-rgb),0.08)] transition-colors dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:text-[color:var(--admin-primary)] dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)] disabled:opacity-60"
 >
 {markingAllRead ? "Marking..." : "Mark all read"}
 </button>
 )}
 </div>
 </div>
 </div>

 <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden backdrop-blur-xl notif-enter" style={{ animationDelay: "140ms" }}>
 {loading ? (
 <AdminSectionLoader rows={5} />
 ) : filteredNotifications.length === 0 ? (
 <div className="p-12 text-center">
 <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-800">
 <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
 </svg>
 </div>
 <p className="text-slate-500 text-lg dark:text-slate-300">
 {filter === "unread" ? "No unread notifications" : "No notifications yet"}
 </p>
 <p className="text-slate-400 text-sm mt-1 dark:text-slate-500">
 You'll see alerts about orders, stock, and customers here
 </p>
 </div>
 ) : (
 <div className="divide-y divide-slate-100 dark:divide-slate-800">
 {filteredNotifications.map((notification, index) => (
 <div
 key={notification.id}
 className={"p-4 md:p-5 flex items-start gap-4 hover:bg-slate-50 transition-colors duration-200 notif-enter " + (!notification.read ? "bg-slate-50" : "bg-white") + " dark:bg-slate-900 " + (!notification.read ? "dark:bg-slate-800/70" : "") + " dark:hover:bg-slate-800"}
 style={{ animationDelay: `${200 + index * 60}ms` }}
 >
 {canBulkSelect ? (
 <div className="pt-2">
 <input
 type="checkbox"
 checked={selectedIds.includes(notification.id)}
 onChange={() => toggleSelect(notification.id)}
 className="rounded border-slate-300 dark:border-slate-700 dark:bg-slate-900"
 />
 </div>
 ) : null}
 {getIcon(notification.type)}
 <div className="flex-1 min-w-0">
 {!notification.read && (
 <span
 className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
 style={{ backgroundColor: primaryColor }}
 />
 )}
 <p className={"text-sm " + (!notification.read ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300")}>
 {notification.message}
 </p>
 <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">{notification.time}</p>
 </div>
 <div className="flex items-center gap-2">
 {canEditNotifications && !notification.read && (
 <button
 onClick={() => handleMarkAsRead(notification.id)}
 className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
 title="Mark as read"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </button>
 )}
 {canDeleteNotifications ? (
 <button
 onClick={() => handleDelete(notification.id)}
 className="transition-colors"
 style={deleteButtonStyle}
 aria-label="Delete notification"
 title="Delete"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 ) : null}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 <style>{`
 @keyframes notifEnter {
 from {
 opacity: 0;
 transform: translateY(14px) scale(0.99);
 }
 to {
 opacity: 1;
 transform: translateY(0) scale(1);
 }
 }
 .notif-enter {
 opacity: 0;
 animation: notifEnter 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
 will-change: transform, opacity;
 }
 `}</style>
 </div>
 );
}

