import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";

/** Same default as Header `background_color` — muted sage (not emerald). */
const DEFAULT_HEADER_SAGE = "#6e8b7e";

function normalizeHex(color) {
  if (!color || typeof color !== "string") return DEFAULT_HEADER_SAGE;
  let h = color.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return DEFAULT_HEADER_SAGE;
  return h.toUpperCase();
}

function hexToRgb(hex) {
  const h = normalizeHex(hex);
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixTowardBlack(hex, t) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - t;
  return rgbToHex(r * f, g * f, b * f);
}

function heroBrandFallbackGradient(headerColor) {
  const base = normalizeHex(headerColor);
  const mid = mixTowardBlack(base, 0.16);
  const deep = mixTowardBlack(base, 0.38);
  return `linear-gradient(to bottom right, ${base} 0%, ${mid} 46%, ${deep} 100%)`;
}

// High-End Animation Variants (3 Styles for Random Selection)
const imageVariants = {
  // Style 1: Fade-In (Elegant and Simple)
  fadeInEnter: {
    opacity: 0,
  },
  fadeInCenter: {
    opacity: 1,
    transition: {
      duration: 1.0,
      ease: [0.43, 0.13, 0.23, 0.96],
    },
  },
  fadeInExit: {
    opacity: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
  
  // Style 2: Zoom-In / Ken Burns Effect (Cinematic)
  zoomInEnter: {
    scale: 1.2,
    opacity: 0,
  },
  zoomInCenter: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 1.3,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  zoomInExit: {
    scale: 0.95,
    opacity: 0,
    transition: {
      duration: 0.8,
      ease: "easeOut",
    },
  },
  
  // Style 3: Slide-from-Right (Dynamic)
  slideFromRightEnter: {
    x: "100%",
    opacity: 0,
  },
  slideFromRightCenter: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 50,
      damping: 22,
      mass: 1,
    },
  },
  slideFromRightExit: {
    x: "-30%",
    opacity: 0,
    transition: {
      duration: 0.6,
      ease: "easeIn",
    },
  },
};

export default function Hero() {
  const { settings } = useHomepageSettings();
  const [i, setI] = useState(0);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animationStyle, setAnimationStyle] = useState("fadeIn");
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Array of 3 high-end animation styles for random selection
  const animationStyles = ["fadeIn", "zoomIn", "slideFromRight"];

  // Get random animation style (not sequential - truly random)
  const getRandomAnimationStyle = () => {
    const randomIndex = Math.floor(Math.random() * animationStyles.length);
    return animationStyles[randomIndex];
  };

  useEffect(() => {
    const placeholder = () => {
      const headerColor = settings?.header?.background_color || DEFAULT_HEADER_SAGE;
      return [
        {
          id: "placeholder-welcome",
          image_url: "",
          gradient_background: heroBrandFallbackGradient(headerColor),
        },
      ];
    };

    const fetchBanners = async () => {
      try {
        const { data } = await api.get("/banners/hero");
        const items = data?.data || [];
        if (items.length > 0) {
          setBanners(items);
        } else {
          setBanners(placeholder());
        }
      } catch (error) {
        console.warn("[Hero] /banners/hero failed:", error?.response?.status ?? error?.message);
        setBanners(placeholder());
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [settings?.header?.background_color]);

  const slides = useMemo(() => {
    return banners.map((b) => ({
      id: b.id,
      image: b.image_url ? resolveImageUrl(b.image_url) : null,
      bg: b.bg || "from-zinc-700 via-zinc-600 to-zinc-900",
      gradient_background: b.gradient_background || null,
    }));
  }, [banners]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      setAnimationStyle(getRandomAnimationStyle());
      setI((x) => (x + 1) % slides.length);
    }, 5000); // 5-second auto-play
    return () => clearInterval(t);
  }, [slides.length]);

  if (loading) {
    return (
      <section className="container-safe pt-4 md:pt-6 max-w-[1600px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-zinc-200 bg-zinc-100 animate-pulse aspect-video md:aspect-auto md:min-h-[400px] lg:min-h-[560px]" />
      </section>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  const active = slides[i];

  // Touch/Swipe handlers
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setAnimationStyle(getRandomAnimationStyle());
      setI((x) => (x + 1) % slides.length);
    }
    if (isRightSwipe) {
      setAnimationStyle(getRandomAnimationStyle());
      setI((x) => (x - 1 + slides.length) % slides.length);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // Handle dot click
  const handleDotClick = (index) => {
    if (index !== i) {
      setAnimationStyle(getRandomAnimationStyle());
      setI(index);
    }
  };

  /** Desktop: click empty hero area to go to next slide (same as swipe). Skips links and dot buttons. */
  const handleHeroBackgroundClick = (e) => {
    if (slides.length <= 1) return;
    if (e.target.closest("a, button")) return;
    setAnimationStyle(getRandomAnimationStyle());
    setI((x) => (x + 1) % slides.length);
  };

  return (
    <section className="container-safe pt-4 max-w-[1600px] mx-auto">
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
        <div
          className={
            "relative aspect-video md:aspect-auto md:min-h-[400px] lg:min-h-[560px] overflow-hidden " +
            (slides.length > 1 ? "cursor-pointer md:cursor-grab md:active:cursor-grabbing" : "cursor-default")
          }
          onClick={handleHeroBackgroundClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Animated Banner Images */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`banner-${i}-${animationStyle}`}
              initial={`${animationStyle}Enter`}
              animate={`${animationStyle}Center`}
              exit={`${animationStyle}Exit`}
              variants={imageVariants}
              className="absolute inset-0"
            >
              {active.image && (
                <img
                  src={active.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              )}
              {!active.image && (
                <div
                  className={
                    active.gradient_background
                      ? "absolute inset-0"
                      : `absolute inset-0 bg-gradient-to-br ${active.bg || "from-zinc-700 via-zinc-600 to-zinc-900"}`
                  }
                  style={
                    active.gradient_background
                      ? { background: active.gradient_background }
                      : undefined
                  }
                  aria-hidden
                />
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            </motion.div>
          </AnimatePresence>

          {/* Elegant Progress Dots */}
          {slides.length > 1 && (
            <div className="absolute bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 md:gap-2">
              {slides.map((_, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleDotClick(idx)}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.85 }}
                  className="relative group"
                  aria-label={`Go to slide ${idx + 1}`}
                >
                  {/* Dot background */}
                  <span 
                    className={`block rounded-full transition-all duration-500 ${
                      idx === i
                        ? "w-8 md:w-10 h-1.5 md:h-2 bg-white shadow-lg"
                        : "w-1.5 md:w-2 h-1.5 md:h-2 bg-white/40 group-hover:bg-white/70"
                    }`}
                  />
                  
                  {/* Active progress bar */}
                  {idx === i && (
                    <motion.span
                      className="absolute inset-0 bg-white/50 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 5, ease: "linear" }}
                      style={{ transformOrigin: "left" }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
