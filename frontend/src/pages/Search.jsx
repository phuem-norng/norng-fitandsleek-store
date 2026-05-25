import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { resolveImageUrl } from "../lib/images.js";
import ProductCard from "../components/shop/ProductCard.jsx";
import StorefrontFilterDrawer, { StorefrontFilterToolbarButton } from "../components/shop/StorefrontFilterDrawer.jsx";
import { useWishlist } from "../state/wishlist.jsx";
import { useStorefrontFilterDrawer } from "../hooks/useStorefrontFilterDrawer.js";
import { useStorefrontFilterSections } from "../hooks/useStorefrontFilterSections.js";
import {
  applyBrowseToSearchParams,
  applyFiltersToSearchParams,
  buildProductApiParams,
  browseFromSearchParams,
  filtersFromSearchParams,
  buildStorefrontFilterChips,
  countStorefrontFilters,
} from "../lib/storefrontProductFilters.js";
import { useStorefrontBrowseDraft } from "../hooks/useStorefrontBrowseDraft.js";
import { Sparkles } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Search() {
  const qs = useQuery();
  const location = useLocation();
  const nav = useNavigate();
  const wishlist = useWishlist();
  const { t } = useLanguage();

  const { categories, brands, filterSections, priceBounds } = useStorefrontFilterSections();
  const appliedFilters = useMemo(() => filtersFromSearchParams(qs), [qs]);
  const listFilters = useStorefrontFilterDrawer(appliedFilters);
  const browse = useStorefrontBrowseDraft(qs, appliedFilters, priceBounds);
  const [loading, setLoading] = useState(qs.get("tab") !== "wishlist");
  const [page, setPage] = useState(Number(qs.get("page") || 1));
  const [data, setData] = useState({ data: [], meta: null });
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const q = qs.get("q") || "";
  const parentCategory = qs.get("parent_category") || "";
  const tab = qs.get("tab") || "";
  const imageSearchParam = qs.get("image_search");
  const colorsParam = qs.get("colors");

  // Initialize image search from navigation state or storage
  useEffect(() => {
    const stateResults = location?.state?.imageSearchResults;
    if (stateResults?.colors) {
      setImageSearchResults(stateResults);
      return;
    }
    try {
      const stored = sessionStorage.getItem("image_search_results");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.colors) setImageSearchResults(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, [location]);

  // Initialize image search from URL params
  useEffect(() => {
    if (imageSearchParam === "1" && colorsParam) {
      try {
        const colors = JSON.parse(decodeURIComponent(colorsParam));
        setImageSearchResults((prev) => ({ ...prev, colors }));
        loadSuggestions();
      } catch (e) {
        console.error("Failed to parse colors from URL:", e);
      }
    }
  }, [imageSearchParam, colorsParam]);

  useEffect(() => setPage(Number(qs.get("page") || 1)), [qs]);

  useEffect(() => {
    listFilters.syncFromExternal(appliedFilters);
  }, [appliedFilters]);

  // Load suggestions when image search is active
  useEffect(() => {
    if (imageSearchResults) {
      loadSuggestions();
    }
  }, [imageSearchResults]);

  const loadSuggestions = async () => {
    try {
      // Get random/featured products as suggestions
      const { data: productsData } = await api.get("/products", {
        params: { limit: 4, random: true }
      });
      const products = productsData?.data || productsData || [];
      // Ensure we have at least 4 products
      if (products.length < 4) {
        const allProducts = products;
        while (allProducts.length < 4) {
          allProducts.push(...products);
        }
        setSuggestions(allProducts.slice(0, 4));
      } else {
        setSuggestions(products.slice(0, 4));
      }
    } catch {
      setSuggestions([]);
    }
  };

  // State for wishlist-specific product data
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Stable string key from wishlist IDs — avoids array-reference comparison issues
  const wishlistKey = wishlist.ids.slice().sort().join(",");

  // Fetch wishlist products by ID whenever the wishlist tab is active or IDs change
  useEffect(() => {
    if (tab !== "wishlist") return;

    if (!wishlistKey) {
      setWishlistProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setWishlistLoading(true);
    setLoading(false); // ensure the main spinner never blocks wishlist tab
    (async () => {
      try {
        const res = await api.get("/products", {
          params: { ids: wishlistKey, per_page: 200 },
        });
        if (!cancelled) setWishlistProducts(res.data?.data || []);
      } catch {
        if (!cancelled) setWishlistProducts([]);
      } finally {
        if (!cancelled) setWishlistLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, wishlistKey]);

  // Normal search / browse fetch (skip when wishlist tab is active)
  useEffect(() => {
    if (tab === "wishlist") {
      setLoading(false); // clear spinner if user switches back and forth
      return;
    }

    (async () => {
      if (imageSearchResults?.items && Array.isArray(imageSearchResults.items)) {
        setData({ data: imageSearchResults.items, meta: null });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = buildProductApiParams({
          page,
          q,
          tab,
          parentCategory,
          applied: appliedFilters,
          browse: browse.browseFromUrl,
          imageColors: imageSearchResults?.colors || null,
        });
        const res = await api.get("/products", { params });
        setData(res.data || { data: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, q, parentCategory, page, imageSearchResults, appliedFilters, browse.browseFromUrl]);

  const parentCollectionLabel = useMemo(() => {
    if (!parentCategory) return "";

    const normalized = parentCategory.toLowerCase();
    if (normalized === "men") return "All Men's Collection";
    if (normalized === "women") return "All Women's Collection";
    if (normalized === "boys") return "All Boys' Collection";
    if (normalized === "girls") return "All Girls' Collection";

    return `All ${parentCategory} Collection`;
  }, [parentCategory]);

  const pageTitle = useMemo(() => {
    if (imageSearchResults) return t("similarItems");
    if (tab === "new") return t("newIn");
    if (tab === "trending") return t("trendingNow");
    if (tab === "this-week") return t("thisWeek");
    if (tab === "sale") return t("sale");
    if (parentCollectionLabel) return parentCollectionLabel;
    if (q) return `"${q}"`;
    return t("shop");
  }, [imageSearchResults, tab, parentCollectionLabel, q, t]);

  // When wishlist tab is active, use the dedicated wishlist fetch result
  const products = useMemo(() => {
    if (tab === "wishlist") return wishlistProducts;
    return data?.data || [];
  }, [data, tab, wishlistProducts]);

  const change = (next, options = {}) => {
    const { clearImageSearch: shouldClearImageSearch = false, clearAttributeFilters = false } = options;
    let n = new URLSearchParams(qs);
    Object.entries(next).forEach(([k, v]) => {
      if (v === "" || v == null) n.delete(k);
      else n.set(k, String(v));
    });
    if (clearAttributeFilters) {
      n = applyFiltersToSearchParams(n, {
        gender: [],
        section: [],
        category: [],
        brand: [],
        color: [],
        size: [],
      });
      listFilters.clearAll();
      browse.clearBrowseDraft();
    }
    if (shouldClearImageSearch) {
      n.delete("image_search");
      n.delete("colors");
      setImageSearchResults(null);
      setSuggestions([]);
      try {
        sessionStorage.removeItem("image_search_results");
      } catch {
        // ignore storage errors
      }
    }
    n.delete("page");
    nav(`/search?${n.toString()}`);
  };

  const openFilterDrawer = () => {
    listFilters.openDrawer();
    browse.syncBrowseDraftFromUrl();
  };

  const applyDrawerFilters = () => {
    const applied = listFilters.apply();
    let n = applyFiltersToSearchParams(qs, applied);
    n = applyBrowseToSearchParams(n, browse.browseDraft, priceBounds);
    if (applied.gender?.length) n.delete("parent_category");
    n.delete("image_search");
    n.delete("colors");
    setImageSearchResults(null);
    setSuggestions([]);
    nav(`/search?${n.toString()}`);
  };

  const clearAllFilters = () => {
    listFilters.clearAll();
    browse.clearBrowseDraft();
    const n = new URLSearchParams();
    if (q) n.set("q", q);
    if (tab && tab !== "wishlist") n.set("tab", tab);
    nav(`/search?${n.toString()}`);
  };

  const clearDrawerDraft = () => {
    listFilters.clearDraft();
    browse.clearBrowseDraft();
  };

  const totalActiveFilters = countStorefrontFilters(appliedFilters, browse.browseFromUrl, priceBounds);

  const removeFilterValue = (sectionKey, value) => {
    const next = {
      ...appliedFilters,
      [sectionKey]: (appliedFilters[sectionKey] || []).filter((v) => v !== value),
    };
    const n = applyFiltersToSearchParams(qs, next);
    if (next.gender?.length) n.delete("parent_category");
    n.delete("page");
    listFilters.syncFromExternal(next);
    nav(`/search?${n.toString()}`);
  };

  const filterChipLabels = useMemo(
    () =>
      buildStorefrontFilterChips({
        applied: appliedFilters,
        browse: browse.browseFromUrl,
        priceBounds,
        filterSections,
        categories,
        brands,
        removeFilterValue,
        changeBrowseParams: change,
      }),
    [appliedFilters, categories, brands, filterSections, browse.browseFromUrl, priceBounds],
  );

  const handleImageSearch = async ({ image, colors }) => {
    setImageSearchResults({ image, colors });
    setShowImageSearch(false);
    
    // Navigate to search page with image search params
    const encodedColors = encodeURIComponent(JSON.stringify(colors));
    nav(`/search?image_search=1&colors=${encodedColors}`);
  };

  const clearImageSearch = () => {
    setImageSearchResults(null);
    setSuggestions([]);
    try {
      sessionStorage.removeItem("image_search_results");
    } catch {
      // ignore storage errors
    }
    // Remove image search params from URL
    const n = new URLSearchParams(qs);
    n.delete("image_search");
    n.delete("colors");
    nav(`/search?${n.toString()}`, { replace: true });
  };

  const meta = data?.meta || null;
  const lastPage = data?.last_page || meta?.last_page || 1;

  return (
    <div className="container-safe py-6 md:py-8">
      {/* Header: title left, filter right */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">
            {pageTitle}
          </h1>
          {parentCollectionLabel && (
            <p className="fs-filter-chip mt-2 text-xs">
              View All • {parentCollectionLabel}
            </p>
          )}
        </div>
        <StorefrontFilterToolbarButton
          activeCount={totalActiveFilters}
          onClick={openFilterDrawer}
          className="shrink-0"
        />
      </div>

      <StorefrontFilterDrawer
        open={listFilters.open}
        onClose={listFilters.closeDrawer}
        sections={filterSections}
        selected={listFilters.draft}
        onToggle={listFilters.toggleDraft}
        onApply={applyDrawerFilters}
        onClearAll={clearDrawerDraft}
        sortValue={browse.draftSort}
        onSortChange={browse.setDraftSort}
        priceBounds={priceBounds}
        priceMin={browse.draftMinPrice}
        priceMax={browse.draftMaxPrice}
        onPriceMinChange={browse.setDraftMinPrice}
        onPriceMaxChange={browse.setDraftMaxPrice}
      />

      {(q || filterChipLabels.length > 0 || parentCategory || (tab && tab !== "wishlist")) && (
        <div className="mb-6 flex flex-wrap gap-2 items-center text-xs">
          <span className="text-zinc-600 font-medium">{t('activeFilters')}:</span>
          {tab && tab !== "wishlist" && (
            <span className="fs-filter-chip">
              {pageTitle}
              <button type="button" onClick={() => change({ tab: "" })} aria-label="Remove">×</button>
            </span>
          )}
          {q && (
            <span className="fs-filter-chip">
              {q}
              <button type="button" onClick={() => change({ q: '' })} aria-label="Remove">×</button>
            </span>
          )}
          {parentCategory && (
            <span className="fs-filter-chip">
              {parentCollectionLabel}
              <button type="button" onClick={() => change({ parent_category: '' })} aria-label="Remove">×</button>
            </span>
          )}
          {filterChipLabels.map((chip) => (
            <span key={chip.key} className="fs-filter-chip">
              {chip.label}
              {chip.onClear ? (
                <button type="button" onClick={chip.onClear} aria-label="Remove">×</button>
              ) : null}
            </span>
          ))}
          {(totalActiveFilters > 0 || parentCategory) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-zinc-600 underline hover:text-zinc-900"
            >
              {t('resetFilters') || 'Reset'}
            </button>
          )}
        </div>
      )}

      {/* Image Search Results Info */}
      {imageSearchResults && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border border-purple-200 flex-shrink-0">
            <img
              src={imageSearchResults.image}
              alt={t('searchImageAlt')}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-purple-800 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" />
              {t('searchingSimilarItems') || 'Searching Similar Items'}
            </p>
            <p className="text-sm text-purple-700">
              {products.length} {t('productsFoundMatchingImage') || 'products matching your image'}
            </p>
          </div>
          <button
            onClick={() => setShowImageSearch(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-semibold hover:bg-purple-600 transition-colors flex-shrink-0"
          >
            {t('tryDifferent') || 'Try Different'}
          </button>
          <button
            onClick={clearImageSearch}
            className="px-4 py-2 bg-white text-purple-700 rounded-xl text-sm font-semibold border border-purple-300 hover:bg-purple-50 transition-colors flex-shrink-0"
          >
            {t('clear') || 'Clear'}
          </button>
        </div>
      )}

      {/* Products Container */}
      <div className="mt-6">
        {(loading || wishlistLoading) ? (
          /* Loading Skeleton */
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="fs-card overflow-hidden">
                <div className="aspect-[4/5] bg-zinc-100 animate-pulse rounded-lg" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-2/3 bg-zinc-100 animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-zinc-100 animate-pulse rounded" />
                  <div className="h-8 w-20 bg-zinc-100 animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          /* Empty State */
          <div className="fs-card p-12 text-center">
            <div className="space-y-4">
              <div className="text-5xl">🔍</div>
              <p className="text-lg font-semibold text-zinc-900">
                {tab === "wishlist" ? "Your Wishlist is Empty" : (t('noProductsFound') || 'No Products Found')}
              </p>
              <p className="text-sm text-zinc-600">
                {tab === "wishlist"
                  ? "Tap the ♥ heart on any product to save it here."
                  : imageSearchResults
                    ? 'No products match this image. Try uploading a different image.'
                    : 'Try adjusting your search filters to find what you\'re looking for.'}
              </p>
              {tab !== "wishlist" && !imageSearchResults && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-4 px-6 py-2 bg-zinc-900 text-white rounded-full text-sm font-semibold hover:bg-zinc-800 transition-colors"
                >
                  {t('resetFilters') || 'Reset Filters'}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Products Grid - Responsive 2→4→4→4→4→4 */
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {tab !== "wishlist" && !imageSearchResults && meta && lastPage > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
          <button
            disabled={page <= 1}
            onClick={() => nav(`/search?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page - 1) }).toString()}`)}
            className="h-11 px-4 sm:px-6 rounded-full border border-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base font-semibold hover:bg-zinc-50 transition-colors"
          >
            ← {t('prev') || 'Prev'}
          </button>
          <div className="text-sm sm:text-base text-zinc-700 font-medium px-2">
            <span className="font-semibold text-zinc-900">{page}</span> / <span className="font-semibold text-zinc-900">{lastPage}</span>
          </div>
          <button
            disabled={page >= lastPage}
            onClick={() => nav(`/search?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page + 1) }).toString()}`)}
            className="h-11 px-4 sm:px-6 rounded-full border border-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base font-semibold hover:bg-zinc-50 transition-colors"
          >
            {t('next') || 'Next'} →
          </button>
        </div>
      )}
    </div>
  );
}
