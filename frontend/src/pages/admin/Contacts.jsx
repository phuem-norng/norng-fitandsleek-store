import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { AdminSectionLoader, AdminContentSkeleton } from "@/components/admin/AdminLoading";
import {
 buildAllColumnsVisibility,
 loadTableColumnVisibility,
 TableColumnVisibilityMenu,
} from "../../components/admin/TableColumnVisibilityMenu.jsx";

const CONTACTS_TABLE_COLUMNS = [
 { id: "select", label: "Select" },
 { id: "name", label: "Name" },
 { id: "email", label: "Email" },
 { id: "subject", label: "Subject" },
 { id: "status", label: "Status" },
 { id: "date", label: "Date" },
 { id: "actions", label: "Actions" },
];

const CONTACTS_COLUMNS_STORAGE_KEY = "fitandsleek-contacts-columns";

export default function Contacts() {
 const [contacts, setContacts] = useState([]);
 const [loading, setLoading] = useState(true);
 const [stats, setStats] = useState(null);
 const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
 const [filters, setFilters] = useState({ status: "", search: "", sort_by: "created_at", sort_dir: "desc" });
 const [selectedIds, setSelectedIds] = useState([]);
 const [viewContact, setViewContact] = useState(null);
 const [err, setErr] = useState("");
 const [success, setSuccess] = useState("");
 const [pendingDeleteId, setPendingDeleteId] = useState(null);
 const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
 const [deleteBusy, setDeleteBusy] = useState(false);
 const [columnVisibility, setColumnVisibility] = useState(() =>
 loadTableColumnVisibility(CONTACTS_COLUMNS_STORAGE_KEY, CONTACTS_TABLE_COLUMNS),
 );

 const loadContacts = async () => {
 setLoading(true);
 try {
 const params = new URLSearchParams();
 if (filters.status) params.append("status", filters.status);
 if (filters.search) params.append("search", filters.search);
 if (filters.sort_by) params.append("sort_by", filters.sort_by);
 if (filters.sort_dir) params.append("sort_dir", filters.sort_dir);
 params.append("page", pagination.current_page);

 console.log("Loading contacts from:", `/admin/contacts?${params.toString()}`);
 const { data } = await api.get(`/admin/contacts?${params.toString()}`);
 console.log("Contacts response:", data);
 setContacts(data.contacts || []);
 setStats(data.stats || {});
 setPagination(data.pagination || { current_page: 1, last_page: 1, total: 0 });
 setErr("");
 } catch (e) {
 console.error("Failed to load contacts:", e);
 const errorMessage = e.response?.data?.message || e.message || "Failed to load contacts";
 setErr(`${errorMessage}. Make sure you've run: php artisan migrate`);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadContacts();
 }, [pagination.current_page, filters.status]);

 useEffect(() => {
 try {
 localStorage.setItem(CONTACTS_COLUMNS_STORAGE_KEY, JSON.stringify(columnVisibility));
 } catch { /* ignore quota */ }
 }, [columnVisibility]);

 const isColVisible = (columnId) => columnVisibility[columnId] !== false;

 const toggleTableColumn = (columnId) => {
 setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
 };

 const setAllTableColumnsVisible = (visible) => {
 setColumnVisibility(buildAllColumnsVisibility(CONTACTS_TABLE_COLUMNS, visible, "name"));
 };

 const visibleColumnCount = CONTACTS_TABLE_COLUMNS.filter((col) => isColVisible(col.id)).length || 1;

 const handleStatusChange = async (id, newStatus) => {
 try {
 await api.patch(`/admin/contacts/${id}`, { status: newStatus });
 setSuccess("Contact status updated");
 loadContacts();
 setViewContact(null);
 } catch (e) {
 setErr("Failed to update contact");
 }
 };

 const handleDelete = (id) => {
 setPendingDeleteId(id);
 };

 const confirmDelete = async () => {
 setDeleteBusy(true);
 try {
 if (pendingBulkDelete) {
 await api.post("/admin/contacts/bulk-delete", { ids: selectedIds });
 setSuccess(`${selectedIds.length} contacts deleted`);
 setSelectedIds([]);
 } else if (pendingDeleteId != null) {
 await api.delete(`/admin/contacts/${pendingDeleteId}`);
 setSuccess("Contact deleted");
 if (viewContact?.id === pendingDeleteId) setViewContact(null);
 }
 loadContacts();
 } catch (e) {
 setErr("Failed to delete contact(s)");
 } finally {
 setDeleteBusy(false);
 setPendingDeleteId(null);
 setPendingBulkDelete(false);
 }
 };

 const handleBulkAction = async () => {
 if (selectedIds.length === 0) return;

 if (filters.status && filters.status !== "") {
 try {
 await api.post("/admin/contacts/bulk-update", { ids: selectedIds, status: filters.status });
 setSuccess(`${selectedIds.length} contacts updated`);
 setSelectedIds([]);
 loadContacts();
 } catch (e) {
 setErr("Failed to update contacts");
 }
 }
 };

 const handleBulkDelete = async () => {
 if (selectedIds.length === 0) return;
 setPendingBulkDelete(true);
 };

 const handleSelectAll = (e) => {
 if (e.target.checked) {
 setSelectedIds(contacts.map(c => c.id));
 } else {
 setSelectedIds([]);
 }
 };

 const handleSelectOne = (id) => {
 if (selectedIds.includes(id)) {
 setSelectedIds(selectedIds.filter(i => i !== id));
 } else {
 setSelectedIds([...selectedIds, id]);
 }
 };

 if (loading) return <AdminContentSkeleton title="Contacts" />;

 const getStatusBadge = (status) => {
 const styles = {
 new: "bg-[color:var(--admin-primary)] text-white",
 read: "bg-slate-700 text-white dark:bg-slate-600",
 replied: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
 closed: "bg-white text-slate-400 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
 };
 return (
 <span className={"px-2.5 py-1 rounded-full text-xs font-semibold " + (styles[status] || styles.new)}>
 {status?.charAt(0).toUpperCase() + status?.slice(1)}
 </span>
 );
 };

 return (
 <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
 <div className="w-full min-w-0">
 <AdminConfirmDialog
 open={pendingDeleteId != null || pendingBulkDelete}
 onClose={() => {
 if (deleteBusy) return;
 setPendingDeleteId(null);
 setPendingBulkDelete(false);
 }}
 onConfirm={confirmDelete}
 title={pendingBulkDelete ? "Delete selected contacts?" : "Delete this contact?"}
 message={
 pendingBulkDelete
 ? `Permanently remove ${selectedIds.length} contact(s)? This cannot be undone.`
 : "This action cannot be undone."
 }
 confirmLabel="Delete"
 cancelLabel="Cancel"
 destructive
 busy={deleteBusy}
 />

 {/* Header */}
 <div className="mb-8">
 <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-2">
 Contacts
 </h1>
 <p className="text-slate-500 dark:text-slate-400 text-lg">Manage customer inquiries and messages</p>
 </div>

 {/* Success/Error Messages */}
 {success && (
 <div className="mb-6 bg-[rgba(var(--admin-primary-rgb),0.1)] dark:bg-[rgba(var(--admin-primary-rgb),0.16)] border border-[rgba(var(--admin-primary-rgb),0.3)] dark:border-[rgba(var(--admin-primary-rgb),0.4)] rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
 <svg className="w-5 h-5 text-[color:var(--admin-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 <span className="text-[color:var(--admin-primary)] dark:text-[color:var(--admin-primary)]">{success}</span>
 <button onClick={() => setSuccess("")} className="ml-auto text-[color:var(--admin-primary)] hover:brightness-125">&times;</button>
 </div>
 )}
 {err && (
 <div className="mb-6 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-2xl p-4 flex items-center gap-3">
 <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
 </svg>
 <span className="text-red-700">{err}</span>
 <button onClick={() => setErr("")} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
 </div>
 )}

 {/* Stats Cards */}
 {stats && (
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
 <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p>
 </div>
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
 <p className="text-sm text-slate-500 dark:text-slate-400">New</p>
 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.new}</p>
 </div>
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
 <p className="text-sm text-slate-500 dark:text-slate-400">Read</p>
 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.read}</p>
 </div>
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
 <p className="text-sm text-slate-500 dark:text-slate-400">Replied</p>
 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.replied}</p>
 </div>
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
 <p className="text-sm text-slate-500 dark:text-slate-400">Closed</p>
 <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.closed}</p>
 </div>
 </div>
 )}

 {/* Filters */}
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
 <div className="flex flex-wrap gap-4 items-center">
 <div className="flex-1 min-w-[200px]">
 <input
 type="text"
 placeholder="Search contacts..."
 value={filters.search}
 onChange={(e) => setFilters({ ...filters, search: e.target.value })}
 className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)] focus:bg-white dark:focus:bg-slate-900 transition-all"
 />
 </div>
 <select
 value={filters.status}
 onChange={(e) => setFilters({ ...filters, status: e.target.value })}
 className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)] transition-all"
 >
 <option value="">All Status</option>
 <option value="new">New</option>
 <option value="read">Read</option>
 <option value="replied">Replied</option>
 <option value="closed">Closed</option>
 </select>
 <select
 value={filters.sort_by + "-" + filters.sort_dir}
 onChange={(e) => {
 const [sort_by, sort_dir] = e.target.value.split("-");
 setFilters({ ...filters, sort_by, sort_dir });
 }}
 className="h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)] transition-all"
 >
 <option value="created_at-desc">Newest First</option>
 <option value="created_at-asc">Oldest First</option>
 <option value="name-asc">Name A-Z</option>
 <option value="name-desc">Name Z-A</option>
 </select>
 {selectedIds.length > 0 && (
 <div className="flex items-center gap-2">
 <button
 onClick={handleBulkAction}
 className="px-4 py-2 bg-[color:var(--admin-primary)] text-white rounded-lg hover:brightness-110 transition-colors font-medium"
 >
 Update Selected ({selectedIds.length})
 </button>
 <button
 onClick={handleBulkDelete}
 className="px-4 py-2 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 bg-white dark:bg-slate-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
 >
 Delete Selected ({selectedIds.length})
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Contacts Table */}
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
 <div className="relative z-10 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3 md:px-6">
 <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
 {pagination.total || contacts.length} contact{(pagination.total || contacts.length) !== 1 ? "s" : ""}
 </p>
 <TableColumnVisibilityMenu
 columns={CONTACTS_TABLE_COLUMNS}
 visibility={columnVisibility}
 onToggle={toggleTableColumn}
 onShowAll={() => setAllTableColumnsVisible(true)}
 onHideAll={() => setAllTableColumnsVisible(false)}
 />
 </div>
 <div className="overflow-x-auto rounded-b-2xl">
 <table className="w-full">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
 {isColVisible("select") ? (
 <th className="px-6 py-4">
 <input
 type="checkbox"
 onChange={handleSelectAll}
 checked={selectedIds.length === contacts.length && contacts.length > 0}
 className="rounded"
 />
 </th>
 ) : null}
 {isColVisible("name") ? <th className="px-6 py-4">Name</th> : null}
 {isColVisible("email") ? <th className="px-6 py-4">Email</th> : null}
 {isColVisible("subject") ? <th className="px-6 py-4">Subject</th> : null}
 {isColVisible("status") ? <th className="px-6 py-4">Status</th> : null}
 {isColVisible("date") ? <th className="px-6 py-4">Date</th> : null}
 {isColVisible("actions") ? <th className="px-6 py-4">Actions</th> : null}
 </tr>
 </thead>
 <tbody>
 {loading ? (
 <tr>
 <td colSpan={visibleColumnCount} className="p-0">
 <AdminSectionLoader rows={4} />
 </td>
 </tr>
 ) : contacts.length === 0 ? (
 <tr>
 <td colSpan={visibleColumnCount} className="p-12 text-center">
 <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 </div>
 <p className="text-slate-500 dark:text-slate-400 text-lg">No contacts found</p>
 </td>
 </tr>
 ) : (
 contacts.map((contact) => (
 <tr key={contact.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
 {isColVisible("select") ? (
 <td className="px-6 py-4">
 <input
 type="checkbox"
 checked={selectedIds.includes(contact.id)}
 onChange={() => handleSelectOne(contact.id)}
 className="rounded"
 />
 </td>
 ) : null}
 {isColVisible("name") ? (
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold">
 {contact.name?.charAt(0).toUpperCase()}
 </div>
 <span className="font-medium text-slate-800 dark:text-slate-100">{contact.name}</span>
 </div>
 </td>
 ) : null}
 {isColVisible("email") ? (
 <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{contact.email}</td>
 ) : null}
 {isColVisible("subject") ? (
 <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{contact.subject || "No subject"}</td>
 ) : null}
 {isColVisible("status") ? (
 <td className="px-6 py-4">{getStatusBadge(contact.status)}</td>
 ) : null}
 {isColVisible("date") ? (
 <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">
 {new Date(contact.created_at).toLocaleDateString()}
 </td>
 ) : null}
 {isColVisible("actions") ? (
 <td className="px-6 py-4">
 <div className="flex gap-1.5">
 <button
 onClick={() => setViewContact(contact)}
 className="h-9 w-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center"
 title="View"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 </button>
 <button
 onClick={() => handleStatusChange(contact.id, contact.status === "new" ? "read" : "replied")}
 className="h-9 w-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center"
 title="Update Status"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 </button>
 <button
 onClick={() => handleDelete(contact.id)}
 className="h-9 w-9 border border-red-200 dark:border-red-700 text-red-500 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors inline-flex items-center justify-center"
 title="Delete"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </div>
 </td>
 ) : null}
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* Pagination */}
 {pagination.last_page > 1 && (
 <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
 <p className="text-sm text-slate-500 dark:text-slate-400">
 Showing {(pagination.current_page - 1) * 15 + 1} to {Math.min(pagination.current_page * 15, pagination.total)} of {pagination.total}
 </p>
 <div className="flex gap-2">
 <button
 onClick={() => setPagination({ ...pagination, current_page: pagination.current_page - 1 })}
 disabled={pagination.current_page === 1}
 className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
 >
 Previous
 </button>
 <button
 onClick={() => setPagination({ ...pagination, current_page: pagination.current_page + 1 })}
 disabled={pagination.current_page === pagination.last_page}
 className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
 >
 Next
 </button>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Contact Detail Modal */}
 <AdminModal
 open={!!viewContact}
 onClose={() => setViewContact(null)}
 title="Contact Details"
 titleId="contact-details-title"
 maxWidthClass="max-w-lg"
 >
 {viewContact ? (
 <div className="space-y-4">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 text-xl font-bold">
 {viewContact.name?.charAt(0).toUpperCase()}
 </div>
 <div>
 <h4 className="font-bold text-slate-800 dark:text-slate-100">{viewContact.name}</h4>
 <p className="text-sm text-slate-500 dark:text-slate-400">{viewContact.email}</p>
 {viewContact.phone && <p className="text-sm text-slate-500 dark:text-slate-400">{viewContact.phone}</p>}
 </div>
 </div>

 <div>
 <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Subject</p>
 <p className="font-medium text-slate-800 dark:text-slate-100">{viewContact.subject || "No subject"}</p>
 </div>

 <div>
 <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Message</p>
 <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-slate-700 dark:text-slate-200">
 {viewContact.message}
 </div>
 </div>

 <div>
 <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</p>
 <div className="flex gap-2 flex-wrap">
 {["new", "read", "replied", "closed"].map((status) => (
 <button
 key={status}
 onClick={() => handleStatusChange(viewContact.id, status)}
 className={"px-3 py-1 rounded-full text-sm font-medium transition-colors " + (viewContact.status === status ? "bg-[color:var(--admin-primary)] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")}
 >
 {status.charAt(0).toUpperCase() + status.slice(1)}
 </button>
 ))}
 </div>
 </div>

 <div className="flex gap-3 pt-4">
 <button
 onClick={() => {
 window.location.href = "mailto:" + viewContact.email + "?subject=Re: " + (viewContact.subject || "");
 }}
 className="flex-1 py-3 bg-[color:var(--admin-primary)] text-white rounded-xl font-semibold hover:brightness-110 transition-colors"
 >
 Reply via Email
 </button>
 <button
 onClick={() => handleDelete(viewContact.id)}
 className="px-4 py-3 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
 >
 Delete
 </button>
 </div>
 </div>
 ) : null}
 </AdminModal>

 <style>{`
 @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
 .animate-fade-in { animation: fade-in 0.3s ease-out; }
 `}</style>
 </div>
 );
}

