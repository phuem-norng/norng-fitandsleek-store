import React, { useEffect, useMemo, useState } from "react";
import { Columns2Icon, LayoutGridIcon, ListIcon } from "lucide-react";
import { resolveImageUrl } from "../../lib/images";
import { matchesSection } from "../../lib/adminListFilters.js";
import { recordMatchesYearMonth } from "../../lib/adminYearMonthFilter.js";
import { useAdminFilterDrawer } from "../../lib/useAdminFilterDrawer.js";
import { useAdminYearMonthFilter } from "../../lib/useAdminYearMonthFilter.js";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import AdminFilterDrawer, { AdminFilterToolbarButton } from "./AdminFilterDrawer.jsx";
import AdminSortMenu from "./AdminSortMenu.jsx";
import {
  buildAllColumnsVisibility,
  loadTableColumnVisibility,
  TableColumnVisibilityMenu,
} from "./TableColumnVisibilityMenu.jsx";
import { AdminDashboardLoader, AdminSectionLoader } from "@/components/admin/AdminLoading";
import {
  formatStockBarcodePickerLabel,
} from "../../lib/stockLabelReceipts";
import {
  barcodeEntriesForProduct,
  formatProductBarcodeCell,
  productMatchesVariantBarcodeSearch,
} from "../../lib/productBarcodeHelpers.js";
import VariantBarcodePreview from "./VariantBarcodePreview.jsx";
import {
  buildProductGroups,
  loadProductSortPrefs,
  saveProductSortPrefs,
  sortProducts,
} from "../../lib/productSort.js";
import {
  buildCatalogCategories,
  deleteIconButtonStyle,
  EMPTY_TABLE_CELL,
  FILTER_NONE,
  formatSupplierOptionLabel,
  GENDER_OPTIONS,
  gridMetaTextClass,
  matchesGender,
  PRODUCT_CATALOG_COLUMNS,
  productMatchesSectionTab,
  stockLabelKeyForProduct,
  stockNameForProduct,
  supplierIdForProduct,
  supplierKeyForProduct,
  tableCellTextClass,
} from "../../lib/productCatalogHelpers.js";

const DEFAULT_COLUMNS_KEY = "fitandsleek-product-catalog-columns";
const DEFAULT_SORT_KEY = "fitandsleek-product-catalog-sort";

