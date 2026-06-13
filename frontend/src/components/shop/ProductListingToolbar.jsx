import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import StorefrontPlpSortMenu from "./StorefrontPlpSortMenu.jsx";

export default function ProductListingToolbar({
  title,
  itemCount = null,
  filterActiveCount = 0,
  onFilterClick,
  brandFacets = [],
  selectedBrandIds = [],
  onBrandToggle,
  sortValue = "recommend",
  onSortChange,
  facetsLoading = false,
  className = "",
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollHints) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro?.disconnect();
    };
  }, [brandFacets, updateScrollHints]);

  const scrollBrands = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 220, behavior: "smooth" });
  };

  const countLabel =
    itemCount == null
      ? ""
      : itemCount === 1
        ? "(1 Item)"
        : `(${Number(itemCount).toLocaleString()} Items)`;

  const showBrandRail = facetsLoading || brandFacets.length > 0;

  return (
    <div className={`fs-plp-toolbar ${className}`} role="toolbar" aria-label="Product listing controls">
      <div className="fs-plp-toolbar__row">
        <h1 className="fs-plp-toolbar__title">
          <span className="fs-plp-toolbar__title-name">{title}</span>
          {countLabel ? <span className="fs-plp-toolbar__title-count">{countLabel}</span> : null}
        </h1>

        {showBrandRail ? (
            <div className="fs-plp-toolbar__brands-wrap">
              {canScrollLeft ? (
                <button
                  type="button"
                  className="fs-carousel-nav-btn absolute left-0 top-1/2 z-10 -translate-y-1/2"
                  onClick={() => scrollBrands(-1)}
                  aria-label="Scroll brands left"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
              ) : null}

              <div ref={scrollRef} className="fs-plp-toolbar__brands brand-scroll scrollbar-hide">
                {facetsLoading && brandFacets.length === 0
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <span key={i} className="fs-plp-toolbar__brand-chip fs-plp-toolbar__brand-chip--skeleton" />
                    ))
                  : brandFacets.map((brand) => {
                      const id = String(brand.id);
                      const active = selectedBrandIds.some((v) => String(v) === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`fs-plp-toolbar__brand-chip${active ? " is-active" : ""}`}
                          aria-pressed={active}
                          onClick={() => onBrandToggle?.(id)}
                        >
                          {brand.name}
                          <span className="fs-plp-toolbar__brand-count">({brand.count})</span>
                        </button>
                      );
                    })}
              </div>

              {canScrollRight ? (
                <button
                  type="button"
                  className="fs-carousel-nav-btn absolute right-0 top-1/2 z-10 -translate-y-1/2"
                  onClick={() => scrollBrands(1)}
                  aria-label="Scroll brands right"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}

        <div className="fs-plp-toolbar__controls">
          <button
            type="button"
            className="fs-plp-toolbar__filter-btn"
            onClick={onFilterClick}
            aria-label="Filter products"
          >
            <Filter className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Filter
            {filterActiveCount > 0 ? (
              <span className="fs-plp-toolbar__filter-badge">{filterActiveCount}</span>
            ) : null}
          </button>
          <StorefrontPlpSortMenu value={sortValue} onChange={onSortChange} />
        </div>
      </div>
    </div>
  );
}
