import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { resolveImageUrl } from "../../lib/images";

const ASSISTANT_TITLE = "Fit & Sleek AI Assistant";

const WELCOME_MESSAGE =
  "សួស្ដី — ខ្ញុំជួយគ្រប់គ្រង Fit & Sleek Admin Console។\n\n" +
  "ខ្ញុំអាចឆ្លើយអំពី៖\n" +
  "• Revenue & orders (today, 7d, 30d)\n" +
  "• Top selling products & recent orders\n" +
  "• Stock, inventory & low-stock alerts\n" +
  "• Customers, payments & replacements\n\n" +
  "សួរជាភាសាខ្មែរឬអង់គ្លេសបាន។";

const QUICK_SUGGESTIONS = [
  { label: "Revenue today", text: "How much revenue today?" },
  { label: "Top products", text: "What products sold best in the last 30 days?" },
  { label: "Pending orders", text: "How many pending orders and who are the customers?" },
  { label: "លក់ថ្ងៃនេះ", text: "តើលក់បានប៉ុន្មានថ្ងៃនេះ?" },
  { label: "ផលិតផលលក់ដាច់", text: "លក់បានផលិតផលអ្វីខ្លះ?" },
  { label: "Low stock", text: "Which products are low on stock?" },
  { label: "បញ្ចុះតម្លៃ", text: "តើយើងគួរបញ្ចុះតម្លៃអីវ៉ាន់ណាខ្លះ?" },
];

const ASK_AI_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 16 16" fill="none" role="img" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.7258 8.81331L13.1987 8.00002L10.7258 7.18674C9.82078 6.88908 9.11092 6.17922 8.81326 5.27416L7.99998 2.80127L7.18669 5.27416C6.88903 6.17922 6.17917 6.88908 5.27411 7.18674L2.80122 8.00002L5.27411 8.81331C6.17917 9.11097 6.88903 9.82083 7.18669 10.7259L7.99998 13.1988L8.81326 10.7259C9.11092 9.82083 9.82078 10.7259 10.7258 8.81331ZM13.6674 9.42494C15.0425 8.97267 15.0425 7.02737 13.6674 6.57511L11.1945 5.76182C10.7419 5.61299 10.387 5.25806 10.2382 4.80553L9.42489 2.33264C8.97263 0.957479 7.02732 0.957479 6.57506 2.33264L5.76177 4.80553C5.61294 5.25806 5.25801 5.61299 4.80548 5.76182L2.33259 6.57511C0.957432 7.02737 0.957434 8.97268 2.3326 9.42494L4.80548 10.2382C5.25801 10.3871 5.61294 10.742 5.76177 11.1945L6.57506 13.6674C7.02733 15.0426 8.97263 15.0426 9.42489 13.6674L10.2382 11.1945C10.387 10.742 10.7419 10.3871 11.1945 10.2382L13.6674 9.42494Z"
      fill="currentColor"
    />
  </svg>
);

