import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../lib/api';
import { resolveImageUrl } from '../../lib/images';
import { AdminContentSkeleton } from '@/components/admin/AdminLoading';
import { useTheme } from '../../state/theme.jsx';
import { AdminConfirmDialog } from '../../components/admin/AdminModal.jsx';
import TopNavDropdownEditor from '../../components/admin/TopNavDropdownEditor.jsx';
import ChromeBackgroundImageField from '../../components/admin/ChromeBackgroundImageField.jsx';
import AdminSaveToast, { AdminFormErrorBanner, flashAdminMessage } from '../../components/admin/AdminFormToast.jsx';
import { useAdminPermissions } from '../../hooks/useAdminPermissions.js';
import { getFirstAccessibleAdminPath } from '../../lib/adminPermissions.js';
import { DEFAULT_TOP_NAV_DROPDOWNS, mergeTopNavDropdowns } from '../../lib/defaultTopNavDropdowns.js';
import { useHomepageSettings } from '../../state/homepageSettings.jsx';
import {
  DEFAULT_CHROME_BACKGROUND,
  DEFAULT_CHROME_TEXT,
} from '../../lib/storefrontChrome.js';
import {
  DEFAULT_FOOTER_SECTION_ORDER,
  normalizeFooterSectionOrder,
  orderFooterSectionEntries,
  reorderFooterSectionKeys,
  reorderFooterSectionsObject,
} from '../../lib/footerSections.js';
import {
  DEFAULT_FAQ_BILINGUAL,
  addFaqSection,
  getFaqLocaleView,
  moveFaqSection,
  normalizeFaqPayload,
  removeFaqSection,
  updateFaqLocaleField,
  updateFaqLocaleSection,
} from '../../lib/faqContent.js';
import FaqManagerPanel from '../../components/admin/FaqManagerPanel.jsx';
import ContactPageManagerPanel from '../../components/admin/ContactPageManagerPanel.jsx';
import PrivacyPageManagerPanel from '../../components/admin/PrivacyPageManagerPanel.jsx';
import TermsPageManagerPanel from '../../components/admin/TermsPageManagerPanel.jsx';
import CookiesPageManagerPanel from '../../components/admin/CookiesPageManagerPanel.jsx';
import {
  DEFAULT_CONTACT_BILINGUAL,
  addContactInfoCard,
  addContactSubject,
  getContactLocaleView,
  moveContactInfoCard,
  moveContactSubject,
  normalizeContactPagePayload,
  removeContactInfoCard,
  removeContactSubject,
  updateContactFormField,
  updateContactInfoCard,
  updateContactLocaleField,
  updateContactSubject,
} from '../../lib/contactPageContent.js';
import {
  DEFAULT_PRIVACY_BILINGUAL,
  addPrivacySection,
  addPrivacySectionItem,
  getPrivacyLocaleView,
  movePrivacySection,
  normalizePrivacyPagePayload,
  removePrivacySection,
  removePrivacySectionItem,
  updatePrivacyInquiryField,
  updatePrivacyLocaleField,
  updatePrivacyLocaleSection,
  updatePrivacySectionItem,
} from '../../lib/privacyPageContent.js';
import {
  DEFAULT_TERMS_BILINGUAL,
  addTermsSection,
  getTermsLocaleView,
  moveTermsSection,
  normalizeTermsPagePayload,
  removeTermsSection,
  updateTermsLocaleField,
  updateTermsLocaleSection,
} from '../../lib/termsPageContent.js';
import {
  DEFAULT_COOKIES_BILINGUAL,
  addCookiesSection,
  addCookiesSectionItem,
  getCookiesLocaleView,
  moveCookiesSection,
  normalizeCookiesPagePayload,
  removeCookiesSection,
  removeCookiesSectionItem,
  updateCookiesLocaleField,
  updateCookiesLocaleSection,
  updateCookiesSectionItem,
} from '../../lib/cookiesPageContent.js';

function withoutMenuVisibilitySection(leftMenu) {
 if (!Array.isArray(leftMenu)) return [];
 return leftMenu.filter((s) => String(s?.title || '').trim() !== 'Menu Visibility');
}

const defaultLeftMenu = [
 {
 title: 'New Product',
 items: [
 { label: 'New Arrivals', to: '/search?tab=new', image: '/placeholder.svg' },
 { label: 'Trending Now', to: '/search?tab=trending', image: '/placeholder.svg' },
 { label: 'This Week', to: '/search?tab=this-week', image: '/placeholder.svg' },
 { label: 'Best Sellers', to: '/search?q=Best%20Seller', image: '/placeholder.svg' },
 { label: 'Editor Picks', to: '/search?q=Editors%20Pick', image: '/placeholder.svg' },
 { label: 'Limited Drop', to: '/search?q=Limited%20Drop', image: '/placeholder.svg' },
 { label: 'Fresh Styles', to: '/search?q=Fresh%20Style', image: '/placeholder.svg' },
 { label: 'Just Added', to: '/search?q=Just%20Added', image: '/placeholder.svg' },
 ],
 },
 {
 title: 'Product Trending',
 items: [
 { label: 'Trending Now', to: '/search?tab=trending', image: '/placeholder.svg' },
 { label: 'Top Rated', to: '/search?sort=rating', image: '/placeholder.svg' },
 { label: 'Best Sellers', to: '/search?sort=popular', image: '/placeholder.svg' },
 { label: 'Most Viewed', to: '/search?q=Most%20Viewed', image: '/placeholder.svg' },
 { label: 'Popular Now', to: '/search?q=Popular%20Now', image: '/placeholder.svg' },
 { label: 'Street Style', to: '/search?q=Street%20Style', image: '/placeholder.svg' },
 { label: 'Viral Picks', to: '/search?q=Viral', image: '/placeholder.svg' },
 { label: 'Trending This Week', to: '/search?q=Trending%20This%20Week', image: '/placeholder.svg' },
 ],
 },
 {
 title: 'Product Discounts',
 items: [
 { label: 'All Discounts', to: '/discounts', image: '/placeholder.svg' },
 { label: 'Clothes', to: '/discounts/clothes', image: '/placeholder.svg' },
 { label: 'Shoes', to: '/discounts/shoes', image: '/placeholder.svg' },
 { label: 'Under $20', to: '/discounts?max_price=20', image: '/placeholder.svg' },
 { label: 'Top Deals', to: '/discounts?sort=discount', image: '/placeholder.svg' },
 { label: 'Accessories', to: '/discounts?q=Accessories', image: '/placeholder.svg' },
 { label: 'Bags', to: '/discounts?q=Bags', image: '/placeholder.svg' },
 { label: 'Flash Sale', to: '/discounts?q=Flash', image: '/placeholder.svg' },
 ],
 },
 {
 title: 'Brands',
 items: [
 { label: 'Nike', to: '/search?q=Nike', image: '/placeholder.svg' },
 { label: 'Adidas', to: '/search?q=Adidas', image: '/placeholder.svg' },
 { label: 'Puma', to: '/search?q=Puma', image: '/placeholder.svg' },
 { label: 'Zara', to: '/search?q=Zara', image: '/placeholder.svg' },
 ],
 },
];

