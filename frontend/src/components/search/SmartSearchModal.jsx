import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CornerDownLeft, Loader2, Search, Sparkles, Tag, TrendingUp } from "lucide-react";
import api from "../../lib/api.js";
import { resolveImageUrl } from "../../lib/images.js";
import { useLanguage } from "../../lib/i18n.jsx";

function buildDefaultPopular(t) {
  return [
    { id: "pop-belts", label: t("belts"), description: t("accessories"), to: "/search?q=Belts", icon: Tag, kind: "category" },
    { id: "pop-shoes", label: t("shoes"), description: t("shoes"), to: "/search?q=Shoes", icon: Tag, kind: "category" },
    { id: "pop-hoodies", label: t("hoodies"), description: t("tops"), to: "/search?q=Hoodies", icon: Tag, kind: "category" },
    { id: "pop-new", label: t("newIn"), description: t("newArrivals"), to: "/search?tab=new", icon: TrendingUp, kind: "tab" },
    { id: "pop-tshirts", label: t("tShirts"), description: t("clothes"), to: "/search?q=T-shirts", icon: Tag, kind: "category" },
    { id: "pop-jeans", label: t("jeans"), description: t("bottoms"), to: "/search?q=Jeans", icon: Tag, kind: "category" },
  ];
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(value, q, accentColor) {
  if (!q || !value) return value;
  try {
    const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
    const parts = String(value).split(re);
    const needle = q.toLowerCase();
    return parts.map((part, idx) =>
      part && part.toLowerCase() === needle ? (
        <mark key={idx} className="bg-transparent font-semibold" style={{ color: accentColor }}>
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  } catch {
    return value;
  }
}

export default function SmartSearchModal({
  open,
  onClose,
  placeholder,
  accentColor = "#10a37f",
}) {
  const nav = useNavigate();
  const { t } = useLanguage();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [popularItems, setPopularItems] = useState(() => buildDefaultPopular(t));
  const [popularHover, setPopularHover] = useState(-1);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const reset = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open, reset]);

  useEffect(() => {
    setPopularItems(buildDefaultPopular(t));
  }, [t]);

  const fetchSuggestions = useCallback((term) => {
    if (!term || term.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    api
      .get("/products", {
        params: { q: term, per_page: 8 },
        signal: controller.signal,
      })
      .then(({ data }) => {
        const products = data?.data || data || [];
        const items = Array.isArray(products) ? products.slice(0, 8) : [];
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      })
      .catch((err) => {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
  }, []);

  const handleInput = (value) => {
    setQuery(value);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const goTo = (path) => {
    onClose?.();
    reset();
    nav(path);
  };

  const submitSearch = (e) => {
    e?.preventDefault();
    const term = query.trim();
    onClose?.();
    reset();
    nav(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  const selectProduct = (product) => {
    onClose?.();
    reset();
    if (product?.slug) nav(`/p/${product.slug}`);
    else nav(`/search?q=${encodeURIComponent(product?.name || query)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectProduct(suggestions[selectedIndex]);
    }
  };

  if (!open) return null;

  const inputPlaceholder = placeholder || t("searchEverything");

  const modal = (
    <AnimatePresence>
      <motion.div
        key="search-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9998] bg-slate-950/60 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />
      <motion.div
        key="search-shell"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center px-3 pt-3 pb-4 sm:items-center sm:px-4 sm:py-0 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-search-title"
        style={{ "--cmd-accent": accentColor }}
      >
        <div
          className="pointer-events-auto flex w-full max-w-[680px] max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl sm:max-h-none sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — compact on mobile */}
          <div className="shrink-0 px-4 pt-4 pb-2 sm:px-10 sm:pt-9 sm:pb-5">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <h2
                  id="smart-search-title"
                  className="text-xl leading-tight font-black tracking-tight text-slate-900 sm:text-[32px] sm:leading-none"
                >
                  {t("searchProducts")}
                </h2>
                <p className="mt-1 line-clamp-1 text-xs text-slate-500 sm:mt-2.5 sm:line-clamp-none sm:text-base">
                  {t("smartSearchSubtitle")}
                </p>
              </div>
              <span
                className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-500"
              >
                <Sparkles className="h-3 w-3" style={{ color: accentColor }} />
                {t("smartSearchLabel")}
              </span>
            </div>
          </div>

          <form onSubmit={submitSearch} className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-10 sm:pb-9">
            <div className="space-y-3 sm:space-y-6">
            {/* Search input — compact on mobile */}
            <div className="relative">
              <div className="relative overflow-hidden rounded-full border border-slate-200/80 bg-slate-50/50 shadow-sm ring-1 ring-black/[0.03] focus-within:border-slate-300 focus-within:bg-white focus-within:ring-slate-200/60 transition-all">
                <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 h-11 sm:gap-2 sm:pl-3 sm:pr-2 sm:h-16">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9"
                    style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
                  >
                    <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={inputPlaceholder}
                    className="h-full w-full min-w-0 border-0 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 sm:text-[18px]"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t("searchProducts")}
                    aria-expanded={showSuggestions}
                  />
                  <button
                    type="button"
                    aria-label={t("searchByImage")}
                    title={t("searchByImage")}
                    onClick={() => goTo("/image-search")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:h-10 sm:w-10"
                  >
                    <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
                {loading && (
                  <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
                    <div
                      className="h-full w-1/3 animate-[cmdLoader_1.1s_ease-in-out_infinite]"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                )}
              </div>

              {/* Suggestions — admin-style list */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-200/70 bg-white/98 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <Search className="h-3 w-3 opacity-70" />
                    <span>{t("smartSearchMatches") || "Suggestions"}</span>
                  </div>
                  <ul className="max-h-[36vh] overflow-y-auto px-1 py-1 sm:max-h-[280px] sm:px-1.5 sm:py-1.5" role="listbox">
                    {suggestions.map((product, index) => {
                      const isActive = selectedIndex === index;
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => selectProduct(product)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors sm:gap-3 sm:px-2.5 sm:py-2 ${
                              isActive ? "bg-slate-100/80" : "hover:bg-slate-50"
                            }`}
                            style={
                              isActive
                                ? { boxShadow: `inset 2px 0 0 ${accentColor}` }
                                : undefined
                            }
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md sm:h-8 sm:w-8 ${
                                isActive ? "ring-2 ring-white" : "bg-slate-100"
                              }`}
                              style={isActive ? { backgroundColor: accentColor } : undefined}
                            >
                              <img
                                src={resolveImageUrl(product.image_url)}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-slate-900 sm:text-sm">
                                {highlight(product.name, query, accentColor)}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                ${Number(product.price || 0).toFixed(2)}
                              </span>
                            </span>
                            <CornerDownLeft
                              className={`hidden h-3.5 w-3.5 shrink-0 transition-opacity sm:block ${
                                isActive ? "opacity-90" : "opacity-0 group-hover:opacity-50"
                              }`}
                              style={isActive ? { color: accentColor } : undefined}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100/80"
                  >
                    <Search className="h-4 w-4" />
                    {t("viewAllResultsFor")} &ldquo;{query}&rdquo;
                  </button>
                </div>
              )}

              {loading && query.trim().length >= 2 && !showSuggestions && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/98 px-4 py-3 text-sm text-slate-500 shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: accentColor }} />
                  {t("loadingSuggestions")}
                </div>
              )}
            </div>

            {/* Popular searches — scrollable & compact on mobile */}
            <div className="overflow-hidden rounded-lg border border-slate-200/70 bg-slate-50/40 ring-1 ring-black/[0.03] sm:rounded-xl">
              <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:px-3.5 sm:py-2 sm:text-[10.5px]">
                <Sparkles className="h-3 w-3 opacity-70" />
                <span>{t("popularSearches")}</span>
              </div>
              <ul className="max-h-[34vh] overflow-y-auto px-1 py-1 sm:max-h-none sm:px-1.5 sm:py-1.5">
                {popularItems.map((item, index) => {
                  const isActive = popularHover === index;
                  const Icon = item.icon || Tag;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goTo(item.to)}
                        onMouseEnter={() => setPopularHover(index)}
                        onMouseLeave={() => setPopularHover(-1)}
                        className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors sm:gap-3 sm:px-2.5 sm:py-2 ${
                          isActive ? "bg-white shadow-sm ring-1 ring-slate-200/60" : "hover:bg-white/80"
                        }`}
                        style={
                          isActive ? { boxShadow: `inset 2px 0 0 ${accentColor}` } : undefined
                        }
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md transition-colors sm:h-8 sm:w-8 ${
                            isActive ? "text-white" : "bg-white text-slate-600 ring-1 ring-slate-200/60"
                          }`}
                          style={isActive ? { backgroundColor: accentColor } : undefined}
                        >
                          {item.imageUrl ? (
                            <img
                              src={resolveImageUrl(item.imageUrl)}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-900 sm:text-sm">
                            {item.label}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500 sm:text-xs">
                            {item.description}
                          </span>
                        </span>
                        <CornerDownLeft
                          className={`hidden h-3.5 w-3.5 shrink-0 transition-opacity sm:block ${
                            isActive ? "opacity-90" : "opacity-0 group-hover:opacity-50"
                          }`}
                          style={isActive ? { color: accentColor } : undefined}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            </div>

            <div className="mt-3 h-px shrink-0 bg-slate-200/80 sm:mt-0" />

            {/* Footer — sticky on mobile */}
            <div className="mt-3 flex shrink-0 items-center justify-between gap-3 pt-1 sm:mt-0 sm:gap-4 sm:pt-0">
              <button
                type="button"
                onClick={() => onClose?.()}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-700 sm:text-sm"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="inline-flex h-9 min-w-[96px] items-center justify-center rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 sm:h-11 sm:min-w-[120px] sm:rounded-xl sm:px-6 sm:text-sm"
                style={{ backgroundColor: accentColor }}
              >
                {t("searchButton")}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
      <style key="search-cmd-style">{`
        @keyframes cmdLoader {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
