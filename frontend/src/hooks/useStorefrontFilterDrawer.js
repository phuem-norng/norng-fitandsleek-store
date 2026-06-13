import { useCallback, useMemo, useState } from "react";
import {
  STOREFRONT_FILTER_SECTION_IDS,
  cloneFilterSet,
  countFilterSelections,
  toggleFilterSelection,
} from "../lib/storefrontProductFilters.js";

function emptyFilterState() {
  return Object.fromEntries(STOREFRONT_FILTER_SECTION_IDS.map((id) => [id, []]));
}

export function useStorefrontFilterDrawer(initialApplied = emptyFilterState()) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(() => cloneFilterSet(initialApplied));
  const [draft, setDraft] = useState(() => cloneFilterSet(initialApplied));

  const syncFromExternal = useCallback((nextApplied) => {
    const cloned = cloneFilterSet(nextApplied);
    setApplied(cloned);
    setDraft(cloned);
  }, []);

  const openDrawer = useCallback(() => {
    setDraft(cloneFilterSet(applied));
    setOpen(true);
  }, [applied]);

  const closeDrawer = useCallback(() => setOpen(false), []);

  const toggleDraft = useCallback((sectionId, value) => {
    setDraft((prev) => toggleFilterSelection(prev, sectionId, value));
  }, []);

  const apply = useCallback(() => {
    const next = cloneFilterSet(draft);
    setApplied(next);
    setOpen(false);
    return next;
  }, [draft]);

  const clearAll = useCallback(() => {
    const cleared = emptyFilterState();
    setDraft(cleared);
    setApplied(cleared);
    return cleared;
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(emptyFilterState());
  }, []);

  const activeCount = useMemo(() => countFilterSelections(applied), [applied]);

  return {
    open,
    applied,
    draft,
    activeCount,
    openDrawer,
    closeDrawer,
    toggleDraft,
    apply,
    clearAll,
    clearDraft,
    syncFromExternal,
  };
}
