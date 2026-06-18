import React, { useEffect, useRef, useState } from "react";

function cn(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** Scrollable mega-menu body with a bottom fade when more content is below. */
export default function MegaMenuScrollArea({ children, className = "" }) {
  const ref = useRef(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const overflow = el.scrollHeight - el.clientHeight;
      setCanScrollDown(overflow > 8 && el.scrollTop < overflow - 8);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={cn("overflow-y-auto pr-2 scrollbar-hide", className)}
      >
        {children}
      </div>
      {canScrollDown ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/80 to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
