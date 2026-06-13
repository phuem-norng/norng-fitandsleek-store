import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";

export default function DiscountsPageBanner() {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/banners/discounts");
        const items = data?.data || [];
        if (!cancelled && items.length) setBanner(items[0]);
      } catch {
        if (!cancelled) setBanner(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const imageUrl = banner?.image_url ? resolveImageUrl(banner.image_url) : "";
  const title = banner?.title?.trim() || "FLASH SALE";
  const subtitle = banner?.subtitle?.trim() || "";
  const linkUrl = banner?.link_url?.trim() || "";

  const inner = (
    <div className="fs-discounts-banner relative min-h-[140px] overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-r from-[#7c1d6f] via-[#9b2d8a] to-[#c43fad] shadow-sm md:min-h-[200px]">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div
        className={`relative z-10 flex h-full min-h-[140px] flex-col justify-center px-6 py-8 md:min-h-[200px] md:px-10 ${
          imageUrl ? "bg-gradient-to-r from-black/55 via-black/35 to-transparent" : ""
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/90">Promotion</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-lg text-sm text-white/90 md:text-base">{subtitle}</p> : null}
      </div>
    </div>
  );

  if (linkUrl) {
    return (
      <section>
        <Link to={linkUrl} className="block transition hover:opacity-[0.98]">
          {inner}
        </Link>
      </section>
    );
  }

  return <section>{inner}</section>;
}
