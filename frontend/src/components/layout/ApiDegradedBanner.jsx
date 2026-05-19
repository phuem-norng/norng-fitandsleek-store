import React, { useCallback, useEffect, useState } from "react";
import { subscribeApiInfrastructureDegraded } from "../../lib/apiHealth";
import { useLanguage } from "../../lib/i18n.jsx";

export default function ApiDegradedBanner() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribeApiInfrastructureDegraded(() => setOpen(true));
  }, []);

  const onRetry = useCallback(() => {
    window.location.reload();
  }, []);

  if (!open) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-200/80 bg-amber-50 text-amber-950 px-3 sm:px-4 py-2.5 text-sm leading-snug"
    >
      <div className="mx-auto max-w-[1600px] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="font-semibold">{t("catalogUnavailable")}</p>
          <p className="mt-0.5 text-amber-900/90 text-xs sm:text-sm">{t("catalogUnavailableHint")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
          >
            {t("retryPage")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-amber-300/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-white transition-colors"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