export default function CompleteHomepageManager() {
 const { mode } = useTheme();
 const { user, can, permissionsReady } = useAdminPermissions();
 const canViewHomepageComplete = can('homepage_complete', 'view');
 const canEditHomepageComplete = can('homepage_complete', 'edit');
 const { reloadSettings } = useHomepageSettings();
 const [activeTab, setActiveTab] = useState('sections');
 const [loading, setLoading] = useState(false);
 const [initialLoading, setInitialLoading] = useState(true);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const showSuccess = (msg) => flashAdminMessage(setSuccess, msg);
 const [pendingRemove, setPendingRemove] = useState(null);

 // Sections data
 const [sections, setSections] = useState({
 discounts: { title: 'Discounts', enabled: true, order: 1 },
 clothes: { title: 'Clothes', enabled: true, order: 2 },
 shoes: { title: 'Shoes', enabled: true, order: 3 },
 belts: { title: 'Belts', enabled: true, order: 4 },
 });
 const [newSection, setNewSection] = useState({
 key: '',
 title: '',
 order: 5,
 enabled: true,
 });

 // Header data
 const [headerSettings, setHeaderSettings] = useState({
 logo_text: 'FIT&SLEEK',
 logo_url: '/logo.png',
 background_color: DEFAULT_CHROME_BACKGROUND,
 background_image: '',
 text_color: DEFAULT_CHROME_TEXT,
 search_placeholder: 'Search items...',
 search_enabled: true,
 cart_enabled: true,
 wishlist_enabled: true,
 language_enabled: true,
 free_delivery_icon: '🚚',
 free_delivery_text: 'Free delivery on orders above $40',
 nav_visibility: {
 newIn: true,
 discounts: true,
 women: true,
 men: true,
 sale: true,
 },
 custom_nav: [],
 left_menu: defaultLeftMenu,
 nav_labels: {},
 nav_dropdowns: DEFAULT_TOP_NAV_DROPDOWNS,
});

 // Footer data
 const [footerSettings, setFooterSettings] = useState({
 company_name: 'FIT&SLEEK Pro',
 company_description: 'Your fashion destination',
 contact_title: 'CONTACT',
 contact_email: 'kalapakgpt@gmail.com',
 contact_phone: '+855 00 00 000',
 contact_address: 'Phnom Penh, Cambodia',
 social_title: 'FOLLOW US',
 social_enabled: true,
 support_enabled: true,
 tracking_enabled: true,
 privacy_enabled: true,
 contact_enabled: true,
 copyright_text: '© 2026 FIT&SLEEK Pro. All rights reserved.',
 background_color: DEFAULT_CHROME_BACKGROUND,
 background_image: '',
 text_color: DEFAULT_CHROME_TEXT,
 });

 // Footer links sections
 const [footerSections, setFooterSections] = useState({
 support: {
 title: 'HELP',
 items: [
 { label: 'Help Center', link: '/support' },
 { label: 'FAQ', link: '/faq' },
 { label: 'Contact Us', link: '/contact' },
 ],
 },
 tracking: {
 title: 'TRACKING',
 items: [
 { label: 'Track Order', link: '/profile?tab=track' },
 { label: 'Returns', link: '/returns' },
 { label: 'Shipping Info', link: '/shipping' },
 ],
 },
 legal: {
 title: 'LEGAL',
 items: [
 { label: 'Privacy Policy', link: '/privacy' },
 { label: 'Terms & Conditions', link: '/terms' },
 { label: 'Cookies Policy', link: '/cookies' },
 ],
 },
 });

 const [footerSectionOrder, setFooterSectionOrder] = useState(DEFAULT_FOOTER_SECTION_ORDER);

 const [faqSettings, setFaqSettings] = useState(DEFAULT_FAQ_BILINGUAL);
 const [faqEditLocale, setFaqEditLocale] = useState('en');

 const [contactPage, setContactPage] = useState(DEFAULT_CONTACT_BILINGUAL);
 const [contactEditLocale, setContactEditLocale] = useState('en');
 const [privacyPage, setPrivacyPage] = useState(DEFAULT_PRIVACY_BILINGUAL);
 const [privacyEditLocale, setPrivacyEditLocale] = useState('en');
 const [termsPage, setTermsPage] = useState(DEFAULT_TERMS_BILINGUAL);
 const [termsEditLocale, setTermsEditLocale] = useState('en');
 const [cookiesPage, setCookiesPage] = useState(DEFAULT_COOKIES_BILINGUAL);
 const [cookiesEditLocale, setCookiesEditLocale] = useState('en');

 const [footerSocials, setFooterSocials] = useState([
 { platform: 'facebook', url: '#' },
 { platform: 'instagram', url: '#' },
 { platform: 'twitter', url: '#' },
 ]);

 const headerLinkOptions = [
 { label: 'New In', value: '/search?tab=new' },
 { label: 'Discounts', value: '/discounts' },
 { label: 'Women', value: '/search?gender=women' },
 { label: 'Men', value: '/search?gender=men' },
 { label: 'Sale', value: '/search?tab=sale' },
 { label: 'All Products', value: '/search' },
 { label: 'Cart', value: '/cart' },
 { label: 'Contact', value: '/contact' },
 { label: 'Support', value: '/support' },
 { label: 'Track Order', value: '/profile?tab=track' },
 { label: 'Privacy', value: '/privacy' },
 ];

 const footerLinkOptions = [
 { label: 'Support', value: '/support' },
 { label: 'FAQ', value: '/faq' },
 { label: 'Contact', value: '/contact' },
 { label: 'Track Order', value: '/profile?tab=track' },
 { label: 'Returns', value: '/returns' },
 { label: 'Shipping Info', value: '/shipping' },
 { label: 'Privacy Policy', value: '/privacy' },
 { label: 'Terms & Conditions', value: '/terms' },
 { label: 'Cookies Policy', value: '/cookies' },
 { label: 'All Products', value: '/search' },
 { label: 'Women', value: '/search?gender=women' },
 { label: 'Men', value: '/search?gender=men' },
 { label: 'Cart', value: '/cart' },
 ];

 // Load settings from API on component mount
 useEffect(() => {
 const loadSettings = async () => {
 try {
 setLoading(true);
 // Try loading from API (uses public endpoint by default)
 const response = await api.get('/homepage-settings');

 if (response.data) {
 setSections(response.data.sections || sections);
 const loadedHeader = response.data.header || {};
 setHeaderSettings({
   ...headerSettings,
   ...loadedHeader,
   left_menu: withoutMenuVisibilitySection(loadedHeader.left_menu),
   nav_dropdowns: mergeTopNavDropdowns(loadedHeader.nav_dropdowns),
 });
 setFooterSettings(response.data.footer || footerSettings);
 if (response.data.footer_socials) {
 setFooterSocials(response.data.footer_socials);
 }
 if (response.data.footer_sections) {
 const incoming = response.data.footer_sections;
 const isOldSupportList = Array.isArray(incoming.support);
 const isOldTrackingList = Array.isArray(incoming.tracking);
 const isOldLegalList = Array.isArray(incoming.legal);
 let loadedFooterSections = incoming;

 if (isOldSupportList || isOldTrackingList || isOldLegalList) {
 loadedFooterSections = {
 support: { title: 'HELP', items: incoming.support || [] },
 tracking: { title: 'TRACKING', items: incoming.tracking || [] },
 legal: { title: 'LEGAL', items: incoming.legal || [] },
 };
 }

 setFooterSections(loadedFooterSections);
 setFooterSectionOrder(
 normalizeFooterSectionOrder(response.data.footer_section_order, loadedFooterSections)
 );
 }
 if (response.data.faq) {
 setFaqSettings(normalizeFaqPayload(response.data.faq));
 }
 if (response.data.contact_page) {
 setContactPage(normalizeContactPagePayload(response.data.contact_page));
 }
 if (response.data.privacy_page) {
 setPrivacyPage(normalizePrivacyPagePayload(response.data.privacy_page));
 }
 if (response.data.terms_page) {
 setTermsPage(normalizeTermsPagePayload(response.data.terms_page));
 }
 if (response.data.cookies_page) {
 setCookiesPage(normalizeCookiesPagePayload(response.data.cookies_page));
 }
 }
 } catch (err) {
 console.warn('Using default settings (API not available):', err.message);
 } finally {
 setLoading(false);
 setInitialLoading(false);
 }
 };

 loadSettings();
 }, []);

 const handleSectionToggle = (sectionKey) => {
 if (!canEditHomepageComplete) return;
 setSections(prev => ({
 ...prev,
 [sectionKey]: {
 ...prev[sectionKey],
 enabled: !prev[sectionKey].enabled
 }
 }));
 };

 const handleSectionOrderChange = (sectionKey, newOrder) => {
 if (!canEditHomepageComplete) return;
 setSections(prev => ({
 ...prev,
 [sectionKey]: {
 ...prev[sectionKey],
 order: parseInt(newOrder, 10) || 1
 }
 }));
 };

 const handleSectionTitleChange = (sectionKey, newTitle) => {
 if (!canEditHomepageComplete) return;
 setSections(prev => ({
 ...prev,
 [sectionKey]: {
 ...prev[sectionKey],
 title: newTitle,
 }
 }));
 };

 const normalizeSectionKey = (value) => {
 return String(value || '')
 .toLowerCase()
 .trim()
 .replace(/[^a-z0-9]+/g, '_')
 .replace(/^_+|_+$/g, '');
 };

 const handleAddSection = () => {
 if (!canEditHomepageComplete) return;
 const normalizedKey = normalizeSectionKey(newSection.key || newSection.title);
 const title = String(newSection.title || '').trim();
 const order = parseInt(newSection.order, 10) || Object.keys(sections).length + 1;

 if (!normalizedKey) {
 setError('Section key is required.');
 return;
 }

 if (!title) {
 setError('Section title is required.');
 return;
 }

 if (sections[normalizedKey]) {
 setError('Section key already exists. Please use a different key.');
 return;
 }

 setSections(prev => ({
 ...prev,
 [normalizedKey]: {
 title,
 enabled: !!newSection.enabled,
 order,
 },
 }));

 setNewSection({
 key: '',
 title: '',
 order: order + 1,
 enabled: true,
 });
 setError('');
 };

 const handleRemoveSection = (sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'section', sectionKey });
 };

 const confirmRemove = () => {
 if (!canEditHomepageComplete) return;
 if (!pendingRemove) return;
 if (pendingRemove.type === 'section') {
 setSections(prev => {
 const next = { ...prev };
 delete next[pendingRemove.sectionKey];
 return next;
 });
 }
 if (pendingRemove.type === 'custom_nav') {
 const next = (headerSettings.custom_nav || []).filter((_, i) => i !== pendingRemove.index);
 handleHeaderChange('custom_nav', next);
 }
 if (pendingRemove.type === 'left_menu_section') {
 const next = (headerSettings.left_menu || []).filter((_, i) => i !== pendingRemove.sectionIndex);
 handleHeaderChange('left_menu', next);
 }
 if (pendingRemove.type === 'left_menu_item') {
 const next = [...(headerSettings.left_menu || [])];
 const items = [...(next[pendingRemove.sectionIndex]?.items || [])].filter((_, i) => i !== pendingRemove.itemIndex);
 next[pendingRemove.sectionIndex] = { ...next[pendingRemove.sectionIndex], items };
 handleHeaderChange('left_menu', next);
 }
 if (pendingRemove.type === 'footer_link') {
 setFooterSections(prev => ({
 ...prev,
 [pendingRemove.section]: { ...prev[pendingRemove.section], items: (prev[pendingRemove.section]?.items || []).filter((_, i) => i !== pendingRemove.index) }
 }));
 }
 if (pendingRemove.type === 'footer_section') {
 setFooterSections(prev => {
 const next = { ...prev };
 delete next[pendingRemove.sectionKey];
 return next;
 });
 setFooterSectionOrder(prev => prev.filter((key) => key !== pendingRemove.sectionKey));
 }
 if (pendingRemove.type === 'faq_section') {
 setFaqSettings((prev) => removeFaqSection(prev, pendingRemove.sectionKey));
 }
 if (pendingRemove.type === 'faq_item') {
 setFaqSettings((prev) => updateFaqLocaleSection(prev, pendingRemove.locale || faqEditLocale, pendingRemove.sectionKey, (section) => ({
 ...section,
 items: (section.items || []).filter((_, i) => i !== pendingRemove.index),
 })));
 }
 if (pendingRemove.type === 'contact_subject') {
 setContactPage((prev) => removeContactSubject(prev, pendingRemove.subjectKey));
 }
 if (pendingRemove.type === 'contact_info_card') {
 setContactPage((prev) => removeContactInfoCard(prev, pendingRemove.cardKey));
 }
 if (pendingRemove.type === 'privacy_section') {
 setPrivacyPage((prev) => removePrivacySection(prev, pendingRemove.sectionKey));
 }
 if (pendingRemove.type === 'privacy_item') {
 setPrivacyPage((prev) => removePrivacySectionItem(prev, pendingRemove.locale || privacyEditLocale, pendingRemove.sectionKey, pendingRemove.index));
 }
 if (pendingRemove.type === 'terms_section') {
 setTermsPage((prev) => removeTermsSection(prev, pendingRemove.sectionKey));
 }
 if (pendingRemove.type === 'cookies_section') {
 setCookiesPage((prev) => removeCookiesSection(prev, pendingRemove.sectionKey));
 }
 if (pendingRemove.type === 'cookies_item') {
 setCookiesPage((prev) => removeCookiesSectionItem(prev, pendingRemove.locale || cookiesEditLocale, pendingRemove.sectionKey, pendingRemove.index));
 }
 if (pendingRemove.type === 'footer_social') {
 setFooterSocials(prev => prev.filter((_, i) => i !== pendingRemove.index));
 }
 if (pendingRemove.type === 'nav_flat') {
 const key = pendingRemove.navKey;
 const next = { ...(headerSettings.nav_dropdowns || {}) };
 next[key] = (next[key] || []).filter((_, i) => i !== pendingRemove.index);
 handleHeaderChange('nav_dropdowns', next);
 }
 if (pendingRemove.type === 'nav_section') {
 const key = pendingRemove.navKey;
 const next = { ...(headerSettings.nav_dropdowns || {}) };
 next[key] = (next[key] || []).filter((_, i) => i !== pendingRemove.index);
 handleHeaderChange('nav_dropdowns', next);
 }
 if (pendingRemove.type === 'nav_section_link') {
 const key = pendingRemove.navKey;
 const next = { ...(headerSettings.nav_dropdowns || {}) };
 const sections = [...(next[key] || [])];
 const items = [...(sections[pendingRemove.sectionIndex]?.items || [])].filter((_, i) => i !== pendingRemove.index);
 sections[pendingRemove.sectionIndex] = { ...sections[pendingRemove.sectionIndex], items };
 next[key] = sections;
 handleHeaderChange('nav_dropdowns', next);
 }
 setPendingRemove(null);
 showSuccess('Removed. Save settings to publish changes.');
 };

 const handleHeaderChange = (key, value) => {
 if (!canEditHomepageComplete) return;
 setHeaderSettings(prev => ({
 ...prev,
 [key]: value
 }));
 };

