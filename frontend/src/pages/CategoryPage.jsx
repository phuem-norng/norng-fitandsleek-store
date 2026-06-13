import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import ProductCard from "../components/shop/ProductCard.jsx";
import ProductListingToolbar from "../components/shop/ProductListingToolbar.jsx";
import StorefrontFilterDrawer from "../components/shop/StorefrontFilterDrawer.jsx";
import { useStorefrontFilterDrawer } from "../hooks/useStorefrontFilterDrawer.js";
import { useStorefrontFilterSections } from "../hooks/useStorefrontFilterSections.js";
import { useStorefrontBrowseDraft } from "../hooks/useStorefrontBrowseDraft.js";
import { useProductListingFacets } from "../hooks/useProductListingFacets.js";
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

export default function CategoryPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const safeSlug = useMemo(() => String(slug || "").trim(), [slug]);
  const appliedFilters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const browseFromUrl = useMemo(() => browseFromSearchParams(searchParams), [searchParams]);

  const { filterSections, priceBounds } = useStorefrontFilterSections();
  const listFilters = useStorefrontFilterDrawer(appliedFilters);
  const browse = useStorefrontBrowseDraft(searchParams, appliedFilters, priceBounds);

  const [products, setProducts] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(null);
  const [totalPages, setTotalPages] = useState(1);

  const page = Number(searchParams.get("page") || 1);

  const facetsParams = useMemo(
    () =>
      buildProductFacetsApiParams({
        categorySlug: safeSlug,
        applied: appliedFilters,
        browse: browseFromUrl,
      }),
    [safeSlug, appliedFilters, browseFromUrl],
  );

  const { brandFacets, facetsLoading } = useProductListingFacets(facetsParams, Boolean(safeSlug));

  useEffect(() => {
    listFilters.syncFromExternal(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    if (page !== 1) {
      const next = new URLSearchParams(searchParams);
      next.delete("page");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset pagination when category slug changes
  }, [safeSlug]);

  useEffect(() => {
    const fetchCategoryProducts = async () => {
      if (!safeSlug) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const params = buildProductApiParams({
          page,
          categorySlug: safeSlug,
          applied: appliedFilters,
          browse: browseFromUrl,
        });
        const { data } = await api.get("/products", { params });

        const productList = data?.data || [];
        setProducts(productList);
        setTotalPages(data?.last_page || 1);
        setTotalItems(data?.total ?? productList.length);

        if (productList.length > 0) {
          setCategoryName(productList[0]?.category?.name || safeSlug);
        } else {
          setCategoryName(safeSlug.replace(/[-_]+/g, " "));
        }
      } catch {
        setProducts([]);
        setTotalPages(1);
        setTotalItems(0);
        setCategoryName(safeSlug.replace(/[-_]+/g, " "));
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryProducts();
  }, [safeSlug, page, appliedFilters, browseFromUrl]);

  const pushParams = (mutator) => {
    const next = new URLSearchParams(searchParams);
    mutator(next);
    next.delete("page");
    setSearchParams(next);
  };

  const openFilterDrawer = () => {
    listFilters.openDrawer();
    browse.syncBrowseDraftFromUrl();
  };

  const applyDrawerFilters = () => {
    const applied = listFilters.apply();
    let next = applyFiltersToSearchParams(searchParams, applied);
    next = applyBrowseToSearchParams(next, browse.browseDraft, priceBounds);
    setSearchParams(next);
  };

  const clearDrawerDraft = () => {
    listFilters.clearDraft();
    browse.clearBrowseDraft();
  };

  const handleSortChange = (sort) => {
    pushParams((next) => {
      if (sort && sort !== "recommend") next.set("sort", sort);
      else next.delete("sort");
    });
  };

  const handleBrandToggle = (brandId) => {
    const nextBrands = toggleListParamValue(appliedFilters.brand, brandId);
    const applied = { ...appliedFilters, brand: nextBrands };
    const next = applyFiltersToSearchParams(searchParams, applied);
    setSearchParams(next);
  };

  const setPageParam = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(newPage));
    setSearchParams(next);
  };

  const totalActiveFilters = countStorefrontFilters(appliedFilters, browseFromUrl, priceBounds);
  const displayTitle = categoryName || safeSlug.replace(/[-_]+/g, " ");

  return (
    <div className="container-safe py-6 md:py-8">
      <ProductListingToolbar
        title={displayTitle}
        itemCount={totalItems}
        filterActiveCount={totalActiveFilters}
        onFilterClick={openFilterDrawer}
        brandFacets={brandFacets}
        selectedBrandIds={appliedFilters.brand}
        onBrandToggle={handleBrandToggle}
        sortValue={browseFromUrl.sort}
        onSortChange={handleSortChange}
        facetsLoading={facetsLoading}
      />

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

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="fs-card overflow-hidden">
              <div className="aspect-[4/5] bg-zinc-100 animate-pulse" />
              <div className="p-3 sm:p-4">
                <div className="h-3 w-2/3 bg-zinc-100 animate-pulse rounded" />
                <div className="mt-2 h-3 w-1/3 bg-zinc-100 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600">
          No products found for this category.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} p={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPageParam(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-zinc-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPageParam(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
