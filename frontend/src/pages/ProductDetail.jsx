
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { resolveImageUrl } from "../lib/images";
import { PRODUCT_GALLERY_ASPECT_CLASS, PRODUCT_GALLERY_THUMB_CLASS } from "../lib/productImages";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  Zap,
  Phone,
  CreditCard,
  X,
  Package,
  RotateCcw,
} from "lucide-react";
import Swal from "sweetalert2";
import { useCart } from "../state/cart";
import { useWishlist } from "../state/wishlist";
import ProductCard from "../components/shop/ProductCard.jsx";
import { useLanguage } from "../lib/i18n.jsx";
import { clientVariantMaxQty, matrixQtyForCombo, parseVariantMatrix } from "../lib/variantMatrix.js";

function Money({ value }) {
  const n = Number(value || 0);
  return <span>US ${n.toFixed(2)}</span>;
}

const NAMED_COLOR_HEX = {
  black: "#171717",
  white: "#fafafa",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#ea580c",
  purple: "#9333ea",
  pink: "#ec4899",
  gray: "#6b7280",
  grey: "#6b7280",
  brown: "#78350f",
  navy: "#1e3a8a",
  beige: "#d6c8b4",
  gold: "#ca8a04",
  silver: "#94a3b8",
  coconut: "#f5f0e8",
  "coconut milk": "#f5f0e8",
  metallic: "#a8a29e",
  "metallic silver": "#9ca3af",
  khaki: "#854d0e",
  cream: "#faf5eb",
  maroon: "#7f1d1d",
  teal: "#0d9488",
  mint: "#99f6e4",
  coral: "#fb7185",
  lavender: "#c4b5fd",
  charcoal: "#374151",
};

function colorSwatchFill(name) {
  if (!name || typeof name !== "string") return null;
  const key = name.toLowerCase().trim();
  if (NAMED_COLOR_HEX[key]) return NAMED_COLOR_HEX[key];
  const first = key.split(/\s+/)[0];
  return NAMED_COLOR_HEX[first] || null;
}

function ProductBodyText({ text }) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.includes("<")) {
    return (
      <div
        className="text-sm leading-relaxed text-zinc-600 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-zinc-900 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">{trimmed}</p>;
}

function AccordionRow({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-zinc-200 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="fs-product-accordion__trigger flex w-full items-center justify-between gap-3 bg-zinc-100 px-4 py-3 text-left text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200/80"
      >
        <span>{title}</span>
        <ChevronRight className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? <div className="border-t border-zinc-200 bg-white px-4 py-3">{children}</div> : null}
    </div>
  );
}

// Service Badge — compact row (reference storefront style)
function ServiceBadge({ icon, title, description }) {
  return (
    <div className="flex flex-1 min-w-0 items-start gap-2 border border-zinc-200 bg-white px-3 py-2.5">
      <div className="mt-0.5 shrink-0 text-zinc-700">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-zinc-900">{title}</div>
        <div className="text-[11px] leading-snug text-zinc-600">{description}</div>
      </div>
    </div>
  );
}

/** @returns {{ name: string, image_url: string | null }[]} */
function parseColorVariants(colorsData) {
  if (!colorsData) return [];
  const raw = Array.isArray(colorsData)
    ? colorsData
    : typeof colorsData === "string"
      ? colorsData.split(",").map((c) => c.trim()).filter(Boolean)
      : [];
  const out = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) out.push({ name, image_url: null });
      continue;
    }
    if (item && typeof item === "object") {
      const name = String(item.name ?? item.label ?? "").trim();
      if (!name) continue;
      const imgRaw = item.image_url ?? item.imageUrl ?? null;
      const image_url =
        typeof imgRaw === "string" && imgRaw.trim() ? imgRaw.trim() : null;
      out.push({ name, image_url });
    }
  }
  return out;
}

