import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function DiscountsToolbarMenu({
  value,
  onChange,
  ariaLabel,
  options = [],
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((o) => String(o.value) === String(value)) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`fs-discounts-toolbar__field fs-discounts-toolbar__field--menu ${className}`}
    >
      <button
        type="button"
        className="fs-discounts-toolbar__menu-btn"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={`fs-discounts-toolbar__chevron-inline shrink-0 ${open ? "is-open" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul id={listId} className="fs-discounts-toolbar__menu" role="listbox">
          {options.map((opt) => {
            const active = String(opt.value) === String(value);
            return (
              <li key={opt.value === "" ? "__all" : opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? "is-active" : ""}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
