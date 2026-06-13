import React, { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveImageUrl } from "../../lib/images";
import { useWishlist } from "../../state/wishlist";
import {
  hasStorefrontAdminDiscount,
  hasStorefrontLotDiscount,
  resolveStorefrontPriceDisplay,
} from "../../lib/storefrontLotPrice.js";

function Money({ value }) {
  const n = Number(value || 0);
  return <span>${n.toFixed(2)}</span>;
}

/** Primary image URL for card thumbnail (first gallery / image_url). */
function primaryImageUrl(product) {
  const urls = [];
  const push = (u) => {
    if (u && typeof u === "string" && !urls.includes(u)) urls.push(u);
  };
  if (product?.image_url) push(product.image_url);
  const g = product?.gallery;
  if (Array.isArray(g)) {
    g.forEach((img) => push(typeof img === "string" ? img : img?.url || img?.src));
  } else if (typeof g === "string" && g.trim()) {
    g.split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(push);
  }
  return urls[0] ?? null;
}

export default function ProductCard({ p }) {
  const [imgOk, setImgOk] = useState(true);
  const wishlist = useWishlist();

  const rawUrl = useMemo(() => primaryImageUrl(p), [p]);
  const src = imgOk && rawUrl ? resolveImageUrl(rawUrl) : "/placeholder.svg";

  useEffect(() => {
    setImgOk(true);
  }, [p?.id]);

  const discountPrice =
    p.discount_price ??
    p.discount?.sale_price ??
    p.active_discount?.sale_price ??
    p.activeDiscount?.sale_price ??
    null;
  const discountPercentage =
    p.discount_percentage ??
    p.discount?.discount_percentage ??
    (p.discount?.type === "percentage" ? Number(p.discount?.value || 0) : null);
  const priceDisplay = resolveStorefrontPriceDisplay(p);
  const { sale: displayPrice, compare: discountCompare, pctLabel } = priceDisplay;

  const hasDiscount =
    hasStorefrontAdminDiscount(p) ||
    hasStorefrontLotDiscount(p) ||
    Boolean(p.has_discount) ||
    (discountPrice !== null && Number(discountPrice) > 0 && Number(discountPrice) < Number(p.price || 0));

  const badge = hasDiscount
    ? discountPercentage && Number(discountPercentage) > 0
      ? `Discount ${Math.round(Number(discountPercentage))}%`
      : pctLabel
        ? `Discount ${pctLabel.replace(/^-/, "")}`
        : "Discount"
    : p.old_price
      ? "SALE"
      : null;
  const originalPrice = discountCompare ?? (hasDiscount ? null : p.old_price ?? null);
  const saleBadge = badge;

  return (
    <div className="fs-card group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995]">
      <div className="relative overflow-hidden bg-zinc-50">
        <Link to={`/p/${p.slug}`} className="block aspect-[4/5] overflow-hidden">
          <img
            src={src}
            alt={p.name}
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <button
          type="button"
          onClick={() => wishlist.toggle(p.id)}
          className={
            `absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border sm:h-9 sm:w-9 ` +
            (wishlist.has(p.id)
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white/95") +
            " pointer-events-none translate-y-1 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
          }
          aria-label="Wishlist"
          title="Wishlist"
        >
          <Heart
            className="h-4 w-4 sm:h-5 sm:w-5"
            strokeWidth={1.5}
            fill={wishlist.has(p.id) ? "currentColor" : "none"}
          />
        </button>

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {saleBadge && (
            <div className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold leading-tight text-white shadow-sm whitespace-nowrap">
              {saleBadge}
            </div>
          )}

          {hasDiscount && (p.discount?.end_date || p.active_discount?.end_date || p.activeDiscount?.end_date) && (
            <div className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold leading-tight text-white shadow-sm whitespace-nowrap">
              Limited Time
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto p-3 sm:p-4">
        <div className="flex items-center gap-2">
          {originalPrice && (
            <div className="text-xs text-zinc-500 line-through">
              <Money value={originalPrice} />
            </div>
          )}
          <div className={`text-sm font-black ${originalPrice ? "text-rose-600" : "text-slate-900"}`}>
            <Money value={displayPrice} />
          </div>
        </div>

        <Link
          to={`/p/${p.slug}`}
          className="mt-1.5 line-clamp-2 text-sm font-semibold text-zinc-900 hover:text-[#F2A65A]"
        >
          {p.name}
        </Link>

        <div className="mt-2 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-zinc-900" />
          <span className="h-2 w-2 rounded-full bg-zinc-400" />
          <span className="h-2 w-2 rounded-full bg-zinc-200" />
        </div>
      </div>
    </div>
  );
}
