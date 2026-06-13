import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../state/auth";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import { resolveImageUrl } from "../../lib/images";
import { useTheme } from "../../state/theme.jsx";
import AdminModal, { AdminConfirmDialog } from "../../components/admin/AdminModal.jsx";
import AdminPermissionsPanel from "../../components/admin/AdminPermissionsPanel.jsx";
import { AdminSectionLoader, AdminContentSkeleton } from "@/components/admin/AdminLoading";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import {
 buildAllColumnsVisibility,
 loadTableColumnVisibility,
 TableColumnVisibilityMenu,
} from "../../components/admin/TableColumnVisibilityMenu.jsx";

const CUSTOMER_TABLE_COLUMNS = [
 { id: "select", label: "Select" },
 { id: "name", label: "Name" },
 { id: "email", label: "Email" },
 { id: "phone", label: "Phone" },
 { id: "role", label: "Role" },
 { id: "loyalty", label: "Loyalty" },
 { id: "orders", label: "Orders" },
 { id: "totalSpent", label: "Total Spent" },
 { id: "joined", label: "Joined" },
 { id: "actions", label: "Actions" },
];

const CUSTOMER_STATUS_OPTIONS = [
 { value: "", label: "All statuses" },
 { value: "active", label: "Active" },
 { value: "inactive", label: "Inactive" },
 { value: "suspended", label: "Suspended" },
];

const CUSTOMER_LOYALTY_OPTIONS = [
 { value: "", label: "All tiers" },
 { value: "bronze", label: "Bronze" },
 { value: "silver", label: "Silver" },
 { value: "gold", label: "Gold" },
 { value: "vip", label: "VIP" },
];

const CUSTOMER_ORDERS_OPTIONS = [
 { value: "", label: "All customers" },
 { value: "1", label: "With orders" },
 { value: "0", label: "No orders" },
];

const CUSTOMER_SORT_OPTIONS = [
 { value: "newest", label: "Newest first" },
 { value: "name", label: "Name (A–Z)" },
 { value: "orders", label: "Most orders" },
 { value: "spent", label: "Highest spent" },
 { value: "loyalty", label: "Most points" },
];

const ADMIN_TABLE_COLUMNS = [
 { id: "name", label: "Name" },
 { id: "email", label: "Email" },
 { id: "phone", label: "Phone" },
 { id: "role", label: "Role" },
 { id: "joined", label: "Joined" },
 { id: "actions", label: "Actions" },
];

const CUSTOMERS_COLUMNS_STORAGE_KEY = "fitandsleek-customers-columns";
const ADMINISTRATORS_COLUMNS_STORAGE_KEY = "fitandsleek-administrators-columns";

const USER_ROLE_OPTIONS = [
 { value: "customer", label: "Customer" },
 { value: "admin", label: "Admin" },
 { value: "superadmin", label: "Super Admin" },
 { value: "driver", label: "Driver" },
];

