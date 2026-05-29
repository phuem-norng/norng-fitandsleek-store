import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import KhqrSuccessModal from "../alerts/KhqrSuccessModal";
import KhqrModal from "./KhqrModal";

/** ~24 checks/min — under backend bakong-status limit (90/min). */
const POLL_MS = 2500;

function pickStatus(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.order_payment_status === "paid" || payload.payment_status === "paid") {
    return "paid";
  }
  return payload.status ?? payload.payment?.status ?? null;
}

function isPaidPayload(payload) {
  return pickStatus(payload) === "paid";
}

export default function CheckoutPaymentKhqr({
  open,
  orderId,
  orderNumber,
  amount,
  currency = "KHR",
  onClose,
  onPaid,
  onDone,
  redirectSeconds = 60,
}) {
  const [payment, setPayment] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [successOpen, setSuccessOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const pollRef = useRef(null);
  const pollFailuresRef = useRef(0);
  const paidNotifiedRef = useRef(false);
  const backoffUntilRef = useRef(0);
  const lastResumeCheckRef = useRef(0);

  const paymentIdRef = useRef(paymentId);
  paymentIdRef.current = paymentId;

  const runStatusCheckRef = useRef(null);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const createInFlightRef = useRef(false);
  const createKhqrRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handlePaid = useCallback(
    (payload) => {
      if (paidNotifiedRef.current) return;
      paidNotifiedRef.current = true;
      setStatus("paid");
      setError("");
      setVerificationNote("");
      setAwaitingConfirmation(false);
      stopPolling();
      setSuccessOpen(true);
      onPaidRef.current?.(payload);
    },
    [stopPolling],
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

      if (isPaidPayload(data) || isPaidPayload(nextPayment)) {
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

  const runStatusCheck = useCallback(async () => {
    const targetId = paymentIdRef.current;
    if (!targetId || paidNotifiedRef.current) return;
    if (Date.now() < backoffUntilRef.current) return;

    try {
      const { data } = await api.get(`/payments/bakong/status/${targetId}`);
      pollFailuresRef.current = 0;
      backoffUntilRef.current = 0;
      setError("");
      setAwaitingConfirmation(false);
      applyStatusPayload(data);
    } catch (e) {
      const httpStatus = e?.response?.status;

      if (httpStatus === 429) {
        backoffUntilRef.current = Date.now() + 12_000;
        setVerificationNote("Still checking your payment…");
        return;
      }

      pollFailuresRef.current += 1;

      if (httpStatus === 403) {
        setError(e?.response?.data?.message || "Unauthorized.");
        setStatus("error");
        stopPolling();
        return;
      }

      if (pollFailuresRef.current >= 5) {
        setError(
          e?.response?.data?.message ||
            "Unable to verify payment status. Keep this screen open after paying in your banking app.",
        );
      }
    }
  }, [applyStatusPayload, stopPolling]);

  runStatusCheckRef.current = runStatusCheck;

  const createKhqr = useCallback(async ({ force = false } = {}) => {
    if (!orderId) return;
    if (!force && createInFlightRef.current) return;
    createInFlightRef.current = true;
    setLoading(true);
    setError("");
    paidNotifiedRef.current = false;
    setVerificationNote("");
    setAwaitingConfirmation(false);
    backoffUntilRef.current = 0;
    lastResumeCheckRef.current = 0;

    try {
      const { data } = await api.post("/payments/bakong/create", { order_id: orderId });
      const nextPayment = data?.payment || data;
      const nextStatus = pickStatus(data) || "pending";
      setPayment(nextPayment);
      const id = nextPayment?.payment_id ?? nextPayment?.id ?? data?.payment_id;
      setPaymentId(id);
      paymentIdRef.current = id;
      setStatus(nextStatus);
      if (isPaidPayload(data) || isPaidPayload(nextPayment)) {
        handlePaid(nextPayment);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create KHQR.");
      setStatus("error");
    } finally {
      createInFlightRef.current = false;
      setLoading(false);
    }
  }, [handlePaid, orderId]);

  createKhqrRef.current = createKhqr;

  useEffect(() => {
    if (!open || !orderId) return;
    void createKhqrRef.current?.();
  }, [open, orderId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api
      .get("/payments/bakong/readiness")
      .then(({ data }) => {
        if (cancelled || paidNotifiedRef.current) return;
        if (!data?.checkout_ready && data?.message) {
          setVerificationNote(String(data.message));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !paymentId) return;
    if (status === "paid" || status === "expired" || status === "error") return;

    const tick = () => void runStatusCheckRef.current?.();
    tick();
    pollRef.current = window.setInterval(tick, POLL_MS);

    return () => {
      stopPolling();
    };
  }, [open, paymentId, status, stopPolling]);

  useEffect(() => {
    if (!open || status !== "pending" || !paymentId) return undefined;

    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastResumeCheckRef.current < 2500) return;
      lastResumeCheckRef.current = now;
      setAwaitingConfirmation(true);
      void runStatusCheckRef.current?.().finally(() => {
        window.setTimeout(() => setAwaitingConfirmation(false), 1500);
      });
    };

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [open, paymentId, status]);

  useEffect(() => {
    if (!open) {
      createInFlightRef.current = false;
      stopPolling();
      if (!successOpen) {
        setPayment(null);
        setPaymentId(null);
        paymentIdRef.current = null;
        setStatus("idle");
        setError("");
        pollFailuresRef.current = 0;
        paidNotifiedRef.current = false;
        setVerificationNote("");
        setAwaitingConfirmation(false);
        backoffUntilRef.current = 0;
        lastResumeCheckRef.current = 0;
      }
    }
  }, [open, successOpen, stopPolling]);

  useEffect(() => {
    if (!successOpen) return undefined;
    const t = window.setTimeout(() => {
      setSuccessOpen(false);
      onDone?.();
    }, redirectSeconds * 1000);
    return () => window.clearTimeout(t);
  }, [successOpen, onDone, redirectSeconds]);

  const handleSuccessClose = useCallback(() => {
    setSuccessOpen(false);
    paidNotifiedRef.current = false;
    setPayment(null);
    setPaymentId(null);
    paymentIdRef.current = null;
    setStatus("idle");
    onDone?.();
  }, [onDone]);

  return (
    <>
    <KhqrModal
      open={open && !successOpen}
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
      onRegenerate={() => createKhqr({ force: true })}
    />
    <KhqrSuccessModal
      open={successOpen}
      orderNumber={orderNumber}
      total={amount}
      currency={currency}
      redirectSeconds={redirectSeconds}
      onClose={handleSuccessClose}
    />
    </>
  );
}
