
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { resolveImageUrl } from "../lib/images";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Zap,
  Phone,
  CreditCard,
  User,
  X,
  Package,
  RotateCcw,
  Eye,
} from "lucide-react";
import Swal from "sweetalert2";
import { useCart } from "../state/cart";
import { useWishlist } from "../state/wishlist";
import ProductCard from "../components/shop/ProductCard.jsx";
import { useLanguage } from "../lib/i18n.jsx";

function Money({ value }) {
  const n = Number(value || 0);
  return <span>${n.toFixed(2)}</span>;
}

// Service Badge Component
function ServiceBadge({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs font-semibold text-zinc-900">{title}</div>
        <div className="text-xs text-zinc-600">{description}</div>
      </div>
    </div>
  );
}

// Helper to parse colors array
function parseColors(colorsData) {
  if (!colorsData) return [];
  if (Array.isArray(colorsData)) return colorsData;
  if (typeof colorsData === 'string') return colorsData.split(',').map(c => c.trim()).filter(Boolean);
  return [];
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

// Default size chart (cm) — shown when product has no custom `size_guide` text
const DEFAULT_SIZE_GUIDE_ROWS = [
  { size: "XS", chest: "86-91", waist: "71-76", hip: "86-91" },
  { size: "S", chest: "91-96", waist: "76-81", hip: "91-96" },
  { size: "M", chest: "96-101", waist: "81-86", hip: "96-101" },
  { size: "L", chest: "101-106", waist: "86-91", hip: "101-106" },
  { size: "XL", chest: "106-111", waist: "91-96", hip: "106-111" },
];

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
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [similarProducts, setSimilarProducts] = useState([]);
  const thumbScrollerRef = useRef(null);
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

  // useEffect hook
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/products/${slug}`);
        setP(data);
        setActiveImage(0);

        // Set default selections after data is loaded
        if (data && data.colors) {
          const colors = parseColors(data.colors);
          if (colors.length > 0) {
            setSelectedColor(colors[0]);
          }
        }

        if (data && data.sizes) {
          const sizes = parseSizes(data.sizes);
          if (sizes.length > 0) {
            setSelectedSize(sizes[0]);
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
  const images = useMemo(() => {
    if (!p) return ["/placeholder.svg"];
    const gallery = [];
    if (p.image_url) gallery.push(p.image_url);
    if (p.gallery && Array.isArray(p.gallery)) {
      p.gallery.forEach(img => {
        if (img && !gallery.includes(img)) gallery.push(img);
      });
    }
    return gallery.length > 0 ? gallery : ["/placeholder.svg"];
  }, [p]);

  const colors = useMemo(() => parseColors(p?.colors), [p?.colors]);
  const sizes = useMemo(() => parseSizes(p?.sizes), [p?.sizes]);
  const paymentMethods = useMemo(() => parsePaymentMethods(p?.payment_methods), [p?.payment_methods]);

  const deliveryInfo = p?.delivery_info || t('deliveryFromToDays');
  const supportPhone = p?.support_phone || "+855 12 345 678";
  const maxQty = Number.isFinite(Number(p?.stock)) ? Math.max(0, Number(p.stock)) : 99;
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
    const currentStock = Number.isFinite(Number(p?.stock)) ? Number(p.stock) : null;
    if (currentStock !== null && currentStock <= 0) {
      await showStockLimitAlert({ stock: 0, requestedQuantity: qty });
      return;
    }
    if (colors.length > 0 && !selectedColor) {
      await Swal.fire({
        icon: "info",
        text: t('selectColorFirst') || "Please select a color",
        ...swalBase,
      });
      return;
    }
    if (sizes.length > 0 && !selectedSize) {
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
      <div className="container-safe py-10">
        <div className="fs-card p-10 animate-pulse">
          <div className="h-6 w-48 bg-zinc-100 rounded" />
          <div className="mt-6 grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-zinc-100 rounded-2xl" />
            <div>
              <div className="h-4 w-64 bg-zinc-100 rounded" />
              <div className="mt-3 h-4 w-40 bg-zinc-100 rounded" />
              <div className="mt-6 h-10 w-40 bg-zinc-100 rounded-full" />
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
      {/* Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-zinc-600 mb-6">
        <div>
          <Link className="hover:underline" to="/search">{t('shop')}</Link> / <span className="text-zinc-800">{p.name}</span>
        </div>
        {backToImageSearch && (
          <button
            onClick={() => nav(backTarget)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Image Search
          </button>
        )}
      </div>

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

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Image Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-3 md:gap-4 items-start">
          {/* Vertical Thumbnails */}
          <div className="order-2 md:order-1 mt-2 md:mt-0 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden no-scrollbar md:h-[520px]">
            <div className="flex gap-3 md:flex-col">
              {images.slice(0, 5).map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  onMouseEnter={() => setActiveImage(idx)}
                  className={`h-16 w-16 shrink-0 md:h-20 md:w-20 rounded-xl overflow-hidden transition-colors border ${activeImage === idx ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                >
                  <img
                    src={resolveImageUrl(img)}
                    alt={`${p.name} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Main Image */}
          <div
            ref={mainImageRef}
            className="order-1 md:order-2 aspect-[4/5] bg-zinc-50 rounded-md overflow-hidden relative cursor-zoom-in"
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
              onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
              alt={p.name}
              className="w-full h-full object-cover rounded-md"
            />
            {hoverZoom && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${resolveImageUrl(images[activeImage])})`,
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "180%",
                }}
              />
            )}
            {/* Image Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImage((prev) => (prev - 1 + images.length) % images.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white"
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2} />
                </button>
                <button
                  onClick={() => setActiveImage((prev) => (prev + 1) % images.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white"
                >
                  <ChevronRight className="w-5 h-5" strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Header */}
          {stockError && (
            <div className="mt-3 text-sm text-red-600">
              {stockError}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="fs-pill">{p.category?.name || t('category')}</span>
              {p.is_active && <span className="fs-pill bg-emerald-100 text-emerald-700">{t('inStock')}</span>}
            </div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-3xl font-black tracking-tight">{p.name}</h1>
              <button
                onClick={() => wishlist.toggle(p.id)}
                className={
                  `h-10 w-10 rounded-full border flex items-center justify-center ` +
                  (wishlist.has(p.id)
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white border-zinc-200")
                }
                aria-label={t('wishlist')}
                title={t('wishlist')}
              >
                <Heart
                  className="w-5 h-5"
                  strokeWidth={1.5}
                  fill={wishlist.has(p.id) ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-2xl font-black text-rose-600">
                <Money value={p.discount?.sale_price ?? p.activeSale?.sale_price ?? p.price} />
              </div>
              {(p.discount?.original_price || p.activeSale?.sale_price || p.compare_at_price) && (
                <div className="text-lg text-zinc-400 line-through">
                  <Money value={p.discount?.original_price ?? p.price ?? p.compare_at_price} />
                </div>
              )}
            </div>

            {/* Discount Badge */}
            {(p.discount || p.activeSale) && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm font-bold px-3 py-1 bg-rose-100 text-rose-700 rounded-full">
                  {p.discount?.type === 'percentage' || p.activeSale?.discount_type === 'percentage'
                    ? `${Math.round(p.discount?.value ?? p.activeSale?.discount_value ?? 0)}% OFF`
                    : `$${Math.round(p.discount?.value ?? p.activeSale?.discount_value ?? 0)} OFF`}
                </span>
                {(p.discount?.end_date || p.activeSale?.end_date) && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">{t('limitedTime')}</span>
                )}
              </div>
            )}
          </div>

          {/* Product Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">{t('code')}:</span>
              <span className="font-semibold text-zinc-900">{p.sku || "—"}</span>
            </div>
          </div>

          {/* Description */}
          {p.description && (
            <p className="text-sm text-zinc-700 leading-relaxed">{p.description}</p>
          )}

          {/* Colors */}
          {colors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-zinc-900">{t('colorsAvailable')}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {colors.map((color, idx) => {
                  const swatchImage = images[idx] || images[0];
                  const isActive = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        if (swatchImage) setActiveImage(Math.min(idx, images.length - 1));
                      }}
                      className={`flex items-center gap-3 rounded-xl border px-2 py-2 text-left ${isActive ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                    >
                      <span className="h-12 w-12 rounded-lg overflow-hidden bg-zinc-50 border border-zinc-200">
                        <img
                          src={resolveImageUrl(swatchImage)}
                          alt={color}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      <span className="text-sm font-medium text-zinc-900 truncate">{color}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size */}
          {sizes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-zinc-900">{t('sizeAvailable')}</span>
                {sizes.length > 0 && (
                  <button
                    onClick={() => setShowSizeGuide(true)}
                    className="text-xs text-zinc-600 hover:text-zinc-900 underline"
                  >
                    {t('sizeGuide')}
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 rounded-xl text-sm font-semibold transition-all ${selectedSize === size
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="space-y-4">
            {fromOrder && orderItem && (
              <button
                onClick={reorderAsBefore}
                disabled={maxQty === 0}
                className="w-full rounded-xl bg-blue-600 text-white py-4 font-bold hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="w-5 h-5" strokeWidth={2} />
                {t('reorderAsBefore') || `Reorder as before (${orderItem.quantity}x)`}
              </button>
            )}

            {/* Quantity Controls */}
            <div className="flex items-center justify-center sm:justify-start gap-4">
              <div className="inline-flex items-center rounded-xl border border-gray-200">
                <button
                  className="h-12 w-12 flex items-center justify-center hover:bg-gray-50 transition-colors rounded-l-xl"
                  onClick={() => setQty((x) => Math.max(1, x - 1))}
                >
                  <Minus className="w-5 h-5" strokeWidth={2} />
                </button>
                <div className="w-14 text-center text-base font-bold">{qty}</div>
                <button
                  className="h-12 w-12 flex items-center justify-center hover:bg-gray-50 transition-colors rounded-r-xl disabled:opacity-40"
                  onClick={() => setQty((x) => Math.min(maxQty || 1, x + 1))}
                  disabled={maxQty === 0}
                >
                  <Plus className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              {Number.isFinite(Number(p?.stock)) && (
                <div className="text-sm text-gray-500">
                  {t('quantityAvailable')}: <span className="font-semibold text-gray-700">{p.stock}</span>
                </div>
              )}
            </div>

            {/* Stock Info - Above Buttons */}
            {Number.isFinite(Number(p?.stock)) && (
              <div className="text-xs text-gray-400 text-center sm:text-left">
                {p.stock > 10 ? `${p.stock} ${t('itemsAvailable') || 'items available'}` :
                  p.stock > 0 ? `${t('onlyItemsLeft') || 'Only'} ${p.stock} ${t('itemsLeft') || 'items left'}!` :
                    t('outOfStock') || 'Out of stock'}
              </div>
            )}

            {/* Premium Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={add}
                disabled={maxQty === 0}
                className="w-full rounded-xl bg-black text-white py-4 font-bold hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={2.5} />
                {t('addToCart')}
              </button>

              <Link
                to="/cart"
                className="w-full rounded-xl bg-white border border-gray-200 text-black py-4 font-semibold hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Eye className="w-5 h-5" strokeWidth={2} />
                {t('viewCart')}
              </Link>
            </div>
          </div>

          {/* Service Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-200">
            <ServiceBadge
              icon={
                <Zap className="w-5 h-5 text-emerald-600" strokeWidth={2} />
              }
              title={t('fastDelivery')}
              description={deliveryInfo}
            />
            <ServiceBadge
              icon={
                <Phone className="w-5 h-5 text-blue-600" strokeWidth={2} />
              }
              title={t('supportHotline')}
              description={supportPhone}
            />
            <ServiceBadge
              icon={
                <CreditCard className="w-5 h-5 text-amber-600" strokeWidth={2} />
              }
              title={t('easyPayment')}
              description={paymentMethods.length > 0 ? paymentMethods.slice(0, 3).join(", ") : t('paymentMethodsDefault')}
            />
          </div>

          {/* Model Info */}
          {p.model_info && (
            <div className="bg-zinc-50 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                  <User className="w-5 h-5 text-zinc-600" strokeWidth={2} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900 mb-1">{t('modelSize')}</div>
                  <p className="text-sm text-zinc-600">{p.model_info}</p>
                </div>
              </div>
            </div>
          )}
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

      {/* Size Guide — portal to body so it stays centered on all viewports */}
      {showSizeGuide &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-hidden
              onClick={() => setShowSizeGuide(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="size-guide-dialog-title"
              className="relative z-10 mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex max-h-[min(90dvh,640px)] flex-col">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
                  <h3 id="size-guide-dialog-title" className="text-lg font-bold tracking-tight text-zinc-900">
                    {t("sizeGuide")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSizeGuide(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                  {p.size_guide ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{p.size_guide}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full min-w-[280px] text-sm">
                        <thead>
                          <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                            <th className="px-3 py-3 sm:px-4">{t("size")}</th>
                            <th className="px-3 py-3 sm:px-4">{t("chestCm")}</th>
                            <th className="px-3 py-3 sm:px-4">{t("waistCm")}</th>
                            <th className="px-3 py-3 sm:px-4">{t("hipCm")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {DEFAULT_SIZE_GUIDE_ROWS.map((row) => (
                            <tr key={row.size} className="text-zinc-800">
                              <td className="px-3 py-2.5 font-semibold sm:px-4">{row.size}</td>
                              <td className="px-3 py-2.5 tabular-nums sm:px-4">{row.chest}</td>
                              <td className="px-3 py-2.5 tabular-nums sm:px-4">{row.waist}</td>
                              <td className="px-3 py-2.5 tabular-nums sm:px-4">{row.hip}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
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

