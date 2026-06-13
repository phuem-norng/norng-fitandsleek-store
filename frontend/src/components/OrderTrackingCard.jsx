import React from "react";
import { CheckCircle, Package, ShoppingBag, Truck } from "lucide-react";
import ExternalCourierTrackButton from "./ExternalCourierTrackButton.jsx";

const TIMELINE_STEPS = [
  { status: "pending", labelKey: "statusPending", fallback: "Order placed", icon: ShoppingBag },
  { status: "confirmed", labelKey: "statusConfirmed", fallback: "Confirmed", icon: CheckCircle },
  { status: "processing", labelKey: "statusProcessing", fallback: "Processing", icon: Package },
  { status: "shipped", labelKey: "statusShipped", fallback: "Shipped", icon: Truck },
  { status: "delivered", labelKey: "statusDelivered", fallback: "Delivered", icon: CheckCircle },
];

export function getOrderStatusStep(status) {
  const steps = { pending: 0, pending_payment: 0, paid: 1, confirmed: 1, processing: 2, preparing: 2, shipped: 3, completed: 4, delivered: 4 };
  return steps[String(status || "").toLowerCase()] ?? 0;
}

export default function OrderTrackingCard({ order, t, compact = false }) {
  const orderLabel = order.order_number || `#${order.id}`;
  const currentStep = getOrderStatusStep(order.status);
  const shipment = order.shipment;
  const hasCourierLink = Boolean(shipment?.external_tracking_url);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{t("orderNumber") || "Order"} {orderLabel}</h3>
          <p className="text-sm text-gray-600">
            {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
            {" · "}
            <span className="capitalize font-medium text-gray-800">{order.status}</span>
          </p>
        </div>
        <p className="text-lg font-bold text-[#6F8B7F]">${Number(order.total || 0).toFixed(2)}</p>
      </div>

      {!compact ? (
        <div className="mt-5 space-y-3">
          {TIMELINE_STEPS.map((step, idx) => {
            const stepNum = getOrderStatusStep(step.status);
            const isCompleted = stepNum <= currentStep;
            const isCurrent = stepNum === currentStep;
            const Icon = step.icon;

            return (
              <div key={step.status} className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${
                    isCompleted ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  {isCompleted ? <Icon className="h-4 w-4" /> : <span className="text-sm font-bold">{idx + 1}</span>}
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isCurrent ? "text-[#6F8B7F]" : isCompleted ? "text-emerald-700" : "text-gray-500"
                    }`}
                  >
                    {t(step.labelKey) || step.fallback}
                  </p>
                  {isCurrent ? (
                    <p className="text-xs text-[#6F8B7F]">{t("currentStatus") || "Current status"}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {hasCourierLink ? (
          <>
            <ExternalCourierTrackButton
              url={shipment.external_tracking_url}
              provider={shipment.provider}
              label={
                shipment.provider && shipment.provider !== "Internal"
                  ? `${t("trackOnCourier") || "Track on"} ${shipment.provider}`
                  : (t("trackPackage") || "Track package")
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[#6F8B7F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5f786d] transition-colors"
            />
            {shipment.tracking_code ? (
              <span className="text-xs text-gray-600 font-mono">
                {t("trackingNumber")}: {shipment.tracking_code}
              </span>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-600">
            {["shipped", "completed", "delivered"].includes(String(order.status || "").toLowerCase())
              ? (t("trackAwaitingCourier") || "Courier tracking link is not available yet.")
              : (t("trackNotShippedYet") || "Tracking will be available once your order ships.")}
          </p>
        )}
      </div>
    </div>
  );
}
