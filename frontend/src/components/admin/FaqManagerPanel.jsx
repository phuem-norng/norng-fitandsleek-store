import React from 'react';
import { orderFaqSectionEntries } from '../../lib/faqContent.js';

export default function FaqManagerPanel({
  faqLocale,
  onLocaleChange,
  faqTitle,
  faqSubtitle,
  faqSections,
  faqSectionOrder,
  canEdit,
  loading,
  onTitleChange,
  onSubtitleChange,
  onSectionTitleChange,
  onItemChange,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onAddItem,
  onRemoveItem,
  onSave,
}) {
  const orderedSections = orderFaqSectionEntries(faqSections, faqSectionOrder);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">FAQ Page</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Create, edit, delete, and reorder FAQ sections and questions. Section order is shared; text is edited per language.
      </p>

      <div className="mb-6 inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => onLocaleChange('en')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${faqLocale === 'en'
            ? 'bg-[color:var(--admin-primary)] text-white'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => onLocaleChange('km')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${faqLocale === 'km'
            ? 'bg-[color:var(--admin-primary)] text-white'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          ខ្មែរ
        </button>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Page title</label>
          <input
            type="text"
            value={faqTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={!canEdit}
            className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Page subtitle</label>
          <input
            type="text"
            value={faqSubtitle}
            onChange={(e) => onSubtitleChange(e.target.value)}
            disabled={!canEdit}
            className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">FAQ Sections</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use arrows to change section order on the FAQ page.</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onAddSection}
            className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            + New FAQ Section
          </button>
        ) : null}
      </div>

      <div className="space-y-6">
        {orderedSections.map(([sectionKey, section], sectionIndex) => (
          <div key={sectionKey} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="mb-4 flex items-start gap-2">
              {canEdit ? (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveSection(sectionKey, -1)}
                    disabled={sectionIndex === 0}
                    title="Move up"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveSection(sectionKey, 1)}
                    disabled={sectionIndex === orderedSections.length - 1}
                    title="Move down"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>
              ) : null}
              <input
                type="text"
                value={section?.title || sectionKey}
                onChange={(e) => onSectionTitleChange(sectionKey, e.target.value)}
                disabled={!canEdit}
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-semibold focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onRemoveSection(sectionKey)}
                  title="Delete section"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              {(section?.items || []).map((item, itemIndex) => (
                <div key={`${sectionKey}-${itemIndex}`} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/60">
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question</label>
                    <input
                      type="text"
                      value={item.question || ''}
                      onChange={(e) => onItemChange(sectionKey, itemIndex, 'question', e.target.value)}
                      disabled={!canEdit}
                      placeholder="Question"
                      className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Answer</label>
                    <textarea
                      value={item.answer || ''}
                      onChange={(e) => onItemChange(sectionKey, itemIndex, 'answer', e.target.value)}
                      disabled={!canEdit}
                      placeholder="Answer"
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    />
                  </div>
                  {canEdit ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(sectionKey, itemIndex)}
                        title="Delete question"
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Delete question
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onAddItem(sectionKey)}
                  className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  + Add Question
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {canEdit ? (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={loading}
            className="h-11 rounded-lg bg-[color:var(--admin-primary)] px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            Save FAQ Settings
          </button>
        </div>
      ) : null}
    </div>
  );
}
