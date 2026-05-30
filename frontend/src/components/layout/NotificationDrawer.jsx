import React from "react";
import { Link } from "react-router-dom";
import { Bell, X, ExternalLink } from "lucide-react";
import { resolveImageUrl } from "../../lib/images";
import { resolveStorefrontPath } from "../../lib/paths";

function getNotificationIcon(type) {
  switch (type) {
    case "order":
      return "📦";
    case "promotion":
      return "🏷️";
    case "system":
      return "🔔";
    case "message":
      return "💬";
    default:
      return "📌";
  }
}

function inferMediaType(url, fallback = "") {
  if (fallback) return fallback;
  if (!url) return "";
  const lower = url.toLowerCase();
  if (lower.startsWith("data:video")) return "video";
  if (lower.startsWith("data:image")) return "image";
  if (lower.match(/\.(mp4|webm|ogg)(\?|#|$)/)) return "video";
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|#|$)/)) return "image";
  return "";
}

function resolveMediaUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : resolveImageUrl(url);
}

function NotificationThumbnail({ item }) {
  const mediaUrl = item.media_url ? resolveMediaUrl(item.media_url) : "";
  const mediaType = inferMediaType(item.media_url, item.media_type);

  if (mediaUrl && mediaType === "image") {
    return (
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        <img
          src={mediaUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    );
  }

  if (mediaUrl && mediaType === "video") {
    return (
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-900">
        <video
          src={mediaUrl}
          className="h-full w-full object-cover opacity-80"
          muted
          playsInline
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
          ▶
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-lg">
      {getNotificationIcon(item.type)}
    </div>
  );
}

export default function NotificationDrawer({
  open,
  onClose,
  notifications = [],
  loading = false,
  unreadCount = 0,
  onMarkRead = () => {},
  onMarkAllRead = () => {},
  user = null,
  formatTime = () => "",
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open}>
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-[340px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300 sm:max-w-sm"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6F8B7F]/10 text-[#6F8B7F]">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Notifications</h2>
              {unreadCount > 0 ? (
                <p className="text-[11px] text-zinc-500">
                  {unreadCount} unread
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {user && unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[#6F8B7F] transition-colors hover:bg-[#6F8B7F]/10"
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-200 border-t-[#6F8B7F]" />
              <p className="text-sm text-zinc-500">Loading…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                <Bell className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-900">No notifications</p>
              <p className="mt-1 text-xs text-zinc-500">
                We&apos;ll notify you when something new arrives.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {notifications.map((item) => {
                const storefrontPath = resolveStorefrontPath(item.link_url);

                return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onMarkRead(item)}
                    className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 ${
                      item.is_read ? "bg-white" : "bg-emerald-50/40"
                    }`}
                  >
                    <div className="relative shrink-0 pt-0.5">
                      <NotificationThumbnail item={item} />
                      {!item.is_read ? (
                        <span className="absolute -left-1.5 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${
                            item.is_read
                              ? "font-medium text-zinc-700"
                              : "font-semibold text-zinc-900"
                          }`}
                        >
                          {item.title || "Notification"}
                        </p>
                      </div>

                      {item.message ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                          {item.message}
                        </p>
                      ) : null}

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {formatTime ? (
                          <span className="text-[11px] text-zinc-400">
                            {formatTime(item.created_at)}
                          </span>
                        ) : null}
                        {storefrontPath ? (
                          <Link
                            to={storefrontPath}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                            }}
                            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#6F8B7F] hover:text-[#5a7368]"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
