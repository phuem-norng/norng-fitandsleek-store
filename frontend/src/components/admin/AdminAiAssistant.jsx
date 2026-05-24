import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../lib/api";

const ASSISTANT_TITLE = "Fit & Sleek AI Assistant";

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

function ChatBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-md bg-[color:var(--admin-primary)] text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        {content}
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
    {
      id: "welcome",
      role: "assistant",
      content:
        "សួស្ដី — សួរអ្វីត្រូវការបាន (ឧ. pending orders, revenue 7d, users)។ ខ្ញុំឆ្លើយតាមសំណួររបស់អ្នក។",
    },
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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
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
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply },
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
  }, [conversationId, input, loading]);

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
            <ChatBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {loading ? <TypingIndicator /> : null}
        </div>

        {error ? (
          <p className="shrink-0 px-4 pb-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

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
              placeholder="I am having trouble with..."
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
