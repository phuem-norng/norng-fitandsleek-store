import React from 'react';
import { orderTermsSectionEntries } from '../../lib/termsPageContent.js';
import AdminLocaleToggle from './AdminLocaleToggle.jsx';

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60';

const textareaClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60';

function MoveButtons({ canEdit, index, total, onMove }) {
  if (!canEdit) return null;
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        title="Move up"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === total - 1}
        title="Move down"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
  );
}

function DeleteButton({ canEdit, onClick, title = 'Delete' }) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
  );
}

export default function TermsPageManagerPanel({
  termsLocale,
  onLocaleChange,
  termsPage,
  canEdit,
  loading,
  onPageFieldChange,
  onSectionFieldChange,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onSave,
}) {
  const orderedSections = orderTermsSectionEntries(termsPage.sections, termsPage.section_order);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Terms Page</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Manage the public Terms &amp; Conditions page: headings, section text, and order. Section order is shared; text is edited per language.
      </p>

      <AdminLocaleToggle locale={termsLocale} onLocaleChange={onLocaleChange} />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Page title</label>
          <input type="text" value={termsPage.title} onChange={(e) => onPageFieldChange('title', e.target.value)} disabled={!canEdit} className={inputClass} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Last updated line</label>
          <input type="text" value={termsPage.last_updated} onChange={(e) => onPageFieldChange('last_updated', e.target.value)} disabled={!canEdit} className={inputClass} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Terms Sections</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use arrows to reorder sections on the terms page.</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={onAddSection} className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
            + New Section
          </button>
        ) : null}
      </div>

      <div className="space-y-6">
        {orderedSections.map(([sectionKey, section], sectionIndex) => (
          <div key={sectionKey} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/60">
            <div className="mb-4 flex items-start gap-2">
              <MoveButtons canEdit={canEdit} index={sectionIndex} total={orderedSections.length} onMove={(direction) => onMoveSection(sectionKey, direction)} />
              <input
                type="text"
                value={section?.title || sectionKey}
                onChange={(e) => onSectionFieldChange(sectionKey, 'title', e.target.value)}
                disabled={!canEdit}
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-semibold focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              />
              <DeleteButton canEdit={canEdit} onClick={() => onRemoveSection(sectionKey)} title="Delete section" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Section body</label>
              <textarea
                value={section?.body || ''}
                onChange={(e) => onSectionFieldChange(sectionKey, 'body', e.target.value)}
                disabled={!canEdit}
                rows={4}
                className={textareaClass}
              />
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
            Save Terms Page
          </button>
        </div>
      ) : null}
    </div>
  );
}
