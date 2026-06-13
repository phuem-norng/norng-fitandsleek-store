import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAdminUiPreference } from "../../lib/adminUiPreferences";
import AdminModal from "../../components/admin/AdminModal.jsx";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";

const DEFAULT_TIER_RULES = {
  bronze: { min_points: 0, discount_percent: 0 },
  silver: { min_points: 200, discount_percent: 5 },
  gold: { min_points: 500, discount_percent: 10 },
  vip: { min_points: 1000, discount_percent: 15 },
};

const TIER_COLORS = {
  bronze: "bg-amber-100 text-amber-700",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-yellow-100 text-yellow-700",
  vip: "bg-purple-100 text-purple-700",
};

function tierBadge(tier) {
  const key = String(tier || "bronze").toLowerCase();
  const cls = TIER_COLORS[key] || TIER_COLORS.bronze;
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ${cls}`}>
      {key}
    </span>
  );
}

export default function LoyaltyTopFans() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState({});
  const [draftRules, setDraftRules] = useState({});
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMeta, setRulesMeta] = useState(null);
  const [showTierRulesForm, setShowTierRulesForm] = useState(false);
  const [search, setSearch] = useAdminUiPreference("loyalty.topFans.search", "");
  const [tierFilter, setTierFilter] = useAdminUiPreference("loyalty.topFans.tierFilter", "all");
  const [sortBy, setSortBy] = useAdminUiPreference("loyalty.topFans.sortBy", "points");
  const [sortDir, setSortDir] = useAdminUiPreference("loyalty.topFans.sortDir", "desc");
  const [viewMode, setViewMode] = useAdminUiPreference("loyalty.topFans.viewMode", "list");
  const [pageSize, setPageSize] = useAdminUiPreference("loyalty.topFans.pageSize", 12);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columns, setColumns] = useAdminUiPreference("loyalty.topFans.columns", {
    user: true,
    tier: true,
    points: true,
    orders: true,
    lifetime_spend: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/admin/loyalty/top-fans", { params: { limit: 50 } });
        if (!mounted) return;
        setRows(Array.isArray(data?.data) ? data.data : []);
        setTiers(data?.tiers || {});
        setDraftRules(data?.tiers || {});
        setRulesMeta(data?.rules_meta || null);
      } catch (error) {
        console.error("Failed to load top fans", error);
        if (!mounted) return;
        setRows([]);
        setTiers({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const out = { bronze: 0, silver: 0, gold: 0, vip: 0 };
    rows.forEach((r) => {
      const key = String(r?.tier || "bronze").toLowerCase();
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }, [rows]);

  const updateRule = (tier, key, value) => {
    const numeric = Math.max(0, Number(value || 0));
    setDraftRules((prev) => ({
      ...prev,
      [tier]: {
        ...(prev?.[tier] || {}),
        [key]: numeric,
      },
    }));
  };

  const saveRules = async () => {
    if (!isRulesValid) return;
    setSavingRules(true);
    try {
      const { data } = await api.put("/admin/loyalty/rules", {
        rules: draftRules,
      });
      setTiers(data?.data || {});
      setDraftRules(data?.data || {});
      setRulesMeta(data?.meta || null);
      setShowTierRulesForm(false);
    } catch (error) {
      console.error("Failed to save loyalty rules", error);
    } finally {
      setSavingRules(false);
    }
  };

  const tierOrder = ["bronze", "silver", "gold", "vip"];
  const validation = useMemo(() => {
    const issues = [];
    let prevMin = -1;
    for (const tier of tierOrder) {
      const minPoints = Number(draftRules?.[tier]?.min_points);
      const discount = Number(draftRules?.[tier]?.discount_percent);
      if (!Number.isFinite(minPoints) || minPoints < 0) {
        issues.push(`${tier}: min points must be 0 or greater.`);
      }
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        issues.push(`${tier}: discount must be between 0 and 100.`);
      }
      if (Number.isFinite(minPoints) && minPoints < prevMin) {
        issues.push(`${tier}: min points cannot be lower than previous tier.`);
      }
      if (Number.isFinite(minPoints)) {
        prevMin = Math.max(prevMin, minPoints);
      }
    }
    return issues;
  }, [draftRules]);

  const isRulesValid = validation.length === 0;
  const applyDefaultRules = () => {
    setDraftRules(DEFAULT_TIER_RULES);
  };
  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return rows.filter((row) => {
      const rowTier = String(row?.tier || "bronze").toLowerCase();
      if (tierFilter !== "all" && rowTier !== tierFilter) return false;
      if (!q) return true;
      const name = String(row?.user?.name || "");
      const email = String(row?.user?.email || "");
      const userId = String(row?.user_id || "");
      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        userId.toLowerCase().includes(q) ||
        rowTier.includes(q)
      );
    });
  }, [rows, search, tierFilter]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      const aUser = `${a?.user?.name || ""} ${a?.user?.email || ""}`.trim().toLowerCase();
      const bUser = `${b?.user?.name || ""} ${b?.user?.email || ""}`.trim().toLowerCase();
      const valA = sortBy === "user"
        ? aUser
        : sortBy === "tier"
          ? String(a?.tier || "bronze").toLowerCase()
          : Number(a?.[sortBy] || 0);
      const valB = sortBy === "user"
        ? bUser
        : sortBy === "tier"
          ? String(b?.tier || "bronze").toLowerCase()
          : Number(b?.[sortBy] || 0);
      if (valA === valB) return 0;
      const base = valA > valB ? 1 : -1;
      return sortDir === "asc" ? base : -base;
    });
    return list;
  }, [filteredRows, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / Math.max(1, Number(pageSize) || 1)));
  const pagedRows = useMemo(() => {
    const safeSize = Math.max(1, Number(pageSize) || 1);
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * safeSize;
    return sortedRows.slice(start, start + safeSize);
  }, [sortedRows, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, tierFilter, sortBy, sortDir, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const allVisibleSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        pagedRows.forEach((r) => next.delete(r.id));
      } else {
        pagedRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (key) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedRows = useMemo(
    () => sortedRows.filter((row) => selectedIds.has(row.id)),
    [sortedRows, selectedIds]
  );

  const toCsvValue = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportRowsToCsv = (dataRows, filename) => {
    if (!Array.isArray(dataRows) || dataRows.length === 0) return;
    const header = ["User", "Email", "Tier", "Points", "Orders", "Lifetime Spend"];
    const lines = [
      header.join(","),
      ...dataRows.map((row) => [
        toCsvValue(row?.user?.name || `User #${row?.user_id || "-"}`),
        toCsvValue(row?.user?.email || "-"),
        toCsvValue(String(row?.tier || "bronze").toUpperCase()),
        toCsvValue(Number(row?.points || 0)),
        toCsvValue(Number(row?.orders_count || 0)),
        toCsvValue(Number(row?.lifetime_spend || 0).toFixed(2)),
      ].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Top Fans & Loyalty</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Loyalty tiers and highest-point customers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTierRulesForm(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Tier Rules
          </button>
        </div>
      </div>

      <AdminModal
        open={showTierRulesForm}
        onClose={() => setShowTierRulesForm(false)}
        title="Tier Rules"
        maxWidthClass="max-w-4xl"
        zIndexClass="z-[120]"
        initialFocusSelector="input[type='number']"
      >
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={applyDefaultRules}
            disabled={savingRules}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Apply Default Tier Rules
          </button>
          <button
            type="button"
            onClick={saveRules}
            disabled={savingRules || !isRulesValid}
            className="rounded-lg bg-[color:var(--admin-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingRules ? "Saving..." : "Save Rules"}
          </button>
        </div>
        {rulesMeta?.updated_by?.name ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Last updated by {rulesMeta.updated_by.name}
            {rulesMeta?.updated_at ? ` on ${new Date(rulesMeta.updated_at).toLocaleString()}` : ""}
          </p>
        ) : null}
        {!isRulesValid ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {validation.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {tierOrder.map((tier) => (
            <div key={tier} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-3">{tierBadge(tier)}</div>
              <label className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Min points
                <input
                  type="number"
                  min={0}
                  value={Number(draftRules?.[tier]?.min_points || 0)}
                  onChange={(e) => updateRule(tier, "min_points", e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Discount %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Number(draftRules?.[tier]?.discount_percent || 0)}
                  onChange={(e) => updateRule(tier, "discount_percent", e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            </div>
          ))}
        </div>
      </AdminModal>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["bronze", "silver", "gold", "vip"].map((tier) => (
          <div key={tier} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div>{tierBadge(tier)}</div>
            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{summary[tier] || 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Discount {tiers?.[tier]?.discount_percent ?? 0}%
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-3 dark:border-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, email, tier..."
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:col-span-4"
            />
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:col-span-2"
            >
              <option value="all">All tiers</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="vip">VIP</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:col-span-2"
            >
              <option value="user">Sort: User</option>
              <option value="tier">Sort: Tier</option>
              <option value="points">Sort: Points</option>
              <option value="orders_count">Sort: Orders</option>
              <option value="lifetime_spend">Sort: Lifetime Spend</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:col-span-1"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <div className="flex items-center gap-2 lg:col-span-3 lg:justify-end">
              {["list", "grid", "split"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`h-10 min-w-[64px] rounded-lg px-3 text-xs font-semibold ${viewMode === mode ? "bg-[color:var(--admin-primary)] text-white" : "border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
              />
              Select all (visible)
            </label>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Selected: {selectedIds.size}
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              Page size
              <select
                value={Number(pageSize) || 12}
                onChange={(e) => setPageSize(Number(e.target.value || 12))}
                className="h-7 rounded-md border border-slate-300 px-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {[6, 12, 24, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => exportRowsToCsv(selectedRows, "loyalty-top-fans-selected.csv")}
              disabled={selectedRows.length === 0}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Export selected CSV
            </button>
            <button
              type="button"
              onClick={() => exportRowsToCsv(pagedRows, "loyalty-top-fans-visible-page.csv")}
              disabled={pagedRows.length === 0}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Export current page CSV
            </button>
            <details className="ml-auto relative">
              <summary className="list-none cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Columns
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {[
                ["user", "User"],
                ["tier", "Tier"],
                ["points", "Points"],
                ["orders", "Orders"],
                ["lifetime_spend", "Lifetime Spend"],
              ].map(([key, label]) => (
                <label key={key} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={!!columns[key]}
                    onChange={() => toggleColumn(key)}
                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
                  />
                  {label}
                </label>
              ))}
              </div>
            </details>
          </div>
          </div>
        </div>
        {viewMode === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Select</th>
                {columns.user ? <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">User</th> : null}
                {columns.tier ? <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tier</th> : null}
                {columns.points ? <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Points</th> : null}
                {columns.orders ? <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Orders</th> : null}
                {columns.lifetime_spend ? <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">Lifetime Spend</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Loading top fans...</td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No loyalty data yet.</td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelectRow(row.id)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                      />
                    </td>
                    {columns.user ? (
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{row.user?.name || `User #${row.user_id}`}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{row.user?.email || "-"}</p>
                      </td>
                    ) : null}
                    {columns.tier ? <td className="px-4 py-3">{tierBadge(row.tier)}</td> : null}
                    {columns.points ? (
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {Number(row.points || 0).toLocaleString()}
                      </td>
                    ) : null}
                    {columns.orders ? (
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {Number(row.orders_count || 0).toLocaleString()}
                      </td>
                    ) : null}
                    {columns.lifetime_spend ? (
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        ${Number(row.lifetime_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : (
          <div className={`p-4 ${viewMode === "grid" ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}`}>
            {loading ? (
              <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">Loading top fans...</div>
            ) : pagedRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">No loyalty data yet.</div>
            ) : (
              pagedRows.map((row) => (
                <div key={row.id} className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${viewMode === "split" ? "flex items-center justify-between gap-4" : "space-y-2"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelectRow(row.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <div>
                      {columns.user ? (
                        <>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{row.user?.name || `User #${row.user_id}`}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{row.user?.email || "-"}</p>
                        </>
                      ) : null}
                      {columns.tier ? <div className="mt-2">{tierBadge(row.tier)}</div> : null}
                    </div>
                  </div>
                  <div className={`grid gap-2 text-sm ${viewMode === "split" ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
                    {columns.points ? <p className="text-slate-700 dark:text-slate-300"><span className="text-xs text-slate-500">Points:</span> {Number(row.points || 0).toLocaleString()}</p> : null}
                    {columns.orders ? <p className="text-slate-700 dark:text-slate-300"><span className="text-xs text-slate-500">Orders:</span> {Number(row.orders_count || 0).toLocaleString()}</p> : null}
                    {columns.lifetime_spend ? (
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="text-xs text-slate-500">Lifetime:</span> ${Number(row.lifetime_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <AdminListPaginationBar
          page={Math.min(page, totalPages)}
          lastPage={totalPages}
          total={sortedRows.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