function formatDate(value) {
 if (!value) return "—";
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function normalizeRoleValue(role) {
 const normalized = String(role || "customer").toLowerCase().replace(/[\s-]+/g, "");
 if (normalized === "superadmin") return "superadmin";
 if (normalized === "admin") return "admin";
 if (normalized === "driver") return "driver";
 return "customer";
}

function formatRoleLabel(role) {
 const normalized = String(role || "").toLowerCase().replace(/[\s-]+/g, "");
 if (normalized === "superadmin") return "Super Admin";
 if (normalized === "admin") return "Admin";
 if (normalized === "driver") return "Driver";
 if (normalized === "customer") return "Customer";
 if (!role) return "—";
 return String(role).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function loyaltyTierBadgeClass(tier) {
 const normalized = String(tier || "bronze").toLowerCase();
 if (normalized === "vip") return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800";
 if (normalized === "gold") return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
 if (normalized === "silver") return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
 return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800";
}

function formatLoyaltyTierLabel(tier) {
 const normalized = String(tier || "bronze").toLowerCase();
 if (normalized === "vip") return "VIP";
 return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function roleBadgeClass(role) {
 const normalized = String(role || "").toLowerCase().replace(/[\s-]+/g, "");
 if (normalized === "superadmin") {
 return "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-800";
 }
 if (normalized === "admin") {
 return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800";
 }
 if (normalized === "driver") {
 return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
 }
 if (normalized === "customer") {
 return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800";
 }
 return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
}

const pageSize = 10;

function normalizeList(payload) {
 if (Array.isArray(payload)) return payload;
 if (Array.isArray(payload?.data)) return payload.data;
 if (Array.isArray(payload?.data?.data)) return payload.data.data;
 if (Array.isArray(payload?.customers)) return payload.customers;
 if (Array.isArray(payload?.users)) return payload.users;
 return [];
}

export default function Users({ showCustomers = true, showAdmins = true }) {
 const navigate = useNavigate();
 const { user, refresh } = useAuth();
 const { user: sessionUser, can, permissionsReady } = useAdminPermissions();
 const canViewCustomers = can("customers", "view");
 const canCreateCustomers = can("customers", "create");
 const canEditCustomers = can("customers", "edit");
 const canDeleteCustomers = can("customers", "delete");
 const { mode } = useTheme();
 const isSuperAdmin = useMemo(() => {
 const role = user?.role?.toLowerCase?.();
 return role === "superadmin" || role === "super admin" || role === "super-admin";
 }, [user]);

 const allowAdmins = showAdmins && isSuperAdmin;
 const customersPageOnly = showCustomers && !allowAdmins;
 const showCustomerSection = showCustomers && canViewCustomers;
 const customerCanMutate = canEditCustomers || canDeleteCustomers;

 const pageTitle = useMemo(() => {
 if (!showCustomers && allowAdmins) return "Administrators";
 if (showCustomers && !allowAdmins) return "Customers";
 return "Users";
 }, [showCustomers, allowAdmins]);

 const pageSubtitle = useMemo(() => {
 if (!showCustomers && allowAdmins) return "Invite and manage staff accounts with admin access.";
 if (showCustomers && !allowAdmins) return "Review customer profiles, orders, and contact details.";
 return "Manage your customers and admin team in one place.";
 }, [showCustomers, allowAdmins]);

 const [customers, setCustomers] = useState([]);
 const [admins, setAdmins] = useState([]);
 const [loadingCustomers, setLoadingCustomers] = useState(showCustomers);
 const [loadingAdmins, setLoadingAdmins] = useState(allowAdmins);
 const [viewMode, setViewMode] = useState("list");
 const [adminViewMode, setAdminViewMode] = useState("list");
 const [searchQuery, setSearchQuery] = useState("");
 const [searchDebounced, setSearchDebounced] = useState("");
 const [statusFilter, setStatusFilter] = useState("");
 const [loyaltyFilter, setLoyaltyFilter] = useState("");
 const [ordersFilter, setOrdersFilter] = useState("");
 const [sortFilter, setSortFilter] = useState("newest");
 const [currentPage, setCurrentPage] = useState(1);
 const [customerTotalPages, setCustomerTotalPages] = useState(1);
 const [customerTotal, setCustomerTotal] = useState(0);
 const [adminSearchQuery, setAdminSearchQuery] = useState("");
 const [selectedIds, setSelectedIds] = useState([]);
 const [showAddModal, setShowAddModal] = useState(false);
 const [editingUser, setEditingUser] = useState(null);
 const [userToDelete, setUserToDelete] = useState(null);
 const [modalContext, setModalContext] = useState("customer");
 const [deleteContext, setDeleteContext] = useState("customer");
 const [formData, setFormData] = useState({
 name: "",
 email: "",
 phone: "",
 address: "",
 password: "",
 role: "customer",
 });
 const [customerColumnVisibility, setCustomerColumnVisibility] = useState(() =>
 loadTableColumnVisibility(CUSTOMERS_COLUMNS_STORAGE_KEY, CUSTOMER_TABLE_COLUMNS),
 );
 const [adminColumnVisibility, setAdminColumnVisibility] = useState(() =>
 loadTableColumnVisibility(ADMINISTRATORS_COLUMNS_STORAGE_KEY, ADMIN_TABLE_COLUMNS),
 );
 const [permissionsAdmin, setPermissionsAdmin] = useState(null);

 useEffect(() => {
 const t = window.setTimeout(() => setSearchDebounced(searchQuery.trim()), 350);
 return () => window.clearTimeout(t);
 }, [searchQuery]);

 useEffect(() => {
 if (!showCustomers) {
 setLoadingCustomers(false);
 return;
 }
 if (!permissionsReady) return;
 if (!canViewCustomers) {
 setCustomers([]);
 setCustomerTotalPages(1);
 setCustomerTotal(0);
 setLoadingCustomers(false);
 return;
 }
 loadCustomers(currentPage, searchDebounced, {
 status: statusFilter,
 loyalty_tier: loyaltyFilter,
 has_orders: ordersFilter,
 sort: sortFilter,
 });
 }, [showCustomers, currentPage, searchDebounced, statusFilter, loyaltyFilter, ordersFilter, sortFilter, permissionsReady, canViewCustomers]);

 useEffect(() => {
 if (allowAdmins) {
 loadAdmins();
 } else {
 setLoadingAdmins(false);
 }
 }, [allowAdmins]);

 useEffect(() => {
 try {
 localStorage.setItem(CUSTOMERS_COLUMNS_STORAGE_KEY, JSON.stringify(customerColumnVisibility));
 } catch { /* ignore quota */ }
 }, [customerColumnVisibility]);

 useEffect(() => {
 try {
 localStorage.setItem(ADMINISTRATORS_COLUMNS_STORAGE_KEY, JSON.stringify(adminColumnVisibility));
 } catch { /* ignore quota */ }
 }, [adminColumnVisibility]);

 const colIsVisible = (context, columnId) => {
 const visibility = context === "admin" ? adminColumnVisibility : customerColumnVisibility;
 return visibility[columnId] !== false;
 };

 const toggleTableColumn = (context, columnId) => {
 const setter = context === "admin" ? setAdminColumnVisibility : setCustomerColumnVisibility;
 setter((prev) => ({ ...prev, [columnId]: !(prev[columnId] !== false) }));
 };

 const setAllTableColumnsVisible = (context, visible) => {
 const columns = context === "admin" ? ADMIN_TABLE_COLUMNS : CUSTOMER_TABLE_COLUMNS;
 const setter = context === "admin" ? setAdminColumnVisibility : setCustomerColumnVisibility;
 setter(buildAllColumnsVisibility(columns, visible, "name"));
 };

 const loadCustomers = async (page = 1, search = "", filters = {}) => {
 if (!canViewCustomers) {
 setCustomers([]);
 setLoadingCustomers(false);
 return;
 }
 setLoadingCustomers(true);
 try {
 const params = { page, per_page: pageSize, compact: 1 };
 if (search) params.search = search;
 if (filters.status) params.status = filters.status;
 if (filters.loyalty_tier) params.loyalty_tier = filters.loyalty_tier;
 if (filters.has_orders) params.has_orders = filters.has_orders;
 if (filters.sort && filters.sort !== "newest") {
 const sortMap = {
 name: { sort: "name", direction: "asc" },
 orders: { sort: "orders", direction: "desc" },
 spent: { sort: "spent", direction: "desc" },
 loyalty: { sort: "loyalty", direction: "desc" },
 };
 const mapped = sortMap[filters.sort];
 if (mapped) {
 params.sort = mapped.sort;
 params.direction = mapped.direction;
 }
 }
 const { data } = await api.get("/admin/customers", { params });
 const list = normalizeList(data);
 setCustomers(list);
 setCustomerTotalPages(Math.max(1, Number(data?.last_page) || 1));
 setCustomerTotal(Number(data?.total) || list.length);
 } catch (err) {
 console.error("Failed to load customers", err);
 setCustomers([]);
 setCustomerTotalPages(1);
 setCustomerTotal(0);
 } finally {
 setLoadingCustomers(false);
 }
 };

 const loadAdmins = async () => {
 setLoadingAdmins(true);
 try {
 const { data } = await api.get("/admin/superadmin/users", { params: { role: "admin", per_page: 50 } });
 setAdmins(normalizeList(data));
 } catch (err) {
 console.error("Failed to load admins", err);
 setAdmins([]);
 } finally {
 setLoadingAdmins(false);
 }
 };

 const paginatedCustomers = customers;
 const totalPages = customerTotalPages;
 const filteredCustomers = customers;
 const allSelected = paginatedCustomers.length > 0 && paginatedCustomers.every((cust) => selectedIds.includes(cust.id));
 const hasActiveCustomerFilters = Boolean(statusFilter || loyaltyFilter || ordersFilter || sortFilter !== "newest");

 const clearCustomerFilters = () => {
 setStatusFilter("");
 setLoyaltyFilter("");
 setOrdersFilter("");
 setSortFilter("newest");
 setCurrentPage(1);
 };

 const filteredAdmins = useMemo(() => {
 const q = adminSearchQuery.trim().toLowerCase();
 if (!q) return admins;
 return admins.filter((adm) => [adm.name, adm.email, adm.phone].some((field) => field?.toString().toLowerCase().includes(q)));
 }, [admins, adminSearchQuery]);

 const toggleSelect = (id) => {
 setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
 };

 const toggleSelectAll = () => {
 if (allSelected) {
 setSelectedIds((prev) => prev.filter((id) => !paginatedCustomers.some((cust) => cust.id === id)));
 } else {
 const idsToAdd = paginatedCustomers.map((cust) => cust.id).filter((id) => !selectedIds.includes(id));
 setSelectedIds((prev) => [...prev, ...idsToAdd]);
 }
 };

 const openCreate = (context) => {
 if (context === "admin" && !allowAdmins) return;
 if (context === "customer" && !canCreateCustomers) return;
 setModalContext(context);
 setEditingUser(null);
 setFormData({
 name: "",
 email: "",
 phone: "",
 address: "",
 password: "",
 role: context === "admin" ? "admin" : "customer",
 });
 setShowAddModal(true);
 };

 const openEdit = (userItem, context) => {
 if (context === "admin" && !allowAdmins) return;
 if (context === "customer" && !canEditCustomers) return;
 setModalContext(context);
 setEditingUser(userItem);
 setFormData({
 name: userItem.name || "",
 email: userItem.email || "",
 phone: userItem.phone || "",
 address: userItem.address || "",
 password: "",
 role: normalizeRoleValue(userItem.role),
 });
 setShowAddModal(true);
 };

 const openDelete = (userItem, context) => {
 if (context === "admin" && !allowAdmins) return;
 if (context === "customer" && !canDeleteCustomers) return;
 setUserToDelete(userItem);
 setDeleteContext(context);
 };

 const openPermissions = (adminItem) => {
 if (!allowAdmins || adminItem?.role !== "admin") return;
 setPermissionsAdmin(adminItem);
 };

 const openProfile = (userItem, context) => {
 if (context === "admin" && !allowAdmins) return;
 if (context === "customer" && !canViewCustomers) return;
 navigate(`/admin/users/${userItem.id}`);
 };

 const closeModals = () => {
 setShowAddModal(false);
 setEditingUser(null);
 setUserToDelete(null);
 setFormData({
 name: "",
 email: "",
 phone: "",
 address: "",
 password: "",
 role: "customer",
 });
 };

 const handleSubmit = async () => {
 if (modalContext === "admin" && !allowAdmins) return;
 if (modalContext === "customer") {
 if (editingUser && !canEditCustomers) return;
 if (!editingUser && !canCreateCustomers) return;
 }
 const payload = { name: formData.name, email: formData.email, phone: formData.phone, address: formData.address };
 if (isSuperAdmin) {
 payload.role = formData.role;
 }
 if (!editingUser || modalContext === "admin") {
 if (formData.password) {
 payload.password = formData.password;
 if (modalContext === "admin") payload.password_confirmation = formData.password;
 }
 }

 try {
 if (editingUser) {
 const url = `/admin/${modalContext === "admin" ? "superadmin/admin-users" : "customers"}/${editingUser.id}`;
 if (modalContext === "admin") {
 await api.put(url, payload);
 } else {
 await api.patch(url, payload);
 }
 } else {
 const url = modalContext === "admin" ? "/admin/superadmin/admin-users" : "/admin/customers";
 await api.post(url, payload);
 }
 if (modalContext === "admin" || isSuperAdmin) {
 await loadAdmins();
 }
 if (modalContext === "customer" || isSuperAdmin) {
 await loadCustomers(currentPage, searchDebounced, {
 status: statusFilter,
 loyalty_tier: loyaltyFilter,
 has_orders: ordersFilter,
 sort: sortFilter,
 });
 }
 closeModals();
 } catch (err) {
 console.error("Failed to save user", err);
 }
 };

 const handleDelete = async () => {
 if (!userToDelete) return;
 if (deleteContext === "admin" && !allowAdmins) return;
 if (deleteContext === "customer" && !canDeleteCustomers) return;
 try {
 const url = deleteContext === "admin" ? `/admin/superadmin/admin-users/${userToDelete.id}` : `/admin/customers/${userToDelete.id}`;
 await api.delete(url);
 if (deleteContext === "admin") {
 await loadAdmins();
 } else {
 await loadCustomers(currentPage, searchDebounced, {
 status: statusFilter,
 loyalty_tier: loyaltyFilter,
 has_orders: ordersFilter,
 sort: sortFilter,
 });
 }
 } catch (err) {
 console.error("Failed to delete user", err);
 } finally {
 closeModals();
 }
 };

 if (customersPageOnly && !permissionsReady) {
 return <AdminContentSkeleton title="Customers" />;
 }
 if (customersPageOnly && permissionsReady && !canViewCustomers) {
 return <Navigate to={getFirstAccessibleAdminPath(sessionUser)} replace />;
 }

 if (loadingCustomers && customers.length === 0 && !showAdmins) {
 return <AdminContentSkeleton title="Users" />;
 }
 if (loadingAdmins && admins.length === 0 && !showCustomers) {
 return <AdminContentSkeleton title="Users" />;
 }
 if (loadingCustomers && loadingAdmins && customers.length === 0 && admins.length === 0) {
 return <AdminContentSkeleton title="Users" />;
 }

 const viewToggleButton = (mode, activeMode, setter, title, icon) => (
 <button
 type="button"
 title={title}
 onClick={() => setter(mode)}
 className={
 "h-8 w-8 rounded-md transition-colors inline-flex items-center justify-center " +
 (activeMode === mode
 ? "text-white bg-[color:var(--admin-primary)] shadow-sm"
 : "text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")
 }
 >
 {icon}
 </button>
 );

 const isDark = mode === "dark";

 const deleteButtonStyle = {
 backgroundColor: isDark ? "rgba(127, 29, 29, 0.22)" : "#fef2f2",
 color: isDark ? "#fecdd3" : "#991b1b",
 border: `1px solid ${isDark ? "rgba(248, 113, 113, 0.45)" : "#fecdd3"}`,
 borderRadius: "0.5rem",
 height: "2.25rem",
 width: "2.25rem",
 display: "inline-flex",
 alignItems: "center",
 justifyContent: "center",
 transition: "all 150ms ease",
 };

 const renderUserRow = (item, context) => (
 <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
 {context === "customer" && colIsVisible(context, "select") && (
 <td className="px-6 py-4">
 <input
 type="checkbox"
 checked={selectedIds.includes(item.id)}
 onChange={() => toggleSelect(item.id)}
 className="rounded border-slate-300 dark:border-slate-700"
 />
 </td>
 )}
 {colIsVisible(context, "name") && (
 <td className="px-6 py-4">
 <button
 type="button"
 onClick={() => openProfile(item, context)}
 className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
 title="View profile"
 >
 <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold overflow-hidden">
 {item.profile_image_url ? (
<img src={resolveImageUrl(item.profile_image_url)} alt={item.name} className="w-full h-full object-cover" />
 ) : (
 item.name?.charAt(0).toUpperCase()
 )}
 </div>
 <div className="min-w-0">
 <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate hover:text-[color:var(--admin-primary)]">
 {item.name}
 </div>
 </div>
 </button>
 </td>
 )}
 {colIsVisible(context, "email") && (
 <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 truncate">{item.email || "-"}</td>
 )}
 {colIsVisible(context, "phone") && (
 <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 truncate">{item.phone || "-"}</td>
 )}
 {colIsVisible(context, "role") && (
 <td className="px-6 py-4">
 <span
 className={
 "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " +
 roleBadgeClass(item.role)
 }
 >
 {formatRoleLabel(item.role)}
 </span>
 </td>
 )}
 {context === "customer" && colIsVisible(context, "loyalty") && (
 <td className="px-6 py-4">
 <div className="flex flex-col gap-1">
 <span
 className={
 "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " +
 loyaltyTierBadgeClass(item.loyalty_tier)
 }
 >
 {formatLoyaltyTierLabel(item.loyalty_tier)}
 </span>
 <span className="text-xs text-slate-500 dark:text-slate-400">
 {Number(item.loyalty_points ?? 0).toLocaleString()} pts
 </span>
 </div>
 </td>
 )}
 {context === "customer" && colIsVisible(context, "orders") && (
 <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{item.orders_count ?? 0}</td>
 )}
 {context === "customer" && colIsVisible(context, "totalSpent") && (
 <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-100 font-semibold">
 ${Number(item.total_spent || 0).toFixed(2)}
 </td>
 )}
 {colIsVisible(context, "joined") && (
 <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(item.created_at)}</td>
 )}
 {colIsVisible(context, "actions") && (
 <td className="px-6 py-4">
 <div className="flex gap-2">
 {(context === "admin" && allowAdmins) || (context === "customer" && canViewCustomers) ? (
 <button
 onClick={() => openProfile(item, context)}
 title="View profile"
 className="h-9 w-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </button>
 ) : null}
 {(context === "admin" || customerCanMutate) && (context === "admin" || canEditCustomers) && (
 <button
 onClick={() => openEdit(item, context)}
 title="Edit"
 className="h-9 w-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 )}
 {context === "admin" && item.role === "admin" ? (
 <button
 onClick={() => openPermissions(item)}
 title="Manage Permissions"
 className="h-9 w-9 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors inline-flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 </button>
 ) : null}
 {(context === "admin" || canDeleteCustomers) && (
 <button
 onClick={() => openDelete(item, context)}
 title="Delete"
 className="transition-colors"
 style={deleteButtonStyle}
 aria-label={`Delete ${context === "admin" ? "admin" : "customer"}`}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 </div>
 </td>
 )}
 </tr>
 );

 const renderUserCard = (item, context) => (
 <div
 key={item.id}
 className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3"
 >
 <div className="flex items-center gap-3">
 {context === "customer" && colIsVisible(context, "select") && (
 <input
 type="checkbox"
 checked={selectedIds.includes(item.id)}
 onChange={() => toggleSelect(item.id)}
 className="rounded border-slate-300 dark:border-slate-700"
 />
 )}
 {colIsVisible(context, "name") && (
 <button
 type="button"
 onClick={() => openProfile(item, context)}
 className="flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition-opacity"
 title="View profile"
 >
 <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold overflow-hidden flex-shrink-0">
 {item.profile_image_url ? (
<img src={resolveImageUrl(item.profile_image_url)} alt={item.name} className="w-full h-full object-cover" />
 ) : (
 item.name?.charAt(0).toUpperCase()
 )}
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate hover:text-[color:var(--admin-primary)]">
 {item.name}
 </p>
 {colIsVisible(context, "email") ? (
 <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.email}</p>
 ) : null}
 </div>
 </button>
 )}
 </div>
 {(colIsVisible(context, "phone") || colIsVisible(context, "role") || colIsVisible(context, "joined") || (context === "customer" && (colIsVisible(context, "loyalty") || colIsVisible(context, "orders") || colIsVisible(context, "totalSpent")))) ? (
 <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
 {colIsVisible(context, "phone") ? (
 <div>
 <span className="text-slate-400 dark:text-slate-500">Phone</span>
 <p className="text-slate-700 dark:text-slate-200 font-medium">{item.phone || "-"}</p>
 </div>
 ) : null}
 {colIsVisible(context, "role") ? (
 <div>
 <span className="text-slate-400 dark:text-slate-500">Role</span>
 <p className="mt-1">
 <span
 className={
 "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
 roleBadgeClass(item.role)
 }
 >
 {formatRoleLabel(item.role)}
 </span>
 </p>
 </div>
 ) : null}
 {colIsVisible(context, "joined") ? (
 <div>
 <span className="text-slate-400 dark:text-slate-500">Joined</span>
 <p className="text-slate-700 dark:text-slate-200 font-medium">{formatDate(item.created_at)}</p>
 </div>
 ) : null}
 {context === "customer" && colIsVisible(context, "loyalty") ? (
 <div>
 <span className="text-slate-400 dark:text-slate-500">Loyalty</span>
 <p className="mt-1">
 <span
 className={
 "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
 loyaltyTierBadgeClass(item.loyalty_tier)
 }
 >
 {formatLoyaltyTierLabel(item.loyalty_tier)}
 </span>
 </p>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{Number(item.loyalty_points ?? 0).toLocaleString()} pts</p>
 </div>
 ) : null}
 {context === "customer" && colIsVisible(context, "orders") ? (
 <div>
 <span className="text-slate-400 dark:text-slate-500">Orders</span>
 <p className="font-semibold text-slate-800 dark:text-slate-100">{item.orders_count ?? 0}</p>
 </div>
 ) : null}
 {context === "customer" && colIsVisible(context, "totalSpent") ? (
 <div>
 <span className="text-slate-400 dark:text-slate-500">Total Spent</span>
 <p className="font-bold text-slate-900 dark:text-slate-100">${Number(item.total_spent || 0).toFixed(2)}</p>
 </div>
 ) : null}
 </div>
 ) : null}
 {colIsVisible(context, "actions") ? (
 <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
 {(context === "admin" && allowAdmins) || (context === "customer" && canViewCustomers) ? (
 <button
 onClick={() => openProfile(item, context)}
 title="View profile"
 className="flex-1 h-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </button>
 ) : null}
 {(context === "admin" || customerCanMutate) && (context === "admin" || canEditCustomers) && (
 <button
 onClick={() => openEdit(item, context)}
 title="Edit"
 className="flex-1 h-9 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 )}
 {context === "admin" && item.role === "admin" ? (
 <button
 onClick={() => openPermissions(item)}
 title="Manage Permissions"
 className="flex-1 h-9 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors inline-flex items-center justify-center"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
 </svg>
 </button>
 ) : null}
 {(context === "admin" || canDeleteCustomers) && (
 <button
 onClick={() => openDelete(item, context)}
 title="Delete"
 className="transition-colors"
 style={{
 ...deleteButtonStyle,
 width: "100%",
 }}
 aria-label={`Delete ${context === "admin" ? "admin" : "customer"}`}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 </div>
 ) : null}
 </div>
 );

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <div className="w-full min-w-0">
 <div className="mb-10 flex items-center justify-between">
 <div>
 <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2">Admin</p>
 <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{pageTitle}</h1>
 <p className="text-slate-500 dark:text-slate-400 mt-2">{pageSubtitle}</p>
 </div>
 <div className="flex gap-3">
 {showCustomerSection && canCreateCustomers && (
 <button
 onClick={() => openCreate("customer")}
 className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold text-white bg-[color:var(--admin-primary)] hover:brightness-110"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Customer
 </button>
 )}
 {allowAdmins && (
 <button
 onClick={() => openCreate("admin")}
 className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-semibold text-white bg-[color:var(--admin-primary)] hover:brightness-110"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Admin
 </button>
 )}
 </div>
 </div>

 {showCustomerSection && (
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 mb-12">
 <div className="px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 dark:border-slate-800">
 <div>
 <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customers</h2>
 <p className="text-slate-500 dark:text-slate-400">Total: {customerTotal} customer{customerTotal !== 1 ? "s" : ""}</p>
 </div>
 <div className="flex flex-col gap-3 w-full lg:w-auto lg:flex-row lg:items-center">
 <div className="flex items-center gap-3">
 <input
 type="text"
 placeholder="Search by name, email, or phone"
 value={searchQuery}
 onChange={(e) => {
 setSearchQuery(e.target.value);
 setCurrentPage(1);
 }}
 className="w-full lg:w-72 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400"
 />
 <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-0.5">
 {viewToggleButton("list", viewMode, setViewMode, "List view", (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
 </svg>
 ))}
 {viewToggleButton("grid", viewMode, setViewMode, "Grid view", (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
 <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
 <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
 <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
 </svg>
 ))}
 {viewToggleButton("split", viewMode, setViewMode, "Split view", (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <rect x="3" y="3" width="8" height="18" rx="1" strokeWidth={2} />
 <rect x="13" y="3" width="8" height="18" rx="1" strokeWidth={2} />
 </svg>
 ))}
 <TableColumnVisibilityMenu
 columns={CUSTOMER_TABLE_COLUMNS}
 visibility={customerColumnVisibility}
 onToggle={(id) => toggleTableColumn("customer", id)}
 onShowAll={() => setAllTableColumnsVisible("customer", true)}
 onHideAll={() => setAllTableColumnsVisible("customer", false)}
 />
 </div>
 </div>
 </div>
 </div>

 <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
 <select
 value={statusFilter}
 onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
 className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100"
 aria-label="Filter by status"
 >
 {CUSTOMER_STATUS_OPTIONS.map((opt) => (
 <option key={opt.value || "all-status"} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <select
 value={loyaltyFilter}
 onChange={(e) => { setLoyaltyFilter(e.target.value); setCurrentPage(1); }}
 className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100"
 aria-label="Filter by loyalty tier"
 >
 {CUSTOMER_LOYALTY_OPTIONS.map((opt) => (
 <option key={opt.value || "all-tier"} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <select
 value={ordersFilter}
 onChange={(e) => { setOrdersFilter(e.target.value); setCurrentPage(1); }}
 className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100"
 aria-label="Filter by orders"
 >
 {CUSTOMER_ORDERS_OPTIONS.map((opt) => (
 <option key={opt.value || "all-orders"} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <select
 value={sortFilter}
 onChange={(e) => { setSortFilter(e.target.value); setCurrentPage(1); }}
 className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100"
 aria-label="Sort customers"
 >
 {CUSTOMER_SORT_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 {hasActiveCustomerFilters ? (
 <button
 type="button"
 onClick={clearCustomerFilters}
 className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
 >
 Clear filters
 </button>
 ) : null}
 </div>
 </div>

 {loadingCustomers ? (
 <AdminSectionLoader rows={6} />
 ) : paginatedCustomers.length === 0 ? (
 <div className="p-12 text-center">
 <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
 </svg>
 <p className="text-slate-500 dark:text-slate-200 text-lg">No customers found</p>
 </div>
 ) : viewMode === "list" ? (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-semibold text-slate-600 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
 {colIsVisible("customer", "select") ? (
 <th className="px-6 py-4">
 <input type="checkbox" onChange={toggleSelectAll} checked={allSelected} className="rounded border-slate-300 dark:border-slate-700" />
 </th>
 ) : null}
 {colIsVisible("customer", "name") ? <th className="px-6 py-4">Name</th> : null}
 {colIsVisible("customer", "email") ? <th className="px-6 py-4">Email</th> : null}
 {colIsVisible("customer", "phone") ? <th className="px-6 py-4">Phone</th> : null}
 {colIsVisible("customer", "role") ? <th className="px-6 py-4">Role</th> : null}
 {colIsVisible("customer", "loyalty") ? <th className="px-6 py-4">Loyalty</th> : null}
 {colIsVisible("customer", "orders") ? <th className="px-6 py-4">Orders</th> : null}
 {colIsVisible("customer", "totalSpent") ? <th className="px-6 py-4">Total Spent</th> : null}
 {colIsVisible("customer", "joined") ? <th className="px-6 py-4">Joined</th> : null}
 {colIsVisible("customer", "actions") ? <th className="px-6 py-4">Actions</th> : null}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
 {paginatedCustomers.map((cust) => renderUserRow(cust, "customer"))}
 </tbody>
 </table>
 </div>
 ) : (
 <div
 className={
 "p-6 " +
 (viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 lg:grid-cols-2")
 }
 >
 {paginatedCustomers.map((cust) => renderUserCard(cust, "customer"))}
 </div>
 )}
 <AdminListPaginationBar
 page={currentPage}
 lastPage={totalPages}
 total={customerTotal}
 onPageChange={setCurrentPage}
 />
 </div>
 )}

 {allowAdmins && (
 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ">
 <div className="px-6 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 dark:border-slate-800">
 <div>
 <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Administrators</h2>
 <p className="text-slate-500 dark:text-slate-400">Total: {filteredAdmins.length} admin{filteredAdmins.length !== 1 ? "s" : ""}</p>
 </div>
 <div className="flex flex-col gap-3 w-full lg:w-auto lg:flex-row lg:items-center">
 <input
 type="text"
 placeholder="Search admins by name, email, or phone"
 value={adminSearchQuery}
 onChange={(e) => setAdminSearchQuery(e.target.value)}
 className="w-full lg:w-72 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-400 focus:bg-white dark:focus:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder-slate-400"
 />
 <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 gap-0.5">
 {viewToggleButton("list", adminViewMode, setAdminViewMode, "List view", (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
 </svg>
 ))}
 {viewToggleButton("grid", adminViewMode, setAdminViewMode, "Grid view", (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
 <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
 <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
 <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
 </svg>
 ))}
 {viewToggleButton("split", adminViewMode, setAdminViewMode, "Split view", (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <rect x="3" y="3" width="8" height="18" rx="1" strokeWidth={2} />
 <rect x="13" y="3" width="8" height="18" rx="1" strokeWidth={2} />
 </svg>
 ))}
 <TableColumnVisibilityMenu
 columns={ADMIN_TABLE_COLUMNS}
 visibility={adminColumnVisibility}
 onToggle={(id) => toggleTableColumn("admin", id)}
 onShowAll={() => setAllTableColumnsVisible("admin", true)}
 onHideAll={() => setAllTableColumnsVisible("admin", false)}
 />
 </div>
 </div>
 </div>

 {loadingAdmins ? (
 <AdminSectionLoader rows={4} />
 ) : filteredAdmins.length === 0 ? (
 <div className="p-12 text-center">
 <svg className="w-20 h-20 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 <p className="text-slate-500 dark:text-slate-200 text-lg">No administrators found</p>
 </div>
 ) : adminViewMode === "list" ? (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-semibold text-slate-600 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
 {colIsVisible("admin", "name") ? <th className="px-6 py-4">Name</th> : null}
 {colIsVisible("admin", "email") ? <th className="px-6 py-4">Email</th> : null}
 {colIsVisible("admin", "phone") ? <th className="px-6 py-4">Phone</th> : null}
 {colIsVisible("admin", "role") ? <th className="px-6 py-4">Role</th> : null}
 {colIsVisible("admin", "joined") ? <th className="px-6 py-4">Joined</th> : null}
 {colIsVisible("admin", "actions") ? <th className="px-6 py-4">Actions</th> : null}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
 {filteredAdmins.map((admin) => renderUserRow(admin, "admin"))}
 </tbody>
 </table>
 </div>
 ) : (
 <div
 className={
 "p-6 " +
 (adminViewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 lg:grid-cols-2")
 }
 >
 {filteredAdmins.map((admin) => renderUserCard(admin, "admin"))}
 </div>
 )}
 </div>
 )}
 </div>

 <AdminModal
 open={showAddModal}
 onClose={closeModals}
 title={`${editingUser ? "Edit" : "Add"} ${modalContext === "admin" ? "Administrator" : "Customer"}`}
 titleId="user-form-title"
 maxWidthClass="max-w-xl"
 >
 <p className="-mt-2 mb-4 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
 {modalContext === "admin" ? "Admin" : "Customer"}
 </p>
 <div className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
 <span>Name</span>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-500"
 />
 </label>
 <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
 <span>Email</span>
 <input
 type="email"
 value={formData.email}
 onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-500"
 />
 </label>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
 <span>Phone</span>
 <input
 type="text"
 value={formData.phone}
 onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-500"
 />
 </label>
 <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
 <span>Address</span>
 <input
 type="text"
 value={formData.address}
 onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-500"
 />
 </label>
 </div>
 {isSuperAdmin ? (
 <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200 block sm:max-w-xs">
 <span>Role</span>
 <select
 value={formData.role}
 onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
 disabled={
 !!editingUser &&
 (normalizeRoleValue(editingUser.role) === "superadmin" || editingUser.id === user?.id)
 }
 className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
 >
 {USER_ROLE_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 {editingUser?.id === user?.id ? (
 <p className="text-xs font-normal text-slate-500 dark:text-slate-400">You cannot change your own role.</p>
 ) : null}
 {normalizeRoleValue(editingUser?.role) === "superadmin" ? (
 <p className="text-xs font-normal text-slate-500 dark:text-slate-400">Super Admin role cannot be changed here.</p>
 ) : null}
 </label>
 ) : null}
 {(modalContext === "admin" || !editingUser) && (
 <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200 block">
 <span>Password {editingUser ? "(leave blank to keep)" : ""}</span>
 <input
 type="password"
 value={formData.password}
 onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--admin-primary)] dark:focus:border-slate-500"
 />
 </label>
 )}
 </div>

 <div className="mt-6 border-t border-slate-200 bg-slate-50 pt-4 dark:border-slate-800 dark:bg-slate-900 flex gap-3 justify-end">
 <button
 onClick={closeModals}
 className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-semibold"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 className="px-4 py-2 rounded-lg transition-colors font-semibold text-white bg-[color:var(--admin-primary)] hover:brightness-110"
 >
 Save
 </button>
 </div>
 </AdminModal>

 <AdminConfirmDialog
 open={!!userToDelete}
 onClose={closeModals}
 onConfirm={handleDelete}
 title={`Delete ${deleteContext === "admin" ? "Administrator" : "Customer"}`}
 message={`Are you sure you want to delete ${userToDelete?.name || "this user"}? This action cannot be undone.`}
 confirmLabel="Delete"
 cancelLabel="Cancel"
 destructive
 />

 <AdminPermissionsPanel
 open={!!permissionsAdmin}
 adminUser={permissionsAdmin}
 onClose={() => setPermissionsAdmin(null)}
 onSaved={(payload) => {
  if (payload?.user_id != null && String(payload.user_id) === String(user?.id)) {
   refresh?.();
  }
 }}
 />
 </div>
 );
}
