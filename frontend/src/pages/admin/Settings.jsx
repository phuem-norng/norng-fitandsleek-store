import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";

export default function Settings() {
 const [settings, setSettings] = useState({});
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [success, setSuccess] = useState("");
 const [error, setError] = useState("");
 const { mode, primaryColor, setMode, setPrimaryColor, saveTheme, normalizeHexColor } = useTheme();

 // Form state
 const [form, setForm] = useState({
 site_name: "Fit&Sleek",
 site_description: "",
 contact_email: "",
 contact_phone: "",
 currency: "USD",
 tax_rate: "0",
 free_shipping_threshold: "0",
 social_facebook: "",
 social_instagram: "",
 social_twitter: "",
 font_en: "Inter",
 font_km: "Noto Sans Khmer",
 admin_theme_mode: "light",
 admin_primary_color: "#6e8b7e",
 privacy_content: "",
 terms_content: "",
 });

 const formThemeMode = form.admin_theme_mode || mode;
 const formPrimaryColor = form.admin_primary_color || primaryColor;
 const accentColor = formPrimaryColor;
 const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

 const loadSettings = async () => {
 setLoading(true);
 try {
 const res = await api.get("/admin/settings");
 const grouped = res.data || {};
 
 // Convert to flat form object
 const flatForm = { ...form };
 Object.values(grouped).flat().forEach(s => {
 if (flatForm.hasOwnProperty(s.key)) {
 flatForm[s.key] = s.value;
 }
 });

 const loadedMode = flatForm.admin_theme_mode === "dark" ? "dark" : "light";
 const loadedColor = normalizeHexColor(flatForm.admin_primary_color || "#6e8b7e");
 flatForm.admin_theme_mode = loadedMode;
 flatForm.admin_primary_color = loadedColor;

 setForm(flatForm);
 setSettings(grouped);
 } catch (e) {
 console.error("Failed to load settings", e);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { loadSettings(); }, []);

 const save = async () => {
 setSaving(true);
 setError("");
 try {
 const normalizedThemeMode = formThemeMode === "dark" ? "dark" : "light";
 const normalizedThemeColor = normalizeHexColor(formPrimaryColor || "#6e8b7e");
 const payloadForm = {
 ...form,
 admin_theme_mode: normalizedThemeMode,
 admin_primary_color: normalizedThemeColor,
 };

 // Convert form to settings array
 const settingsArray = Object.entries(payloadForm).map(([key, value]) => ({ key, value }));
 await api.put("/admin/settings/bulk", { settings: settingsArray });
 saveTheme(normalizedThemeMode, normalizedThemeColor);
 setForm(payloadForm);
 setSuccess("Settings saved successfully!");
 setTimeout(() => setSuccess(""), 3000);
 loadSettings();
 } catch (e) {
 setError(e.response?.data?.message || "Failed to save settings");
 } finally {
 setSaving(false);
 }
 };

 const handleChange = (key, value) => {
 setForm(s => ({ ...s, [key]: value }));
 };

 const handleThemeModeChange = (nextMode) => {
 const modeValue = nextMode === "dark" ? "dark" : "light";
 setMode(modeValue);
 handleChange("admin_theme_mode", modeValue);
 };

 const handleThemeColorChange = (nextColor) => {
 const colorValue = normalizeHexColor(nextColor || "#6e8b7e");
 setPrimaryColor(colorValue);
 handleChange("admin_primary_color", colorValue);
 };

 if (loading) return <AdminContentSkeleton lines={3} imageHeight={180} />;

 const inputClass =
 "w-full h-11 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/60 px-4 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] focus:border-[var(--admin-primary)] transition";
 const textareaClass =
 "w-full rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/60 p-4 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[rgba(var(--admin-primary-rgb),0.18)] focus:border-[var(--admin-primary)] transition";
 const cardClass =
 "rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white/78 dark:bg-slate-900/62 backdrop-blur-xl ";

 return (
 <div className="min-h-screen">
 <div className="w-full min-w-0 space-y-6">
 <div>
 <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
 <p className="text-slate-500 dark:text-slate-400 mt-1">Configure your store behavior, branding, and legal content.</p>
 </div>

 {success && (
 <div className="rounded-2xl border border-[rgba(var(--admin-primary-rgb),0.3)] dark:border-[rgba(var(--admin-primary-rgb),0.4)] bg-[rgba(var(--admin-primary-rgb),0.09)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] p-4 flex items-center gap-3">
 <svg className="w-5 h-5 text-[color:var(--admin-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 <span className="text-[color:var(--admin-primary)] dark:text-white font-medium">{success}</span>
 </div>
 )}
 {error && (
 <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center gap-3">
 <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span className="text-red-700 dark:text-red-300 font-medium">{error}</span>
 <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300">✕</button>
 </div>
 )}

 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
 <aside className={`${cardClass} p-5 h-fit xl:sticky xl:top-28`}>
 <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Quick Summary</h3>
 <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-slate-500 dark:text-slate-400">Theme Mode</span>
 <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{formThemeMode}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-500 dark:text-slate-400">Primary Color</span>
 <span className="font-semibold text-slate-800 dark:text-slate-200">{formPrimaryColor}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-500 dark:text-slate-400">Currency</span>
 <span className="font-semibold text-slate-800 dark:text-slate-200">{form.currency}</span>
 </div>
 </div>
 <button
 onClick={save}
 disabled={saving}
 className={`mt-5 w-full h-11 rounded-2xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${accentIsWhite ? "border border-slate-300" : ""}`}
 style={{ backgroundColor: accentColor, color: accentIsWhite ? "#0b0b0f" : "#FFFFFF" }}
 >
 {saving ? "Saving..." : "Save Settings"}
 </button>
 </aside>

 <div className="xl:col-span-2 space-y-6">
 <section className={`${cardClass} p-6`}>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
 <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414" />
 </svg>
 Appearance
 </h2>

 <div className="grid md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Theme Mode</label>
 <select value={formThemeMode} onChange={(e) => handleThemeModeChange(e.target.value)} className={inputClass}>
 <option value="light">Light Mode</option>
 <option value="dark">Dark Mode</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Primary Color</label>
 <div className="flex items-center gap-3">
 <input
 type="color"
 value={formPrimaryColor}
 onChange={(e) => handleThemeColorChange(e.target.value)}
 className="h-11 w-14 p-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer"
 />
 <input type="text" value={formPrimaryColor} onChange={(e) => handleThemeColorChange(e.target.value)} className={inputClass} placeholder="#6e8b7e" />
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Admin accent color (default: #6e8b7e)</p>
 </div>
 </div>
 </section>

 <section className={`${cardClass} p-6`}>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
 <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
 </svg>
 General
 </h2>
 <div className="grid md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Site Name</label>
 <input type="text" value={form.site_name} onChange={(e) => handleChange("site_name", e.target.value)} className={inputClass} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Contact Email</label>
 <input type="email" value={form.contact_email} onChange={(e) => handleChange("contact_email", e.target.value)} className={inputClass} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Contact Phone</label>
 <input type="text" value={form.contact_phone} onChange={(e) => handleChange("contact_phone", e.target.value)} className={inputClass} />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Site Description</label>
 <textarea value={form.site_description} onChange={(e) => handleChange("site_description", e.target.value)} rows={4} className={textareaClass} />
 </div>
 </div>
 </section>

 <section className={`${cardClass} p-6`}>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
 <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
 </svg>
 Commerce
 </h2>
 <div className="grid md:grid-cols-3 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Currency</label>
 <select value={form.currency} onChange={(e) => handleChange("currency", e.target.value)} className={inputClass}>
 <option value="USD">USD ($)</option>
 <option value="EUR">EUR (€)</option>
 <option value="GBP">GBP (£)</option>
 <option value="THB">THB (฿)</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Tax Rate (%)</label>
 <input type="number" step="0.01" value={form.tax_rate} onChange={(e) => handleChange("tax_rate", e.target.value)} className={inputClass} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Free Shipping Threshold</label>
 <input type="number" step="0.01" value={form.free_shipping_threshold} onChange={(e) => handleChange("free_shipping_threshold", e.target.value)} className={inputClass} />
 </div>
 </div>
 </section>

 <section className={`${cardClass} p-6`}>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
 <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h16M6 16h12M8 12h8M9 8h6M10 4h4" />
 </svg>
 Typography
 </h2>
 <div className="grid md:grid-cols-2 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">English Font</label>
 <input list="font-en-options" value={form.font_en} onChange={(e) => handleChange("font_en", e.target.value)} className={inputClass} placeholder="Inter" />
 <datalist id="font-en-options">
 <option value="Inter" />
 <option value="Poppins" />
 <option value="Roboto" />
 <option value="Montserrat" />
 <option value="System" />
 </datalist>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Khmer Font</label>
 <input list="font-km-options" value={form.font_km} onChange={(e) => handleChange("font_km", e.target.value)} className={inputClass} placeholder="Noto Sans Khmer" />
 <datalist id="font-km-options">
 <option value="Noto Sans Khmer" />
 <option value="Kantumruy Pro" />
 <option value="Battambang" />
 <option value="System" />
 </datalist>
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">Tip: Fonts must be loaded in the frontend. Use the provided options for best results.</p>
 </div>
 </section>

 <section className={`${cardClass} p-6`}>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
 <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
 </svg>
 Social Media
 </h2>
 <div className="grid md:grid-cols-3 gap-6">
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Facebook URL</label>
 <input type="url" value={form.social_facebook} onChange={(e) => handleChange("social_facebook", e.target.value)} className={inputClass} placeholder="https://facebook.com/..." />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Instagram URL</label>
 <input type="url" value={form.social_instagram} onChange={(e) => handleChange("social_instagram", e.target.value)} className={inputClass} placeholder="https://instagram.com/..." />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Twitter URL</label>
 <input type="url" value={form.social_twitter} onChange={(e) => handleChange("social_twitter", e.target.value)} className={inputClass} placeholder="https://twitter.com/..." />
 </div>
 </div>
 </section>

 <section className={`${cardClass} p-6`}>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
 <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 Legal Pages
 </h2>
 <div className="space-y-6">
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Privacy Policy Content</label>
 <textarea value={form.privacy_content} onChange={(e) => handleChange("privacy_content", e.target.value)} rows={8} className={textareaClass} placeholder="Enter privacy policy text..." />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Terms & Conditions Content</label>
 <textarea value={form.terms_content} onChange={(e) => handleChange("terms_content", e.target.value)} rows={8} className={textareaClass} placeholder="Enter terms and conditions text..." />
 </div>
 </div>
 </section>
 </div>
 </div>
 </div>
 </div>
 );
}

