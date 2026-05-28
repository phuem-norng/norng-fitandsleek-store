import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import KhqrModal from "./KhqrModal";

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
  const pollRef = useRef(null);
  const pollFailuresRef = useRef(0);

  const createKhqr = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/payments/bakong/create", { order_id: orderId });
      const nextPayment = data?.payment || data;
      const nextStatus = nextPayment?.status || data?.status || "pending";
      setPayment(nextPayment);
      setPaymentId(nextPayment?.payment_id || nextPayment?.id);
      setStatus(nextStatus);
      if (nextStatus === "paid") {
        onPaid?.(nextPayment);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create KHQR.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [onPaid, orderId]);

  const checkStatus = useCallback(async () => {
    const targetId = paymentId;
    if (!targetId) return;

    try {
      const { data } = await api.get(`/payments/bakong/status/${targetId}`);
      pollFailuresRef.current = 0;
      setError("");

      const nextPayment = data?.payment || data;
      const nextStatus = nextPayment?.status || data?.status;

      // Only overwrite payment if we actually received QR details; otherwise keep existing
      const hasQr = nextPayment && (nextPayment.qr_string || nextPayment.qr_image_base64 || nextPayment.md5 || nextPayment.bill_number);
      if (hasQr) setPayment(nextPayment);
      if (nextStatus) {
        setStatus(nextStatus);
        if (nextStatus === "paid") onPaid?.(nextPayment || data);
      }
    } catch (e) {
      pollFailuresRef.current += 1;
      if (e?.response?.status === 403) {
        setError(e?.response?.data?.message || "Unauthorized.");
        setStatus("error");
        return;
      }
      if (pollFailuresRef.current >= 3) {
        setError(
          e?.response?.data?.message ||
            "Unable to verify payment status. Keep this screen open and try scanning again.",
        );
      }
    }
  }, [onPaid, paymentId]);

  useEffect(() => {
    if (!open) return;
    createKhqr();
  }, [open, createKhqr]);

  useEffect(() => {
    if (!open) return;
    if (status === "paid" || status === "expired" || status === "error") return;
    if (!paymentId) return;

    pollRef.current = setInterval(() => {
      checkStatus();
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [open, status, checkStatus, paymentId]);

  useEffect(() => {
    if (!open) {
      setPayment(null);
      setPaymentId(null);
      setStatus("idle");
      setError("");
      pollFailuresRef.current = 0;
    }
  }, [open]);

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
      amount={amount}
      currency={payment?.currency || currency}
      onRegenerate={createKhqr}
    />
  );
}
