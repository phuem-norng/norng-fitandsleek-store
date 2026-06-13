import React from 'react';
import { orderContactInfoCards } from '../../lib/contactPageContent.js';
import AdminLocaleToggle from './AdminLocaleToggle.jsx';

const inputClass =
  'h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60';

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

export default function ContactPageManagerPanel({
  contactLocale,
  onLocaleChange,
  contactPage,
  canEdit,
  loading,
  onPageFieldChange,
  onFormFieldChange,
  onSubjectChange,
  onAddSubject,
  onRemoveSubject,
  onMoveSubject,
  onInfoCardChange,
  onAddInfoCard,
  onRemoveInfoCard,
  onMoveInfoCard,
  onSave,
}) {
  const orderedSubjects = (contactPage.form?.subject_order || [])
    .map((key) => [key, contactPage.form?.subjects?.[key]])
    .filter(([, subject]) => subject);
  const orderedInfoCards = orderContactInfoCards(contactPage);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Contact Page</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Manage the public Contact Us page: headings, form labels, subject options, and contact info cards. Subject and card order is shared; text is edited per language.
      </p>

      <AdminLocaleToggle locale={contactLocale} onLocaleChange={onLocaleChange} />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Page title</label>
          <input type="text" value={contactPage.title} onChange={(e) => onPageFieldChange('title', e.target.value)} disabled={!canEdit} className={inputClass} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Page subtitle</label>
          <input type="text" value={contactPage.subtitle} onChange={(e) => onPageFieldChange('subtitle', e.target.value)} disabled={!canEdit} className={inputClass} />
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Form Labels &amp; Placeholders</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['name_label', 'Name label'],
            ['email_label', 'Email label'],
            ['phone_label', 'Phone label'],
            ['subject_label', 'Subject label'],
            ['message_label', 'Message label'],
            ['select_subject_label', 'Subject dropdown placeholder'],
            ['submit_label', 'Submit button label'],
            ['name_placeholder', 'Name placeholder'],
            ['email_placeholder', 'Email placeholder'],
            ['phone_placeholder', 'Phone placeholder'],
            ['message_placeholder', 'Message placeholder'],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
              <input
                type="text"
                value={contactPage.form?.[field] || ''}
                onChange={(e) => onFormFieldChange(field, e.target.value)}
                disabled={!canEdit}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Subject Options</h3>
          {canEdit ? (
            <button type="button" onClick={onAddSubject} className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
              + New Subject
            </button>
          ) : null}
        </div>
        <div className="space-y-3">
          {orderedSubjects.map(([subjectKey, subject], index) => (
            <div key={subjectKey} className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/60">
              <MoveButtons canEdit={canEdit} index={index} total={orderedSubjects.length} onMove={(dir) => onMoveSubject(subjectKey, dir)} />
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Value</label>
                  <input type="text" value={subject.value || ''} onChange={(e) => onSubjectChange(subjectKey, 'value', e.target.value)} disabled={!canEdit} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Label</label>
                  <input type="text" value={subject.label || ''} onChange={(e) => onSubjectChange(subjectKey, 'label', e.target.value)} disabled={!canEdit} className={inputClass} />
                </div>
              </div>
              <DeleteButton canEdit={canEdit} onClick={() => onRemoveSubject(subjectKey)} title="Delete subject" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contact Info Cards</h3>
          {canEdit ? (
            <button type="button" onClick={onAddInfoCard} className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
              + New Info Card
            </button>
          ) : null}
        </div>
        <div className="space-y-4">
          {orderedInfoCards.map(([cardKey, card], index) => (
            <div key={cardKey} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="mb-3 flex items-start gap-2">
                <MoveButtons canEdit={canEdit} index={index} total={orderedInfoCards.length} onMove={(dir) => onMoveInfoCard(cardKey, dir)} />
                <input
                  type="text"
                  value={card.title || ''}
                  onChange={(e) => onInfoCardChange(cardKey, 'title', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Card title"
                  className={`${inputClass} font-semibold`}
                />
                <DeleteButton canEdit={canEdit} onClick={() => onRemoveInfoCard(cardKey)} title="Delete info card" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Line 1</label>
                  <input type="text" value={card.line1 || ''} onChange={(e) => onInfoCardChange(cardKey, 'line1', e.target.value)} disabled={!canEdit} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Line 2</label>
                  <input type="text" value={card.line2 || ''} onChange={(e) => onInfoCardChange(cardKey, 'line2', e.target.value)} disabled={!canEdit} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Link (optional)</label>
                  <input type="text" value={card.href || ''} onChange={(e) => onInfoCardChange(cardKey, 'href', e.target.value)} disabled={!canEdit} placeholder="mailto:... or tel:... or https://..." className={inputClass} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {canEdit ? (
        <div className="flex justify-end">
          <button type="button" onClick={onSave} disabled={loading} className="h-11 rounded-lg bg-[color:var(--admin-primary)] px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
            Save Contact Page
          </button>
        </div>
      ) : null}
    </div>
  );
}
