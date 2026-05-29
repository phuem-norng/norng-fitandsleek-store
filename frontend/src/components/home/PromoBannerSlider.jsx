import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { filterStorefrontMedia } from "../../lib/catalogContent.js";
import { useCatalogAvailability } from "../../state/catalogAvailability.jsx";

const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url || "");

export default function PromoBannerSlider() {
  const { infrastructureDegraded } = useCatalogAvailability();
  const [index, setIndex] = useState(0);
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/banners/promo");
        setBanners(filterStorefrontMedia(data?.data || []));
      } catch (err) {
        console.warn("[PromoBannerSlider] /banners/promo failed:", err?.response?.status ?? err?.message);
        setBanners([]);
      }
    };
    load();
  }, []);

  if (infrastructureDegraded) return null;

  const slides = useMemo(() => {
    return (banners || []).map((b) => {
      const imageUrl = b.image_url || b.image || b.media_url;
      const videoUrl = b.video_url || (isVideo(imageUrl) ? imageUrl : "");
      const fallbackImage = b.fallback_image || b.poster || b.image_url || "";
      return {
        id: b.id || b.title || Math.random().toString(36).slice(2),
        title: b.title || "Promotion",
        subtitle: b.subtitle || b.description || "",
        link_url: b.link_url || "/search",
        image_url: resolveImageUrl(imageUrl),
        video_url: videoUrl ? resolveImageUrl(videoUrl) : "",
        fallback_image: resolveImageUrl(fallbackImage),
      };
    });
  }, [banners]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;

  const active = slides[index];

  return (
    <section className="container-safe mt-6 max-w-[1600px] mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm ring-1 ring-black/5">
        <div className="relative min-h-[200px] md:min-h-[280px]">
          {active.video_url ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={active.video_url}
              poster={active.fallback_image || active.image_url}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            active.image_url && (
              <img
                src={active.image_url}
                alt={active.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )
          )}
          <div className="relative z-10 p-4 md:p-6 bg-gradient-to-r from-black/45 via-black/20 to-transparent">
            <div className="max-w-xl text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.2em]">Promotion</div>
              <h3 className="mt-2 text-lg md:text-2xl font-black">{active.title}</h3>
              {active.subtitle && <p className="mt-1.5 text-xs md:text-sm text-white/90">{active.subtitle}</p>}
              <Link
                to={active.link_url}
                className="mt-3 inline-flex items-center h-9 px-4 rounded-full bg-white text-zinc-900 text-xs font-semibold shadow-sm"
              >
                Shop now
              </Link>
            </div>
          </div>

          {slides.length > 1 && (
            <>
              <button
                onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm"
                aria-label="Previous"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % slides.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm"
                aria-label="Next"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