export default function ProductCatalogPanel({
  products = [],
  categories = [],
  suppliers = [],
  accentColor = "#2563eb",
  accentIsWhite = false,
  isDark = false,
  onEdit,
  onProductClick,
  onDelete,
  onRefresh,
  loading = false,
  title = "All Products",
  storageKey = DEFAULT_COLUMNS_KEY,
  sortStorageKey = DEFAULT_SORT_KEY,
  hideStockNameColumn = false,
  hideBarcodeColumn = false,
  includeUnitsInSummary = false,
  variantBarcodesOnly = false,
  emptyState = null,
}) {
  const { settings: homepageSettings } = useHomepageSettings();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [selectedIds, setSelectedIds] = useState([]);
  const [productSort, setProductSort] = useState(() => loadProductSortPrefs(sortStorageKey));

  const tableColumns = useMemo(() => {
    let cols = PRODUCT_CATALOG_COLUMNS;
    if (hideStockNameColumn) cols = cols.filter((c) => c.id !== "stockName");
    if (hideBarcodeColumn) cols = cols.filter((c) => c.id !== "barcode");
    return cols;
  }, [hideStockNameColumn, hideBarcodeColumn]);

  const [columnVisibility, setColumnVisibility] = useState(() =>
    loadTableColumnVisibility(storageKey, tableColumns),
  );

  const listFilters = useAdminFilterDrawer(["stock", "gender", "section", "category", "stockName", "supplier"]);
  const yearMonthFilter = useAdminYearMonthFilter(2020);

  useEffect(() => {
    saveProductSortPrefs(sortStorageKey, productSort);
  }, [productSort, sortStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch {
      /* ignore quota */
    }
  }, [columnVisibility, storageKey]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products]);

  const catalogCategories = useMemo(() => buildCatalogCategories(categories), [categories]);

  const sectionTabs = useMemo(() => {
    const raw = homepageSettings?.sections;
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .filter(([key]) => key !== "discounts")
      .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99))
      .map(([key, val]) => ({ key, title: val.title || key }));
  }, [homepageSettings]);

  const isColVisible = (columnId) =>
    tableColumns.some((col) => col.id === columnId) && columnVisibility[columnId] !== false;

  const barcodeForProduct = (product) => {
    if (variantBarcodesOnly) {
      const text = formatProductBarcodeCell(product);
      return text || EMPTY_TABLE_CELL;
    }
    return product.barcode_code || EMPTY_TABLE_CELL;
  };

  const renderVariantBarcodeCell = (product) => {
    const entries = barcodeEntriesForProduct(product);
    if (entries.length === 0) {
      return <span className="text-xs text-slate-400 dark:text-slate-500">{EMPTY_TABLE_CELL}</span>;
    }
    return (
      <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        {entries.map((entry, idx) => (
          <VariantBarcodePreview
            key={`${entry.barcode}-${entry.color}-${entry.size}-${idx}`}
            value={entry.barcode}
            format={entry.barcodeFormat}
            isDark={isDark}
            compact
          />
        ))}
      </div>
    );
  };

  const toggleTableColumn = (columnId) => {
    setColumnVisibility((prev) => ({ ...prev, [columnId]: !isColVisible(columnId) }));
  };

  const setAllTableColumnsVisible = (visible) => {
    setColumnVisibility(buildAllColumnsVisibility(tableColumns, visible, "productName"));
  };

  const filteredRows = useMemo(() => products.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q
      || String(p.name || "").toLowerCase().includes(q)
      || String(p.sku || "").toLowerCase().includes(q)
      || String(p.barcode_code || "").toLowerCase().includes(q)
      || (variantBarcodesOnly && productMatchesVariantBarcodeSearch(p, q))
      || String(p.category?.name || "").toLowerCase().includes(q)
      || String(p.brand?.name || "").toLowerCase().includes(q);

    const catSlug = String(p.category?.slug || "").toLowerCase();
    const catName = String(p.category?.name || "").toLowerCase();

    const matchesGenderFilter = matchesSection(listFilters.applied, "gender", (key) => matchesGender(catSlug, key));
    const matchesSectionFilter = matchesSection(listFilters.applied, "section", (key) =>
      catName.includes(key.toLowerCase()) || catSlug.includes(key.toLowerCase()));
    const matchesStockFilter = matchesSection(listFilters.applied, "stock", (key) => {
      if (key === "out") return Number(p.stock) === 0;
      if (key === "in_stock") return Number(p.stock) > 0;
      if (key === "active") return !!p.is_active;
      if (key === "inactive") return !p.is_active;
      return false;
    });
    const matchesCategoryFilter = matchesSection(
      listFilters.applied,
      "category",
      (id) => String(p.category_id || "") === String(id),
    );
    const matchesStockNameFilter = matchesSection(listFilters.applied, "stockName", (value) => {
      const key = stockLabelKeyForProduct(p, categories);
      if (value === FILTER_NONE) return !key;
      return key === String(value);
    });
    const matchesSupplierFilter = matchesSection(listFilters.applied, "supplier", (value) => {
      const key = supplierKeyForProduct(p);
      if (value === FILTER_NONE) return !key;
      return key === String(value);
    });
    const matchesYearMonth = recordMatchesYearMonth(
      p.created_at,
      yearMonthFilter.applied.year,
      yearMonthFilter.applied.month,
    );

    return (
      matchesSearch
      && matchesGenderFilter
      && matchesSectionFilter
      && matchesStockFilter
      && matchesCategoryFilter
      && matchesStockNameFilter
      && matchesSupplierFilter
      && matchesYearMonth
    );
  }), [
    products,
    search,
    listFilters.applied,
    yearMonthFilter.applied,
    categories,
  ]);

  const sortContext = useMemo(
    () => ({
      catalogCategories,
      supplierLabelFor: (p) => supplierIdForProduct(p, suppliers),
    }),
    [catalogCategories, suppliers],
  );

  const sortedRows = useMemo(
    () => sortProducts(filteredRows, productSort.sortBy, productSort.sortDir, sortContext),
    [filteredRows, productSort.sortBy, productSort.sortDir, sortContext],
  );

  const productGroups = useMemo(
    () => buildProductGroups(sortedRows, productSort.groupBy, sortContext),
    [sortedRows, productSort.groupBy, sortContext],
  );

  const visibleTableColumnCount = tableColumns.filter((col) => isColVisible(col.id)).length;
  const filteredStockTotal = useMemo(
    () => filteredRows.reduce((sum, p) => {
      const stock = Number(p?.stock);
      return sum + (Number.isFinite(stock) ? Math.max(0, stock) : 0);
    }, 0),
    [filteredRows],
  );
  const splitColumns = [
    sortedRows.filter((_, index) => index % 2 === 0),
    sortedRows.filter((_, index) => index % 2 === 1),
  ];

  const allSelected = filteredRows.length > 0 && filteredRows.every((p) => selectedIds.includes(p.id));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      const filteredIdSet = new Set(filteredRows.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
      return;
    }
    const next = new Set(selectedIds);
    filteredRows.forEach((p) => next.add(p.id));
    setSelectedIds(Array.from(next));
  };

  const delStyle = deleteIconButtonStyle(isDark);

  const productFilterSections = useMemo(() => {
    const stockOpts = [
      { value: "out", label: "Out of stock" },
      { value: "in_stock", label: "In stock" },
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ].map((opt) => ({
      ...opt,
      count: products.filter((p) => {
        if (opt.value === "out") return Number(p.stock) === 0;
        if (opt.value === "in_stock") return Number(p.stock) > 0;
        if (opt.value === "active") return !!p.is_active;
        if (opt.value === "inactive") return !p.is_active;
        return false;
      }).length,
    }));

    const genderOpts = GENDER_OPTIONS.map((opt) => ({
      value: opt.key,
      label: opt.label,
      count: products.filter((p) => matchesGender(String(p.category?.slug || "").toLowerCase(), opt.key)).length,
    }));

    const sectionOpts = sectionTabs.map((tab) => ({
      value: tab.key,
      label: tab.title,
      count: products.filter((p) => productMatchesSectionTab(p, tab.key)).length,
    }));

    const categoryOpts = catalogCategories
      .map((c) => ({
        value: String(c.id),
        label: c.name || "—",
        count: products.filter((p) => String(p.category_id || "") === String(c.id)).length,
      }))
      .filter((o) => o.count > 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    const stockNameSeen = new Map();
    for (const product of products) {
      const key = stockLabelKeyForProduct(product, categories);
      if (!key || stockNameSeen.has(key)) continue;
      const label = categories.find((c) => String(c.id) === key);
      if (label) stockNameSeen.set(key, formatStockBarcodePickerLabel(label));
    }
    const stockNameOpts = hideStockNameColumn ? [] : [
      {
        value: FILTER_NONE,
        label: "No stock label",
        count: products.filter((p) => !stockLabelKeyForProduct(p, categories)).length,
      },
      ...[...stockNameSeen.entries()]
        .map(([value, label]) => ({
          value,
          label,
          count: products.filter((p) => stockLabelKeyForProduct(p, categories) === value).length,
        }))
        .filter((o) => o.count > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];

    const supplierSeen = new Map();
    for (const product of products) {
      const key = supplierKeyForProduct(product);
      if (!key || supplierSeen.has(key)) continue;
      const supplier = suppliers.find((s) => String(s.id) === key);
      if (supplier) supplierSeen.set(key, formatSupplierOptionLabel(supplier));
    }
    const supplierOpts = [
      {
        value: FILTER_NONE,
        label: "No supplier",
        count: products.filter((p) => !supplierKeyForProduct(p)).length,
      },
      ...[...supplierSeen.entries()]
        .map(([value, label]) => ({
          value,
          label,
          count: products.filter((p) => supplierKeyForProduct(p) === value).length,
        }))
        .filter((o) => o.count > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];

    return [
      { id: "stock", title: "Stock", options: stockOpts },
      { id: "gender", title: "Gender", options: genderOpts },
      ...(sectionOpts.length ? [{ id: "section", title: "Section / type", options: sectionOpts }] : []),
      { id: "category", title: "Categories", options: categoryOpts },
      ...(stockNameOpts.length ? [{ id: "stockName", title: "Stock name", options: stockNameOpts }] : []),
      { id: "supplier", title: "Supplier", options: supplierOpts },
    ];
  }, [products, sectionTabs, catalogCategories, categories, suppliers, hideStockNameColumn]);

  const renderProductListRow = (p) => (
    <tr
      key={p.id}
      className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${onProductClick ? "cursor-pointer" : ""}`}
      onClick={onProductClick ? () => onProductClick(p) : undefined}
      onKeyDown={onProductClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProductClick(p); } } : undefined}
      role={onProductClick ? "button" : undefined}
      tabIndex={onProductClick ? 0 : undefined}
    >
      {isColVisible("select") ? (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedIds.includes(p.id)}
            onChange={() => toggleSelect(p.id)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
          />
        </td>
      ) : null}
      {isColVisible("productName") ? (
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-xs overflow-hidden shrink-0">
              {p.image_url ? (
                <img src={resolveImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                p.name?.charAt(0)?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{p.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{p.brand?.name || ""}</p>
            </div>
          </div>
        </td>
      ) : null}
      {isColVisible("barcode") ? (
        <td className="px-4 py-3">
          {variantBarcodesOnly ? renderVariantBarcodeCell(p) : (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{barcodeForProduct(p)}</span>
          )}
        </td>
      ) : null}
      {isColVisible("category") ? (
        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{p.category?.name}</td>
      ) : null}
      {isColVisible("stockName") ? (
        <td className={`px-4 py-3 ${tableCellTextClass(stockNameForProduct(p, categories))}`}>
          {stockNameForProduct(p, categories)}
        </td>
      ) : null}
      {isColVisible("supplierId") ? (
        <td className={`px-4 py-3 ${tableCellTextClass(supplierIdForProduct(p, suppliers), { mono: true })}`}>
          {supplierIdForProduct(p, suppliers)}
        </td>
      ) : null}
      {isColVisible("price") ? (
        <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">${p.price}</td>
      ) : null}
      {isColVisible("stock") ? (
        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{p.stock}</td>
      ) : null}
      {isColVisible("status") ? (
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${
              p.is_active
                ? "border-[rgba(var(--admin-primary-rgb),0.35)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-[color:var(--admin-primary)]"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-300"
            }`}
          >
            {p.is_active ? "Active" : "Inactive"}
          </span>
        </td>
      ) : null}
      {isColVisible("actions") ? (
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[5px] border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-200 dark:hover:bg-white/10"
                title="Edit"
                aria-label={`Edit ${p.name || "product"}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(p)}
                className="inline-flex transition-colors"
                style={delStyle}
                aria-label={`Delete ${p.name || "product"}`}
                title="Delete"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative z-10 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
            <div className="shrink-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {listFilters.activeCount === 0 ? title : "Filtered products"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {filteredRows.length} product{filteredRows.length !== 1 ? "s" : ""}
                {includeUnitsInSummary ? (
                  <>
                    {" · "}
                    {filteredStockTotal} unit{filteredStockTotal === 1 ? "" : "s"}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={variantBarcodesOnly ? "Search products, variant barcode, SKU…" : "Search products, barcode, SKU…"}
              className="h-8 min-w-[10rem] flex-1 rounded-[5px] border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-600 sm:max-w-[14rem] sm:flex-initial sm:min-w-0 sm:w-44"
            />

            <AdminFilterToolbarButton
              activeCount={listFilters.activeCount + yearMonthFilter.activeCount}
              onClick={() => {
                yearMonthFilter.syncDraftFromApplied();
                listFilters.openDrawer();
              }}
              className="h-8 rounded-[5px]"
            />

            <AdminSortMenu
              sortBy={productSort.sortBy}
              sortDir={productSort.sortDir}
              groupBy={productSort.groupBy}
              onSortByChange={(sortBy) => setProductSort((s) => ({ ...s, sortBy }))}
              onSortDirChange={(sortDir) => setProductSort((s) => ({ ...s, sortDir }))}
              onGroupByChange={(groupBy) => setProductSort((s) => ({ ...s, groupBy }))}
            />

            <AdminFilterDrawer
              open={listFilters.open}
              onClose={listFilters.closeDrawer}
              sections={productFilterSections}
              selected={listFilters.draft}
              onToggle={listFilters.toggleDraft}
              onApply={() => {
                yearMonthFilter.apply();
                listFilters.apply();
              }}
              onClearAll={() => {
                yearMonthFilter.clear();
                listFilters.clearAll();
              }}
              yearMonth={{
                value: yearMonthFilter.draft,
                onChange: yearMonthFilter.setDraft,
                startYear: 2020,
                title: "Added date",
                hint: "Filter by when the product was added to the catalog.",
              }}
            />

            <div
              role="group"
              aria-label="View mode"
              className="inline-flex items-center rounded-[5px] border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
            >
              {[
                { mode: "list", icon: <ListIcon className="w-3.5 h-3.5" />, label: "List" },
                { mode: "grid", icon: <LayoutGridIcon className="w-3.5 h-3.5" />, label: "Grid" },
                { mode: "split", icon: <Columns2Icon className="w-3.5 h-3.5" />, label: "Split" },
              ].map((v) => (
                <button
                  key={v.mode}
                  type="button"
                  onClick={() => setViewMode(v.mode)}
                  aria-label={`${v.label} view`}
                  className={`flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-xs font-medium transition-colors ${
                    viewMode === v.mode ? "" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  style={viewMode === v.mode ? { backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#fff" } : undefined}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
              />
              Select all
            </label>

            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                title="Refresh"
              >
                {loading ? (
                  <AdminDashboardLoader size={18} />
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
            ) : null}

            <TableColumnVisibilityMenu
              columns={tableColumns}
              visibility={columnVisibility}
              onToggle={toggleTableColumn}
              onShowAll={() => setAllTableColumnsVisible(true)}
              onHideAll={() => setAllTableColumnsVisible(false)}
            />
          </div>
        </div>

        {loading ? (
          <AdminSectionLoader rows={6} />
        ) : filteredRows.length === 0 ? (
          emptyState || (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <svg className="h-10 w-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-lg text-slate-500 dark:text-slate-200">No products found</p>
              <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">Adjust search or filters to find products.</p>
            </div>
          )
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto rounded-b-xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {isColVisible("select") ? (
                    <th className="w-8 px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400" />
                  ) : null}
                  {isColVisible("productName") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Product Name</th>
                  ) : null}
                  {isColVisible("barcode") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                      {variantBarcodesOnly ? "Variant barcode" : "Barcode"}
                    </th>
                  ) : null}
                  {isColVisible("category") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Category</th>
                  ) : null}
                  {isColVisible("stockName") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Stock name</th>
                  ) : null}
                  {isColVisible("supplierId") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Supplier ID</th>
                  ) : null}
                  {isColVisible("price") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Price</th>
                  ) : null}
                  {isColVisible("stock") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Stock</th>
                  ) : null}
                  {isColVisible("status") ? (
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
                  ) : null}
                  {isColVisible("actions") ? (
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400" />
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {productGroups
                  ? productGroups.flatMap((group) => [
                    <tr key={`group-${group.key}`} className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/40">
                      <td colSpan={visibleTableColumnCount} className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span className="uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Group · </span>
                        {group.label}
                        <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">({group.items.length})</span>
                      </td>
                    </tr>,
                    ...group.items.map((p) => renderProductListRow(p)),
                  ])
                  : sortedRows.map((p) => renderProductListRow(p))}
              </tbody>
            </table>
          </div>
        ) : viewMode === "split" ? (
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            {splitColumns.map((columnRows, columnIndex) => (
              <div key={columnIndex} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Column {columnIndex + 1}
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {columnRows.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No products</div>
                  ) : (
                    columnRows.map((p) => {
                      const splitMeta = [
                        isColVisible("barcode") ? barcodeForProduct(p) : null,
                        isColVisible("category") ? (p.category?.name || p.brand?.name || "") : null,
                        isColVisible("stockName") ? stockNameForProduct(p, categories) : null,
                        isColVisible("supplierId") ? supplierIdForProduct(p, suppliers) : null,
                        isColVisible("price") ? `$${p.price}` : null,
                        isColVisible("stock") ? `${p.stock} in stock` : null,
                      ].filter(Boolean);
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-4 py-3 ${onProductClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" : ""}`}
                          onClick={onProductClick ? () => onProductClick(p) : undefined}
                          onKeyDown={onProductClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProductClick(p); } } : undefined}
                          role={onProductClick ? "button" : undefined}
                          tabIndex={onProductClick ? 0 : undefined}
                        >
                          {isColVisible("select") ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(p.id)}
                              onChange={() => toggleSelect(p.id)}
                              className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-0"
                            />
                          ) : null}
                          {isColVisible("productName") ? (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {p.image_url ? (
                                <img src={resolveImageUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                p.name?.charAt(0)?.toUpperCase()
                              )}
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            {isColVisible("productName") ? (
                              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                            ) : null}
                            {splitMeta.length > 0 ? (
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{splitMeta.join(" • ")}</p>
                            ) : null}
                          </div>
                          {isColVisible("status") ? (
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                p.is_active
                                  ? "border-[rgba(var(--admin-primary-rgb),0.35)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.45)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-[color:var(--admin-primary)]"
                                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-300"
                              }`}
                            >
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          ) : null}
                          {isColVisible("actions") ? (
                            <div className="flex items-center gap-1">
                              {onEdit ? (
                                <button
                                  type="button"
                                  onClick={() => onEdit(p)}
                                  className="rounded-[5px] p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                  title="Edit"
                                  aria-label="Edit product"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              ) : null}
                              {onDelete ? (
                                <button
                                  type="button"
                                  onClick={() => onDelete(p)}
                                  className="transition-colors"
                                  style={delStyle}
                                  aria-label="Delete product"
                                  title="Delete"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-4">
            {sortedRows.map((p) => (
              <div
                key={p.id}
                className={`group overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 ${onProductClick ? "cursor-pointer" : ""}`}
                onClick={onProductClick ? () => onProductClick(p) : undefined}
                onKeyDown={onProductClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onProductClick(p); } } : undefined}
                role={onProductClick ? "button" : undefined}
                tabIndex={onProductClick ? 0 : undefined}
              >
                {(isColVisible("select") || isColVisible("status") || isColVisible("productName")) ? (
                  <div className="relative aspect-square bg-slate-50 dark:bg-slate-800">
                    {isColVisible("productName") ? (
                      p.image_url ? (
                        <img src={resolveImageUrl(p.image_url)} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-300 dark:text-slate-600">
                          {p.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )
                    ) : null}
                    {(isColVisible("select") || isColVisible("status")) ? (
                      <div className="absolute right-2 top-2 flex items-center gap-1.5">
                        {isColVisible("select") ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="h-4 w-4 rounded border-slate-300 bg-white/90 dark:border-slate-600"
                          />
                        ) : null}
                        {isColVisible("status") ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            p.is_active
                              ? "border border-[rgba(var(--admin-primary-rgb),0.45)] bg-[var(--admin-primary)] text-white"
                              : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-[color:var(--admin-elevated)] dark:text-slate-200"
                          }`}
                          >
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="p-3">
                  {isColVisible("productName") ? (
                    <p className="truncate text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">{p.name}</p>
                  ) : null}
                  {isColVisible("category") ? (
                    <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{p.brand?.name || p.category?.name}</p>
                  ) : null}
                  {isColVisible("barcode") ? (
                    variantBarcodesOnly ? (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        {renderVariantBarcodeCell(p)}
                      </div>
                    ) : (
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-slate-500">{barcodeForProduct(p)}</p>
                    )
                  ) : null}
                  {isColVisible("stockName") ? (
                    <p className={`mt-0.5 truncate ${gridMetaTextClass(stockNameForProduct(p, categories))}`}>
                      Stock: {stockNameForProduct(p, categories)}
                    </p>
                  ) : null}
                  {isColVisible("supplierId") ? (
                    <p className={`mt-0.5 ${gridMetaTextClass(supplierIdForProduct(p, suppliers), { mono: true })}`}>
                      Supplier: {supplierIdForProduct(p, suppliers)}
                    </p>
                  ) : null}
                  {(isColVisible("price") || isColVisible("stock") || isColVisible("actions")) ? (
                    <div className="mt-2 flex items-center justify-between">
                      {(isColVisible("price") || isColVisible("stock")) ? (
                        <div>
                          {isColVisible("price") ? (
                            <p className="text-base font-bold text-slate-900 dark:text-slate-100">${p.price}</p>
                          ) : null}
                          {isColVisible("stock") ? (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{p.stock} in stock</p>
                          ) : null}
                        </div>
                      ) : <div />}
                      {isColVisible("actions") ? (
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {onEdit ? (
                            <button
                              type="button"
                              onClick={() => onEdit(p)}
                              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              title="Edit"
                              aria-label="Edit product"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          ) : null}
                          {onDelete ? (
                            <button
                              type="button"
                              onClick={() => onDelete(p)}
                              className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-transparent text-[#dc2626] transition-colors hover:border-[#fecaca] hover:bg-[#fef2f2] dark:text-[#f87171] dark:hover:border-[#7f1d1d]/50 dark:hover:bg-[#450a0a]/35"
                              title="Delete"
                              aria-label="Delete product"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
