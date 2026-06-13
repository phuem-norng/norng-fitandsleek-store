/** Admin permission helpers — mirrors backend config/admin_permissions.php */

export const ADMIN_PERMISSION_ACTIONS = ["view", "create", "edit", "delete"];

/** Default operational permissions — backend source of truth; used for docs/tests only. */
export const ADMIN_DEFAULT_PERMISSIONS = {
  "orders.view": true,
  "orders.edit": true,
  "orders.delete": true,
  "checkout.view": true,
  "checkout.create": true,
  "checkout.edit": true,
  "discounts.view": true,
  "discounts.create": true,
  "discounts.edit": true,
  "discounts.delete": true,
  "products.view": true,
  "products.create": true,
  "products.edit": true,
  "products.delete": true,
  "categories.view": true,
  "categories.create": true,
  "categories.edit": true,
  "categories.delete": true,
  "brands.view": true,
  "brands.create": true,
  "brands.edit": true,
  "brands.delete": true,
  "stock.view": true,
  "stock.create": true,
  "stock.edit": true,
  "stock.delete": true,
  "stock_received.view": true,
  "stock_received.create": true,
  "stock_received.edit": true,
  "purchase_orders.view": true,
  "purchase_orders.create": true,
  "purchase_orders.edit": true,
  "suppliers.view": true,
  "payments.view": true,
  "payments.edit": true,
  "sale_history.view": true,
  "reports.view": true,
  "contacts.view": true,
  "contacts.create": true,
  "contacts.edit": true,
  "contacts.delete": true,
  "messages.view": true,
  "messages.create": true,
  "messages.edit": true,
  "messages.delete": true,
  "notifications.view": true,
  "notifications.edit": true,
  "notifications.delete": true,
  "shipments.view": true,
  "shipments.create": true,
  "shipments.edit": true,
  "replacements.view": true,
  "replacements.create": true,
  "replacements.edit": true,
  "customers.view": true,
  "customers.create": true,
  "customers.edit": true,
  "customers.delete": true,
  "profile.view": true,
  "profile.edit": true,
  "chatbot.view": true,
  "chatbot.edit": true,
  "general_settings.view": false,
  "general_settings.edit": false,
  "homepage.view": false,
  "homepage.create": false,
  "homepage.edit": false,
  "homepage.delete": false,
  "homepage_complete.view": false,
  "homepage_complete.edit": false,
};

export const SUPERADMIN_ONLY_PATHS = [
  "/admin/administrators",
  "/admin/loyalty-top-fans",
  "/admin/payment-settings",
  "/admin/user-management",
  "/admin/admin-management",
];

/** Preferred landing paths when redirecting away from a denied route (first match wins). */
export const ADMIN_LANDING_CANDIDATES = [
  "/admin",
  "/admin/orders",
  "/admin/checkout",
  "/admin/products",
  "/admin/payments",
  "/admin/stock-inventory",
  "/admin/reports",
  "/admin/profile",
];

/** Minimum view permission required to show a nav item */
export const ADMIN_PATH_PERMISSIONS = {
  "/admin": { resource: "reports", action: "view" },
  "/admin/orders": { resource: "orders", action: "view" },
  "/admin/checkout": { resource: "checkout", action: "view" },
  "/admin/pos": { resource: "checkout", action: "view" },
  "/admin/discounts": { resource: "discounts", action: "view" },
  "/admin/sales": { resource: "discounts", action: "view" },
  "/admin/products": { resource: "products", action: "view" },
  "/admin/inventory": { resource: "products", action: "view" },
  "/admin/categories": { resource: "categories", action: "view" },
  "/admin/brands": { resource: "brands", action: "view" },
  "/admin/stock-inventory": { resource: "stock", action: "view" },
  "/admin/inventory-lots": { resource: "stock", action: "view" },
  "/admin/barcode-qr": { resource: "stock", action: "view" },
  "/admin/stock-received": { resource: "stock_received", action: "view" },
  "/admin/purchase-orders": { resource: "purchase_orders", action: "view" },
  "/admin/suppliers": { resource: "suppliers", action: "view" },
  "/admin/payments": { resource: "payments", action: "view" },
  "/admin/payments/sale-history": { resource: "sale_history", action: "view" },
  "/admin/reports": { resource: "reports", action: "view" },
  "/admin/contacts": { resource: "contacts", action: "view" },
  "/admin/messages": { resource: "messages", action: "view" },
  "/admin/notifications": { resource: "notifications", action: "view" },
  "/admin/shipments": { resource: "shipments", action: "view" },
  "/admin/replacement-cases": { resource: "replacements", action: "view" },
  "/admin/customers": { resource: "customers", action: "view" },
  "/admin/users": { resource: "customers", action: "view" },
  "/admin/chatbot": { resource: "chatbot", action: "view" },
  "/admin/profile": { resource: "profile", action: "view" },
  "/admin/settings": { resource: "general_settings", action: "view" },
  "/admin/homepage": { resource: "homepage", action: "view" },
  "/admin/homepage-complete": { resource: "homepage_complete", action: "view" },
};

