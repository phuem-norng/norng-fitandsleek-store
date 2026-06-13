import React, { useMemo } from "react";
import { Facebook, Instagram, Twitter, Youtube, Linkedin, MessageCircle, Send, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import Logo from "../Logo.jsx";
import { useLanguage } from "../../lib/i18n.jsx";
import { resolveFooterChromeStyle } from "../../lib/storefrontChrome.js";
import { orderFooterSectionEntries } from "../../lib/footerSections.js";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useHomepageSettings();
  const { t } = useLanguage();

  // Get footer settings with fallback defaults
  const footerSettings = settings?.footer || {
    company_name: "FIT&SLEEK Pro",
    company_description: t('footerDescription'),
    contact_title: t('contact'),
    contact_email: "kalapakgpt@gmail.com",
    contact_phone: "+855 00 00 000",
    contact_address: t('location'),
    copyright_text: t('footerCopyright').replace('{year}', String(currentYear)),
    social_title: t('followUs'),
    social_enabled: true,
    support_enabled: true,
    tracking_enabled: true,
    privacy_enabled: true,
    contact_enabled: true,
    background_color: "#6e8b7e",
    background_image: "",
    text_color: "#ffffff",
  };

  const headerSettings = settings?.header || {};
  const chromeStyle = useMemo(
    () => resolveFooterChromeStyle(footerSettings, headerSettings),
    [footerSettings, headerSettings],
  );

  const footerSocials = settings?.footer_socials || [
    { platform: 'facebook', url: '#' },
    { platform: 'instagram', url: '#' },
    { platform: 'twitter', url: '#' },
  ];

  const socialIcon = (platform) => {
    const p = String(platform || '').toLowerCase();
    if (p === 'facebook') return <Facebook className="w-4 h-4" strokeWidth={2} />;
    if (p === 'instagram') return <Instagram className="w-4 h-4" strokeWidth={2} />;
    if (p === 'twitter') return <Twitter className="w-4 h-4" strokeWidth={2} />;
    if (p === 'youtube') return <Youtube className="w-4 h-4" strokeWidth={2} />;
    if (p === 'linkedin') return <Linkedin className="w-4 h-4" strokeWidth={2} />;
    if (p === 'whatsapp') return <MessageCircle className="w-4 h-4" strokeWidth={2} />;
    if (p === 'telegram') return <Send className="w-4 h-4" strokeWidth={2} />;
    return <Globe className="w-4 h-4" strokeWidth={2} />;
  };

  const footerLinkSectionEnabled = (key) => {
    if (key === 'support') return footerSettings.support_enabled !== false;
    if (key === 'tracking') return footerSettings.tracking_enabled !== false;
    if (key === 'legal') return footerSettings.privacy_enabled !== false;
    return true;
  };

  const footerSections = settings?.footer_sections || {
    support: {
      title: t('footerHelp'),
      items: [
        { label: t('footerHelpCenter'), link: "/support" },
        { label: t('footerFaq'), link: "/faq" },
        { label: t('contactUsTitle'), link: "/contact" },
      ],
    },
    tracking: {
      title: t('footerTracking'),
      items: [
        { label: t('trackOrder'), link: "/profile?tab=track" },
        { label: t('footerReturns'), link: "/returns" },
        { label: t('footerShippingInfo'), link: "/shipping" },
      ],
    },
    legal: {
      title: t('footerLegal'),
      items: [
        { label: t('footerPrivacyPolicy'), link: "/privacy" },
        { label: t('footerTermsConditions'), link: "/terms" },
        { label: t('footerCookiesPolicy'), link: "/cookies" },
      ],
    },
  };

  const footerSectionOrder = settings?.footer_section_order;

  const visibleLinkSections = useMemo(
    () => orderFooterSectionEntries(footerSections, footerSectionOrder).filter(([key, section]) => {
      if (!footerLinkSectionEnabled(key)) return false;
      const items = section?.items || [];
      return items.some((item) => item?.label && item?.link);
    }),
    [footerSections, footerSectionOrder, footerSettings.support_enabled, footerSettings.tracking_enabled, footerSettings.privacy_enabled],
  );

  return (
    <footer className="fs-site-chrome hidden md:block border-t fs-chrome-border" style={chromeStyle}>
      <div className="container-safe-inset py-12 grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {/* Brand Section */}
        <div className="space-y-4">
          <Link to="/" className="inline-block transition-transform duration-300 hover:scale-105">
            <Logo className="h-10 w-auto" />
          </Link>
          <p className="text-sm fs-chrome-muted leading-relaxed">
            {footerSettings.company_description}
          </p>
          {/* Social Links */}
          {footerSettings.social_enabled && (
            <div className="pt-2">
              <div className="text-xs font-black tracking-wide uppercase fs-chrome-heading mb-2 opacity-90">
                {footerSettings.social_title || t('followUs')}
              </div>
              <div className="flex items-center gap-3">
                {footerSocials.map((social, idx) => (
                  <a
                    key={`${social.platform}-${idx}`}
                    href={social.url || '#'}
                    className="w-8 h-8 rounded-full fs-chrome-social flex items-center justify-center transition-all duration-300 hover:scale-110"
                    aria-label={social.platform || 'social'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {socialIcon(social.platform)}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {visibleLinkSections.map(([sectionKey, section]) => (
          <div key={sectionKey}>
            <div className="text-xs font-black tracking-wide uppercase fs-chrome-heading mb-4">
              {section.title || sectionKey.toUpperCase()}
            </div>
            <div className="grid gap-2 text-sm">
              {(section.items || []).map((item, idx) => (
                item?.label && item?.link ? (
                  <Link
                    key={`${sectionKey}-${idx}`}
                    className="fs-chrome-link group flex items-center gap-1 w-fit"
                    to={item.link}
                  >
                    {item.label}
                    <svg
                      className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                ) : null
              ))}
            </div>
          </div>
        ))}

        {/* Contact Section - Conditional */}
        {footerSettings.contact_enabled && (
          <div>
            <div className="text-xs font-black tracking-wide uppercase fs-chrome-heading mb-4">
              {footerSettings.contact_title || t('contact')}
            </div>
            <div className="grid gap-2 text-sm fs-chrome-muted">
              <a
                href={`mailto:${footerSettings.contact_email}`}
                className="fs-chrome-link group flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                {footerSettings.contact_email}
              </a>
              <a
                href={`tel:${String(footerSettings.contact_phone || '').replace(/\s+/g, '')}`}
                className="fs-chrome-link group flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                {footerSettings.contact_phone}
              </a>
              <span className="group flex items-center gap-2">
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {footerSettings.contact_address}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t fs-chrome-border">
        <div className="container-safe-inset py-4 flex flex-col md:flex-row items-center justify-between text-xs fs-chrome-muted gap-4">
          <span>
            {footerSettings.copyright_text}
          </span>
          <div className="flex items-center gap-6">
            {footerSettings.privacy_enabled && (
              <>
                <Link
                  to="/terms"
                  className="fs-chrome-link"
                >
                  {t('terms')}
                </Link>
                <Link
                  to="/privacy"
                  className="fs-chrome-link"
                >
                  {t('privacy')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
