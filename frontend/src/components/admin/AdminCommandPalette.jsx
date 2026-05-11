import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Package,
  ShoppingBag,
  Users,
  LayoutDashboard,
  BarChart3,
  Tag,
  Bookmark,
  Boxes,
  FileText,
  MessageSquare,
  Bell,
  CreditCard,
  Settings,
  UserCircle2,
  ShieldCheck,
  Home,
  PanelsTopLeft,
  Phone,
  Bot,
  RotateCcw,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  X,
  Sparkles,
  Plus,
  ChevronRight,
} from "lucide-react";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";

const RECENTS_STORAGE_KEY = "fitandsleek_admin_command_recents";
const MAX_RECENTS = 6;

const PAGE_ITEMS = [
  { id: "page-dashboard", title: "Dashboard", description: "Overview & key metrics", path: "/admin", icon: LayoutDashboard, keywords: "home overview" },
  { id: "page-products", title: "Products", description: "Manage catalogue", path: "/admin/products", icon: Package, keywords: "catalogue items inventory" },
  { id: "page-orders", title: "Orders", description: "Customer orders & status", path: "/admin/orders", icon: ShoppingBag, keywords: "purchases sales transactions" },
  { id: "page-sales", title: "Sales", description: "Revenue & performance", path: "/admin/sales", icon: BarChart3, keywords: "revenue analytics performance" },
  { id: "page-checkout", title: "Checkout / POS", description: "Point of sale", path: "/admin/checkout", icon: CreditCard, keywords: "point of sale register cashier pos" },
  { id: "page-categories", title: "Categories", description: "Product categories", path: "/admin/categories", icon: Tag, keywords: "taxonomy groups" },
  { id: "page-brands", title: "Brands", description: "Brand directory", path: "/admin/brands", icon: Bookmark, keywords: "manufacturers labels" },
  { id: "page-inventory", title: "Stock & Inventory", description: "Stock levels & barcodes", path: "/admin/barcode-qr", icon: Boxes, keywords: "barcode qr warehouse stock" },
  { id: "page-reports", title: "Reports", description: "Business reports", path: "/admin/reports", icon: FileText, keywords: "export pdf statistics" },
  { id: "page-customers", title: "Customers", description: "Customer accounts", path: "/admin/customers", icon: Users, keywords: "clients shoppers users" },
  { id: "page-admins", title: "Administrators", description: "Admin team & roles", path: "/admin/administrators", icon: ShieldCheck, keywords: "team staff roles permissions" },
  { id: "page-contacts", title: "Contacts", description: "Contact messages", path: "/admin/contacts", icon: Phone, keywords: "leads inquiries" },
  { id: "page-messages", title: "Messages", description: "Live chat & support", path: "/admin/messages", icon: MessageSquare, keywords: "chat support inbox" },
  { id: "page-chatbot", title: "Chatbot", description: "AI assistant settings", path: "/admin/chatbot", icon: Bot, keywords: "ai assistant" },
  { id: "page-notifications", title: "Notifications", description: "System notifications", path: "/admin/notifications", icon: Bell, keywords: "alerts" },
  { id: "page-payments", title: "Payments", description: "Payment transactions", path: "/admin/payments", icon: CreditCard, keywords: "billing khqr transactions" },
  { id: "page-replacements", title: "Replacements", description: "Replacement cases", path: "/admin/replacement-cases", icon: RotateCcw, keywords: "returns refunds exchange" },
  { id: "page-homepage", title: "Home Page", description: "Storefront homepage", path: "/admin/homepage", icon: Home, keywords: "storefront banner hero" },
  { id: "page-homepage-complete", title: "Complete Homepage Manager", description: "Advanced homepage editor", path: "/admin/homepage-complete", icon: PanelsTopLeft, keywords: "homepage builder" },
  { id: "page-settings", title: "Settings", description: "System preferences", path: "/admin/settings", icon: Settings, keywords: "preferences config" },
  { id: "page-profile", title: "My Profile", description: "Your account", path: "/admin/profile", icon: UserCircle2, keywords: "account me" },
];

const QUICK_ACTIONS = [
  { id: "action-new-product", title: "Add new product", description: "Create a product in your catalogue", path: "/admin/products?new=1", icon: Plus, keywords: "create add product new" },
  { id: "action-view-orders", title: "View latest orders", description: "Jump to recent orders", path: "/admin/orders", icon: ShoppingBag, keywords: "recent orders today" },
  { id: "action-reports", title: "Open reports", description: "Generate a business report", path: "/admin/reports", icon: FileText, keywords: "report export" },
  { id: "action-settings", title: "Open settings", description: "Configure system", path: "/admin/settings", icon: Settings, keywords: "settings configure" },
];

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecents(list) {
  try {
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    // ignore
  }
}

