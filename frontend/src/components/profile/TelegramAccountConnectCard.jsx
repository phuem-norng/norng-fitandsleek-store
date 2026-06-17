import React from "react";
import TelegramConnectButton from "../TelegramConnectButton.jsx";

export default function TelegramAccountConnectCard({ t }) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5 dark:border-sky-900/40 dark:bg-sky-950/20">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
        {t("telegramNotifications") || "Telegram notifications"}
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {t("telegramNotificationsHint") ||
          "Connect once to receive order, shipping, and delivery updates in Telegram."}
      </p>
      <div className="mt-4">
        <TelegramConnectButton
          label={t("connectTelegram") || "Connect Telegram"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
        />
      </div>
    </div>
  );
}