const handleSharedChromeBackgroundColor = (color) => {
 if (!canEditHomepageComplete) return;
handleHeaderChange('background_color', color);
handleFooterChange('background_color', color);
};

const handleSharedChromeTextColor = (color) => {
 if (!canEditHomepageComplete) return;
handleHeaderChange('text_color', color);
handleFooterChange('text_color', color);
};

const resetSharedChromeBackgroundColor = () => {
handleSharedChromeBackgroundColor(DEFAULT_CHROME_BACKGROUND);
};

const resetSharedChromeTextColor = () => {
handleSharedChromeTextColor(DEFAULT_CHROME_TEXT);
};

const uploadChromeBackground = async (file, target) => {
 if (!canEditHomepageComplete) return;
 if (!file) return;
 const formData = new FormData();
 formData.append('image', file);
 formData.append('target', target);
 try {
 setLoading(true);
 const { data } = await api.post('/admin/homepage-settings/chrome-background-upload', formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 });
 if (data?.background_image) {
 if (target === 'header' || target === 'both') {
 handleHeaderChange('background_image', data.background_image);
 }
 if (target === 'footer' || target === 'both') {
 handleFooterChange('background_image', data.background_image);
 }
 }
 const label = target === 'both' ? 'Header & footer' : target === 'footer' ? 'Footer' : 'Header';
 showSuccess(`${label} background image uploaded. Save section settings to apply.`);
 } catch (err) {
 setError('Failed to upload background image: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
};

const sharedChromeBg = () =>
 headerSettings.background_color || footerSettings.background_color || DEFAULT_CHROME_BACKGROUND;

 const uploadLeftMenuImage = async (sectionIndex, itemIndex, file) => {
 if (!canEditHomepageComplete) return;
 if (!file) return;
 const formData = new FormData();
 formData.append('image', file);
 try {
 setLoading(true);
 const { data } = await api.post('/admin/homepage-settings/menu-image-upload', formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 });
 if (data?.image_url) {
 const next = [...(headerSettings.left_menu || [])];
 const items = [...(next[sectionIndex]?.items || [])];
 items[itemIndex] = { ...items[itemIndex], image: data.image_url };
 next[sectionIndex] = { ...next[sectionIndex], items };
 handleHeaderChange('left_menu', next);
 }
 showSuccess('Menu image uploaded. Save header settings to apply.');
 } catch (err) {
 setError('Failed to upload image: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const isDark = mode === 'dark';

 const deleteButtonStyle = {
 backgroundColor: isDark ? 'rgba(127, 29, 29, 0.22)' : '#fef2f2',
 color: isDark ? '#fecdd3' : '#991b1b',
 border: `1px solid ${isDark ? 'rgba(248, 113, 113, 0.45)' : '#fecdd3'}`,
 borderRadius: '0.75rem',
 height: '2.5rem',
 width: '2.5rem',
 display: 'inline-flex',
 alignItems: 'center',
 justifyContent: 'center',
 transition: 'all 150ms ease',
 };

 const handleFooterChange = (key, value) => {
 if (!canEditHomepageComplete) return;
 setFooterSettings(prev => ({
 ...prev,
 [key]: value
 }));
 };

 const handleFooterLinkChange = (section, index, field, value) => {
 if (!canEditHomepageComplete) return;
 setFooterSections(prev => {
 const items = [...(prev[section]?.items || [])];
 items[index] = { ...items[index], [field]: value };
 return { ...prev, [section]: { ...prev[section], items } };
 });
 };

 const handleAddFooterLink = (section) => {
 if (!canEditHomepageComplete) return;
 setFooterSections(prev => ({
 ...prev,
 [section]: { ...prev[section], items: [...(prev[section]?.items || []), { label: '', link: '' }] }
 }));
 };

 const handleRemoveFooterLink = (section, index) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'footer_link', section, index });
 };

 const handleAddFooterSection = () => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 while (footerSections[`custom_section_${index}`]) {
 index += 1;
 }
 const sectionKey = `custom_section_${index}`;
 setFooterSections(prev => ({
 ...prev,
 [sectionKey]: { title: 'New Section', items: [{ label: '', link: '' }] },
 }));
 setFooterSectionOrder(prev => [...prev, sectionKey]);
 };

 const handleMoveFooterSection = (sectionKey, direction) => {
 if (!canEditHomepageComplete) return;
 setFooterSectionOrder((prev) => {
 const order = normalizeFooterSectionOrder(prev, footerSections);
 return reorderFooterSectionKeys(order, sectionKey, direction);
 });
 };

 const handleRemoveFooterSection = (sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'footer_section', sectionKey });
 };

 const handleFaqItemChange = (sectionKey, index, field, value) => {
 if (!canEditHomepageComplete) return;
 setFaqSettings((prev) => updateFaqLocaleSection(prev, faqEditLocale, sectionKey, (section) => {
 const items = [...(section.items || [])];
 items[index] = { ...items[index], [field]: value };
 return { ...section, items };
 }));
 };

 const handleAddFaqSection = () => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 const localeView = getFaqLocaleView(faqSettings, faqEditLocale);
 while (localeView.sections[`faq_section_${index}`]) {
 index += 1;
 }
 const sectionKey = `faq_section_${index}`;
 setFaqSettings((prev) => addFaqSection(prev, sectionKey));
 };

 const handleRemoveFaqSection = (sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'faq_section', sectionKey });
 };

 const handleMoveFaqSection = (sectionKey, direction) => {
 if (!canEditHomepageComplete) return;
 setFaqSettings((prev) => moveFaqSection(prev, sectionKey, direction));
 };

 const handleAddFaqItem = (sectionKey) => {
 if (!canEditHomepageComplete) return;
 setFaqSettings((prev) => updateFaqLocaleSection(prev, faqEditLocale, sectionKey, (section) => ({
 ...section,
 items: [...(section.items || []), { question: '', answer: '' }],
 })));
 };

 const handleRemoveFaqItem = (sectionKey, index) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'faq_item', sectionKey, index, locale: faqEditLocale });
 };

 const saveContactPage = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 const payload = normalizeContactPagePayload(contactPage);
 await api.put('/admin/homepage-settings/contact-page', { contact_page: payload });
 setContactPage(payload);
 showSuccess('Contact page saved successfully.');
 } catch (err) {
 setError('Failed to save contact page: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const savePrivacyPage = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 const payload = normalizePrivacyPagePayload(privacyPage);
 await api.put('/admin/homepage-settings/privacy-page', { privacy_page: payload });
 setPrivacyPage(payload);
 showSuccess('Privacy page saved successfully.');
 } catch (err) {
 setError('Failed to save privacy page: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const saveTermsPage = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 const payload = normalizeTermsPagePayload(termsPage);
 await api.put('/admin/homepage-settings/terms-page', { terms_page: payload });
 setTermsPage(payload);
 showSuccess('Terms page saved successfully.');
 } catch (err) {
 setError('Failed to save terms page: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const saveCookiesPage = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 const payload = normalizeCookiesPagePayload(cookiesPage);
 await api.put('/admin/homepage-settings/cookies-page', { cookies_page: payload });
 setCookiesPage(payload);
 showSuccess('Cookies page saved successfully.');
 } catch (err) {
 setError('Failed to save cookies page: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const saveFaqSettings = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 const payload = normalizeFaqPayload(faqSettings);
 await api.put('/admin/homepage-settings/faq', { faq: payload });
 setFaqSettings(payload);
 showSuccess('FAQ settings saved successfully.');
 } catch (err) {
 setError('Failed to save FAQ settings: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const saveSections = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 await api.put('/admin/homepage-settings/sections', { sections });
 const chromeBg =
 headerSettings.background_color || footerSettings.background_color || DEFAULT_CHROME_BACKGROUND;
 const chromeText =
 headerSettings.text_color || footerSettings.text_color || DEFAULT_CHROME_TEXT;
 await api.put('/admin/homepage-settings/header-extended', {
 ...headerSettings,
 left_menu: withoutMenuVisibilitySection(headerSettings.left_menu),
 background_color: chromeBg,
 background_image: headerSettings.background_image || '',
 text_color: chromeText,
 });
 await api.put('/admin/homepage-settings/footer-extended', {
 footer: {
 ...footerSettings,
 background_color: chromeBg,
 background_image: footerSettings.background_image || '',
 text_color: chromeText,
 },
 footer_sections: reorderFooterSectionsObject(footerSections, footerSectionOrder),
 footer_section_order: normalizeFooterSectionOrder(footerSectionOrder, footerSections),
 footer_socials: footerSocials,
 });
 showSuccess('Section settings saved successfully.');
 } catch (err) {
 console.error('Save error:', err);
 if (err.response?.status === 401) {
 setError('⚠️ You need to be logged in as an admin to save. Please login first.');
 } else {
 setError('Failed to save sections: ' + (err.response?.data?.message || err.message));
 }
 } finally {
 setLoading(false);
 }
 };

 const saveHeaderSettings = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 await api.put('/admin/homepage-settings/header-extended', {
   ...headerSettings,
   left_menu: withoutMenuVisibilitySection(headerSettings.left_menu),
 });
 await reloadSettings();
 showSuccess('Header settings saved successfully.');
 } catch (err) {
 setError('Failed to save header settings: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 };

 const saveFooterSettings = async () => {
 if (!canEditHomepageComplete) return;
 try {
 setLoading(true);
 setError('');
 await api.put('/admin/homepage-settings/footer-extended', {
 footer: footerSettings,
 footer_sections: reorderFooterSectionsObject(footerSections, footerSectionOrder),
 footer_section_order: normalizeFooterSectionOrder(footerSectionOrder, footerSections),
 footer_socials: footerSocials,
 });
 await reloadSettings();
 showSuccess('Footer settings saved successfully.');
 } catch (err) {
 console.error('Save error:', err);
 if (err.response?.status === 401) {
 setError('⚠️ You need to be logged in as an admin to save. Please login first.');
 } else {
 setError('Failed to save footer settings: ' + (err.response?.data?.message || err.message));
 }
 } finally {
 setLoading(false);
 }
 };

 if (!permissionsReady || initialLoading) return <AdminContentSkeleton title="Homepage Manager" />;

 if (!canViewHomepageComplete) {
 return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
 }

 return (
 <div className="min-h-full admin-soft text-slate-800 dark:text-slate-100">
 <div className="w-full min-w-0">
 <AdminConfirmDialog
 open={!!pendingRemove}
 onClose={() => setPendingRemove(null)}
 onConfirm={confirmRemove}
 title="Remove this item?"
 message="This removes it from the form. Click Save to publish the change."
 confirmLabel="Remove"
 cancelLabel="Cancel"
 destructive
 />
 {/* Header */}
 <div className="mb-8">
 <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-2">Homepage Manager</h1>
 <p className="text-slate-500 dark:text-slate-400">Manage all homepage content including header, sections, and footer</p>
 </div>

 <AdminSaveToast message={success} />
 <AdminFormErrorBanner error={error} onDismiss={() => setError('')} />

 {/* Tabs */}
 <div className="mb-6 inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
 <button
 onClick={() => setActiveTab('sections')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'sections'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 📄 Page Sections
 </button>
 <button
 onClick={() => setActiveTab('header')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'header'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 🔝 Header Settings
 </button>
 <button
 onClick={() => setActiveTab('footer')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'footer'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 🔚 Footer Settings
 </button>
 <button
 onClick={() => setActiveTab('faq')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'faq'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 ❓ FAQ Page
 </button>
 <button
 onClick={() => setActiveTab('contact')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'contact'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 ✉️ Contact Page
 </button>
 <button
 onClick={() => setActiveTab('privacy')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'privacy'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 🔒 Privacy Page
 </button>
 <button
 onClick={() => setActiveTab('terms')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'terms'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 📜 Terms Page
 </button>
 <button
 onClick={() => setActiveTab('cookies')}
 className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'cookies'
 ? 'bg-[color:var(--admin-primary)] text-white hover:brightness-110'
 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'
 }`}
 >
 🍪 Cookies Page
 </button>
 </div>

 {/* Sections Tab */}
 {activeTab === 'sections' && (
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Homepage Sections</h2>
 <p className="text-slate-500 dark:text-slate-400 mb-6">Manage sections displayed on the homepage. Enable/disable sections and set their display order.</p>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Header &amp; footer appearance</h3>
 <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
 Shared text and background colors; <strong>header and footer images are separate</strong> (or copy one to the other). Use <strong>Save Section Settings</strong> below to publish.
 </p>
 <div className="mb-6 grid gap-4 lg:grid-cols-2">
 <ChromeBackgroundImageField
 label="Header background image"
 description="Shown behind the top navigation. Overlay uses background color below."
 imageUrl={headerSettings.background_image}
 tintColor={headerSettings.background_color || sharedChromeBg()}
 disabled={loading}
 onFileSelect={(file) => uploadChromeBackground(file, 'header')}
 onRemove={() => handleHeaderChange('background_image', '')}
 extraActions={
 footerSettings.background_image !== headerSettings.background_image ? (
 <button
 type="button"
 disabled={loading || !headerSettings.background_image}
 onClick={() => handleFooterChange('background_image', headerSettings.background_image || '')}
 className="text-left text-xs font-semibold text-[color:var(--admin-primary)] hover:underline disabled:opacity-50"
 >
 Use same image for footer
 </button>
 ) : null
 }
 />
 <ChromeBackgroundImageField
 label="Footer background image"
 description="Shown behind the site footer on desktop."
 imageUrl={footerSettings.background_image}
 tintColor={footerSettings.background_color || sharedChromeBg()}
 disabled={loading}
 onFileSelect={(file) => uploadChromeBackground(file, 'footer')}
 onRemove={() => handleFooterChange('background_image', '')}
 extraActions={
 headerSettings.background_image && footerSettings.background_image !== headerSettings.background_image ? (
 <button
 type="button"
 disabled={loading}
 onClick={() => handleFooterChange('background_image', headerSettings.background_image || '')}
 className="text-left text-xs font-semibold text-[color:var(--admin-primary)] hover:underline"
 >
 Use same image as header
 </button>
 ) : null
 }
 />
 </div>
 <div className="mb-6 rounded-lg border border-dashed border-slate-200 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
 <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
 Upload one image for <strong>both</strong> header and footer
 </p>
 <input
 type="file"
 accept="image/jpeg,image/png,image/webp,image/avif"
 disabled={loading}
 onChange={(e) => {
 uploadChromeBackground(e.target.files?.[0], 'both');
 e.target.value = '';
 }}
 className="block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110 dark:text-slate-300 dark:file:bg-slate-200 dark:file:text-slate-900"
 />
 </div>
 <div className="grid gap-6 sm:grid-cols-2">
 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
 Background color
 </label>
 <div className="flex flex-wrap items-center gap-3">
 <input
 type="color"
 value={headerSettings.background_color || footerSettings.background_color || DEFAULT_CHROME_BACKGROUND}
 onChange={(e) => handleSharedChromeBackgroundColor(e.target.value)}
 className="h-10 w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer"
 aria-label="Shared header and footer background color"
 />
 <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
 {headerSettings.background_color || footerSettings.background_color || DEFAULT_CHROME_BACKGROUND}
 </span>
 <button
 type="button"
 onClick={resetSharedChromeBackgroundColor}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 transition-colors"
 >
 Reset
 </button>
 </div>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
 Text color
 </label>
 <div className="flex flex-wrap items-center gap-3">
 <input
 type="color"
 value={headerSettings.text_color || footerSettings.text_color || DEFAULT_CHROME_TEXT}
 onChange={(e) => handleSharedChromeTextColor(e.target.value)}
 className="h-10 w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer"
 aria-label="Shared header and footer text color"
 />
 <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
 {headerSettings.text_color || footerSettings.text_color || DEFAULT_CHROME_TEXT}
 </span>
 <button
 type="button"
 onClick={resetSharedChromeTextColor}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 transition-colors"
 >
 Reset
 </button>
 </div>
 </div>
 </div>
 <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
 Defaults: background {DEFAULT_CHROME_BACKGROUND}, text {DEFAULT_CHROME_TEXT}. Click <strong>Save Section Settings</strong> below to apply on the live site.
 </p>
 </div>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
 <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Add New Section</h3>
 <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
 <input
 type="text"
 value={newSection.title}
 onChange={(e) => setNewSection(prev => ({ ...prev, title: e.target.value }))}
 placeholder="Section title (e.g. Accessories)"
 className="md:col-span-2 h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
 />
 <input
 type="text"
 value={newSection.key}
 onChange={(e) => setNewSection(prev => ({ ...prev, key: e.target.value }))}
 placeholder="Section key (optional)"
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
 />
 <input
 type="number"
 min="1"
 value={newSection.order}
 onChange={(e) => setNewSection(prev => ({ ...prev, order: e.target.value }))}
 placeholder="Order"
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
 />
 <button
 type="button"
 onClick={handleAddSection}
 className="h-11 rounded-lg bg-[color:var(--admin-primary)] px-4 text-sm font-semibold text-white hover:brightness-110"
 >
 Add Section
 </button>
 </div>
 <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
 <input
 type="checkbox"
 checked={newSection.enabled}
 onChange={(e) => setNewSection(prev => ({ ...prev, enabled: e.target.checked }))}
 className="text-[color:var(--admin-primary)] border-slate-300 dark:border-slate-600"
 />
 Enabled by default
 </label>
 </div>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
 <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Section List</h3>
 <div className="space-y-4">
 {Object.entries(sections)
 .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
 .map(([key, section]) => (
 <div key={key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
 <div className="flex flex-wrap items-center gap-4">
 {/* Checkbox */}
 <input
 type="checkbox"
 checked={section.enabled}
 onChange={() => handleSectionToggle(key)}
 className="h-5 w-5 cursor-pointer rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />

 {/* Section name */}
 <div className="flex-1">
 <input
 type="text"
 value={section.title}
 onChange={(e) => handleSectionTitleChange(key, e.target.value)}
 className="w-full max-w-sm h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-base font-semibold text-slate-900 dark:text-slate-100 focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900"
 />
 <p className="text-sm text-slate-500 dark:text-slate-400">{key}</p>
 </div>

 {/* Order input */}
 <div className="flex items-center gap-2">
 <label className="text-sm font-medium text-slate-700">Display Order:</label>
 <input
 type="number"
 value={section.order}
 onChange={(e) => handleSectionOrderChange(key, e.target.value)}
 min="1"
 max="99"
 className="h-11 w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-center text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 </div>

 <button
 type="button"
 onClick={() => handleRemoveSection(key)}
 title="Remove"
 className="transition-colors"
 style={deleteButtonStyle}
 aria-label="Remove section"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
 </svg>
 </button>
 </div>
 {section.enabled ? (
 <div className="mt-2 inline-flex items-center rounded-full border border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.08)] dark:bg-[rgba(var(--admin-primary-rgb),0.12)] px-2.5 py-1 text-xs font-semibold text-[color:var(--admin-primary)]">Enabled</div>
 ) : (
 <div className="mt-2 inline-flex items-center rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Disabled</div>
 )}
 </div>
 ))}
 </div>
 </div>

 {canEditHomepageComplete ? (
 <div className="flex justify-end">
 <button
 onClick={saveSections}
 disabled={loading}
 className="h-11 rounded-lg bg-[color:var(--admin-primary)] px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
 >
 Save Section Settings
 </button>
 </div>
 ) : null}
 </div>
 )}

 {/* Header Tab */}
 {activeTab === 'header' && (
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Header Settings</h2>
 <p className="text-slate-500 dark:text-slate-400 mb-6">Configure header elements and features</p>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Basic Header Setup</h3>
 <div className="space-y-6 max-w-2xl">
 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Search Placeholder</label>
 <input
 type="text"
 value={headerSettings.search_placeholder || ''}
 onChange={(e) => handleHeaderChange('search_placeholder', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Logo Image URL</label>
 <input
 type="text"
 value={headerSettings.logo_url || ''}
 onChange={(e) => handleHeaderChange('logo_url', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Upload Logo Image</label>
 <input
 type="file"
 accept="image/*"
 onChange={async (e) => {
 if (!canEditHomepageComplete) return;
 const file = e.target.files?.[0];
 if (!file) return;
 const formData = new FormData();
 formData.append('logo', file);
 try {
 setLoading(true);
 const { data } = await api.post('/admin/homepage-settings/logo-upload', formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 });
 if (data?.logo_url) {
 handleHeaderChange('logo_url', data.logo_url);
 }
 showSuccess('Logo uploaded. Save header settings to apply.');
 } catch (err) {
 setError('Failed to upload logo: ' + (err.response?.data?.message || err.message));
 } finally {
 setLoading(false);
 }
 }}
 className="w-full"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Free Delivery Icon</label>
 <input
 type="text"
 value={headerSettings.free_delivery_icon || '🚚'}
 onChange={(e) => handleHeaderChange('free_delivery_icon', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Free Delivery Message</label>
 <input
 type="text"
 value={headerSettings.free_delivery_text || ''}
 onChange={(e) => handleHeaderChange('free_delivery_text', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 {/* Features */}
 <div className="space-y-3">
 <h3 className="font-semibold text-slate-900 dark:text-white">Enabled Features</h3>
 {['search_enabled', 'cart_enabled', 'wishlist_enabled', 'language_enabled'].map(feature => (
 <label key={feature} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 bg-white dark:bg-slate-900 cursor-pointer">
 <input
 type="checkbox"
 checked={headerSettings[feature]}
 onChange={(e) => handleHeaderChange(feature, e.target.checked)}
 className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />
 <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
 {feature.replace(/_/g, ' ').replace('enabled', '').toUpperCase()}
 </span>
 </label>
 ))}
 </div>
 </div>
 </div>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
 <div>
 <h3 className="font-semibold text-slate-900 dark:text-white">Top Nav Dropdowns (desktop)</h3>
 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
 Edit WOMEN / MEN sections and links. Use &quot;From category&quot; to match your catalog slugs.
 </p>
 </div>
 <button
 type="button"
 onClick={() => handleHeaderChange('nav_dropdowns', DEFAULT_TOP_NAV_DROPDOWNS)}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 Reset to defaults
 </button>
 </div>
 <div className="space-y-4">
 <TopNavDropdownEditor
 title="NEW IN"
 items={headerSettings.nav_dropdowns?.newIn || []}
 onChange={(next) => handleHeaderChange('nav_dropdowns', { ...(headerSettings.nav_dropdowns || {}), newIn: next })}
 onRequestRemove={(payload) => setPendingRemove({ type: 'nav_flat', navKey: 'newIn', index: payload.index })}
 deleteButtonStyle={deleteButtonStyle}
 />
 <TopNavDropdownEditor
 title="Discounts"
 items={headerSettings.nav_dropdowns?.discounts || []}
 onChange={(next) => handleHeaderChange('nav_dropdowns', { ...(headerSettings.nav_dropdowns || {}), discounts: next })}
 onRequestRemove={(payload) => setPendingRemove({ type: 'nav_flat', navKey: 'discounts', index: payload.index })}
 deleteButtonStyle={deleteButtonStyle}
 />
 <TopNavDropdownEditor
 title="WOMEN"
 sectionsMode
 audienceGender="women"
 items={headerSettings.nav_dropdowns?.women || []}
 onChange={(next) => handleHeaderChange('nav_dropdowns', { ...(headerSettings.nav_dropdowns || {}), women: next })}
 onRequestRemove={(payload) => {
 if (payload.mode === 'section') setPendingRemove({ type: 'nav_section', navKey: 'women', index: payload.index });
 else setPendingRemove({ type: 'nav_section_link', navKey: 'women', sectionIndex: payload.sectionIndex, index: payload.index });
 }}
 deleteButtonStyle={deleteButtonStyle}
 />
 <TopNavDropdownEditor
 title="MEN"
 sectionsMode
 audienceGender="men"
 items={headerSettings.nav_dropdowns?.men || []}
 onChange={(next) => handleHeaderChange('nav_dropdowns', { ...(headerSettings.nav_dropdowns || {}), men: next })}
 onRequestRemove={(payload) => {
 if (payload.mode === 'section') setPendingRemove({ type: 'nav_section', navKey: 'men', index: payload.index });
 else setPendingRemove({ type: 'nav_section_link', navKey: 'men', sectionIndex: payload.sectionIndex, index: payload.index });
 }}
 deleteButtonStyle={deleteButtonStyle}
 />
 <TopNavDropdownEditor
 title="SALE"
 items={headerSettings.nav_dropdowns?.sale || []}
 onChange={(next) => handleHeaderChange('nav_dropdowns', { ...(headerSettings.nav_dropdowns || {}), sale: next })}
 onRequestRemove={(payload) => setPendingRemove({ type: 'nav_flat', navKey: 'sale', index: payload.index })}
 deleteButtonStyle={deleteButtonStyle}
 />
 </div>
 </div>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Custom Menu Items</h3>
 <div className="space-y-3">
 {(headerSettings.custom_nav || []).map((item, idx) => (
 <div key={`${item.label}-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
 <input
 type="text"
 placeholder="Label"
 value={item.label || ''}
 onChange={(e) => {
 const next = [...(headerSettings.custom_nav || [])];
 next[idx] = { ...next[idx], label: e.target.value };
 handleHeaderChange('custom_nav', next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
 />
 <select
 value={item.to || ''}
 onChange={(e) => {
 const next = [...(headerSettings.custom_nav || [])];
 next[idx] = { ...next[idx], to: e.target.value };
 handleHeaderChange('custom_nav', next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
 >
 <option value="">Select a page</option>
 {headerLinkOptions.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 <button
 onClick={() => setPendingRemove({ type: 'custom_nav', index: idx })}
 title="Remove"
 className="transition-colors"
 style={deleteButtonStyle}
 aria-label="Remove navigation item"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
 </button>
 </div>
 ))}
 <button
 onClick={() => handleHeaderChange('custom_nav', [...(headerSettings.custom_nav || []), { label: '', to: '' }])}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 + Add Menu Item
 </button>
 </div>
 </div>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Left Hover Menu</h3>
 <div className="flex flex-wrap gap-3 mb-4">
 <button
 onClick={() => handleHeaderChange('left_menu', defaultLeftMenu)}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 Create Left Hover Menu
 </button>
 </div>
 <div className="space-y-4">
 {(headerSettings.left_menu || []).map((section, sIdx) => (
 <div key={sIdx} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
 <div className="flex items-center gap-3 mb-3">
 <input
 type="text"
 value={section.title || ''}
 onChange={(e) => {
 const next = [...(headerSettings.left_menu || [])];
 next[sIdx] = { ...next[sIdx], title: e.target.value };
 handleHeaderChange('left_menu', next);
 }}
 className="h-11 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 placeholder="Section title"
 />
 <button
 onClick={() => setPendingRemove({ type: 'left_menu_section', sectionIndex: sIdx })}
 title="Remove Section"
 className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
 </button>
 </div>
 <div className="space-y-3">
 {(section.items || []).map((item, iIdx) => (
 <div key={iIdx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
 <input
 type="text"
 placeholder="Label"
 value={item.label || ''}
 onChange={(e) => {
 const next = [...(headerSettings.left_menu || [])];
 const items = [...(next[sIdx].items || [])];
 items[iIdx] = { ...items[iIdx], label: e.target.value };
 next[sIdx] = { ...next[sIdx], items };
 handleHeaderChange('left_menu', next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 <select
 value={item.to || ''}
 onChange={(e) => {
 const next = [...(headerSettings.left_menu || [])];
 const items = [...(next[sIdx].items || [])];
 items[iIdx] = { ...items[iIdx], to: e.target.value };
 next[sIdx] = { ...next[sIdx], items };
 handleHeaderChange('left_menu', next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 >
 <option value="">Select a page</option>
 {headerLinkOptions.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 <input
 type="text"
 placeholder="Image URL"
 value={item.image || ''}
 onChange={(e) => {
 const next = [...(headerSettings.left_menu || [])];
 const items = [...(next[sIdx].items || [])];
 items[iIdx] = { ...items[iIdx], image: e.target.value };
 next[sIdx] = { ...next[sIdx], items };
 handleHeaderChange('left_menu', next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 <input
 type="file"
 accept="image/*"
 onChange={(e) => uploadLeftMenuImage(sIdx, iIdx, e.target.files?.[0])}
 className="text-sm"
 />
 <div className="flex items-center">
 <div className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60 overflow-hidden flex items-center justify-center text-xs leading-tight text-slate-400 dark:text-slate-500">
 {item.image ? (
 <img
 src={resolveImageUrl(item.image)}
 alt={item.label || 'Preview'}
 className="w-full h-full object-cover"
 onError={(e) => {
 e.currentTarget.style.display = 'none';
 }}
 />
 ) : (
 'No image'
 )}
 </div>
 </div>
 <button
 onClick={() => setPendingRemove({ type: 'left_menu_item', sectionIndex: sIdx, itemIndex: iIdx })}
 title="Remove"
 className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
 </button>
 </div>
 ))}
 <button
 onClick={() => {
 const next = [...(headerSettings.left_menu || [])];
 const items = [...(next[sIdx].items || []), { label: '', to: '', image: '' }];
 next[sIdx] = { ...next[sIdx], items };
 handleHeaderChange('left_menu', next);
 }}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 + Add Item
 </button>
 </div>
 </div>
 ))}
 <button
 onClick={() => handleHeaderChange('left_menu', [...(headerSettings.left_menu || []), { title: '', items: [] }])}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 + Add Section
 </button>
 </div>
 </div>

 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Menu Labels</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {[
 { key: 'newIn', label: 'NEW IN' },
 { key: 'newArrivals', label: 'New Arrivals' },
 { key: 'trendingNow', label: 'Trending Now' },
 { key: 'thisWeek', label: 'This Week' },
 { key: 'discounts', label: 'Discounts' },
 { key: 'allDiscounts', label: 'All Discounts' },
 { key: 'clothes', label: 'Clothes' },
 { key: 'shoes', label: 'Shoes' },
 { key: 'bags', label: 'Bags' },
 { key: 'belts', label: 'Belts' },
 { key: 'accessories', label: 'Accessories' },
 { key: 'women', label: 'Women' },
 { key: 'tops', label: 'Tops' },
 { key: 'bottoms', label: 'Bottoms' },
 { key: 'dresses', label: 'Dresses' },
 { key: 'outerwear', label: 'Outerwear' },
 { key: 'activewear', label: 'Activewear' },
 { key: 'sneakers', label: 'Sneakers' },
 { key: 'slides', label: 'Slides' },
 { key: 'heels', label: 'Heels' },
 { key: 'boots', label: 'Boots' },
 { key: 'hats', label: 'Hats' },
 { key: 'jewelry', label: 'Jewelry' },
 { key: 'girls', label: 'Girls' },
 { key: 'freshDrops', label: 'Fresh drops for everyday fits' },
 { key: 'viewAll', label: 'View All' },
 { key: 'men', label: 'Men' },
 { key: 'tShirts', label: 'T-Shirts' },
 { key: 'shirts', label: 'Shirts' },
 { key: 'hoodies', label: 'Hoodies' },
 { key: 'jeans', label: 'Jeans' },
 { key: 'shorts', label: 'Shorts' },
 { key: 'running', label: 'Running' },
 { key: 'capsHats', label: 'Caps & Hats' },
 { key: 'watches', label: 'Watches' },
 { key: 'boys', label: 'Boys' },
 { key: 'grabDeals', label: 'Grab deals before they\'re gone' },
 { key: 'sale', label: 'SALE' },
 { key: 'allSaleItems', label: 'All Sale Items' },
 { key: 'womensSale', label: 'Women\'s Sale' },
 { key: 'mensSale', label: 'Men\'s Sale' },
 ].map((item) => (
 <div key={item.key}>
 <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{item.label}</label>
 <input
 type="text"
 value={headerSettings.nav_labels?.[item.key] || ''}
 onChange={(e) => handleHeaderChange('nav_labels', {
 ...(headerSettings.nav_labels || {}),
 [item.key]: e.target.value,
 })}
 className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 </div>
 ))}
 </div>
 </div>

 {canEditHomepageComplete ? (
 <div className="flex justify-end">
 <button
 onClick={saveHeaderSettings}
 disabled={loading}
 className="h-11 rounded-lg bg-[color:var(--admin-primary)] px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
 >
 Save Header Settings
 </button>
 </div>
 ) : null}
 </div>
 )}

 {/* Footer Tab */}
 {activeTab === 'footer' && (
 <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
 <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Footer Settings</h2>
 <p className="text-slate-500 dark:text-slate-400 mb-6">Configure footer content and links</p>

 {/* General Settings */}
 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">General Footer Setup</h3>
 <div className="space-y-6 max-w-2xl">
 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Company Name</label>
 <input
 type="text"
 value={footerSettings.company_name}
 onChange={(e) => handleFooterChange('company_name', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Company Description</label>
 <textarea
 value={footerSettings.company_description}
 onChange={(e) => handleFooterChange('company_description', e.target.value)}
 className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 rows="3"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Copyright Text</label>
 <input
 type="text"
 value={footerSettings.copyright_text}
 onChange={(e) => handleFooterChange('copyright_text', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Contact Section Title</label>
 <input
 type="text"
 value={footerSettings.contact_title || 'CONTACT'}
 onChange={(e) => handleFooterChange('contact_title', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Contact Email</label>
 <input
 type="email"
 value={footerSettings.contact_email || ''}
 onChange={(e) => handleFooterChange('contact_email', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Contact Phone</label>
 <input
 type="tel"
 value={footerSettings.contact_phone || ''}
 onChange={(e) => handleFooterChange('contact_phone', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Contact Address</label>
 <input
 type="text"
 value={footerSettings.contact_address || ''}
 onChange={(e) => handleFooterChange('contact_address', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Social Title</label>
 <input
 type="text"
 value={footerSettings.social_title || 'FOLLOW US'}
 onChange={(e) => handleFooterChange('social_title', e.target.value)}
 className="w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
 />
 </div>

 <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
 <input
 type="checkbox"
 checked={footerSettings.social_enabled}
 onChange={(e) => handleFooterChange('social_enabled', e.target.checked)}
 className="rounded border-slate-300 dark:border-slate-600 text-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
 />
 Show Social Icons
 </label>
 </div>
 </div>

 {/* Social Links */}
 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Social Links</h3>
 <div className="space-y-4">
 {footerSocials.map((item, idx) => (
 <div key={`${item.platform}-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
 <select
 value={item.platform}
 onChange={(e) => {
 const next = [...footerSocials];
 next[idx] = { ...next[idx], platform: e.target.value };
 setFooterSocials(next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 >
 <option value="facebook">Facebook</option>
 <option value="instagram">Instagram</option>
 <option value="twitter">Twitter / X</option>
 <option value="youtube">YouTube</option>
 <option value="tiktok">TikTok</option>
 <option value="whatsapp">WhatsApp</option>
 <option value="telegram">Telegram</option>
 <option value="linkedin">LinkedIn</option>
 <option value="website">Website</option>
 </select>
 <input
 type="text"
 placeholder="https://..."
 value={item.url}
 onChange={(e) => {
 const next = [...footerSocials];
 next[idx] = { ...next[idx], url: e.target.value };
 setFooterSocials(next);
 }}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 <button
 onClick={() => setPendingRemove({ type: 'footer_social', index: idx })}
 title="Remove"
 className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
 </button>
 </div>
 ))}
 <button
 onClick={() => setFooterSocials([...footerSocials, { platform: 'facebook', url: '' }])}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 + Add Social Link
 </button>
 </div>
 </div>

 {/* Footer Sections */}
 <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
 <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Footer Link Sections</h3>
 {canEditHomepageComplete ? (
 <button
 type="button"
 onClick={handleAddFooterSection}
 className="h-10 rounded-lg border border-slate-300 dark:border-slate-600 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 + New Footer Section
 </button>
 ) : null}
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
 {orderFooterSectionEntries(footerSections, footerSectionOrder).map(([sectionKey, section], sectionIndex, orderedSections) => (
 <div key={sectionKey} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
 <div className="mb-4 flex items-start gap-2">
 {canEditHomepageComplete ? (
 <div className="flex shrink-0 flex-col gap-1">
 <button
 type="button"
 onClick={() => handleMoveFooterSection(sectionKey, -1)}
 disabled={sectionIndex === 0}
 title="Move left"
 className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
 </button>
 <button
 type="button"
 onClick={() => handleMoveFooterSection(sectionKey, 1)}
 disabled={sectionIndex === orderedSections.length - 1}
 title="Move right"
 className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
 </button>
 </div>
 ) : null}
 <input
 type="text"
 value={section?.title || sectionKey.toUpperCase()}
 onChange={(e) => setFooterSections(prev => ({
 ...prev,
 [sectionKey]: { ...prev[sectionKey], title: e.target.value }
 }))}
 className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-semibold focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 {canEditHomepageComplete ? (
 <button
 type="button"
 onClick={() => handleRemoveFooterSection(sectionKey)}
 title="Remove Section"
 className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
 </button>
 ) : null}
 </div>
 <div className="space-y-3">
 {(section?.items || []).map((link, idx) => (
 <div key={idx} className="flex flex-col gap-2">
 <input
 type="text"
 placeholder="Label"
 value={link.label}
 onChange={(e) => handleFooterLinkChange(sectionKey, idx, 'label', e.target.value)}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 />
 <select
 value={link.link}
 onChange={(e) => handleFooterLinkChange(sectionKey, idx, 'link', e.target.value)}
 className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm focus:border-[var(--admin-primary)] focus:ring-0 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
 >
 <option value="">Select a page</option>
 {footerLinkOptions.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 <button
 onClick={() => handleRemoveFooterLink(sectionKey, idx)}
 title="Remove Link"
 className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
 >
 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
 </button>
 </div>
 ))}
 <button
 onClick={() => handleAddFooterLink(sectionKey)}
 className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
 >
 + Add Link
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>

 {canEditHomepageComplete ? (
 <div className="flex justify-end">
 <button
 onClick={saveFooterSettings}
 disabled={loading}
 className="h-11 rounded-lg bg-[color:var(--admin-primary)] px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
 >
 Save Footer Settings
 </button>
 </div>
 ) : null}
 </div>
 )}

 {activeTab === 'faq' && (
 <FaqManagerPanel
 faqLocale={faqEditLocale}
 onLocaleChange={setFaqEditLocale}
 faqTitle={getFaqLocaleView(faqSettings, faqEditLocale).title}
 faqSubtitle={getFaqLocaleView(faqSettings, faqEditLocale).subtitle}
 faqSections={getFaqLocaleView(faqSettings, faqEditLocale).sections}
 faqSectionOrder={getFaqLocaleView(faqSettings, faqEditLocale).section_order}
 canEdit={canEditHomepageComplete}
 loading={loading}
 onTitleChange={(value) => setFaqSettings((prev) => updateFaqLocaleField(prev, faqEditLocale, 'title', value))}
 onSubtitleChange={(value) => setFaqSettings((prev) => updateFaqLocaleField(prev, faqEditLocale, 'subtitle', value))}
 onSectionTitleChange={(sectionKey, value) => setFaqSettings((prev) => updateFaqLocaleSection(prev, faqEditLocale, sectionKey, (section) => ({
 ...section,
 title: value,
 })))}
 onItemChange={handleFaqItemChange}
 onAddSection={handleAddFaqSection}
 onRemoveSection={handleRemoveFaqSection}
 onMoveSection={handleMoveFaqSection}
 onAddItem={handleAddFaqItem}
 onRemoveItem={handleRemoveFaqItem}
 onSave={saveFaqSettings}
 />
 )}

 {activeTab === 'contact' && (
 <ContactPageManagerPanel
 contactLocale={contactEditLocale}
 onLocaleChange={setContactEditLocale}
 contactPage={getContactLocaleView(contactPage, contactEditLocale)}
 canEdit={canEditHomepageComplete}
 loading={loading}
 onPageFieldChange={(field, value) => setContactPage((prev) => updateContactLocaleField(prev, contactEditLocale, field, value))}
 onFormFieldChange={(field, value) => setContactPage((prev) => updateContactFormField(prev, contactEditLocale, field, value))}
 onSubjectChange={(subjectKey, field, value) => {
 if (field === 'value') return;
 setContactPage((prev) => updateContactSubject(prev, contactEditLocale, subjectKey, (subject) => ({
 ...subject,
 [field]: value,
 })));
 }}
 onAddSubject={() => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 const localeView = getContactLocaleView(contactPage, contactEditLocale);
 while (localeView.form.subjects[`subject_${index}`]) index += 1;
 const subjectKey = `subject_${index}`;
 setContactPage((prev) => addContactSubject(prev, subjectKey));
 }}
 onRemoveSubject={(subjectKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'contact_subject', subjectKey });
 }}
 onMoveSubject={(subjectKey, direction) => {
 if (!canEditHomepageComplete) return;
 setContactPage((prev) => moveContactSubject(prev, subjectKey, direction));
 }}
 onInfoCardChange={(cardKey, field, value) => setContactPage((prev) => updateContactInfoCard(prev, contactEditLocale, cardKey, (card) => ({
 ...card,
 [field]: value,
 })))}
 onAddInfoCard={() => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 const localeView = getContactLocaleView(contactPage, contactEditLocale);
 while (localeView.info_cards[`info_card_${index}`]) index += 1;
 const cardKey = `info_card_${index}`;
 setContactPage((prev) => addContactInfoCard(prev, cardKey));
 }}
 onRemoveInfoCard={(cardKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'contact_info_card', cardKey });
 }}
 onMoveInfoCard={(cardKey, direction) => {
 if (!canEditHomepageComplete) return;
 setContactPage((prev) => moveContactInfoCard(prev, cardKey, direction));
 }}
 onSave={saveContactPage}
 />
 )}

 {activeTab === 'privacy' && (
 <PrivacyPageManagerPanel
 privacyLocale={privacyEditLocale}
 onLocaleChange={setPrivacyEditLocale}
 privacyPage={getPrivacyLocaleView(privacyPage, privacyEditLocale)}
 canEdit={canEditHomepageComplete}
 loading={loading}
 onPageFieldChange={(field, value) => setPrivacyPage((prev) => updatePrivacyLocaleField(prev, privacyEditLocale, field, value))}
 onInquiryFieldChange={(field, value) => setPrivacyPage((prev) => updatePrivacyInquiryField(prev, privacyEditLocale, field, value))}
 onSectionFieldChange={(sectionKey, field, value) => setPrivacyPage((prev) => updatePrivacyLocaleSection(prev, privacyEditLocale, sectionKey, (section) => ({
 ...section,
 [field]: value,
 })))}
 onSectionItemChange={(sectionKey, index, field, value) => setPrivacyPage((prev) => updatePrivacySectionItem(prev, privacyEditLocale, sectionKey, index, field, value))}
 onSectionContactBoxChange={(sectionKey, field, value) => setPrivacyPage((prev) => updatePrivacyLocaleSection(prev, privacyEditLocale, sectionKey, (section) => ({
 ...section,
 contact_box: {
 ...(section.contact_box || {}),
 [field]: value,
 },
 })))}
 onToggleSectionContactBox={(sectionKey, enabled) => setPrivacyPage((prev) => updatePrivacyLocaleSection(prev, privacyEditLocale, sectionKey, (section) => ({
 ...section,
 contact_box: enabled
 ? (section.contact_box || { company: '', email_label: 'Email:', email: '', location: '' })
 : null,
 })))}
 onAddSection={() => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 const localeView = getPrivacyLocaleView(privacyPage, privacyEditLocale);
 while (localeView.sections[`privacy_section_${index}`]) index += 1;
 const sectionKey = `privacy_section_${index}`;
 setPrivacyPage((prev) => addPrivacySection(prev, sectionKey));
 }}
 onRemoveSection={(sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'privacy_section', sectionKey });
 }}
 onMoveSection={(sectionKey, direction) => {
 if (!canEditHomepageComplete) return;
 setPrivacyPage((prev) => movePrivacySection(prev, sectionKey, direction));
 }}
 onAddSectionItem={(sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPrivacyPage((prev) => addPrivacySectionItem(prev, privacyEditLocale, sectionKey));
 }}
 onRemoveSectionItem={(sectionKey, index) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'privacy_item', sectionKey, index, locale: privacyEditLocale });
 }}
 onSave={savePrivacyPage}
 />
 )}

 {activeTab === 'terms' && (
 <TermsPageManagerPanel
 termsLocale={termsEditLocale}
 onLocaleChange={setTermsEditLocale}
 termsPage={getTermsLocaleView(termsPage, termsEditLocale)}
 canEdit={canEditHomepageComplete}
 loading={loading}
 onPageFieldChange={(field, value) => setTermsPage((prev) => updateTermsLocaleField(prev, termsEditLocale, field, value))}
 onSectionFieldChange={(sectionKey, field, value) => setTermsPage((prev) => updateTermsLocaleSection(prev, termsEditLocale, sectionKey, (section) => ({
 ...section,
 [field]: value,
 })))}
 onAddSection={() => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 const localeView = getTermsLocaleView(termsPage, termsEditLocale);
 while (localeView.sections[`terms_section_${index}`]) index += 1;
 const sectionKey = `terms_section_${index}`;
 setTermsPage((prev) => addTermsSection(prev, sectionKey));
 }}
 onRemoveSection={(sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'terms_section', sectionKey });
 }}
 onMoveSection={(sectionKey, direction) => {
 if (!canEditHomepageComplete) return;
 setTermsPage((prev) => moveTermsSection(prev, sectionKey, direction));
 }}
 onSave={saveTermsPage}
 />
 )}

 {activeTab === 'cookies' && (
 <CookiesPageManagerPanel
 cookiesLocale={cookiesEditLocale}
 onLocaleChange={setCookiesEditLocale}
 cookiesPage={getCookiesLocaleView(cookiesPage, cookiesEditLocale)}
 canEdit={canEditHomepageComplete}
 loading={loading}
 onPageFieldChange={(field, value) => setCookiesPage((prev) => updateCookiesLocaleField(prev, cookiesEditLocale, field, value))}
 onSectionFieldChange={(sectionKey, field, value) => setCookiesPage((prev) => updateCookiesLocaleSection(prev, cookiesEditLocale, sectionKey, (section) => ({
 ...section,
 [field]: value,
 })))}
 onSectionItemChange={(sectionKey, index, field, value) => setCookiesPage((prev) => updateCookiesSectionItem(prev, cookiesEditLocale, sectionKey, index, field, value))}
 onAddSection={() => {
 if (!canEditHomepageComplete) return;
 let index = 1;
 const localeView = getCookiesLocaleView(cookiesPage, cookiesEditLocale);
 while (localeView.sections[`cookies_section_${index}`]) index += 1;
 const sectionKey = `cookies_section_${index}`;
 setCookiesPage((prev) => addCookiesSection(prev, sectionKey));
 }}
 onRemoveSection={(sectionKey) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'cookies_section', sectionKey });
 }}
 onMoveSection={(sectionKey, direction) => {
 if (!canEditHomepageComplete) return;
 setCookiesPage((prev) => moveCookiesSection(prev, sectionKey, direction));
 }}
 onAddSectionItem={(sectionKey) => {
 if (!canEditHomepageComplete) return;
 setCookiesPage((prev) => addCookiesSectionItem(prev, cookiesEditLocale, sectionKey));
 }}
 onRemoveSectionItem={(sectionKey, index) => {
 if (!canEditHomepageComplete) return;
 setPendingRemove({ type: 'cookies_item', sectionKey, index, locale: cookiesEditLocale });
 }}
 onSave={saveCookiesPage}
 />
 )}
 </div>
 </div>
 );
}
