import React from "react";
import { cn } from "@/lib/utils";

/** Clip-path ring loader (styles: `html.admin-dashboard .admin-dashboard-loader`). */
export function AdminDashboardLoader({ size = 48, className = "" }) {
 const scale = Math.max(0.25, Number(size) || 48) / 48;
 return (
 <span
 className={cn("inline-grid place-items-center shrink-0 overflow-hidden", className)}
 style={{ width: size, height: size }}
 role="status"
 aria-live="polite"
 aria-label="Loading"
 >
 <span
 className="admin-dashboard-loader"
 style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
 aria-hidden
 />
 </span>
 );
}

/** Full-page admin wait: spinner only (transparent; no card, no caption). */
export function AdminPageLoader({ className = "" }) {
 return (
 <div
 className={cn(
 "flex w-full flex-1 min-h-0 flex-col items-center justify-center px-6 py-16",
 className
 )}
 aria-busy="true"
 aria-live="polite"
 >
 <AdminDashboardLoader size={52} />
 </div>
 );
}

/** Inline section wait (e.g. table body): spinner only. */
export function AdminSectionLoader({ className = "" }) {
 return (
 <div
 className={cn(
 "flex w-full min-h-[min(360px,calc(100dvh-14rem))] flex-col items-center justify-center px-6 py-20",
 className
 )}
 aria-busy="true"
 aria-live="polite"
 >
 <AdminDashboardLoader />
 </div>
 );
}

/**
 * Page outlet wait: centered spinner on the admin surface (no card, no “Loading” text).
 * Legacy props (`lines`, `imageHeight`, `title`, …) ignored for call-site compatibility.
 */
export function AdminContentSkeleton({ className = "" }) {
 return (
 <div
 className={cn(
 "flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-transparent",
 className
 )}
 aria-busy="true"
 aria-live="polite"
 >
 <AdminDashboardLoader />
 </div>
 );
}
