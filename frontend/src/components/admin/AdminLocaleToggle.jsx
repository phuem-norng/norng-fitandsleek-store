import React from 'react';

export default function AdminLocaleToggle({ locale, onLocaleChange }) {
  return (
    <div className="mb-6 inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
      <button
        type="button"
        onClick={() => onLocaleChange('en')}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${locale === 'en'
          ? 'bg-[color:var(--admin-primary)] text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => onLocaleChange('km')}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${locale === 'km'
          ? 'bg-[color:var(--admin-primary)] text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        ខ្មែរ
      </button>
    </div>
  );
}
