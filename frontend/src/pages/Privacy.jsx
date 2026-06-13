import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../components/ui/Dialog";
import { useLanguage } from "../lib/i18n.jsx";
import {
  DEFAULT_PRIVACY_BILINGUAL,
  getPrivacyLocaleView,
  normalizePrivacyPagePayload,
  orderPrivacySectionEntries,
} from "../lib/privacyPageContent.js";

export default function PrivacyPage() {
  const { t, language } = useLanguage();
  const [pageContent, setPageContent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/privacy-page");
        if (!cancelled && data?.privacy_page) {
          setPageContent(normalizePrivacyPagePayload(data.privacy_page));
        }
      } catch {
        if (!cancelled) setPageContent(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const content = useMemo(
    () => getPrivacyLocaleView(pageContent || DEFAULT_PRIVACY_BILINGUAL, language),
    [pageContent, language]
  );
  const orderedSections = useMemo(
    () => orderPrivacySectionEntries(content.sections, content.section_order),
    [content.sections, content.section_order]
  );
  const inquiry = content.inquiry || DEFAULT_PRIVACY_BILINGUAL.locales.en.inquiry;

  const pageTitle = content.title || t("privacyPolicyTitle");
  const lastUpdated = content.last_updated || t("privacyLastUpdated");
  const inquiryTitle = inquiry.title || t("privacyInquiry");
  const inquirySubtitle = inquiry.subtitle || t("privacyInquiryDesc");
  const inquiryButtonLabel = inquiry.button_label || t("sendPrivacyInquiry");
  const inquiryDialogDesc = inquiry.dialog_description || t("privacyInquiryDialogDesc");
  const inquirySubjectPlaceholder = inquiry.subject_placeholder || t("privacySubjectPlaceholder");
  const inquiryMessagePlaceholder = inquiry.message_placeholder || t("privacyMessagePlaceholder");
  const inquirySubmitLabel = inquiry.submit_label || t("sendInquiry");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await api.post("/contact", { ...form, subject: `${t("privacySubjectPrefix")}${form.subject}` });
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (e) {
      setError(e.response?.data?.message || t("contactSendFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-3">
            <span className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            {pageTitle}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">{lastUpdated}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-8 mb-8">
          {orderedSections.map(([sectionKey, section]) => (
            <section key={sectionKey}>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{section.title}</h2>
              {section.intro ? (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{section.intro}</p>
              ) : null}
              {section.body ? (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{section.body}</p>
              ) : null}
              {section.items?.length > 0 ? (
                <ul className={`list-disc list-inside space-y-2 text-slate-600 dark:text-slate-300 ${section.body || section.intro ? "mt-4" : ""}`}>
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
              {section.footer ? (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-4">{section.footer}</p>
              ) : null}
              {section.contact_box ? (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  {section.contact_box.company ? (
                    <p className="text-slate-800 dark:text-white"><strong>{section.contact_box.company}</strong></p>
                  ) : null}
                  {section.contact_box.email ? (
                    <p className="text-slate-600 dark:text-slate-300">
                      {section.contact_box.email_label || t("privacyEmailLabel")} {section.contact_box.email}
                    </p>
                  ) : null}
                  {section.contact_box.location ? (
                    <p className="text-slate-600 dark:text-slate-300">{section.contact_box.location}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ))}
        </div>

        {inquiry.enabled !== false ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden mt-8">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {inquiryTitle}
              </h2>
              <p className="text-purple-100 text-sm">{inquirySubtitle}</p>
            </div>

            <div className="p-6 text-center">
              <button
                onClick={() => setIsFormOpen(true)}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                {inquiryButtonLabel}
              </button>
            </div>
          </div>
        ) : null}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogPopup
            className="max-w-lg w-full !border-0 !p-0 !rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700/80 max-h-[min(90dvh,44rem)] overflow-y-auto"
            position="center"
            showCloseButton={true}
          >
            <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" aria-hidden />

            <div className="px-6 pb-1 pt-7 sm:px-8 sm:pt-8">
              <div className="pr-10">
                <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  {inquiryTitle}
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {inquiryDialogDesc}
                </DialogDescription>
              </div>
            </div>

            <div className="px-6 pb-7 pt-2 sm:px-8 sm:pb-8">
              {success && (
                <div
                  role="status"
                  className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-300">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span className="pt-1 font-medium">{t("messageSentSuccess")}</span>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {[
                  {
                    id: "privacy-name",
                    label: t("yourName"),
                    type: "text",
                    value: form.name,
                    onChange: (v) => setForm({ ...form, name: v }),
                    placeholder: t("namePlaceholder"),
                  },
                  {
                    id: "privacy-email",
                    label: t("emailAddress"),
                    type: "email",
                    value: form.email,
                    onChange: (v) => setForm({ ...form, email: v }),
                    placeholder: t("emailPlaceholder"),
                  },
                  {
                    id: "privacy-subject",
                    label: t("subject"),
                    type: "text",
                    value: form.subject,
                    onChange: (v) => setForm({ ...form, subject: v }),
                    placeholder: inquirySubjectPlaceholder,
                  },
                ].map((field) => (
                  <div key={field.id}>
                    <label htmlFor={field.id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {field.label}
                    </label>
                    <input
                      id={field.id}
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder={field.placeholder}
                      required
                      className="block w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200/90 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:ring-violet-500 dark:bg-slate-800/60 dark:text-white dark:ring-slate-600 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-violet-400/40"
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor="privacy-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("message")}
                  </label>
                  <textarea
                    id="privacy-message"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={inquiryMessagePlaceholder}
                    required
                    rows={4}
                    className="block min-h-[7.5rem] w-full resize-y rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200/90 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:ring-violet-500 dark:bg-slate-800/60 dark:text-white dark:ring-slate-600 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-violet-400/40"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:justify-end sm:gap-3">
                  <DialogClose
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 sm:w-auto sm:min-w-[7.5rem] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {t("cancel")}
                  </DialogClose>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-lg hover:shadow-violet-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 sm:w-auto sm:min-w-[10rem]"
                  >
                    {loading ? t("sending") : inquirySubmitLabel}
                  </button>
                </div>
              </form>
            </div>
          </DialogPopup>
        </Dialog>
      </div>
    </div>
  );
}
