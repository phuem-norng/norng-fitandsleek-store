import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard.jsx";

export default function Section({ title, to, items, loading, showDiscount = false }) {
  const scrollerRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;

    const updateArrows = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanScroll(max > 8);
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft < max - 6);
    };

    updateArrows();
    const id = window.setTimeout(updateArrows, 50);
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);

    return () => {
      window.clearTimeout(id);
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [items, loading]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section className="container-safe mt-8 md:mt-10 lg:mt-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base md:text-lg lg:text-xl 2xl:text-2xl font-bold tracking-tight text-zinc-900">{title}</h2>
        <Link to={to} className="fs-pill !border-0 !bg-transparent text-xs sm:text-sm">
          Shop More
        </Link>
      </div>

      <div className="relative mt-4">
        {canScroll ? (
          <>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              className={`fs-carousel-nav-btn absolute left-2 top-1/2 z-10 -translate-y-1/2 transition-opacity ${canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              aria-label="Scroll products left"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              className={`fs-carousel-nav-btn absolute right-2 top-1/2 z-10 -translate-y-1/2 transition-opacity ${canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              aria-label="Scroll products right"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}

        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto pb-1 scroll-smooth sm:gap-3 md:gap-4 brand-scroll scrollbar-hide"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="fs-card shrink-0 basis-[calc(50%-0.25rem)] overflow-hidden sm:basis-[calc(25%-0.5625rem)] md:basis-[calc(25%-0.75rem)]"
              >
                <div className="aspect-[4/5] bg-zinc-100 animate-pulse" />
                <div className="p-3 sm:p-4">
                  <div className="h-3 w-2/3 bg-zinc-100 animate-pulse rounded" />
                  <div className="mt-2 h-3 w-1/3 bg-zinc-100 animate-pulse rounded" />
                  <div className="mt-3 h-7 w-20 bg-zinc-100 animate-pulse rounded-full" />
                </div>
              </div>
            ))
            : items.map((p) => (
              <div
                key={p.id}
                className="shrink-0 basis-[calc(50%-0.25rem)] sm:basis-[calc(25%-0.5625rem)] md:basis-[calc(25%-0.75rem)]"
              >
                <ProductCard p={p} showDiscount={showDiscount} />
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
