import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Loader2,
  Search,
  TrendingUp,
  Tag,
  X,
} from "lucide-react";
import api from "../../lib/api.js";
import { resolveImageUrl } from "../../lib/images.js";
import { useLanguage } from "../../lib/i18n.jsx";

function buildDefaultPopular(t) {
  return [
    { id: "pop-belts",   label: t("belts"),   to: "/search?q=Belts",   icon: Tag },
    { id: "pop-shoes",   label: t("shoes"),   to: "/search?q=Shoes",   icon: Tag },
    { id: "pop-hoodies", label: t("hoodies"), to: "/search?q=Hoodies", icon: Tag },
    { id: "pop-new",     label: t("newIn"),   to: "/search?tab=new",   icon: TrendingUp },
    { id: "pop-tshirts", label: t("tShirts"), to: "/search?q=T-shirts",icon: Tag },
    { id: "pop-jeans",   label: t("jeans"),   to: "/search?q=Jeans",   icon: Tag },
  ];
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* In suggestions: the typed prefix stays normal-weight, rest is bold — Alibaba style */
function splitSuggestion(name, query) {
  if (!query || !name) return { prefix: "", bold: name };
  const lname = String(name).toLowerCase();
  const lquery = query.toLowerCase().trim();
  if (lname.startsWith(lquery)) {
    return { prefix: name.slice(0, lquery.length), bold: name.slice(lquery.length) };
  }
  return { prefix: "", bold: name };
}

export default function SmartSearchModal({
  open,
  onClose,
  placeholder,
  accentColor = "#10a37f",
}) {
  const nav = useNavigate();
  const { t } = useLanguage();

  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hoveredIdx, setHoveredIdx]     = useState(-1);
  const [loading, setLoading]           = useState(false);
  const [popularItems, setPopularItems] = useState(() => buildDefaultPopular(t));

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);
  const abortRef    = useRef(null);

  const reset = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setHoveredIdx(-1);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) { reset(); return; }
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open, reset]);

  useEffect(() => { setPopularItems(buildDefaultPopular(t)); }, [t]);

  const fetchSuggestions = useCallback((term) => {
    if (!term || term.trim().length < 2) {
      setSuggestions([]); setShowSuggestions(false); setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    api.get("/products", { params: { q: term, per_page: 8 }, signal: controller.signal })
      .then(({ data }) => {
        const products = data?.data || data || [];
        const items = Array.isArray(products) ? products.slice(0, 8) : [];
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      })
      .catch((err) => {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setSuggestions([]); setShowSuggestions(false);
        }
      })
      .finally(() => { if (abortRef.current === controller) setLoading(false); });
  }, []);

  const handleInput = (value) => {
    setQuery(value);
    setHoveredIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const goTo = (path) => { onClose?.(); reset(); nav(path); };

  const submitSearch = (e) => {
    e?.preventDefault();
    const term = query.trim();
    onClose?.(); reset();
    nav(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  const selectProduct = (product) => {
    onClose?.(); reset();
    if (product?.slug) nav(`/p/${product.slug}`);
    else nav(`/search?q=${encodeURIComponent(product?.name || query)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoveredIdx((p) => (p < suggestions.length - 1 ? p + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoveredIdx((p) => (p > 0 ? p - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && hoveredIdx >= 0) {
      e.preventDefault();
      selectProduct(suggestions[hoveredIdx]);
    }
  };

  if (!open) return null;

  const inputPlaceholder = placeholder || t("searchEverything");

  const modal = (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="sb-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />

      {/* Dialog */}
      <motion.div
        key="sb-dialog"
        initial={{ opacity: 0, y: -14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center pointer-events-none px-4 pt-[6vh] pb-6 sm:pt-[10vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
      >
        <div
          className="pointer-events-auto w-full max-w-[680px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Outer white card wraps everything ── */}
          <div
            className="overflow-hidden rounded-2xl bg-white"
            style={{
              border: `2px solid ${accentColor}`,
              boxShadow: `0 0 0 4px ${accentColor}22, 0 24px 64px -12px rgba(0,0,0,0.35)`,
            }}
          >
          {/* ── Main search box ── */}
          <form onSubmit={submitSearch}>
            <div className="border-b border-slate-100">
              {/* Input row */}
              <div className="relative flex items-center px-4 pt-3 pb-1 sm:px-5 sm:pt-4">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder}
                  className="w-full border-0 bg-transparent text-[17px] font-normal text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 sm:text-xl"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={t("searchProducts")}
                  aria-expanded={showSuggestions}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); inputRef.current?.focus(); }}
                    className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {loading && (
                  <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" style={{ color: accentColor }} />
                )}
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between px-4 pb-3 pt-2 sm:px-5 sm:pb-4">
                {/* Image search */}
                <button
                  type="button"
                  onClick={() => goTo("/image-search")}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <Camera className="h-[18px] w-[18px]" />
                  <span>{t("searchByImage") || "Image Search"}</span>
                </button>

                {/* Search button */}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 active:brightness-95 sm:px-8 sm:py-3 sm:text-[15px]"
                  style={{ backgroundColor: accentColor }}
                >
                  <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                  <span>{t("searchButton")}</span>
                </button>
              </div>
            </div>
            {/* end border-b wrapper */}

            {/* ── Autocomplete suggestions dropdown ── */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.13 }}
                  className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.22)]"
                >
                  <ul className="max-h-[44vh] overflow-y-auto py-1 sm:max-h-[360px]" role="listbox">
                    {suggestions.map((product, index) => {
                      const isActive = hoveredIdx === index;
                      const { prefix, bold } = splitSuggestion(product.name, query);
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => selectProduct(product)}
                            onMouseEnter={() => setHoveredIdx(index)}
                            onMouseLeave={() => setHoveredIdx(-1)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition-colors sm:px-5 sm:py-3 ${
                              isActive ? "bg-slate-50" : "hover:bg-slate-50/60"
                            }`}
                          >
                            <Search className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 truncate text-slate-700">
                              <span className="font-normal">{prefix}</span>
                              <span className="font-semibold text-slate-900">{bold}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {/* "View all" footer */}
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-100 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <Search className="h-4 w-4" style={{ color: accentColor }} />
                    <span>
                      {t("viewAllResultsFor")}{" "}
                      <span className="text-slate-900">&ldquo;{query}&rdquo;</span>
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* ── Popular searches (inside white card, shown when no query) ── */}
          {!query && (
            <div className="border-t border-slate-100 px-5 py-5 sm:px-6 sm:py-6">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: accentColor }} />
                <span className="text-[12px] font-bold uppercase tracking-widest text-slate-500">
                  {t("popularSearches")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {popularItems.map((item) => {
                  const Icon = item.icon || Tag;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goTo(item.to)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = accentColor;
                        e.currentTarget.style.color = accentColor;
                        e.currentTarget.style.backgroundColor = `${accentColor}0d`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "";
                        e.currentTarget.style.color = "";
                        e.currentTarget.style.backgroundColor = "";
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Footer (always visible inside white card) ── */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
            >
              {t("cancel")}
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 shadow-sm">
                Esc
              </kbd>
              <span>to close</span>
            </div>
          </div>

          </div>{/* end outer white card */}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
