import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Clock, Loader2, Search, Tag, TrendingUp, X } from "lucide-react";
import api from "../../lib/api.js";
import { resolveImageUrl } from "../../lib/images.js";
import { useLanguage } from "../../lib/i18n.jsx";

const RECENT_KEY = "fs_recent_searches";
const MAX_RECENT = 6;

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
}
function saveRecent(term) {
  if (!term || term.trim().length < 2) return;
  const t = term.trim();
  const prev = getRecent().filter((s) => s.toLowerCase() !== t.toLowerCase());
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...prev].slice(0, MAX_RECENT))); }
  catch { /* quota */ }
}
function removeRecent(term) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter((s) => s !== term))); }
  catch { /* ignore */ }
}

function buildDefaultPopular(t) {
  return [
    { id: "pop-belts",   label: t("belts"),   to: "/search?q=Belts",    icon: Tag },
    { id: "pop-shoes",   label: t("shoes"),   to: "/search?q=Shoes",    icon: Tag },
    { id: "pop-hoodies", label: t("hoodies"), to: "/search?q=Hoodies",  icon: Tag },
    { id: "pop-new",     label: t("newIn"),   to: "/search?tab=new",    icon: TrendingUp },
    { id: "pop-tshirts", label: t("tShirts"), to: "/search?q=T-shirts", icon: Tag },
    { id: "pop-jeans",   label: t("jeans"),   to: "/search?q=Jeans",    icon: Tag },
  ];
}

