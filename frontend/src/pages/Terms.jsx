import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useLanguage } from "../lib/i18n.jsx";
import {
  DEFAULT_TERMS_BILINGUAL,
  getTermsLocaleView,
  normalizeTermsPagePayload,
  orderTermsSectionEntries,
} from "../lib/termsPageContent.js";

export default function TermsPage() {
  const { t, language } = useLanguage();
  const [pageContent, setPageContent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/terms-page");
        if (!cancelled && data?.terms_page) {
          setPageContent(normalizeTermsPagePayload(data.terms_page));
        }
      } catch {
        if (!cancelled) setPageContent(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const content = useMemo(
    () => getTermsLocaleView(pageContent || DEFAULT_TERMS_BILINGUAL, language),
    [pageContent, language]
  );
  const orderedSections = useMemo(
    () => orderTermsSectionEntries(content.sections, content.section_order),
    [content.sections, content.section_order]
  );

  const pageTitle = content.title || t("termsTitle");
  const lastUpdated = content.last_updated || t("termsLastUpdated");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-3">
            <span className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            {pageTitle}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">{lastUpdated}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 space-y-6">
          {orderedSections.map(([sectionKey, section]) => (
            <section key={sectionKey}>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-3">{section.title}</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
