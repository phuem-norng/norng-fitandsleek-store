import React, { useState } from "react";
import api from "../lib/api";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../components/ui/Dialog";
import { useLanguage } from "../lib/i18n.jsx";

export default function SupportPage() {
  const { t } = useLanguage();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await api.post("/contact", form);
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (e) {
      setError(e.response?.data?.message || t('contactSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const faqs = [
    {
      category: t('faqOrdersShipping'),
      items: [
        { q: t('faqTrackOrderQ'), a: t('faqTrackOrderA') },
        { q: t('faqShippingTimeQ'), a: t('faqShippingTimeA') },
        { q: t('faqInternationalShippingQ'), a: t('faqInternationalShippingA') },
      ]
    },
    {
      category: t('faqReturnsRefunds'),
      items: [
        { q: t('faqReturnPolicyQ'), a: t('faqReturnPolicyA') },
        { q: t('faqReturnStartQ'), a: t('faqReturnStartA') },
        { q: t('faqRefundTimeQ'), a: t('faqRefundTimeA') },
      ]
    },
    {
      category: t('faqPayments'),
      items: [
        { q: t('faqPaymentMethodsQ'), a: t('faqPaymentMethodsA') },
        { q: t('faqPaymentSecureQ'), a: t('faqPaymentSecureA') },
      ]
    },
    {
      category: t('faqAccountOrders'),
      items: [
        { q: t('faqCreateAccountQ'), a: t('faqCreateAccountA') },
        { q: t('faqModifyOrderQ'), a: t('faqModifyOrderA') },
        { q: t('faqForgotPasswordQ'), a: t('faqForgotPasswordA') },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-3">
            <span className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            {t('helpSupport')}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">{t('supportSubtitle')}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <a href="/track-order" className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">{t('trackOrder')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('trackOrderDesc')}</p>
          </a>
          <a href="/contact" className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/30 dark:to-orange-800/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">{t('contactUsTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('contactTeamDesc')}</p>
          </a>
          <a href="/privacy" className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">{t('privacy')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('privacyDesc')}</p>
          </a>
        </div>

        {/* Contact CTA Button */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t('sendUsMessage')}
            </h2>
            <p className="text-amber-100 text-sm">{t('sendMessageSubtitle')}</p>
          </div>
          
          <div className="p-6 text-center">
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-8 sm:px-10 py-3 sm:py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl text-base sm:text-lg font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              {t('openContactForm')}
            </button>
          </div>
        </div>

        {/* Dialog Form */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogPopup
            className="w-[95vw] max-w-lg !border-0 !p-0 !rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700/80 max-h-[min(90dvh,44rem)] overflow-y-auto"
            position="center"
            showCloseButton={true}
          >
            <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600" aria-hidden />

            <div className="px-6 pb-1 pt-7 sm:px-8 sm:pt-8">
              <div className="pr-10">
                <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  {t("sendMessageTitle")}
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {t("messageSentDesc")}
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
                    id: "support-name",
                    label: t("yourName"),
                    type: "text",
                    value: form.name,
                    onChange: (v) => setForm({ ...form, name: v }),
                    placeholder: t("namePlaceholder"),
                  },
                  {
                    id: "support-email",
                    label: t("emailAddress"),
                    type: "email",
                    value: form.email,
                    onChange: (v) => setForm({ ...form, email: v }),
                    placeholder: t("emailPlaceholder"),
                  },
                  {
                    id: "support-subject",
                    label: t("subject"),
                    type: "text",
                    value: form.subject,
                    onChange: (v) => setForm({ ...form, subject: v }),
                    placeholder: t("subjectPlaceholder"),
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
                      className="block w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200/90 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:ring-amber-500 dark:bg-slate-800/60 dark:text-white dark:ring-slate-600 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-amber-400/40"
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor="support-message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("message")}
                  </label>
                  <textarea
                    id="support-message"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={t("messagePlaceholderShort")}
                    required
                    rows={4}
                    className="block min-h-[7.5rem] w-full resize-y rounded-xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200/90 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:ring-amber-500 dark:bg-slate-800/60 dark:text-white dark:ring-slate-600 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-amber-400/40"
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
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 text-sm font-semibold text-white shadow-md shadow-amber-500/25 transition hover:from-amber-400 hover:to-orange-500 hover:shadow-lg hover:shadow-amber-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-slate-900 sm:w-auto sm:min-w-[10rem]"
                  >
                    {loading ? t("sending") : t("sendMessage")}
                  </button>
                </div>
              </form>
            </div>
          </DialogPopup>
        </Dialog>

        {/* FAQs */}
        <div className="space-y-6">
          {faqs.map((section, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{section.category}</h2>
              </div>
              <div className="p-6 space-y-4">
                {section.items.map((item, i) => (
                  <details key={i} className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="font-medium text-slate-800 dark:text-white group-open:text-amber-600 transition-colors">{item.q}</span>
                      <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">{t('supportCtaTitle')}</h2>
          <p className="mb-6 opacity-90">{t('supportCtaSubtitle')}</p>
          <a href="mailto:kalapakgpt@gmail.com" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-amber-600 rounded-xl font-semibold hover:bg-amber-50 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t('emailUs')}
          </a>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