/** Render common markdown from AI replies (lists, bold, headings, tables). */
function formatInlineText(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

function isMarkdownTableRow(line) {
  const t = String(line || "").trim();
  return t.startsWith("|") && t.endsWith("|") && t.includes("|");
}

function isMarkdownTableSeparator(line) {
  const t = String(line || "").trim();
  return /^\|[-:\s|]+\|$/.test(t);
}

function parseMarkdownTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function stripMarkdownTables(text) {
  return String(text || "")
    .replace(/^\|.+\|\s*\n\|[-:\s|]+\|\s*\n(?:\|.+\|\s*\n?)*/gm, "")
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function MarkdownTable({ headers, rows }) {
  if (!headers?.length) return null;

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[240px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 ${
                    i > 0 ? "text-right" : "text-left"
                  }`}
                >
                  {formatInlineText(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-700/70 ${
                  ri % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-900/20" : ""
                }`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 text-slate-700 dark:text-slate-200 ${
                      ci > 0 ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {formatInlineText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssistantMessageContent({ content }) {
  const lines = String(content || "").split("\n");
  const blocks = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (listItems.length === 0) return;

    if (listType === "ol") {
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-1.5 list-decimal space-y-1 pl-5">
          {listItems}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-5">
          {listItems}
        </ul>
      );
    }

    listItems = [];
    listType = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (isMarkdownTableRow(lines[index]) && index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1])) {
      flushList();
      const headers = parseMarkdownTableRow(lines[index]);
      index += 2;
      const rows = [];
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        rows.push(parseMarkdownTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push(<MarkdownTable key={`tbl-${blocks.length}`} headers={headers} rows={rows} />);
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushList();
      blocks.push(
        <p key={`h-${index}`} className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          {formatInlineText(headingMatch[1])}
        </p>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[*•-]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(<li key={`li-${index}`}>{formatInlineText(bulletMatch[1])}</li>);
      continue;
    }

    if (numberedMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(<li key={`li-${index}`}>{formatInlineText(numberedMatch[1])}</li>);
      continue;
    }

    flushList();

    if (trimmed === "") {
      if (blocks.length > 0) {
        blocks.push(<div key={`sp-${index}`} className="h-1.5" aria-hidden="true" />);
      }
      continue;
    }

    blocks.push(
      <p key={`p-${index}`} className={blocks.length > 0 ? "mt-1" : undefined}>
        {formatInlineText(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
}

function ProductThumb({ name, imageUrl }) {
  const src = resolveImageUrl(imageUrl);
  return (
    <img
      src={src}
      alt={name || "Product"}
      className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-600"
      loading="lazy"
      onError={(e) => {
        e.currentTarget.src = "/placeholder.svg";
      }}
    />
  );
}

function AssistantStatsTable({ table }) {
  if (!table?.rows?.length) return null;

  const title = table.title_km || table.title;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-600">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 text-xs font-semibold text-slate-800 dark:border-slate-600 dark:from-slate-900/80 dark:to-slate-900/40 dark:text-slate-100">
        {title}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
        {table.rows.map((row, index) => (
          <div
            key={row.label || index}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 text-xs ${
              index % 2 === 1 ? "bg-slate-50/70 dark:bg-slate-900/25" : ""
            }`}
          >
            <span className="text-slate-600 dark:text-slate-400">{row.label_km || row.label}</span>
            <span className="shrink-0 rounded-md bg-[rgba(var(--admin-primary-rgb),0.1)] px-2 py-0.5 font-semibold tabular-nums text-slate-900 dark:text-white">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantProductTable({ table }) {
  if (!table?.rows?.length) return null;

  const isSales = table.variant === "sales";
  const isDiscount = table.variant === "discount";
  const title = table.title_km || table.title;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-600">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 text-xs font-semibold text-slate-800 dark:border-slate-600 dark:from-slate-900/80 dark:to-slate-900/40 dark:text-slate-100">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-600 dark:bg-slate-900/50">
              <th className="px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300">Product</th>
              {isDiscount ? (
                <>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Stock</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Sold</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Suggest</th>
                </>
              ) : isSales ? (
                <>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Revenue</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Stock</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Price</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr
                key={row.id || row.name}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-700/70 ${
                  index % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-900/20" : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <ProductThumb name={row.name} imageUrl={row.image_url} />
                    <div className="min-w-0">
                      {row.admin_url ? (
                        <Link
                          to={row.admin_url}
                          className="line-clamp-2 font-medium text-[color:var(--admin-primary)] hover:underline"
                          title={row.name}
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="line-clamp-2 font-medium">{row.name}</span>
                      )}
                      {row.storefront_url ? (
                        <Link
                          to={row.storefront_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-[10px] text-slate-500 hover:text-[color:var(--admin-primary)] dark:text-slate-400"
                        >
                          View store →
                        </Link>
                      ) : null}
                      {isDiscount ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                          {row.reason_km || row.reason}
                        </p>
                      ) : null}
                      {isDiscount ? (
                        <Link
                          to="/admin/discounts"
                          className="mt-0.5 inline-block text-[10px] font-medium text-[color:var(--admin-primary)] hover:underline"
                        >
                          Add discount →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </td>
                {isDiscount ? (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.stock ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.sold_30d ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        {row.suggested_discount_pct ?? 0}%
                      </span>
                    </td>
                  </>
                ) : isSales ? (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.qty_sold ?? 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      ${Number(row.revenue ?? 0).toFixed(2)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className={row.stock < 3 ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                        {row.stock ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">${Number(row.price ?? 0).toFixed(2)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssistantDataTable({ table }) {
  if (table?.variant === "summary" || table?.type === "stats") {
    return <AssistantStatsTable table={table} />;
  }

  return <AssistantProductTable table={table} />;
}

function AssistantRichContent({ content, tables }) {
  const hasTables = Array.isArray(tables) && tables.length > 0;
  const displayContent = hasTables ? stripMarkdownTables(content) : content;

  return (
    <div className="space-y-1">
      {displayContent ? <AssistantMessageContent content={displayContent} /> : null}
      {hasTables
        ? tables.map((table, index) => (
            <AssistantDataTable key={`${table.variant || table.type}-${index}`} table={table} />
          ))
        : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-1.5" aria-label="AI is typing">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--admin-primary)] [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--admin-primary)] [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[color:var(--admin-primary)] [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, content, tables }) {
  const isUser = role === "user";
  const hasTables = !isUser && Array.isArray(tables) && tables.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          hasTables ? "max-w-[96%]" : "max-w-[88%]"
        } ${
          isUser
            ? "whitespace-pre-wrap rounded-br-md bg-[color:var(--admin-primary)] text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        {isUser ? content : <AssistantRichContent content={content} tables={tables} />}
      </div>
    </div>
  );
}

/** Trigger button — exact structure from spec, tuned for admin light/dark topbar */
export function AdminAiAssistantButton({ onClick, className = "" }) {
  return (
    <button
      aria-label="Ask AI"
      type="button"
      tabIndex={0}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md border border-slate-200 bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition-colors hover:bg-slate-100 dark:border-neutral-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-neutral-800 ${className}`}
    >
      <span className="text-[color:var(--admin-primary)]">{ASK_AI_ICON}</span>
      Ask AI
    </button>
  );
}

export default function AdminAiAssistant({ open, onClose }) {
  const [messages, setMessages] = useState([
    { id: "welcome", role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState("");
  const [panelVisible, setPanelVisible] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setPanelVisible(true));
      const t = window.setTimeout(() => inputRef.current?.focus(), 320);
      return () => window.clearTimeout(t);
    }
    setPanelVisible(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  const sendMessage = useCallback(
    async (textOverride) => {
      const text = (typeof textOverride === "string" ? textOverride : input).trim();
      if (!text || loading) return;

      setError(null);
      setInput("");
      const userMsg = { id: `u-${Date.now()}`, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const { data } = await api.post("/ai/chat", {
          message: text,
          conversation_id: conversationId || undefined,
        });

        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply,
            tables: Array.isArray(data.tables) ? data.tables : [],
          },
        ]);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Something went wrong. Please try again.";
        setError(typeof msg === "string" ? msg : "AI request failed.");
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `⚠️ ${typeof msg === "string" ? msg : "The AI service is unavailable. Check Dify and your local LLM."}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, input, loading]
  );

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={ASSISTANT_TITLE}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close assistant"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${panelVisible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 ${
          panelVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(var(--admin-primary-rgb),0.12)] text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.18)]">
              {ASK_AI_ICON}
            </span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ASSISTANT_TITLE}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} content={m.content} tables={m.tables} />
          ))}
          {loading ? <TypingIndicator /> : null}
        </div>

        {error ? (
          <p className="shrink-0 px-4 pb-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {/* Quick suggestions */}
        {!loading && (
          <div className="shrink-0 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Quick ask
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={loading}
                  onClick={() => sendMessage(s.text)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-[rgba(var(--admin-primary-rgb),0.4)] hover:bg-[rgba(var(--admin-primary-rgb),0.08)] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer input */}
        <form
          onSubmit={onSubmit}
          className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about revenue, orders, products, stock..."
              disabled={loading}
              className="max-h-28 min-h-[2.25rem] flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--admin-primary)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