const ACTION_LABELS = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

export function permissionActionLabel(action) {
  return ACTION_LABELS[action] || action;
}

export function permissionKey(resource, action) {
  return `${resource}.${action}`;
}

export function isSuperAdminUser(user) {
  const role = user?.role?.toLowerCase?.() || "";
  return role === "superadmin" || role === "super admin" || role === "super-admin";
}

export function isAdminRoleUser(user) {
  const role = user?.role?.toLowerCase?.() || "";
  return role === "admin" || isSuperAdminUser(user);
}

export function adminPermissionsReady(user) {
  if (!user || !isAdminRoleUser(user)) return true;
  if (isSuperAdminUser(user)) return true;
  return Boolean(
    user.effective_admin_permissions && typeof user.effective_admin_permissions === "object",
  );
}

export function getEffectiveAdminPermissions(user) {
  if (!user || !isAdminRoleUser(user)) return null;
  if (isSuperAdminUser(user)) return null;
  if (user.effective_admin_permissions && typeof user.effective_admin_permissions === "object") {
    return user.effective_admin_permissions;
  }
  return null;
}

function permissionGranted(perms, resource, action) {
  return Boolean(perms[permissionKey(resource, action)]);
}

export function hasAdminPermission(user, resource, action = "view") {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;

  const perms = getEffectiveAdminPermissions(user);
  if (!perms) return false;

  if (permissionGranted(perms, resource, action)) return true;

  // POS / checkout only: edit permission covers sale/create actions.
  if (resource === "checkout" && action === "create" && permissionGranted(perms, resource, "edit")) {
    return true;
  }

  return false;
}

/** Mark PO pending/received from Purchase Orders or Stock Received. */
export function canUpdatePurchaseOrderReceiveStatus(user) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  return (
    hasAdminPermission(user, "purchase_orders", "edit") ||
    hasAdminPermission(user, "stock_received", "edit") ||
    hasAdminPermission(user, "stock_received", "create")
  );
}

function findPathPermission(path) {
  if (ADMIN_PATH_PERMISSIONS[path]) return ADMIN_PATH_PERMISSIONS[path];
  const entries = Object.entries(ADMIN_PATH_PERMISSIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, rule] of entries) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return rule;
  }
  return null;
}

export function canAccessAdminPath(user, path) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;

  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/admin";
  if (SUPERADMIN_ONLY_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return false;
  }

  if (!adminPermissionsReady(user)) return false;

  const rule = findPathPermission(normalized);
  if (!rule) return true;
  return hasAdminPermission(user, rule.resource, rule.action);
}

export function getFirstAccessibleAdminPath(user) {
  if (!user) return "/admin/profile";
  for (const path of ADMIN_LANDING_CANDIDATES) {
    if (canAccessAdminPath(user, path)) return path;
  }
  if (canAccessAdminPath(user, "/admin/profile")) return "/admin/profile";
  return "/admin";
}

export function filterNavItemsByPermission(user, items = []) {
  return items.filter((item) => canAccessAdminPath(user, item.path));
}

export function filterNavGroupsByPermission(user, groups = []) {
  return groups
    .map((group) => ({
      ...group,
      children: filterNavItemsByPermission(user, group.children || []),
    }))
    .filter((group) => (group.children || []).length > 0);
}
