import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import ProductCard from "../components/shop/ProductCard.jsx";
import StorefrontFilterDrawer from "../components/shop/StorefrontFilterDrawer.jsx";
import ProductListingToolbar from "../components/shop/ProductListingToolbar.jsx";
import { useWishlist } from "../state/wishlist.jsx";
import { useCart } from "../state/cart.jsx";
import { useStorefrontFilterDrawer } from "../hooks/useStorefrontFilterDrawer.js";
import { useStorefrontFilterSections } from "../hooks/useStorefrontFilterSections.js";
import {
  applyBrowseToSearchParams,
  applyFiltersToSearchParams,
  buildProductApiParams,
  buildProductFacetsApiParams,
  browseFromSearchParams,
  countStorefrontFilters,
  filtersFromSearchParams,
  toggleListParamValue,
} from "../lib/storefrontProductFilters.js";
import { useStorefrontBrowseDraft } from "../hooks/useStorefrontBrowseDraft.js";
import { useProductListingFacets } from "../hooks/useProductListingFacets.js";
import { Camera, Image as ImageIcon, Sparkles } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";
import { resolveImageUrl } from "../lib/images";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Shop() {
  const qs = useQuery();
  const nav = useNavigate();
  const wishlist = useWishlist();
  const cart = useCart();
  const { t } = useLanguage();

  const { categories, brands, filterSections, priceBounds } = useStorefrontFilterSections();
  const appliedFilters = useMemo(() => filtersFromSearchParams(qs), [qs]);
  const listFilters = useStorefrontFilterDrawer(appliedFilters);
  const browse = useStorefrontBrowseDraft(qs, appliedFilters, priceBounds);
  const [loading, setLoading] = useState(true);
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

  // Initialize image search from URL params
  useEffect(() => {
    if (imageSearchParam === "1" && colorsParam) {
      try {
        const colors = JSON.parse(decodeURIComponent(colorsParam));
        setImageSearchResults({ colors });
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

  const parentCollectionLabel = useMemo(() => {
    if (!parentCategory) return "";

    const normalized = parentCategory.toLowerCase();
    if (normalized === "men") return "All Men's Collection";
    if (normalized === "women") return "All Women's Collection";
    if (normalized === "boys") return "All Boys' Collection";
    if (normalized === "girls") return "All Girls' Collection";

    return `All ${parentCategory} Collection`;
  }, [parentCategory]);

  useEffect(() => {
    (async () => {
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
  }, [q, parentCategory, tab, page, imageSearchResults, appliedFilters, browse.browseFromUrl]);

  const products = useMemo(() => {
    const list = data?.data || [];
    if (tab === "wishlist") return list.filter((p) => wishlist.has(p.id));
    return list;
  }, [data, tab, wishlist]);

  const change = (next, options = {}) => {
    const { clearImageSearch: shouldClearImageSearch = false } = options;
    const n = new URLSearchParams(qs);
    Object.entries(next).forEach(([k, v]) => {
      if (v === "" || v == null) n.delete(k);
      else n.set(k, String(v));
    });
    if (shouldClearImageSearch) {
      n.delete("image_search");
      n.delete("colors");
      setImageSearchResults(null);
      setSuggestions([]);
    }
    n.delete("page");
    nav(`/shop?${n.toString()}`);
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
    nav(`/shop?${n.toString()}`);
  };

  const clearDrawerDraft = () => {
    listFilters.clearDraft();
    browse.clearBrowseDraft();
  };

  const totalActiveFilters = countStorefrontFilters(appliedFilters, browse.browseFromUrl, priceBounds);

  const handleImageSearch = async ({ image, colors }) => {
    setImageSearchResults({ image, colors });
    setShowImageSearch(false);

    // Navigate to shop page with image search params
    const encodedColors = encodeURIComponent(JSON.stringify(colors));
    nav(`/shop?image_search=1&colors=${encodedColors}`);
  };

  const clearImageSearch = () => {
    setImageSearchResults(null);
    setSuggestions([]);
    // Remove image search params from URL
    const n = new URLSearchParams(qs);
    n.delete("image_search");
    n.delete("colors");
    nav(`/shop?${n.toString()}`, { replace: true });
  };

  const meta = data?.meta || null;
  const lastPage = data?.last_page || meta?.last_page || 1;
  const totalItems = data?.total ?? meta?.total ?? products.length;

  const facetsParams = useMemo(
    () =>
      buildProductFacetsApiParams({
        q,
        tab,
        parentCategory,
        applied: appliedFilters,
        browse: browse.browseFromUrl,
      }),
    [q, tab, parentCategory, appliedFilters, browse.browseFromUrl],
  );

  const { brandFacets, facetsLoading } = useProductListingFacets(
    facetsParams,
    !imageSearchResults,
  );

  const shopToolbarTitle = useMemo(() => {
    if (imageSearchResults) return t("similarItems");
    if (parentCollectionLabel) return parentCollectionLabel;
    return t("shop");
  }, [imageSearchResults, parentCollectionLabel, t]);

  const handleSortChange = (sort) => {
    change({ sort: sort === "recommend" ? "" : sort });
  };

  const handleBrandToggle = (brandId) => {
    const nextBrands = toggleListParamValue(appliedFilters.brand, brandId);
    const next = applyFiltersToSearchParams(qs, { ...appliedFilters, brand: nextBrands });
    if (appliedFilters.gender?.length) next.delete("parent_category");
    listFilters.syncFromExternal({ ...appliedFilters, brand: nextBrands });
    nav(`/shop?${next.toString()}`);
  };

  const clearCollectionChip = () => {
    setImageSearchResults(null);
    setSuggestions([]);
    nav("/shop");
  };

  return (
    <div className={`container-safe py-8 ${cart.count > 0 ? "pb-28 sm:pb-32" : ""}`}>
      {!imageSearchResults ? (
        <ProductListingToolbar
          title={shopToolbarTitle}
          itemCount={totalItems}
          filterActiveCount={totalActiveFilters}
          onFilterClick={openFilterDrawer}
          brandFacets={brandFacets}
          selectedBrandIds={appliedFilters.brand}
          onBrandToggle={handleBrandToggle}
          sortValue={browse.browseFromUrl.sort}
          onSortChange={handleSortChange}
          facetsLoading={facetsLoading}
        />
      ) : (
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight truncate">{t("similarItems")}</h1>
        </div>
      )}

      {parentCollectionLabel && !imageSearchResults ? (
        <div className="mb-4 -mt-2">
          <span className="fs-filter-chip text-xs">
            <span>🧩 {parentCollectionLabel}</span>
            <button
              type="button"
              onClick={clearCollectionChip}
              aria-label="Clear collection"
              title="Clear collection"
            >
              ×
            </button>
          </span>
        </div>
      ) : null}

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

      {/* Image Search Results Info */}
      {imageSearchResults && (
        <div className="mt-4 p-4 bg-purple-50 rounded-2xl flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white">
            <img
              src={resolveImageUrl(imageSearchResults.image)}
              alt={t('searchImageAlt')}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="font-medium text-purple-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {t('searchingSimilarItems')}
            </p>
            <p className="text-sm text-purple-600">
              {products.length} {t('productsFoundMatchingImage')}
            </p>
          </div>
          <button
            onClick={() => setShowImageSearch(true)}
            className="px-3 sm:px-4 py-2 bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-purple-600 transition-colors"
          >
            {t('tryDifferent')}
          </button>
        </div>
      )}

      <div className="mt-6 w-full">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="fs-card overflow-hidden">
                <div className="aspect-[4/5] fs-skeleton-block" />
                <div className="p-3">
                  <div className="h-3 w-2/3 fs-skeleton-block rounded" />
                  <div className="mt-2 h-3 w-1/3 fs-skeleton-block rounded" />
                  <div className="mt-3 h-7 w-20 fs-skeleton-block rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="fs-card p-10 text-center text-sm text-zinc-600">
            {imageSearchResults ? (
              <div className="space-y-4">
                <p>{t('noMatchingProductsForImage')}</p>

                {/* Fallback Suggestions */}
                <div className="mt-8">
                  <p className="font-medium text-zinc-800 mb-4 flex items-center justify-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    {t('noImageTryThese')}
                  </p>
                  {suggestions.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                      {suggestions.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => change({ q: p.name })}
                          className="cursor-pointer group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-zinc-100 mb-2">
                            <img
                              src={resolveImageUrl(p.image_url || p.image)}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-sm text-zinc-500">${p.price}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-400">{t('loadingSuggestions')}</p>
                  )}
                </div>
              </div>
            ) : (
              t('noProductsFound')
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!imageSearchResults && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => nav(`/shop?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page - 1) }).toString()}`)}
            className="h-10 sm:h-12 px-4 sm:px-6 rounded-full border border-zinc-200 disabled:opacity-40 text-sm sm:text-base font-medium"
          >
            {t('prev')}
          </button>
          <div className="text-sm sm:text-base text-zinc-700">
            {t('page')} <span className="font-semibold">{page}</span> / <span className="font-semibold">{lastPage}</span>
          </div>
          <button
            disabled={page >= lastPage}
            onClick={() => nav(`/shop?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page + 1) }).toString()}`)}
            className="h-10 sm:h-12 px-4 sm:px-6 rounded-full border border-zinc-200 disabled:opacity-40 text-sm sm:text-base font-medium"
          >
            {t('next')}
          </button>
        </div>
      )}

      {cart.count > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-50 sm:left-auto sm:right-6 sm:w-[360px]">
          <button
            type="button"
            onClick={() => nav("/cart")}
            className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-white shadow-[0_10px_24px_rgba(245,158,11,0.35)] transition hover:bg-amber-600"
          >
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{cart.count} item{cart.count > 1 ? "s" : ""}</span>
              <span>View Cart</span>
            </div>
            <div className="mt-0.5 text-left text-xs opacity-95">
              Total: ${Number(cart.total || 0).toFixed(2)}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
