import { useCallback, useMemo, useState } from "react";
import { cloneFilterSet, countFilterSelections, toggleFilterSelection } from "./adminListFilters.js";

export function useAdminFilterDrawer(sectionIds) {
    const emptyState = useMemo(
        () => Object.fromEntries(sectionIds.map((id) => [id, []])),
        [sectionIds.join("|")],
    );

    const [applied, setApplied] = useState(() => cloneFilterSet(emptyState));
    const [draft, setDraft] = useState(() => cloneFilterSet(emptyState));
    const [open, setOpen] = useState(false);

    const openDrawer = useCallback(() => {
        setDraft(cloneFilterSet(applied));
        setOpen(true);
    }, [applied]);

    const closeDrawer = useCallback(() => setOpen(false), []);

    const toggleDraft = useCallback((sectionId, value) => {
        setDraft((prev) => toggleFilterSelection(prev, sectionId, value));
    }, []);

    const apply = useCallback(() => {
        setApplied(cloneFilterSet(draft));
        setOpen(false);
    }, [draft]);

    const clearAll = useCallback(() => {
        const cleared = cloneFilterSet(emptyState);
        setDraft(cleared);
        setApplied(cleared);
    }, [emptyState]);

    const activeCount = countFilterSelections(applied);

    return {
        applied,
        draft,
        open,
        openDrawer,
        closeDrawer,
        toggleDraft,
        apply,
        clearAll,
        activeCount,
    };
}
