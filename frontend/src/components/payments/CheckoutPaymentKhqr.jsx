import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import KhqrModal from "./KhqrModal";

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
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [verifySlideResult, setVerifySlideResult] = useState(null);
  const pollRef = useRef(null);
  const pollFailuresRef = useRef(0);
  const paidNotifiedRef = useRef(false);

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
      setVerifySlideResult("paid");
      setError("");
      stopPolling();
      onPaid?.(payload);
    },
    [onPaid, stopPolling],
  );

  const applyStatusPayload = useCallback(
    (data, { fromManualCheck = false } = {}) => {
      const nextPayment = data?.payment && typeof data.payment === "object" ? data.payment : data;
      const nextStatus = pickStatus(data) ?? pickStatus(nextPayment);

      if (data?.verification_note) {
        setVerificationNote(String(data.verification_note));
      } else if (fromManualCheck && nextStatus !== "paid") {
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

      if (fromManualCheck) {
        if (nextStatus === "expired") {
          setVerifySlideResult("error");
        } else {
          setVerifySlideResult("pending");
        }
      }

      return nextStatus;
    },
    [handlePaid],
  );

  const createKhqr = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    paidNotifiedRef.current = false;
    setVerifySlideResult(null);

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

  const checkStatus = useCallback(
    async ({ manual = false } = {}) => {
      const targetId = paymentId;
      if (!targetId || paidNotifiedRef.current) return null;

      if (manual) {
        setChecking(true);
        setVerifySlideResult(null);
      }

      try {
        const { data } = await api.get(`/payments/bakong/status/${targetId}`);
        pollFailuresRef.current = 0;
        if (!manual) {
          setError("");
        }

        const result = applyStatusPayload(data, { fromManualCheck: manual });
        return result;
      } catch (e) {
        pollFailuresRef.current += 1;
        if (e?.response?.status === 403) {
          setError(e?.response?.data?.message || "Unauthorized.");
          setStatus("error");
          if (manual) setVerifySlideResult("error");
          stopPolling();
          return "error";
        }
        if (manual || pollFailuresRef.current >= 3) {
          setError(
            e?.response?.data?.message ||
              "Unable to verify payment status. Slide to check again after paying.",
          );
          if (manual) setVerifySlideResult("error");
        }
        return "error";
      } finally {
        if (manual) setChecking(false);
      }
    },
    [applyStatusPayload, paymentId, stopPolling],
  );

  const handleSlideVerify = useCallback(async () => {
    await checkStatus({ manual: true });
  }, [checkStatus]);

  useEffect(() => {
    if (!open) return;
    createKhqr();
  }, [open, createKhqr]);

  useEffect(() => {
    if (!open) return;
    if (status === "paid" || status === "expired" || status === "error") return;
    if (!paymentId) return;

    checkStatus();
    pollRef.current = setInterval(() => {
      checkStatus();
    }, 3000);

    return () => {
      stopPolling();
    };
  }, [open, status, checkStatus, paymentId, stopPolling]);

  useEffect(() => {
    if (!open) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible" && status === "pending") {
        checkStatus();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [checkStatus, open, status]);

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setPaymentId(null);
      setStatus("idle");
      setError("");
      setChecking(false);
      pollFailuresRef.current = 0;
      paidNotifiedRef.current = false;
      setVerificationNote("");
      setVerifySlideResult(null);
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
      amount={amount}
      currency={payment?.currency || currency}
      onRegenerate={createKhqr}
      onSlideVerify={handleSlideVerify}
      slideVerifyBusy={checking}
      slideVerifyResult={verifySlideResult}
    />
  );
}