function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, query) {
  const value = String(text ?? "");
  const q = String(query || "").trim();
  if (!q) return value;
  try {
    const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
    const parts = value.split(re);
    const needle = q.toLowerCase();
    return parts.map((part, idx) =>
      part && part.toLowerCase() === needle ? (
        <mark
          key={idx}
          className="bg-transparent font-semibold text-[var(--cmd-accent,#6B7E73)] dark:text-[var(--cmd-accent,#6B7E73)]"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  } catch {
    return value;
  }
}

function fuzzyMatch(item, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = `${item.title} ${item.description || ""} ${item.keywords || ""}`.toLowerCase();
  if (hay.includes(needle)) return true;
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return false;
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `$${n.toFixed(2)}`;
}

const statusTone = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  processing: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  shipped: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  refunded: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export default function AdminCommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState({ products: [], orders: [], customers: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState(() => loadRecents());

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setRemote({ products: [], orders: [], customers: [] });
      setActiveIndex(0);
      setRecents(loadRecents());
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const q = debouncedQuery;
    if (!q) {
      setRemote({ products: [], orders: [], customers: [] });
      setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get("/admin/search", {
          params: { q },
          signal: controller.signal,
        });
        setRemote({
          products: Array.isArray(data?.products) ? data.products : [],
          orders: Array.isArray(data?.orders) ? data.orders : [],
          customers: Array.isArray(data?.customers) ? data.customers : [],
        });
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setRemote({ products: [], orders: [], customers: [] });
        }
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedQuery, open]);

  const filteredPages = useMemo(
    () => PAGE_ITEMS.filter((p) => fuzzyMatch(p, debouncedQuery)).slice(0, debouncedQuery ? 6 : 8),
    [debouncedQuery]
  );

  const filteredActions = useMemo(
    () => QUICK_ACTIONS.filter((p) => fuzzyMatch(p, debouncedQuery)).slice(0, 4),
    [debouncedQuery]
  );

  const sections = useMemo(() => {
    const out = [];
    if (!debouncedQuery && recents.length) {
      out.push({
        id: "recents",
        label: "Recent",
        icon: Clock,
        items: recents.map((r) => ({
          id: `recent-${r.id}`,
          kind: "recent",
          title: r.title,
          description: r.description,
          path: r.path,
          icon: Clock,
          meta: r.meta || null,
        })),
      });
    }

    if (filteredPages.length) {
      out.push({
        id: "pages",
        label: "Pages",
        icon: PanelsTopLeft,
        items: filteredPages.map((p) => ({
          id: p.id,
          kind: "page",
          title: p.title,
          description: p.description,
          path: p.path,
          icon: p.icon,
        })),
      });
    }

    if (filteredActions.length && !debouncedQuery) {
      out.push({
        id: "actions",
        label: "Quick actions",
        icon: Sparkles,
        items: filteredActions.map((p) => ({
          id: p.id,
          kind: "action",
          title: p.title,
          description: p.description,
          path: p.path,
          icon: p.icon,
        })),
      });
    }

    if (debouncedQuery) {
      if (remote.products.length) {
        out.push({
          id: "products",
          label: "Products",
          icon: Package,
          items: remote.products.map((p) => ({
            id: `product-${p.id}`,
            kind: "product",
            title: p.name || `Product #${p.id}`,
            description: p.sku ? `SKU: ${p.sku}` : "Product",
            meta: formatPrice(p.price),
            path: "/admin/products",
            icon: Package,
          })),
        });
      }
      if (remote.orders.length) {
        out.push({
          id: "orders",
          label: "Orders",
          icon: ShoppingBag,
          items: remote.orders.map((o) => ({
            id: `order-${o.id}`,
            kind: "order",
            title: `Order #${o.id}`,
            description: o.name || "Guest",
            meta: o.status || null,
            metaTone: statusTone[String(o.status || "").toLowerCase()] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            path: "/admin/orders",
            icon: ShoppingBag,
          })),
        });
      }
      if (remote.customers.length) {
        out.push({
          id: "customers",
          label: "Customers",
          icon: Users,
          items: remote.customers.map((c) => ({
            id: `customer-${c.id}`,
            kind: "customer",
            title: c.name || `Customer #${c.id}`,
            description: c.email || "Customer",
            path: "/admin/customers",
            icon: Users,
          })),
        });
      }
    }
    return out;
  }, [filteredPages, filteredActions, remote, recents, debouncedQuery]);

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (activeIndex >= flatItems.length) setActiveIndex(0);
  }, [flatItems.length, activeIndex]);

  const handleSelect = useCallback(
    (item) => {
      if (!item?.path) return;
      const recent = {
        id: item.id,
        title: item.title,
        description: item.description,
        path: item.path,
        meta: item.meta || null,
      };
      const next = [recent, ...recents.filter((r) => r.id !== item.id)].slice(0, MAX_RECENTS);
      setRecents(next);
      saveRecents(next);
      onClose?.();
      navigate(item.path);
    },
    [recents, navigate, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (flatItems.length ? (i + 1) % flatItems.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (flatItems.length ? (i - 1 + flatItems.length) % flatItems.length : 0));
        return;
      }
      if (e.key === "Enter") {
        const item = flatItems[activeIndex];
        if (item) {
          e.preventDefault();
          handleSelect(item);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flatItems, activeIndex, handleSelect, onClose]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-index="${activeIndex}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!open) return null;

  let runningIndex = -1;

  const palette = (
    <AnimatePresence>
      <motion.div
        key="cmd-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9998] bg-slate-950/60 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />
      <motion.div
        key="cmd-shell"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        style={{ "--cmd-accent": primaryColor }}
      >
        <div className="pointer-events-auto w-[min(640px,100%)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/95 dark:ring-white/5">
          <div className="relative border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-700/70">
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }}
              >
                <Search className="h-4 w-4" />
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search products, orders, customers, pages…"
                className="h-9 w-full min-w-0 border-0 bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-slate-100"
                autoComplete="off"
                spellCheck={false}
                aria-label="Search"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Clear search"
                  title="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden h-6 select-none items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                esc
              </kbd>
            </div>

            <AnimatePresence>
              {loading && (
                <motion.div
                  key="cmd-loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
                >
                  <div
                    className="h-full w-1/3 animate-[cmdLoader_1.1s_ease-in-out_infinite]"
                    style={{ backgroundColor: primaryColor }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            ref={listRef}
            className="max-h-[min(60vh,520px)] overflow-y-auto py-2"
            role="listbox"
            aria-label="Search results"
          >
            {sections.length === 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div
                  className="mb-3 flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
                >
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {debouncedQuery ? `No results for “${debouncedQuery}”` : "Type to start searching"}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {debouncedQuery
                    ? "Try a different keyword, SKU, or order number."
                    : "Find products, orders, customers, and pages."}
                </p>
              </div>
            )}

            {sections.map((section) => {
              const SectionIcon = section.icon;
              return (
                <div key={section.id} className="mt-1 first:mt-0">
                  <div className="flex items-center gap-1.5 px-3.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    {SectionIcon && <SectionIcon className="h-3 w-3 opacity-70" />}
                    <span>{section.label}</span>
                  </div>
                  <ul className="px-1.5">
                    {section.items.map((item) => {
                      runningIndex += 1;
                      const idx = runningIndex;
                      const isActive = idx === activeIndex;
                      const Icon = item.icon || ChevronRight;
                      const metaTone =
                        item.metaTone ||
                        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            data-cmd-index={idx}
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => handleSelect(item)}
                            className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                              isActive
                                ? "bg-slate-100/80 dark:bg-slate-800/80"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                            style={
                              isActive
                                ? { boxShadow: `inset 2px 0 0 ${primaryColor}` }
                                : undefined
                            }
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                                isActive
                                  ? "text-white"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                              style={
                                isActive
                                  ? { backgroundColor: primaryColor }
                                  : undefined
                              }
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                {highlight(item.title, debouncedQuery)}
                              </span>
                              {item.description && (
                                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                  {highlight(item.description, debouncedQuery)}
                                </span>
                              )}
                            </span>
                            {item.meta && (
                              <span
                                className={`hidden shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium capitalize sm:inline-flex ${metaTone}`}
                              >
                                {item.meta}
                              </span>
                            )}
                            <CornerDownLeft
                              className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
                                isActive ? "opacity-90" : "opacity-0 group-hover:opacity-50"
                              }`}
                              style={isActive ? { color: primaryColor } : undefined}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <ArrowUp className="h-2.5 w-2.5" />
                </kbd>
                <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <ArrowDown className="h-2.5 w-2.5" />
                </kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-5 items-center justify-center rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                </kbd>
                <span>Open</span>
              </span>
              <span className="hidden items-center gap-1 sm:flex">
                <kbd className="inline-flex h-5 items-center justify-center rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  esc
                </kbd>
                <span>Close</span>
              </span>
            </div>
            <span className="hidden items-center gap-1 sm:flex">
              <Sparkles className="h-3 w-3" style={{ color: primaryColor }} />
              <span>Smart search</span>
            </span>
          </div>
        </div>
        </div>
      </motion.div>
      <style key="cmd-style">{`
        @keyframes cmdLoader {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return palette;
  return createPortal(palette, document.body);
}
