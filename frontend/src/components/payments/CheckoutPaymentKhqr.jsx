import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import KhqrModal from "./KhqrModal";

const POLL_MS = 5000;
const POLL_MS_SLOW = 10000;
const BURST_COOLDOWN_MS = 8000;

function pickStatus(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.status ?? payload.payment?.status ?? null;
}

export default function CheckoutPaymentKhqr({
  open,
  orderId,
  orderNumber,
  amount,
  currency = "KHR",
  onClose,
  onPaid,
}) {
  const [payment, setPayment] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const pollRef = useRef(null);
  const pollFailuresRef = useRef(0);
  const paidNotifiedRef = useRef(false);
  const backoffUntilRef = useRef(0);
  const lastBurstAtRef = useRef(0);
  const pollIntervalMsRef = useRef(POLL_MS);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (intervalMs) => {
      stopPolling();
      pollIntervalMsRef.current = intervalMs;
      pollRef.current = window.setInterval(() => {
        if (Date.now() < backoffUntilRef.current) return;
        void checkStatusRef.current?.();
      }, intervalMs);
    },
    [stopPolling],
  );

  const handlePaid = useCallback(
    (payload) => {
      if (paidNotifiedRef.current) return;
      paidNotifiedRef.current = true;
      setStatus("paid");
      setError("");
      setAwaitingConfirmation(false);
      stopPolling();
      onPaid?.(payload);
    },
    [onPaid, stopPolling],
  );

  const applyStatusPayload = useCallback(
    (data) => {
      const nextPayment = data?.payment && typeof data.payment === "object" ? data.payment : data;
      const nextStatus = pickStatus(data) ?? pickStatus(nextPayment);

      if (data?.verification_note) {
        setVerificationNote(String(data.verification_note));
      } else if (nextStatus === "paid") {
        setVerificationNote("");
      }

      const hasQr =
        nextPayment &&
        (nextPayment.qr_string ||
          nextPayment.qr_image_base64 ||
          nextPayment.md5 ||
          nextPayment.bill_number);
      if (hasQr) setPayment(nextPayment);

      if (nextStatus === "paid") {
        handlePaid(nextPayment || data);
        return "paid";
      }

      if (nextStatus) {
        setStatus(nextStatus);
      }

      return nextStatus;
    },
    [handlePaid],
  );

  const checkStatusRef = useRef(null);

  const checkStatus = useCallback(async () => {
    const targetId = paymentId;
    if (!targetId || paidNotifiedRef.current) return null;
    if (Date.now() < backoffUntilRef.current) return null;

    try {
      const { data } = await api.get(`/payments/bakong/status/${targetId}`);
      pollFailuresRef.current = 0;
      backoffUntilRef.current = 0;
      setError("");
      if (pollIntervalMsRef.current !== POLL_MS) {
        startPolling(POLL_MS);
      }
      return applyStatusPayload(data);
    } catch (e) {
      const httpStatus = e?.response?.status;

      if (httpStatus === 429) {
        const retryAfterSec = Number(e?.response?.headers?.["retry-after"] || 60);
        const waitMs = Math.min(Math.max(retryAfterSec, 15), 120) * 1000;
        backoffUntilRef.current = Date.now() + waitMs;
        startPolling(POLL_MS_SLOW);
        setVerificationNote("Checking payment… please wait a moment.");
        return null;
      }

      pollFailuresRef.current += 1;
      if (httpStatus === 403) {
        setError(e?.response?.data?.message || "Unauthorized.");
        setStatus("error");
        stopPolling();
        return "error";
      }
      if (pollFailuresRef.current >= 3) {
        setError(
          e?.response?.data?.message ||
            "Unable to verify payment status. Keep this screen open after paying in your banking app.",
        );
      }
      return "error";
    }
  }, [applyStatusPayload, paymentId, startPolling, stopPolling]);

  checkStatusRef.current = checkStatus;

  const createKhqr = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    paidNotifiedRef.current = false;
    setVerificationNote("");
    setAwaitingConfirmation(false);
    backoffUntilRef.current = 0;
    lastBurstAtRef.current = 0;

    try {
      const { data } = await api.post("/payments/bakong/create", { order_id: orderId });
      const nextPayment = data?.payment || data;
      const nextStatus = pickStatus(data) || "pending";
      setPayment(nextPayment);
      setPaymentId(nextPayment?.payment_id ?? nextPayment?.id ?? data?.payment_id);
      setStatus(nextStatus);
      if (nextStatus === "paid") {
        handlePaid(nextPayment);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create KHQR.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [handlePaid, orderId]);

  const burstCheckStatus = useCallback(() => {
    if (paidNotifiedRef.current || !paymentId) return;
    const now = Date.now();
    if (now - lastBurstAtRef.current < BURST_COOLDOWN_MS) {
      void checkStatus();
      return;
    }
    lastBurstAtRef.current = now;
    setAwaitingConfirmation(true);
    void checkStatus();
    window.setTimeout(() => {
      void checkStatus();
      setAwaitingConfirmation(false);
    }, 1200);
  }, [checkStatus, paymentId]);

  useEffect(() => {
    if (!open) return;
    createKhqr();
  }, [open, createKhqr]);

  useEffect(() => {
    if (!open) return;
    if (status === "paid" || status === "expired" || status === "error") return;
    if (!paymentId) return;

    void checkStatus();
    startPolling(POLL_MS);

    return () => {
      stopPolling();
    };
  }, [open, status, checkStatus, paymentId, startPolling, stopPolling]);

  useEffect(() => {
    if (!open || status !== "pending") return undefined;

    const onResume = () => {
      if (document.visibilityState === "visible") {
        burstCheckStatus();
      }
    };

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [burstCheckStatus, open, status]);

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setPaymentId(null);
      setStatus("idle");
      setError("");
      pollFailuresRef.current = 0;
      paidNotifiedRef.current = false;
      setVerificationNote("");
      setAwaitingConfirmation(false);
      backoffUntilRef.current = 0;
      lastBurstAtRef.current = 0;
      pollIntervalMsRef.current = POLL_MS;
      stopPolling();
    }
  }, [open, stopPolling]);

  return (
    <KhqrModal
      open={open}
      onClose={onClose}
      qrImageBase64={payment?.qr_image_base64}
      qrString={payment?.qr_string}
      billNumber={payment?.bill_number || orderNumber}
      md5={payment?.md5}
      expiresAt={payment?.expires_at}
      status={status}
      loading={loading}
      error={error}
      verificationNote={verificationNote}
      awaitingConfirmation={awaitingConfirmation}
      amount={amount}
      currency={payment?.currency || currency}
      onRegenerate={createKhqr}
    />
  );
}