/* typed part stays normal-weight, the rest is bold — Nike style */
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

  const [query, setQuery]             = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [products, setProducts]       = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [hoveredIdx, setHoveredIdx]   = useState(-1);
  const [loading, setLoading]         = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [popularItems, setPopularItems]     = useState(() => buildDefaultPopular(t));

  const inputRef    = useRef(null);
  const debounceRef = useRef(null);
  const abortRef    = useRef(null);

  const reset = useCallback(() => {
    setQuery(""); setSuggestions([]); setProducts([]);
    setShowResults(false); setHoveredIdx(-1); setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) { reset(); return; }
    setRecentSearches(getRecent());
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, reset]);

  useEffect(() => { setPopularItems(buildDefaultPopular(t)); }, [t]);

  const fetchSuggestions = useCallback((term) => {
    if (!term || term.trim().length < 2) {
      setSuggestions([]); setProducts([]); setShowResults(false); setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    api.get("/products", { params: { q: term, per_page: 10 }, signal: controller.signal })
      .then(({ data }) => {
        const raw = data?.data || data || [];
        const items = Array.isArray(raw) ? raw : [];
        setSuggestions(items.slice(0, 5));
        setProducts(items.slice(0, 5));
        setShowResults(items.length > 0);
      })
      .catch((err) => {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setSuggestions([]); setProducts([]); setShowResults(false);
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
    if (term) saveRecent(term);
    onClose?.(); reset();
    nav(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  const selectProduct = (product) => {
    if (query.trim()) saveRecent(query.trim());
    onClose?.(); reset();
    if (product?.slug) nav(`/p/${product.slug}`);
    else nav(`/search?q=${encodeURIComponent(product?.name || query)}`);
  };

  const runRecent = (term) => {
    saveRecent(term); onClose?.(); reset();
    nav(`/search?q=${encodeURIComponent(term)}`);
  };

  const deleteRecent = (e, term) => {
    e.stopPropagation();
    removeRecent(term);
    setRecentSearches(getRecent());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
    if (!showResults || suggestions.length === 0) return;
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

  const getProductImage = (p) => {
    // Match the same priority order as ProductCard
    if (p?.image_url) return resolveImageUrl(p.image_url);
    const g = p?.gallery;
    if (Array.isArray(g) && g.length > 0) {
      const first = g[0];
      return resolveImageUrl(typeof first === "string" ? first : first?.url || first?.src || null);
    }
    if (typeof g === "string" && g.trim()) {
      const first = g.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)[0];
      if (first) return resolveImageUrl(first);
    }
    return "/placeholder.svg";
  };

  const modal = (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="ns-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[9997] bg-black/40"
        onClick={() => onClose?.()}
      />

      {/* Full-width panel drops from top */}
      <motion.div
        key="ns-panel"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="fixed top-0 left-0 right-0 z-[9999] bg-white"
        style={{ boxShadow: "0 8px 32px -4px rgba(0,0,0,0.18)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submitSearch}>

          {/* ══ Input bar ══ */}
          <div className="flex items-center gap-3 px-6 sm:px-10 md:px-14 lg:px-20 xl:px-28 h-16 sm:h-[72px]">
            {/* Search / spinner icon */}
            <span className="shrink-0 text-zinc-500">
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
                : <Search className="h-5 w-5" strokeWidth={2} />}
            </span>

            {/* Input */}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              className="flex-1 border-0 bg-transparent text-[17px] sm:text-xl font-normal text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
              autoComplete="off"
              spellCheck={false}
              aria-label={t("searchProducts")}
              aria-expanded={showResults}
            />

            {/* Clear */}
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => {
                  setQuery(""); setSuggestions([]); setProducts([]);
                  setShowResults(false); inputRef.current?.focus();
                }}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Divider */}
            <span className="shrink-0 h-5 w-px bg-zinc-200" aria-hidden="true" />

            {/* Image search — standard position inside the input bar */}
            <button
              type="button"
              onClick={() => goTo("/image-search")}
              aria-label={t("searchByImage") || "Search by image"}
              title={t("searchByImage") || "Search by image"}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <Camera className="h-5 w-5" />
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => onClose?.()}
              className="shrink-0 text-base font-medium text-zinc-700 transition hover:text-zinc-900 pl-1"
            >
              {t("cancel")}
            </button>
          </div>

          {/* ══ Body ══ */}
          <div className="max-h-[80vh] overflow-y-auto px-6 sm:px-10 md:px-14 lg:px-20 xl:px-28 pb-8 pt-4">

            {/* ── Empty state: recent + popular ── */}
            {!query.trim() && (
              <div className="space-y-7">

                {/* Recent searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm text-zinc-500">
                      {t("recentSearches") || "Recent Searches"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term) => (
                        <div
                          key={term}
                          role="button"
                          tabIndex={0}
                          onClick={() => runRecent(term)}
                          onKeyDown={(e) => e.key === "Enter" && runRecent(term)}
                          className="group relative inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-800 transition hover:bg-zinc-200 cursor-pointer select-none"
                        >
                          <Clock className="h-3 w-3 shrink-0 text-zinc-400" />
                          <span>{term}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${term}`}
                            onClick={(e) => deleteRecent(e, term)}
                            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 transition"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Search Terms — Nike pill style */}
                <div>
                  <p className="mb-3 text-sm text-zinc-500">
                    {t("popularSearchTerms") || "Popular Search Terms"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {popularItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => goTo(item.to)}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-800 transition hover:bg-zinc-200 hover:border-zinc-300"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ── Results: suggestions (left) + product row (right) ── */}
            {query.trim() && showResults && (
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                {/* Left: Top Suggestions */}
                <div className="lg:w-52 xl:w-60 shrink-0">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                    {t("topSuggestions") || "Top Suggestions"}
                  </p>
                  <ul className="space-y-0.5" role="listbox">
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
                            className={`flex w-full items-center rounded-lg px-2 py-2 text-left text-[15px] transition-colors ${
                              isActive ? "bg-zinc-50" : "hover:bg-zinc-50"
                            }`}
                          >
                            <span className="truncate">
                              <span className="font-normal text-zinc-800">{prefix}</span>
                              <span className="font-bold text-zinc-900">{bold}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                </div>

                {/* Right: Product cards row */}
                {products.length > 0 && (
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProduct(p)}
                          className="group flex flex-col text-left transition-all duration-200"
                        >
                          {/* Portrait image */}
                          <div className="relative w-full overflow-hidden rounded-lg bg-zinc-100"
                               style={{ aspectRatio: "3/4" }}>
                            <img
                              src={getProductImage(p)}
                              alt={p.name || "Product"}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
                            />
                          </div>
                          {/* Info */}
                          <div className="mt-2 px-0.5">
                            <p className="text-[13px] font-semibold text-zinc-900 leading-tight line-clamp-1 group-hover:underline">
                              {p.name}
                            </p>
                            {p.category?.name || p.brand?.name ? (
                              <p className="mt-0.5 text-[12px] text-zinc-500 leading-tight line-clamp-1">
                                {[p.brand?.name, p.category?.name].filter(Boolean).join(" · ")}
                              </p>
                            ) : null}
                            {(() => {
                              const discountPrice =
                                p.discount_price ??
                                p.discount?.sale_price ??
                                p.active_discount?.sale_price ??
                                p.activeDiscount?.sale_price ??
                                null;
                              const hasDiscount =
                                Boolean(p.has_discount) ||
                                (discountPrice !== null &&
                                  Number(discountPrice) > 0 &&
                                  Number(discountPrice) < Number(p.price || 0));
                              const displayPrice = hasDiscount
                                ? discountPrice
                                : (p.final_price ?? p.price);
                              const originalPrice = hasDiscount ? p.price : p.old_price;
                              if (displayPrice == null) return null;
                              return (
                                <div className="mt-1 flex items-baseline gap-1.5">
                                  <span className="text-[13px] font-semibold text-zinc-800">
                                    ${Number(displayPrice).toFixed(2)}
                                  </span>
                                  {originalPrice != null && (
                                    <span className="text-[11px] text-zinc-400 line-through">
                                      ${Number(originalPrice).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {query.trim() && !loading && !showResults && (
              <div className="py-10 text-center text-zinc-400">
                <Search className="mx-auto mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">
                  {t("noResultsFor") || "No results for"}{" "}
                  <span className="text-zinc-700 font-semibold">&ldquo;{query}&rdquo;</span>
                </p>
              </div>
            )}
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
