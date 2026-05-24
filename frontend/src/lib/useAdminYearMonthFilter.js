import { useCallback, useMemo, useState } from "react";
import {
  countYearMonthFilters,
  EMPTY_YEAR_MONTH,
  yearMonthToDateRange,
} from "./adminYearMonthFilter.js";

export function useAdminYearMonthFilter(startYear = 2020) {
  const [draft, setDraft] = useState(EMPTY_YEAR_MONTH);
  const [applied, setApplied] = useState(EMPTY_YEAR_MONTH);

  const syncDraftFromApplied = useCallback(() => {
    setDraft({ ...applied });
  }, [applied]);

  const apply = useCallback(() => {
    setApplied({ ...draft });
  }, [draft]);

  const clear = useCallback(() => {
    setDraft({ ...EMPTY_YEAR_MONTH });
    setApplied({ ...EMPTY_YEAR_MONTH });
  }, []);

  const activeCount = countYearMonthFilters(applied);
  const dateRange = useMemo(
    () => yearMonthToDateRange(applied.year, applied.month),
    [applied.year, applied.month],
  );

  return {
    draft,
    setDraft,
    applied,
    apply,
    clear,
    syncDraftFromApplied,
    activeCount,
    dateRange,
    startYear,
  };
}
