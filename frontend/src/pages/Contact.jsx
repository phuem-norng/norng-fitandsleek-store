import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { X } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";
import {
  DEFAULT_CONTACT_BILINGUAL,
  getContactLocaleView,
  normalizeContactPagePayload,
  orderContactInfoCards,
  orderContactSubjects,
} from "../lib/contactPageContent.js";

function InfoCardIcon({ cardKey }) {
  if (cardKey === "email") {
    return (
      <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (cardKey === "phone") {
    return (
      <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  }
  if (cardKey === "visit") {
    return (
      <svg className="w-7 h-7 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function cardIconClass(cardKey) {
  if (cardKey === "email") return "from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30";
  if (cardKey === "phone") return "from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30";
  if (cardKey === "visit") return "from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30";
  return "from-amber-100 to-orange-200 dark:from-amber-900/30 dark:to-orange-800/30";
}

export default function ContactPage() {
  const { t, language } = useLanguage();
  const [pageContent, setPageContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/contact-page");
        if (!cancelled && data?.contact_page) {
          setPageContent(normalizeContactPagePayload(data.contact_page));
        }
      } catch {
        if (!cancelled) setPageContent(null);
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const content = useMemo(
    () => getContactLocaleView(pageContent || DEFAULT_CONTACT_BILINGUAL, language),
    [pageContent, language]
  );
  const subjects = useMemo(() => orderContactSubjects(content.form), [content.form]);
  const infoCards = useMemo(() => orderContactInfoCards(content), [content]);

  const pageTitle = content.title || t('contactUsTitle');
  const pageSubtitle = content.subtitle || t('contactSubtitle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await api.post("/contact", form);
      setSuccess(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (e) {
      setError(e.response?.data?.message || t('contactSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-3">{pageTitle}</h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">{pageSubtitle}</p>
        </div>

        {success && (
          <div className="mb-8 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 flex items-center gap-4 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-300">{t('messageSent')}</h3>
              <p className="text-emerald-600 dark:text-emerald-400">{t('messageSentDesc')}</p>
            </div>
            <button onClick={() => setSuccess(false)} className="ml-auto text-emerald-400 hover:text-emerald-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-800 dark:text-red-300">{t('error')}</h3>
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8">
          {contentLoading ? (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400">{t('loading')}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{content.form.name_label} *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all"
                    placeholder={content.form.name_placeholder}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{content.form.email_label} *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all"
                    placeholder={content.form.email_placeholder}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{content.form.phone_label}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all"
                    placeholder={content.form.phone_placeholder}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{content.form.subject_label} *</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                    className="w-full h-12 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="">{content.form.select_subject_label}</option>
                    {subjects.map((subject) => (
                      <option key={subject.value} value={subject.value}>{subject.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{content.form.message_label} *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  rows={5}
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all resize-none"
                  placeholder={content.form.message_placeholder}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base sm:text-lg hover:from-amber-600 hover:to-orange-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {content.form.submit_label}
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {infoCards.map(([cardKey, card]) => (
            <div key={cardKey} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg text-center">
              <div className={`w-14 h-14 bg-gradient-to-br ${cardIconClass(cardKey)} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                <InfoCardIcon cardKey={cardKey} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-2">{card.title}</h3>
              {card.href ? (
                <a href={card.href} className="block text-sm text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                  {card.line1}
                </a>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">{card.line1}</p>
              )}
              {card.line2 ? <p className="text-sm text-slate-500 dark:text-slate-400">{card.line2}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
