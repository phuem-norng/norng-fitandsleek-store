import React from "react";
import AdminTablePagination from "./AdminTablePagination.jsx";

/**
 * Numbered list footer — Previous · 1 2 3 … · Next
 */
export default function AdminListPaginationBar({
  page,
  lastPage,
  total: _total,
  onPageChange,
  onPrevious,
  onNext,
}) {
  if (lastPage <= 1) return null;

  const changePage = (target) => {
    if (typeof onPageChange === "function") {
      onPageChange(target);
      return;
    }
    if (target < page) onPrevious?.();
    else if (target > page) onNext?.();
  };

  return (
    <AdminTablePagination page={page} lastPage={lastPage} onPageChange={changePage} />
  );
}
