/** Shared helpers for admin list filter drawers (multi-select per section). */

export function cloneFilterSet(obj) {
    return Object.fromEntries(
        Object.entries(obj || {}).map(([key, values]) => [key, [...(values || [])]]),
    );
}

export function countFilterSelections(selected) {
    return Object.values(selected || {}).reduce(
        (total, values) => total + (Array.isArray(values) ? values.length : 0),
        0,
    );
}

export function toggleFilterSelection(selected, sectionId, value) {
    const current = selected[sectionId] || [];
    const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
    return { ...selected, [sectionId]: next };
}

/** Empty selection for a section = no filter (show all). */
export function matchesSection(selected, sectionId, predicate) {
    const values = selected?.[sectionId];
    if (!values?.length) return true;
    return values.some(predicate);
}
