import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const KHQR_RED = "#C0272D";

/**
 * Slide handle to manually check Bakong payment status after the customer pays in their banking app.
 */
export default function SlideToVerifyPayment({
  disabled = false,
  busy = false,
  result = null,
  onVerify,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offsetPx, setOffsetPx] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const THUMB = 52;
  const THRESHOLD = 0.85;

  const maxTravel = Math.max(0, trackWidth - THUMB);
  const progress = maxTravel > 0 ? offsetPx / maxTravel : 0;

  const resetThumb = useCallback(() => {
    setOffsetPx(0);
    setDragging(false);
  }, []);

  const measure = useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 0;
    setTrackWidth(w);
  }, []);

  const completeSlide = useCallback(async () => {
    if (disabled || busy) {
      resetThumb();
      return;
    }
    setOffsetPx(maxTravel);
    await onVerify?.();
  }, [busy, disabled, maxTravel, onVerify, resetThumb]);

  useEffect(() => {
    if (result === "paid") {
      setOffsetPx(maxTravel);
      return;
    }
    if (result === "pending" || result === "error") {
      const t = window.setTimeout(resetThumb, 500);
      return () => window.clearTimeout(t);
    }
  }, [maxTravel, resetThumb, result]);

  const onPointerDown = (e) => {
    if (disabled || busy || result === "paid") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    measure();
    setDragging(true);
  };

  const onPointerMove = (e) => {
    if (!dragging || disabled || busy) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - THUMB / 2;
    setOffsetPx(Math.min(maxTravel, Math.max(0, x)));
  };

  const onPointerUp = async () => {
    if (!dragging) return;
    setDragging(false);
    if (progress >= THRESHOLD) {
      await completeSlide();
    } else {
      resetThumb();
    }
  };

  const resultBanner = (() => {
    if (result === "paid") {
      return (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Payment successful! Finishing your order…</span>
        </div>
      );
    }
    if (result === "pending") {
      return (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>Payment not detected yet. Wait a few seconds, then slide again.</span>
        </div>
      );
    }
    if (result === "error") {
      return (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Could not verify payment. Check your connection and try again.</span>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="space-y-3">
      {resultBanner}

      <div
        ref={trackRef}
        className="relative select-none rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
        style={{ height: THUMB + 8, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-y-1 left-1 rounded-xl transition-[width] duration-75"
          style={{
            width: Math.max(THUMB, offsetPx + THUMB),
            background: `linear-gradient(90deg, ${KHQR_RED}22, ${KHQR_RED}55)`,
            opacity: progress > 0.05 ? 1 : 0,
          }}
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-14 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
          {busy ? "Checking payment…" : "Slide to check if payment succeeded →"}
        </p>
        <div
          className="absolute top-1 flex items-center justify-center rounded-xl bg-white shadow-md dark:bg-slate-700"
          style={{
            width: THUMB,
            height: THUMB,
            left: 4 + offsetPx,
            transition: dragging ? "none" : "left 0.25s ease-out",
          }}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#C0272D]" aria-hidden />
          ) : result === "paid" ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
          ) : (
            <span className="text-lg text-[#C0272D]" aria-hidden>
              →
            </span>
          )}
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
        After paying in your banking app, slide to confirm success or failure.
      </p>
    </div>
  );
}
