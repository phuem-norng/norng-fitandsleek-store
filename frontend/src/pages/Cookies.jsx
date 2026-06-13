import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useLanguage } from "../lib/i18n.jsx";
import {
  DEFAULT_COOKIES_BILINGUAL,
  getCookiesLocaleView,
  normalizeCookiesPagePayload,
  orderCookiesSectionEntries,
} from "../lib/cookiesPageContent.js";

export default function CookiesPage() {
  const { t, language } = useLanguage();
  const [pageContent, setPageContent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/cookies-page");
        if (!cancelled && data?.cookies_page) {
          setPageContent(normalizeCookiesPagePayload(data.cookies_page));
        }
      } catch {
        if (!cancelled) setPageContent(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const content = useMemo(
    () => getCookiesLocaleView(pageContent || DEFAULT_COOKIES_BILINGUAL, language),
    [pageContent, language]
  );
  const orderedSections = useMemo(
    () => orderCookiesSectionEntries(content.sections, content.section_order),
    [content.sections, content.section_order]
  );

  const pageTitle = content.title || t("cookiesTitle");
  const lastUpdated = content.last_updated || t("cookiesLastUpdated");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-3">
            <span className="w-14 h-14 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.12-3 2.5 0 1.381 1.343 2.5 3 2.5s3 1.12 3 2.5-1.343 2.5-3 2.5m0-10a3.5 3.5 0 013.5 3.5M12 4.5a7.5 7.5 0 010 15" />
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
              {section.body ? (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{section.body}</p>
              ) : null}
              {section.items?.length > 0 ? (
                <ul className={`list-disc list-inside space-y-2 text-slate-600 dark:text-slate-300 ${section.body ? "mt-4" : ""}`}>
                  {section.items.map((item, index) => (
                    <li key={`${sectionKey}-${index}`}>
                      {item.label ? (
                        <>
                          <strong>{item.label}</strong> {item.text}
                        </>
                      ) : (
                        item.text
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
