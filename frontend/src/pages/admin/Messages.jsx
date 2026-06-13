import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { isAdminDarkChrome } from "../../lib/adminDarkChrome.js";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import { AdminContentSkeleton, AdminDashboardLoader } from "@/components/admin/AdminLoading";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";

export default function AdminMessages() {
 const { user, can, permissionsReady } = useAdminPermissions();
 const canViewMessages = can("messages", "view");
 const canCreateMessages = can("messages", "create");
 const canEditMessages = can("messages", "edit");
 const canDeleteMessages = can("messages", "delete");
 const canBulkSelect = canDeleteMessages;
 const [messages, setMessages] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingMessage, setEditingMessage] = useState(null);
 const [uploadingMedia, setUploadingMedia] = useState(false);
 const [uploadError, setUploadError] = useState("");
 const [filters, setFilters] = useState({
 language: 'all',
 status: 'all'
 });
 const [search, setSearch] = useState("");
 const [selectedIds, setSelectedIds] = useState([]);
 const [pendingDeleteId, setPendingDeleteId] = useState(null);
 const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
 const [deleteBusy, setDeleteBusy] = useState(false);

 const [formData, setFormData] = useState({
 title: '',
 content: '',
 link_url: '',
 media_url: '',
 media_type: '',
 language: 'en',
 target_audience: 'all',
 is_active: true,
 scheduled_at: '',
 expires_at: ''
 });

 const loadMessages = useCallback(async () => {
 if (!canViewMessages) {
 setMessages([]);
 setLoading(false);
 return;
 }
 setLoading(true);
 try {
 const params = new URLSearchParams();
 if (filters.language !== 'all') params.append('language', filters.language);
 if (filters.status !== 'all') params.append('status', filters.status);

 const { data } = await api.get(`/admin/messages?${params}`);
 setMessages(data.data || []);
 } catch (e) {
 console.error("Failed to load messages", e);
 } finally {
 setLoading(false);
 }
 }, [canViewMessages, filters.language, filters.status]);

 const inferMediaType = (url, fallback = "") => {
 if (fallback) return fallback;
 if (!url) return "";
 const lower = url.toLowerCase();
 if (lower.startsWith("data:video")) return "video";
 if (lower.startsWith("data:image")) return "image";
 if (lower.match(/\.(mp4|webm|ogg)(\?|#|$)/)) return "video";
 if (lower.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|#|$)/)) return "image";
 return "";
 };

 const filteredMessages = messages.filter((m) => {
 const q = search.trim().toLowerCase();
 if (!q) return true;
 return (
 String(m.title || "").toLowerCase().includes(q) ||
 String(m.content || "").toLowerCase().includes(q) ||
 String(m.target_audience || "").toLowerCase().includes(q) ||
 String(m.language || "").toLowerCase().includes(q)
 );
 });

 useEffect(() => {
 if (!permissionsReady) return;
 loadMessages();
 }, [loadMessages, permissionsReady]);

 useEffect(() => {
 setSelectedIds((prev) => prev.filter((id) => messages.some((m) => m.id === id)));
 }, [messages]);

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (editingMessage ? !canEditMessages : !canCreateMessages) return;
 try {
 if (formData.media_url && formData.media_url.startsWith('blob:')) {
 setUploadError('Please wait for upload to finish or use a media URL');
 return;
 }
 const data = {
 ...formData,
 link_url: formData.link_url || null,
 media_url: formData.media_url || null,
 media_type: formData.media_type || null,
 scheduled_at: formData.scheduled_at || null,
 expires_at: formData.expires_at || null
 };

 if (editingMessage) {
 await api.put(`/admin/messages/${editingMessage.id}`, data);
 } else {
 await api.post('/admin/messages', data);
 }

 setShowForm(false);
 setEditingMessage(null);
 resetForm();
 loadMessages();
 } catch (e) {
 console.error("Failed to save message", e);
 }
 };

 const handleEdit = (message) => {
 if (!canEditMessages) return;
 setEditingMessage(message);
 setFormData({
 title: message.title,
 content: message.content,
 link_url: message.link_url || '',
 media_url: message.media_url || '',
 media_type: message.media_type || '',
 language: message.language,
 target_audience: message.target_audience,
 is_active: message.is_active,
 scheduled_at: message.scheduled_at ? message.scheduled_at.substring(0, 16) : '',
 expires_at: message.expires_at ? message.expires_at.substring(0, 16) : ''
 });
 setShowForm(true);
 };

 const closeForm = () => {
 setShowForm(false);
 setEditingMessage(null);
 resetForm();
 };

 const handleDelete = (id) => {
 if (!canDeleteMessages) return;
 setPendingDeleteId(id);
 };

 const confirmDelete = async () => {
 if (!canDeleteMessages) return;
 setDeleteBusy(true);
 try {
 if (pendingBulkDelete) {
 await Promise.all(selectedIds.map((id) => api.delete(`/admin/messages/${id}`)));
 setSelectedIds([]);
 } else if (pendingDeleteId != null) {
 await api.delete(`/admin/messages/${pendingDeleteId}`);
 if (editingMessage?.id === pendingDeleteId) closeForm();
 }
 loadMessages();
 } catch (e) {
 console.error("Failed to delete message(s)", e);
 } finally {
 setDeleteBusy(false);
 setPendingDeleteId(null);
 setPendingBulkDelete(false);
 }
 };

 const toggleSelect = (id) => {
 setSelectedIds((prev) =>
 prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
 );
 };

 const allSelected =
 filteredMessages.length > 0 && filteredMessages.every((m) => selectedIds.includes(m.id));

 const toggleSelectAll = () => {
 if (allSelected) {
 const filteredIds = new Set(filteredMessages.map((m) => m.id));
 setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
 return;
 }
 const next = new Set(selectedIds);
 filteredMessages.forEach((m) => next.add(m.id));
 setSelectedIds(Array.from(next));
 };

 const deleteSelected = () => {
 if (!canDeleteMessages || selectedIds.length === 0) return;
 setPendingBulkDelete(true);
 };

 const handleToggleActive = async (message) => {
 if (!canEditMessages) return;
 try {
 await api.patch(`/admin/messages/${message.id}/toggle-active`);
 loadMessages();
 } catch (e) {
 console.error("Failed to toggle message status", e);
 }
 };

 if (!permissionsReady || (loading && messages.length === 0)) {
 return <AdminContentSkeleton title="Messages" />;
 }

 if (!canViewMessages) {
 return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
 }

 if (loading) return <AdminContentSkeleton title="Messages" />;

 const resetForm = () => {
 setFormData({
 title: '',
 content: '',
 link_url: '',
 media_url: '',
 media_type: '',
 language: 'en',
 target_audience: 'all',
 is_active: true,
 scheduled_at: '',
 expires_at: ''
 });
 };

 const handleMediaUpload = async (e) => {
 if (editingMessage ? !canEditMessages : !canCreateMessages) return;
 const file = e.target.files?.[0];
 if (!file) return;

 setUploadError("");
 setUploadingMedia(true);
 const localUrl = URL.createObjectURL(file);
 setFormData((s) => ({
 ...s,
 media_url: localUrl,
 media_type: file.type.startsWith('video/') ? 'video' : 'image',
 }));
 try {
 const fd = new FormData();
 fd.append('media', file);
 const { data } = await api.post('/admin/messages/media-upload', fd, {
 headers: { 'Content-Type': 'multipart/form-data' },
 });
 setFormData((s) => ({
 ...s,
 media_url: data?.media_url || '',
 media_type: data?.media_type || inferMediaType(data?.media_url || ""),
 }));
 } catch (err) {
 setUploadError(err?.response?.data?.message || "Failed to upload media");
 console.error('Failed to upload media', err);
 } finally {
 if (localUrl) {
 URL.revokeObjectURL(localUrl);
 }
 setUploadingMedia(false);
 }
 };

 const getLanguageBadge = (language) => {
 return (
 <span className={"px-2.5 py-1 text-xs font-semibold rounded-full " + (language === 'en' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100')}>
 {language === 'en' ? 'English' : 'Khmer'}
 </span>
 );
 };

 const getAudienceBadge = (audience) => {
 const colors = {
 all: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white',
 customers: 'bg-slate-700 text-white dark:bg-slate-600',
 guests: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
 };

 return (
 <span className={"px-2.5 py-1 text-xs font-semibold rounded-full " + (colors[audience] || colors.all)}>
 {audience === 'all' ? 'All Users' : audience === 'customers' ? 'Customers' : 'Guests'}
 </span>
 );
 };

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <div className="w-full min-w-0">
 <AdminConfirmDialog
 open={pendingDeleteId != null || pendingBulkDelete}
 onClose={() => {
 if (deleteBusy) return;
 setPendingDeleteId(null);
 setPendingBulkDelete(false);
 }}
 onConfirm={confirmDelete}
 title={pendingBulkDelete ? "Delete selected messages?" : "Delete this message?"}
 message={
 pendingBulkDelete
 ? `Permanently remove ${selectedIds.length} message(s)? This cannot be undone.`
 : "This action cannot be undone."
 }
 confirmLabel="Delete"
 cancelLabel="Cancel"
 destructive
 busy={deleteBusy}
 />

 {/* Header */}
 <div className="mb-8">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-2">
 Messages
 </h1>
 <p className="text-slate-500 dark:text-slate-400 text-lg">Send messages and notifications to customers and guests</p>
 </div>
 {canCreateMessages ? (
 <button
 onClick={() => {
 setEditingMessage(null);
 resetForm();
 setShowForm(true);
 }}
 className="px-6 py-3 bg-[color:var(--admin-primary)] text-white font-semibold rounded-xl hover:brightness-110 transition-colors flex items-center gap-2"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 New Message
 </button>
 ) : null}
 </div>
 </div>

 {/* Filters */}
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-6">
 <div className="flex flex-wrap gap-4 items-end">
 {canBulkSelect ? (
 <div className="flex items-center gap-2 pb-1">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={toggleSelectAll}
 className="rounded"
 />
 <span className="text-sm text-slate-600 dark:text-slate-300">Select all</span>
 </div>
 ) : null}
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
 <select
 value={filters.language}
 onChange={(e) => setFilters({ ...filters, language: e.target.value })}
 className="h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 >
 <option value="all">All Languages</option>
 <option value="en">English</option>
 <option value="km">Khmer</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
 <select
 value={filters.status}
 onChange={(e) => setFilters({ ...filters, status: e.target.value })}
 className="h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 >
 <option value="all">All Status</option>
 <option value="active">Active</option>
 <option value="inactive">Inactive</option>
 </select>
 </div>
 <div className="flex-1 min-w-[220px]">
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Search</label>
 <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search messages..."
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 />
 </div>
 {canDeleteMessages && selectedIds.length > 0 && (
 <button
 onClick={deleteSelected}
 className="px-4 py-2 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 bg-white dark:bg-slate-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
 >
 Delete Selected ({selectedIds.length})
 </button>
 )}
 </div>
 </div>

 {/* Messages List */}
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
 {loading ? (
 <div className="p-12 text-center">
 <div className="mx-auto flex justify-center py-12">
 <AdminDashboardLoader />
 </div>
 </div>
 ) : filteredMessages.length === 0 ? (
 <div className="p-12 text-center">
 <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
 </svg>
 </div>
 <p className="text-slate-500 dark:text-slate-300 text-lg">No messages yet</p>
 <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Create your first message to start communicating with users</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-100 dark:divide-slate-800">
 {filteredMessages.map((message) => (
 <div key={message.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
 <div className="flex items-start gap-4">
 {canBulkSelect ? (
 <div className="pt-1">
 <input
 type="checkbox"
 checked={selectedIds.includes(message.id)}
 onChange={() => toggleSelect(message.id)}
 className="rounded"
 />
 </div>
 ) : null}
 <div className="flex items-start justify-between flex-1">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{message.title}</h3>
 <div className="flex gap-2">
 {getLanguageBadge(message.language)}
 {getAudienceBadge(message.target_audience)}
 </div>
 </div>
 <p className="text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">{message.content}</p>
 <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
 <span>Created: {new Date(message.created_at).toLocaleDateString()}</span>
 {message.scheduled_at && (
 <span>Scheduled: {new Date(message.scheduled_at).toLocaleString()}</span>
 )}
 {message.expires_at && (
 <span>Expires: {new Date(message.expires_at).toLocaleString()}</span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2 ml-4">
 {canEditMessages ? (
 <button
 onClick={() => handleToggleActive(message)}
 className={"px-3 py-1 text-xs font-medium rounded-full transition-colors " + (message.is_active ? 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-[color:var(--admin-primary)] dark:hover:brightness-110' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600')}
 >
 {message.is_active ? 'Active' : 'Inactive'}
 </button>
 ) : null}
 {canEditMessages ? (
 <button
 onClick={() => handleEdit(message)}
 className="h-9 w-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center justify-center"
 title="Edit"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 ) : null}
 {canDeleteMessages ? (
 <button
 onClick={() => handleDelete(message.id)}
 title="Delete"
 aria-label="Delete message"
 className="h-9 w-9 rounded-lg transition-colors inline-flex items-center justify-center"
 style={{
 color: message.is_active ? (isAdminDarkChrome() ? '#fca5a5' : '#dc2626') : (isAdminDarkChrome() ? '#fca5a5' : '#dc2626'),
 border: `1px solid ${isAdminDarkChrome() ? '#fca5a5' : '#fecaca'}`,
 backgroundColor: isAdminDarkChrome() ? 'rgba(248,113,113,0.12)' : '#fff',
 cursor: 'pointer',
 }}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 ) : null}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Message Form Modal */}
 <AdminModal
 open={showForm}
 onClose={closeForm}
 title={editingMessage ? 'Edit Message' : 'Create New Message'}
 titleId="message-form-title"
 maxWidthClass="max-w-2xl"
 >
 <form onSubmit={handleSubmit} className="space-y-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
 <input
 type="text"
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Content</label>
 <textarea
 value={formData.content}
 onChange={(e) => setFormData({ ...formData, content: e.target.value })}
 rows={4}
 className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Link (Optional)</label>
 <input
 type="url"
 value={formData.link_url}
 onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 placeholder="https://example.com/product"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Promotion Media (Image/Video)</label>
 <div className="grid md:grid-cols-2 gap-4">
 <div>
 <input
 type="url"
 value={formData.media_url}
 onChange={(e) => {
 const url = e.target.value;
 setFormData({ ...formData, media_url: url, media_type: inferMediaType(url, formData.media_type) });
 }}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 placeholder="Paste media URL"
 />
 <div className="mt-3 flex items-center gap-3 flex-wrap">
 <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
 Upload file
 <input
 type="file"
 accept="image/*,video/*"
 onChange={handleMediaUpload}
 className="hidden"
 />
 </label>
 {uploadingMedia && (
 <span className="text-xs text-slate-500 dark:text-slate-400">Uploading…</span>
 )}
 <select
 value={formData.media_type || ''}
 onChange={(e) => setFormData({ ...formData, media_type: e.target.value })}
 className="h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none text-sm"
 >
 <option value="">Auto</option>
 <option value="image">Image</option>
 <option value="video">Video</option>
 </select>
 </div>
 {uploadError && (
 <p className="text-xs text-red-600 mt-2">{uploadError}</p>
 )}
 </div>
 <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
 <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Preview</p>
 {formData.media_url ? (
 (formData.media_type || inferMediaType(formData.media_url)) === 'video' ? (
 <video
 src={formData.media_url.startsWith('http') ? formData.media_url : resolveImageUrl(formData.media_url)}
 controls
 className="w-full rounded-md"
 />
 ) : (
 <img
 src={formData.media_url.startsWith('http') ? formData.media_url : resolveImageUrl(formData.media_url)}
 alt="Preview"
 className="w-full rounded-md object-cover"
 />
 )
 ) : (
 <p className="text-xs text-slate-400">No media</p>
 )}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Language</label>
 <select
 value={formData.language}
 onChange={(e) => setFormData({ ...formData, language: e.target.value })}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 >
 <option value="en">English</option>
 <option value="km">Khmer</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Target Audience</label>
 <select
 value={formData.target_audience}
 onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 >
 <option value="all">All Users</option>
 <option value="customers">Customers Only</option>
 <option value="guests">Guests Only</option>
 </select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Schedule At (Optional)</label>
 <input
 type="datetime-local"
 value={formData.scheduled_at}
 onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Expires At (Optional)</label>
 <input
 type="datetime-local"
 value={formData.expires_at}
 onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
 className="w-full h-10 px-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[rgba(var(--admin-primary-rgb),0.22)]"
 />
 </div>
 </div>

 <div className="flex items-center">
 <input
 type="checkbox"
 id="is_active"
 checked={formData.is_active}
 onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
 className="h-4 w-4 border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-800"
 />
 <label htmlFor="is_active" className="ml-2 text-sm text-slate-700 dark:text-slate-300">
 Active
 </label>
 </div>

 <div className="flex justify-end gap-3 pt-4">
 <button
 type="button"
 onClick={closeForm}
 className="px-4 py-2 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="px-6 py-2 bg-[color:var(--admin-primary)] text-white font-semibold rounded-lg hover:brightness-110 transition-colors"
 >
 {editingMessage ? 'Update Message' : 'Create Message'}
 </button>
 </div>
 </form>
 </AdminModal>
 </div>
 </div>
 );
}
