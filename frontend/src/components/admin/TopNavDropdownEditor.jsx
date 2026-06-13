import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { storefrontSearchUrl } from "../../lib/storefrontNavLinks.js";

function categoryMatchesGender(category, gender) {
  if (!gender) return true;
  const g = String(category?.gender || "").toLowerCase();
  const name = String(category?.name || "").toLowerCase();
  const slug = String(category?.slug || "").toLowerCase();
  const token = gender.toLowerCase();
  if (g.includes(token) || g.includes(token.replace(/s$/, ""))) return true;
  if (name.includes(token) || slug.includes(token)) return true;
  return false;
}

export default function TopNavDropdownEditor({
  title,
  sectionsMode = false,
  audienceGender = null,
  items = [],
  onChange,
  deleteButtonStyle,
  onRequestRemove,
}) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/categories");
        const list = Array.isArray(data) ? data : data?.data || [];
        if (mounted) setCategories(Array.isArray(list) ? list : []);
      } catch {
        if (mounted) setCategories([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCategories = useMemo(
    () => categories.filter((c) => categoryMatchesGender(c, audienceGender)),
    [categories, audienceGender]
  );

  const updateFlatItem = (idx, patch) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const updateSection = (sIdx, patch) => {
    const next = [...items];
    next[sIdx] = { ...next[sIdx], type: "section", ...patch };
    onChange(next);
  };

  const updateSectionLink = (sIdx, iIdx, patch) => {
    const next = [...items];
    const section = { ...next[sIdx], items: [...(next[sIdx]?.items || [])] };
    section.items[iIdx] = { ...section.items[iIdx], ...patch };
    next[sIdx] = section;
    onChange(next);
  };

  const addFromCategory = (sIdx, categoryId) => {
    const cat = categories.find((c) => String(c.id) === String(categoryId));
    if (!cat) return;
    const slug = cat.slug || "";
    const to = audienceGender
      ? storefrontSearchUrl({ gender: audienceGender, category: slug })
      : `/search?category=${encodeURIComponent(slug)}`;
    const link = { label: cat.name || slug, to };
    if (sectionsMode && sIdx != null) {
      const next = [...items];
      const section = { ...next[sIdx], type: "section", items: [...(next[sIdx]?.items || []), link] };
      next[sIdx] = section;
      onChange(next);
    } else {
      onChange([...items, link]);
    }
  };

  if (!sectionsMode) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/40">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h4>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_auto] gap-2 items-center">
              <input
                type="text"
                placeholder="Label"
                value={item.label || ""}
                onChange={(e) => updateFlatItem(idx, { label: e.target.value })}
                className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                placeholder="/search?..."
                value={item.to || ""}
                onChange={(e) => updateFlatItem(idx, { to: e.target.value })}
                className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <button type="button" onClick={() => onRequestRemove({ mode: "flat", index: idx })} style={deleteButtonStyle} aria-label="Remove link">
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => onChange([...items, { label: "", to: "" }])}
            className="h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            + Add link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/40">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h4>
      <div className="space-y-4">
        {items.map((section, sIdx) => (
          <div key={sIdx} className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-white dark:bg-slate-900">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Section title (e.g. Clothing)"
                value={section.label || ""}
                onChange={(e) => updateSection(sIdx, { label: e.target.value })}
                className="h-10 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button type="button" onClick={() => onRequestRemove({ mode: "section", index: sIdx })} style={deleteButtonStyle} aria-label="Remove section">
                ×
              </button>
            </div>
            <div className="space-y-2 pl-2 border-l-2 border-slate-200 dark:border-slate-600">
              {(section.items || []).map((item, iIdx) => (
                <div key={iIdx} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={item.label || ""}
                    onChange={(e) => updateSectionLink(sIdx, iIdx, { label: e.target.value })}
                    className="h-9 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={item.to || ""}
                    onChange={(e) => updateSectionLink(sIdx, iIdx, { to: e.target.value })}
                    className="h-9 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => onRequestRemove({ mode: "sectionLink", sectionIndex: sIdx, index: iIdx })}
                    style={deleteButtonStyle}
                    aria-label="Remove link"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => updateSection(sIdx, { items: [...(section.items || []), { label: "", to: "" }] })}
                className="h-8 px-2 text-xs rounded border border-slate-300 dark:border-slate-600"
              >
                + Link
              </button>
              {filteredCategories.length > 0 && (
                <select
                  className="h-8 rounded border border-slate-300 dark:border-slate-600 text-xs px-2 max-w-[200px]"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) addFromCategory(sIdx, e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">+ From category…</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, { type: "section", label: "New section", items: [] }])}
        className="mt-3 h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium"
      >
        + Add section
      </button>
    </div>
  );
}
