/** Shared year / month filter helpers for admin list pages. */

export const YEAR_ALL = "all";
export const MONTH_ALL = "all";

export const MONTH_OPTIONS = [
  { value: MONTH_ALL, label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function buildYearOptions(startYear = 2020) {
  const current = new Date().getFullYear();
  const years = [{ value: YEAR_ALL, label: "All years" }];
  for (let y = current; y >= startYear; y -= 1) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}

export const EMPTY_YEAR_MONTH = { year: YEAR_ALL, month: MONTH_ALL };

/**
 * @param {string} year
 * @param {string} month
 * @returns {{ from: string, to: string }}
 */
export function yearMonthToDateRange(year, month) {
  if (!year || year === YEAR_ALL) {
    return { from: "", to: "" };
  }

  const y = parseInt(year, 10);
  if (Number.isNaN(y)) {
    return { from: "", to: "" };
  }

  if (month && month !== MONTH_ALL) {
    const m = parseInt(month, 10);
    if (Number.isNaN(m) || m < 1 || m > 12) {
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }

  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function countYearMonthFilters({ year, month }) {
  let n = 0;
  if (year && year !== YEAR_ALL) n += 1;
  if (month && month !== MONTH_ALL && year && year !== YEAR_ALL) n += 1;
  return n;
}

export function formatYearMonthLabel({ year, month }) {
  if (!year || year === YEAR_ALL) return "All time";
  if (!month || month === MONTH_ALL) return String(year);
  const monthLabel = MONTH_OPTIONS.find((m) => m.value === String(month))?.label || month;
  return `${monthLabel} ${year}`;
}

/**
 * @param {string|Date|null|undefined} dateValue
 * @param {string} year
 * @param {string} month
 */
export function recordMatchesYearMonth(dateValue, year, month) {
  const { from, to } = yearMonthToDateRange(year, month);
  if (!from && !to) return true;
  if (!dateValue) return false;

  const t = new Date(dateValue).getTime();
  if (Number.isNaN(t)) return false;

  if (from) {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    if (t < fromMs) return false;
  }
  if (to) {
    const toMs = new Date(`${to}T23:59:59.999`).getTime();
    if (t > toMs) return false;
  }
  return true;
}
