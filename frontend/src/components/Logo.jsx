import React from "react";
import { resolveImageUrl } from "../lib/images";

/** Same-origin path so the logo still loads when the API host is down. */
function siteStaticLogoPath() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/logo.png`;
  }
  return "/logo.png";
}

export default function Logo({ className = "h-12 w-auto", src = "/logo.png", alt = "Fitandsleek" }) {
  const fallbackSrc = siteStaticLogoPath();
  const resolvedSrc = src ? resolveImageUrl(src) : siteStaticLogoPath();

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`${className} object-contain`}
      onError={(e) => {
        if (e.currentTarget.src !== fallbackSrc) {
          e.currentTarget.src = fallbackSrc;
        }
      }}
    />
  );
}