// Helper to parse sizes array
function parseSizes(sizesData) {
  if (!sizesData) return [];
  if (Array.isArray(sizesData)) return sizesData;
  if (typeof sizesData === 'string') return sizesData.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// Helper to parse payment methods array
function parsePaymentMethods(paymentData) {
  if (!paymentData) return [];
  if (Array.isArray(paymentData)) return paymentData;
  if (typeof paymentData === 'string') return paymentData.split(',').map(p => p.trim()).filter(Boolean);
  return [];
}

export default function ProductDetail() {
  const { slug } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const cart = useCart();
  const wishlist = useWishlist();
  const { t } = useLanguage();

  // All state hooks at the top - always called in same order
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [similarProducts, setSimilarProducts] = useState([]);
  const mainImageRef = useRef(null);
  const [hoverZoom, setHoverZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [stockError, setStockError] = useState("");
  const [modalZoom, setModalZoom] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const [zoomPanning, setZoomPanning] = useState(false);
  const zoomViewportRef = useRef(null);
  const zoomPanDragRef = useRef(null);
  const modalZoomRef = useRef(1);
  const [detailAcc, setDetailAcc] = useState({ model: false, details: false });

  // useEffect hook
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/products/${slug}`);
        setP(data);
        setActiveImage(0);

        // Set default selections after data is loaded (matrix inventory takes precedence)
        const vm = parseVariantMatrix(data.variant_matrix);
        if (vm.length > 0) {
          const inStock = vm.filter((r) => r.qty > 0);
          const pick = inStock[0] || vm[0];
          setSelectedColor(pick.color);
          setSelectedSize(pick.size);
        } else {
          if (data && data.colors) {
            const cv = parseColorVariants(data.colors);
            if (cv.length > 0) {
              setSelectedColor(cv[0].name);
            }
          }

          if (data && data.sizes) {
            const sz = parseSizes(data.sizes);
            if (sz.length > 0) {
              setSelectedSize(sz[0]);
            }
          }
        }

        // Load similar products
        if (data && data.category_id) {
          const { data: similar } = await api.get("/products", {
            params: { category_id: data.category_id, limit: 4 }
          });
          const filtered = (similar?.data || []).filter(item => item.id !== data.id).slice(0, 4);
          setSimilarProducts(filtered);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // All useMemo hooks - always called in same order
  const colorVariants = useMemo(() => parseColorVariants(p?.colors), [p?.colors]);

  const images = useMemo(() => {
    if (!p) return ["/placeholder.svg"];
    const gallery = [];
    if (p.image_url) gallery.push(p.image_url);
    if (p.gallery && Array.isArray(p.gallery)) {
      p.gallery.forEach((img) => {
        if (img && !gallery.includes(img)) gallery.push(img);
      });
    }
    for (const cv of colorVariants) {
      if (cv.image_url && !gallery.includes(cv.image_url)) gallery.push(cv.image_url);
    }
    return gallery.length > 0 ? gallery : ["/placeholder.svg"];
  }, [p, colorVariants]);
  const sizes = useMemo(() => parseSizes(p?.sizes), [p?.sizes]);
  const variantMatrix = useMemo(() => parseVariantMatrix(p?.variant_matrix), [p?.variant_matrix]);
  const usesVariantMatrix = variantMatrix.length > 0;
  const displaySizes = useMemo(() => {
    if (!usesVariantMatrix) return sizes;
    const sel = String(selectedColor || "").trim().toLowerCase();
    const ordered = [];
    const seen = new Set();
    for (const r of variantMatrix) {
      if (sel && r.color.toLowerCase() !== sel) continue;
      if (seen.has(r.size)) continue;
      seen.add(r.size);
      ordered.push(r.size);
    }
    return ordered;
  }, [usesVariantMatrix, variantMatrix, sizes, selectedColor]);
  const paymentMethods = useMemo(() => parsePaymentMethods(p?.payment_methods), [p?.payment_methods]);

  const pricing = useMemo(() => {
    if (!p) {
      return { sale: 0, compare: null, pctLabel: null };
    }
    const activeDisc = p.active_discount ?? p.activeDiscount;
    const sale = Number(p.discount?.sale_price ?? activeDisc?.sale_price ?? p.price ?? 0);
    const onSale = Boolean(p.discount || activeDisc);
    const compareRaw = onSale
      ? Number(p.discount?.original_price ?? p.price ?? 0)
      : p.compare_at_price != null
        ? Number(p.compare_at_price)
        : null;
    const compare = compareRaw != null && compareRaw > sale ? compareRaw : null;

    let pctLabel = null;
    if (onSale) {
      const isPct = p.discount?.type === "percentage" || activeDisc?.discount_type === "percentage";
      if (isPct) {
        const v = Math.round(Number(p.discount?.value ?? activeDisc?.discount_value ?? 0));
        if (v > 0) pctLabel = `-${v}%`;
      } else if (typeof p.discount?.discount_percentage === "number" && p.discount.discount_percentage > 0) {
        pctLabel = `-${Math.round(p.discount.discount_percentage)}%`;
      } else if (compare != null && compare > sale) {
        pctLabel = `-${Math.round(((compare - sale) / compare) * 100)}%`;
      }
    }

    return { sale, compare, pctLabel };
  }, [p]);

  useEffect(() => {
    if (!p || !usesVariantMatrix || !selectedColor) return;
    const matchQty = variantMatrix.filter(
      (r) => r.color.toLowerCase() === String(selectedColor).toLowerCase() && r.qty > 0
    );
    if (matchQty.length === 0) return;
    const ok = matchQty.some((r) => r.size.toLowerCase() === String(selectedSize).toLowerCase());
    if (!ok) setSelectedSize(matchQty[0].size);
  }, [p, usesVariantMatrix, variantMatrix, selectedColor, selectedSize]);

  const deliveryInfo = p?.delivery_info || t('deliveryFromToDays');
  const supportPhone = p?.support_phone || "+855 12 345 678";
  const maxQty = useMemo(
    () => clientVariantMaxQty(p, selectedColor, selectedSize),
    [p, selectedColor, selectedSize]
  );
  const backToImageSearch = Boolean(location.state?.fromImageSearch);
  const backTarget = location.state?.backTo || "/image-search";
  const fromOrder = Boolean(location.state?.fromOrder);
  const orderItem = location.state?.orderItem || null;

  const swalBase = {
    confirmButtonColor: "#497869",
    customClass: {
      popup: "font-sans",
      title: "font-sans",
      htmlContainer: "font-sans",
      confirmButton: "font-sans",
    },
  };

  const extractStockCount = (message, fallbackStock = 0) => {
    const text = String(message || "");
    const matches = text.match(/\d+/g);
    if (matches && matches.length > 0) {
      const lastNumber = Number(matches[matches.length - 1]);
      if (Number.isFinite(lastNumber)) return lastNumber;
    }
    return Number.isFinite(Number(fallbackStock)) ? Math.max(0, Number(fallbackStock)) : 0;
  };

  const showStockLimitAlert = async ({ stock, requestedQuantity }) => {
    const safeStock = Number.isFinite(Number(stock)) ? Math.max(0, Number(stock)) : 0;
    const safeRequested = Number.isFinite(Number(requestedQuantity)) ? Math.max(1, Number(requestedQuantity)) : 1;

    if (safeStock === 0) {
      await Swal.fire({
        icon: "error",
        text: "សោកស្តាយ! ទំនិញនេះអស់ពីស្តុកហើយ (Out of Stock)",
        ...swalBase,
      });
      return;
    }

    if (safeRequested > safeStock) {
      await Swal.fire({
        icon: "warning",
        text: `ស្តុកមានកំណត់! យើងមានសល់ត្រឹមតែ ${safeStock} ប៉ុណ្ណោះ (Only ${safeStock} left in stock)`,
        ...swalBase,
      });
      return;
    }

    await Swal.fire({
      icon: "warning",
      text: `ស្តុកមានកំណត់! យើងមានសល់ត្រឹមតែ ${safeStock} ប៉ុណ្ណោះ (Only ${safeStock} left in stock)`,
      ...swalBase,
    });
  };

  const add = async () => {
    setStockError("");
    if (maxQty <= 0) {
      await showStockLimitAlert({ stock: 0, requestedQuantity: qty });
      return;
    }
    if (qty > maxQty) {
      await showStockLimitAlert({ stock: maxQty, requestedQuantity: qty });
      return;
    }
    if (colorVariants.length > 0 && !selectedColor) {
      await Swal.fire({
        icon: "info",
        text: t('selectColorFirst') || "Please select a color",
        ...swalBase,
      });
      return;
    }
    if (displaySizes.length > 0 && !selectedSize) {
      await Swal.fire({
        icon: "info",
        text: t('selectSizeFirst') || "Please select a size",
        ...swalBase,
      });
      return;
    }
    try {
      await cart.add(p, qty, selectedSize || null, selectedColor || null);
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("STOCK_LIMIT")) {
        setStockError("Stock limit reached for this product.");
        await showStockLimitAlert({ stock: extractStockCount(msg, Number(p?.stock || 0)), requestedQuantity: qty });
        return;
      }
      if (msg.includes("LOGIN_REQUIRED")) {
        window.location.href = "/login";
        return;
      }
      await Swal.fire({
        icon: "error",
        text: msg || t('addToCartFailed') || "Failed to add to cart",
        ...swalBase,
      });
    }
  };

  const reorderAsBefore = async () => {
    if (!orderItem) return;
    setStockError("");
    try {
      const reorderQty = orderItem.quantity || 1;
      const currentStock = Number.isFinite(Number(p?.stock)) ? Number(p.stock) : null;
      if (currentStock !== null && currentStock <= 0) {
        await showStockLimitAlert({ stock: 0, requestedQuantity: reorderQty });
        return;
      }
      await cart.add(p, reorderQty, null, null);
      await Swal.fire({
        icon: "success",
        text: t('reorderedSuccess') || `Added ${reorderQty} item(s) to cart as before!`,
        ...swalBase,
      });
      nav('/cart');
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("STOCK_LIMIT")) {
        setStockError("Stock limit reached for this product.");
        await showStockLimitAlert({ stock: extractStockCount(msg, Number(p?.stock || 0)), requestedQuantity: orderItem?.quantity || 1 });
        return;
      }
      if (msg.includes("LOGIN_REQUIRED")) {
        window.location.href = "/login";
        return;
      }
      await Swal.fire({
        icon: "error",
        text: msg || t('addToCartFailed') || "Failed to add to cart",
        ...swalBase,
      });
    }
  };

  useEffect(() => {
    modalZoomRef.current = modalZoom;
  }, [modalZoom]);

  useEffect(() => {
    if (!showZoomModal) {
      setModalZoom(1);
      setModalPan({ x: 0, y: 0 });
      zoomPanDragRef.current = null;
      setZoomPanning(false);
    }
  }, [showZoomModal]);

  useEffect(() => {
    if (!showZoomModal || modalZoom <= 1) {
      if (showZoomModal && modalZoom <= 1) setModalPan({ x: 0, y: 0 });
      return;
    }
    const el = zoomViewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const pad = Math.max(vw, vh) * (modalZoom - 1) * 0.55;
    setModalPan((prev) => ({
      x: Math.max(-pad, Math.min(pad, prev.x)),
      y: Math.max(-pad, Math.min(pad, prev.y)),
    }));
  }, [modalZoom, showZoomModal]);

  useEffect(() => {
    if (!zoomPanning) return undefined;
    const stop = () => {
      zoomPanDragRef.current = null;
      setZoomPanning(false);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [zoomPanning]);

  useEffect(() => {
    if (!showZoomModal) return undefined;
    const el = zoomViewportRef.current;
    if (!el) return undefined;
    let startDist = 0;
    let startZoom = 1;
    const onTouchStart = (ev) => {
      if (ev.touches.length === 2) {
        const [a, b] = [ev.touches[0], ev.touches[1]];
        startDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        startZoom = modalZoomRef.current;
      }
    };
    const onTouchMove = (ev) => {
      if (ev.touches.length !== 2) return;
      ev.preventDefault();
      const [a, b] = [ev.touches[0], ev.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
      const next = Math.min(3, Math.max(1, (startZoom * d) / startDist));
      setModalZoom(Number(next.toFixed(2)));
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [showZoomModal]);

  const onZoomPanPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (modalZoomRef.current <= 1) return;
    if (e.target.closest && e.target.closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    zoomPanDragRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    setZoomPanning(true);
  }, []);

  const onZoomPanPointerMove = useCallback((e) => {
    const drag = zoomPanDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    const z = modalZoomRef.current;
    const el = zoomViewportRef.current;
    if (!el || z <= 1) {
      setModalPan({ x: 0, y: 0 });
      return;
    }
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const pad = Math.max(vw, vh) * (z - 1) * 0.55;
    setModalPan((prev) => ({
      x: Math.max(-pad, Math.min(pad, prev.x + dx)),
      y: Math.max(-pad, Math.min(pad, prev.y + dy)),
    }));
  }, []);

  const onZoomPanPointerUp = useCallback((e) => {
    const drag = zoomPanDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    zoomPanDragRef.current = null;
    setZoomPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (loading) {
    return (
      <div className="container-safe py-8 md:py-10">
        <div className="animate-pulse border border-zinc-200 bg-white p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
            <div className="flex flex-col gap-4 md:flex-row md:gap-4">
              <div className="hidden shrink-0 flex-col gap-2 md:flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`${PRODUCT_GALLERY_THUMB_CLASS} bg-zinc-100`} />
                ))}
              </div>
              <div className={`w-full bg-zinc-100 md:min-h-0 md:flex-1 ${PRODUCT_GALLERY_ASPECT_CLASS}`} />
            </div>
            <div className="space-y-5 pt-1">
              <div className="h-9 w-4/5 max-w-lg bg-zinc-100" />
              <div className="h-7 w-48 bg-zinc-100" />
              <div className="h-12 w-full bg-zinc-100" />
              <div className="h-24 w-full bg-zinc-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="container-safe py-10">
        <div className="fs-card p-10 text-center text-sm text-zinc-600">{t('productNotFound')}</div>
      </div>
    );
  }

  return (
    <div className="container-safe py-8">
      {backToImageSearch && (
        <div className="flex justify-end mb-6">
          <button
            type="button"
            onClick={() => nav(backTarget)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Image Search
          </button>
        </div>
      )}

      {fromOrder && orderItem && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              {t('fromYourOrder') || "From your order"}
            </p>
            <p className="text-xs text-blue-700">
              {t('previouslyOrdered') || `You previously ordered ${orderItem.quantity} of this item. Click "Reorder as before" to add the same quantity to your cart.`}
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          {/* Gallery — thumbs left, main 3∶4 (1215×1620) */}
          <div className="flex flex-col gap-4 md:flex-row md:gap-4">
            <div className="order-2 flex gap-2 overflow-x-auto pb-1 md:order-1 md:w-[72px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-0 no-scrollbar md:max-h-[min(560px,70vh)]">
              {images.slice(0, 5).map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  onMouseEnter={() => setActiveImage(idx)}
                  className={`${PRODUCT_GALLERY_THUMB_CLASS} border transition-colors ${
                    activeImage === idx ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <img
                    src={resolveImageUrl(img)}
                    alt={`${p.name} ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>

            <div
              ref={mainImageRef}
              className={`relative order-1 w-full cursor-zoom-in overflow-hidden border border-zinc-200 bg-zinc-50 md:order-2 md:min-h-0 md:flex-1 ${PRODUCT_GALLERY_ASPECT_CLASS}`}
              onMouseEnter={() => setHoverZoom(true)}
              onMouseLeave={() => setHoverZoom(false)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
              }}
              onClick={() => setShowZoomModal(true)}
            >
              <img
                src={resolveImageUrl(images[activeImage])}
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
                alt={p.name}
                className="h-full w-full object-cover"
              />
              {hoverZoom && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: `url(${resolveImageUrl(images[activeImage])})`,
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "180%",
                  }}
                />
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage((prev) => (prev - 1 + images.length) % images.length);
                    }}
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border border-zinc-200 bg-white/95 shadow-sm transition hover:bg-white md:left-4 md:h-10 md:w-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage((prev) => (prev + 1) % images.length);
                    }}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center border border-zinc-200 bg-white/95 shadow-sm transition hover:bg-white md:right-4 md:h-10 md:w-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Product info — typography + controls aligned to reference */}
          <div className="space-y-6 lg:pt-1">
            {stockError ? <div className="text-sm text-red-600">{stockError}</div> : null}

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">{p.name}</h1>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-bold tabular-nums text-red-600 md:text-[1.75rem]">
                  <Money value={pricing.sale} />
                </span>
                {pricing.pctLabel ? (
                  <span className="text-sm font-semibold text-zinc-900">{pricing.pctLabel}</span>
                ) : null}
                {pricing.compare != null ? (
                  <span className="text-sm text-zinc-400 line-through tabular-nums">
                    <Money value={pricing.compare} />
                  </span>
                ) : null}
              </div>

              {(p.discount?.end_date || p.active_discount?.end_date || p.activeDiscount?.end_date) &&
              (p.discount || p.active_discount || p.activeDiscount) ? (
                <p className="mt-2 text-xs font-medium text-amber-800">{t("limitedTime")}</p>
              ) : null}
            </div>

            {colorVariants.length > 0 ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-zinc-900">{t("colorsAvailable")}</p>
                <div className="flex flex-wrap gap-2">
                  {colorVariants.map((cv, idx) => {
                    const fill = colorSwatchFill(cv.name);
                    const isActive = selectedColor === cv.name;
                    return (
                      <button
                        key={`${cv.name}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedColor(cv.name);
                          if (cv.image_url) {
                            const ix = images.indexOf(cv.image_url);
                            if (ix >= 0) setActiveImage(ix);
                          } else {
                            setActiveImage(0);
                          }
                        }}
                        className="flex w-12 flex-col items-center gap-2 text-center md:w-[72px]"
                      >
                        <span
                          className={`${PRODUCT_GALLERY_THUMB_CLASS} flex items-center justify-center border transition-colors ${
                            isActive ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-300 hover:border-zinc-500"
                          }`}
                          style={
                            cv.image_url
                              ? undefined
                              : fill
                                ? { backgroundColor: fill }
                                : {
                                    backgroundImage:
                                      "linear-gradient(135deg, #e4e4e7 25%, #fafafa 25%, #fafafa 50%, #e4e4e7 50%, #e4e4e7 75%, #fafafa 75%)",
                                    backgroundSize: "8px 8px",
                                  }
                          }
                          title={cv.name}
                        >
                          {cv.image_url ? (
                            <img
                              src={resolveImageUrl(cv.image_url)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="max-w-[4.5rem] truncate text-xs font-medium text-zinc-800 md:max-w-[4.5rem]">{cv.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {displaySizes.length > 0 ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-zinc-900">{t("sizeAvailable")}</p>
                <div className="flex flex-wrap gap-2">
                  {displaySizes.map((size) => {
                    const isActive = selectedSize === size;
                    const rowQty = usesVariantMatrix
                      ? matrixQtyForCombo(variantMatrix, selectedColor, size) ?? 0
                      : null;
                    const soldOut = usesVariantMatrix && rowQty <= 0;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={soldOut}
                        onClick={() => !soldOut && setSelectedSize(size)}
                        className={`flex h-11 min-w-[2.75rem] items-center justify-center border px-2 text-sm font-semibold transition-colors ${
                          soldOut
                            ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 line-through"
                            : isActive
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
                        }`}
                        title={soldOut ? "Out of stock for this color" : undefined}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {fromOrder && orderItem ? (
                <button
                  type="button"
                  onClick={reorderAsBefore}
                  disabled={maxQty === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-blue-600 py-3.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-50"
                >
                  <RotateCcw className="h-5 w-5" strokeWidth={2} />
                  {t("reorderAsBefore") || `Reorder as before (${orderItem.quantity}x)`}
                </button>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-900">{t("quantity")}</p>
                <div className="fs-product-qty inline-flex w-full max-w-[220px] items-stretch border border-zinc-200 bg-zinc-100 sm:max-w-xs">
                  <button
                    type="button"
                    className="fs-product-qty__btn flex flex-1 items-center justify-center py-3 transition hover:bg-zinc-200/80"
                    onClick={() => setQty((x) => Math.max(1, x - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-5 w-5 text-zinc-800" strokeWidth={2} />
                  </button>
                  <div className="fs-product-qty__value flex min-w-[3rem] items-center justify-center border-x border-zinc-200 bg-white text-base font-semibold tabular-nums text-zinc-900">
                    {qty}
                  </div>
                  <button
                    type="button"
                    className="fs-product-qty__btn flex flex-1 items-center justify-center py-3 transition hover:bg-zinc-200/80 disabled:opacity-40"
                    onClick={() => setQty((x) => Math.min(maxQty || 1, x + 1))}
                    disabled={maxQty === 0}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-5 w-5 text-zinc-800" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={add}
                  disabled={maxQty === 0}
                  className="min-h-[48px] flex-1 border border-black bg-black py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("addToCart")}
                </button>
                <button
                  type="button"
                  onClick={() => wishlist.toggle(p.id)}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    wishlist.has(p.id) ? "bg-zinc-900 text-white" : "bg-white text-zinc-900 hover:bg-zinc-100"
                  }`}
                  aria-label={t("wishlist")}
                  title={t("wishlist")}
                >
                  <Heart className="h-5 w-5" strokeWidth={1.5} fill={wishlist.has(p.id) ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-zinc-200 pt-6 sm:flex-row sm:items-stretch">
              <ServiceBadge
                icon={<Zap className="h-4 w-4 text-zinc-700" strokeWidth={2} />}
                title={t("fastDelivery")}
                description={deliveryInfo}
              />
              <ServiceBadge
                icon={<Phone className="h-4 w-4 text-zinc-700" strokeWidth={2} />}
                title={t("supportHotline")}
                description={supportPhone}
              />
              <ServiceBadge
                icon={<CreditCard className="h-4 w-4 text-zinc-700" strokeWidth={2} />}
                title={t("easyPayment")}
                description={
                  paymentMethods.length > 0 ? paymentMethods.slice(0, 4).join(", ") : t("paymentMethodsDefault")
                }
              />
            </div>

            {p.model_info || p.description || p.sku || p.category?.name ? (
              <div className="fs-product-accordion overflow-hidden rounded-sm border border-zinc-200">
                {p.model_info ? (
                  <AccordionRow
                    title={t("modelInfo")}
                    open={detailAcc.model}
                    onToggle={() => setDetailAcc((s) => ({ ...s, model: !s.model }))}
                  >
                    <ProductBodyText text={p.model_info} />
                  </AccordionRow>
                ) : null}
                {p.description || p.sku || p.category?.name ? (
                  <AccordionRow
                    title={t("productDetails")}
                    open={detailAcc.details}
                    onToggle={() => setDetailAcc((s) => ({ ...s, details: !s.details }))}
                  >
                    <div className="space-y-3">
                      {(p.sku || p.category?.name) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                          {p.sku ? (
                            <span>
                              {t("code")}: <span className="font-semibold text-zinc-800">{p.sku}</span>
                            </span>
                          ) : null}
                          {p.category?.name ? (
                            <span>
                              {t("category")}: <span className="font-semibold text-zinc-800">{p.category.name}</span>
                            </span>
                          ) : null}
                        </div>
                      )}
                      {p.description ? <ProductBodyText text={p.description} /> : null}
                    </div>
                  </AccordionRow>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-black tracking-tight mb-6">{t('similarItems')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {similarProducts.map((product) => (
              <ProductCard key={product.id} p={product} />
            ))}
          </div>
        </div>
      )}

      {/* Zoom Modal */}
      {showZoomModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-2">
          <div className="absolute inset-0" onClick={() => setShowZoomModal(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("zoom")}
            className="relative flex h-[min(94dvh,calc(100dvh-0.5rem))] w-full max-w-[min(98vw,640px)] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl sm:h-[min(92dvh,calc(100dvh-1rem))] sm:max-w-[min(96vw,880px)] md:max-w-[min(94vw,1120px)] lg:h-[min(91dvh,calc(100dvh-1.25rem))] lg:max-w-[min(92vw,1280px)] xl:max-w-[min(90vw,1440px)] 2xl:max-w-[min(88vw,1680px)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">{t("zoom")}</div>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 sm:h-10 sm:w-10"
              >
                <X className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
              </button>
            </div>
            <div
              ref={zoomViewportRef}
              className={`relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-zinc-100/90 p-2 sm:p-4 md:p-6 lg:p-8 select-none ${
                modalZoom > 1 ? `touch-none ${zoomPanning ? "cursor-grabbing" : "cursor-grab"}` : ""
              }`}
              style={{ touchAction: modalZoom > 1 ? "none" : "manipulation" }}
              onPointerDown={onZoomPanPointerDown}
              onPointerMove={onZoomPanPointerMove}
              onPointerUp={onZoomPanPointerUp}
              onPointerCancel={onZoomPanPointerUp}
            >
              <img
                src={resolveImageUrl(images[activeImage])}
                alt={p.name}
                draggable={false}
                className="mx-auto block h-full max-h-full w-full max-w-full object-contain shadow-none will-change-transform"
                style={{
                  transform: `translate(${modalPan.x}px, ${modalPan.y}px) scale(${modalZoom})`,
                  transformOrigin: "center center",
                  transition: zoomPanning ? "none" : "transform 0.2s ease-out",
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/30 via-black/10 to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-14 sm:pt-20 lg:pt-24">
                <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/25 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2.5 lg:gap-4 lg:px-5 lg:py-3">
                  <button
                    type="button"
                    onClick={() => setModalZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                    disabled={modalZoom <= 1}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 sm:text-xl lg:h-12 lg:w-12"
                  >
                    −
                  </button>
                  <div className="flex h-10 min-w-[5rem] items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-sm font-semibold tabular-nums text-zinc-800 shadow-sm sm:h-11 sm:min-w-[5.5rem] sm:text-base lg:h-12 lg:min-w-[6rem] lg:text-lg">
                    {Math.round(modalZoom * 100)}%
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                    disabled={modalZoom >= 3}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 sm:text-xl lg:h-12 lg:w-12"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

