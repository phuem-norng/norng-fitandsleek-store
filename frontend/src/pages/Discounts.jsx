import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import ProductCard from "../components/shop/ProductCard.jsx";
import DiscountsPageBanner from "../components/shop/DiscountsPageBanner.jsx";
import DiscountsToolbarMenu from "../components/shop/DiscountsToolbarMenu.jsx";
import { useLanguage } from "../lib/i18n.jsx";

export default function Discounts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const page = Number(searchParams.get("page") || 1);
  const selectedCategory = searchParams.get("category") || searchParams.get("category_id") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const searchQuery = searchParams.get("q") || "";

  const [draftQ, setDraftQ] = useState(searchQuery);
  const [draftMin, setDraftMin] = useState(minPrice);
  const [draftMax, setDraftMax] = useState(maxPrice);

  useEffect(() => {
    setDraftQ(searchQuery);
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
  }, [searchQuery, minPrice, maxPrice]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/categories");
        const categoryData = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setCategories(categoryData);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", String(page));
        params.append("per_page", "12");
        params.append("sort", sortBy);
        if (selectedCategory) params.append("category_id", selectedCategory);
        if (minPrice) params.append("min_price", minPrice);
        if (maxPrice) params.append("max_price", maxPrice);
        if (searchQuery) params.append("q", searchQuery);

        const res = await api.get(`/products/discounts?${params}`);
        const productData = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setProducts(productData);
        setTotalResults(res.data?.total ?? productData.length);
        setTotalPages(res.data?.last_page || 1);
      } catch (error) {
        console.error("Error fetching discounted products:", error);
        setProducts([]);
        setTotalResults(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [page, selectedCategory, sortBy, minPrice, maxPrice, searchQuery]);

  const applySearchParams = useCallback(
    (patch, resetPage = true) => {
      const n = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "" || v == null) n.delete(k);
        else n.set(k, String(v));
      });
      if (resetPage) n.delete("page");
      else if (!n.has("page")) n.set("page", "1");
      n.delete("category_id");
      setSearchParams(n);
    },
    [searchParams, setSearchParams],
  );

  const handleSearch = (e) => {
    e.preventDefault();
    applySearchParams({ q: draftQ.trim() });
  };

  const resetFilters = () => {
    setDraftQ("");
    setSearchParams(new URLSearchParams());
  };

  const goToPage = (nextPage) => {
    const n = new URLSearchParams(searchParams);
    if (nextPage <= 1) n.delete("page");
    else n.set("page", String(nextPage));
    setSearchParams(n);
  };

  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("allCategories") },
      ...categories.map((cat) => ({ value: String(cat.id), label: cat.name })),
    ],
    [categories, t],
  );

  const sortOptions = useMemo(
    () => [
      { value: "newest", label: t("newest") },
      { value: "price_low", label: t("priceLowHigh") },
      { value: "price_high", label: t("priceHighLow") },
      { value: "discount", label: t("bestDiscount") },
    ],
    [t],
  );

  const resultsLabel =
    totalResults === 1
      ? t("showingOneResult") || "Showing 1 result"
      : (t("showingAllResults") || "Showing all {count} results").replace(
          "{count}",
          String(totalResults),
        );

  return (
    <div className="fs-discounts-page container-safe">
      <header className="fs-discounts-page__header">
        <h1 className="fs-discounts-page__title">{t("discounts")}</h1>
        <p className="fs-discounts-page__meta">{resultsLabel}</p>
      </header>

      <div className="fs-discounts-page__banner">
        <DiscountsPageBanner />
      </div>

      <div className="fs-discounts-toolbar" role="toolbar" aria-label="Discount filters">
        <form
          onSubmit={handleSearch}
          className="fs-discounts-toolbar__field fs-discounts-toolbar__field--search"
        >
          <input
            type="search"
            placeholder={t("searchDiscountsPlaceholder")}
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            className="fs-discounts-toolbar__control"
          />
        </form>

        <DiscountsToolbarMenu
          value={selectedCategory}
          onChange={(v) => applySearchParams({ category: v })}
          ariaLabel={t("allCategories")}
          options={categoryOptions}
        />

        <DiscountsToolbarMenu
          value={sortBy}
          onChange={(v) => applySearchParams({ sort: v })}
          ariaLabel="Sort"
          options={sortOptions}
        />

        <div className="fs-discounts-toolbar__field fs-discounts-toolbar__field--price">
          <input
            type="number"
            placeholder={t("min")}
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
            onBlur={() => applySearchParams({ min_price: draftMin.trim() })}
            className="fs-discounts-toolbar__price-input"
            min={0}
            aria-label={t("min")}
          />
          <input
            type="number"
            placeholder={t("max")}
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            onBlur={() => applySearchParams({ max_price: draftMax.trim() })}
            className="fs-discounts-toolbar__price-input"
            min={0}
            aria-label={t("max")}
          />
        </div>

        <button type="button" onClick={resetFilters} className="fs-discounts-toolbar__reset">
          {t("reset")}
        </button>
      </div>

      <div className="fs-discounts-page__products">
        {loading ? (
          <div className="fs-discounts-page__grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="fs-card overflow-hidden">
                <div className="aspect-[4/5] animate-pulse rounded-lg bg-zinc-100" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="fs-card fs-discounts-page__empty">
            <div className="space-y-4">
              <div className="text-5xl">🏷️</div>
              <p className="fs-discounts-page__empty-title">{t("noDiscountsFound")}</p>
              <p className="fs-discounts-page__empty-desc">{t("noDiscountsDesc")}</p>
              <button
                type="button"
                onClick={() => navigate("/shop")}
                className="fs-discounts-page__cta"
              >
                {t("browseAllProducts")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="fs-discounts-page__grid">
              {products.map((product) => (
                <ProductCard key={product.id} p={product} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="fs-discounts-page__pagination" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="fs-discounts-page__page-btn"
                >
                  ← {t("prev")}
                </button>
                <span className="fs-discounts-page__page-meta">
                  <span className="font-semibold">{page}</span> /{" "}
                  <span className="font-semibold">{totalPages}</span>
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="fs-discounts-page__page-btn"
                >
                  {t("next")} →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
