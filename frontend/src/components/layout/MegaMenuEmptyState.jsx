import React from "react";

/** Centered placeholder when a mega menu section has no items. */
export default function MegaMenuEmptyState({ message }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center py-8">
      <p className="text-center text-base font-medium text-zinc-500">{message}</p>
    </div>
  );
}
