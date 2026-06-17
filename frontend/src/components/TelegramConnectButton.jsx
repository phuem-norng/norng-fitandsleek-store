import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import {
  fetchTelegramOrderLink,
  fetchTelegramSettings,
  fetchTelegramStatus,
} from "../lib/telegram.js";

export default function TelegramConnectButton({
  orderNumber = null,
  connectUrl = null,
  className = "",
  label,
  compact = false,
}) {
  const [url, setUrl] = useState(connectUrl || "");
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(!connectUrl);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (connectUrl) {
          const settings = await fetchTelegramSettings();
          if (!mounted) return;
          setEnabled(Boolean(settings?.enabled));
          setUrl(connectUrl);
          setLoading(false);
          return;
        }

        const settings = await fetchTelegramSettings();
        if (!mounted) return;
        setEnabled(Boolean(settings?.enabled));
        if (!settings?.enabled) {
          setLoading(false);
          return;
        }

        if (orderNumber) {
          const orderLink = await fetchTelegramOrderLink(orderNumber);
          if (!mounted) return;
          setConnected(Boolean(orderLink?.connected));
          setUrl(orderLink?.connect_url || orderLink?.account_connect_url || "");
        } else {
          const status = await fetchTelegramStatus();
          if (!mounted) return;
          setConnected(Boolean(status?.connected));
          setUrl(status?.connect_url || "");
        }
      } catch {
        if (!mounted) return;
        setEnabled(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [connectUrl, orderNumber]);

  if (loading || !enabled || !url) {
    return null;
  }

  const text =
    label ||
    (orderNumber
      ? "Get delivery updates on Telegram"
      : connected
        ? "Open Telegram bot"
        : "Connect Telegram for order updates");

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        `inline-flex items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${
          compact ? "py-2.5" : ""
        }`
      }
    >
      <Send className={compact ? "h-4 w-4" : "h-5 w-5"} />
      <span>{text}</span>
    </a>
  );
}
