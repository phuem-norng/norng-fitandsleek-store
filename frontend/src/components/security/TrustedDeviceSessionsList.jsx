import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { groupTrustedDeviceSessions } from "../../lib/trustedDeviceSessions.js";

function SessionMeta({ session, className = "", compact = false }) {
  if (compact) {
    return (
      <>
        <p className={`text-xs ${className}`}>
          {session.browser || "Unknown browser"} • {session.os || "Unknown OS"}
        </p>
        <p className={`text-xs ${className}`}>
          IP: {session.ip_address || "-"} • Last used: {session.last_used_at || session.last_login_at || "-"}
        </p>
      </>
    );
  }

  return (
    <>
      <p className={`text-xs ${className}`}>
        {session.browser || "Unknown browser"} • {session.os || "Unknown OS"}
      </p>
      <p className={`text-xs ${className}`}>
        IP: {session.ip_address || "-"}
      </p>
      <p className={`text-xs ${className}`}>
        Last used: {session.last_used_at || session.last_login_at || "-"}
      </p>
    </>
  );
}

function SessionActions({ session, onRevoke, canRevoke, currentLabel, revokeLabel, currentBadgeClass, currentBadgeStyle, revokeButtonClass, revokeButtonStyle }) {
  return (
    <div className="flex items-center gap-2">
      {session.is_current ? (
        <span className={currentBadgeClass} style={currentBadgeStyle}>{currentLabel}</span>
      ) : null}
      {canRevoke ? (
        <button type="button" onClick={() => onRevoke(session.id)} className={revokeButtonClass} style={revokeButtonStyle}>
          {revokeLabel}
        </button>
      ) : null}
    </div>
  );
}

export default function TrustedDeviceSessionsList({
  sessions = [],
  onRevoke,
  canRevoke = true,
  currentLabel = "Current",
  revokeLabel = "Logout",
  historyRevokeLabel = "Remove",
  compactMeta = false,
  titleClassName = "font-semibold text-gray-800",
  metaClassName = "text-gray-600",
  mutedMetaClassName = "text-gray-500",
  cardClassName = "rounded-lg border border-gray-200 bg-gray-50 p-3",
  nestedCardClassName = "rounded-lg border border-gray-200 bg-white p-3 ml-8",
  currentBadgeClassName = "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700",
  currentBadgeStyle,
  revokeButtonClassName = "px-3 py-1.5 rounded-lg border border-red-300 text-xs font-semibold text-red-700 hover:bg-red-50",
  revokeButtonStyle,
  expandButtonClassName = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors",
}) {
  const groups = useMemo(() => groupTrustedDeviceSessions(sessions), [sessions]);
  const [expanded, setExpanded] = useState({});

  const toggleGroup = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3">
      {groups.map(({ key, primary, others, total }) => {
        const hasMore = others.length > 0;
        const isOpen = Boolean(expanded[key]);

        return (
          <div key={key} className={cardClassName}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(key)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Hide older sessions" : "Show older sessions"}
                    className={expandButtonClassName}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                ) : (
                  <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className={titleClassName}>
                    {primary.device_name || "Unknown device"}
                    {hasMore ? (
                      <span className={`ml-2 text-xs font-normal ${mutedMetaClassName}`}>
                        ({total} sessions)
                      </span>
                    ) : null}
                  </p>
                  <SessionMeta session={primary} className={metaClassName} compact={compactMeta} />
                </div>
              </div>
              <SessionActions
                session={primary}
                onRevoke={onRevoke}
                canRevoke={canRevoke}
                currentLabel={currentLabel}
                revokeLabel={revokeLabel}
                currentBadgeClass={currentBadgeClassName}
                currentBadgeStyle={currentBadgeStyle}
                revokeButtonClass={revokeButtonClassName}
                revokeButtonStyle={revokeButtonStyle}
              />
            </div>

            {hasMore && isOpen ? (
              <div className="mt-3 space-y-2">
                {others.map((session) => (
                  <div key={session.id} className={nestedCardClassName}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-sm font-medium ${titleClassName}`}>Previous session</p>
                        <SessionMeta session={session} className={mutedMetaClassName} compact={compactMeta} />
                      </div>
                      <SessionActions
                        session={session}
                        onRevoke={onRevoke}
                        canRevoke={canRevoke}
                        currentLabel={currentLabel}
                        revokeLabel={session.is_active === false ? historyRevokeLabel : revokeLabel}
                        currentBadgeClass={currentBadgeClassName}
                        currentBadgeStyle={currentBadgeStyle}
                        revokeButtonClass={revokeButtonClassName}
                        revokeButtonStyle={revokeButtonStyle}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
