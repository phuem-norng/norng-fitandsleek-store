import { useEffect, useRef } from "react";
import { useTheme } from "../state/theme.jsx";

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "[role='button']",
  "[role='switch']",
  "input",
  "textarea",
  "select",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const TEXT_SELECTOR = [
  "p",
  "span",
  "label",
  "li",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "small",
  "strong",
  "em",
  "code",
  "input",
  "textarea",
  "[contenteditable='true']",
].join(",");

function targetLooksDanger(target) {
  const dangerEl = target?.closest?.(
    "[data-cursor-danger='true'], [data-danger='true'], .text-red-500, .text-red-600, .text-red-700, .text-rose-500, .text-rose-600, .text-rose-700"
  );
  if (dangerEl) return true;

  const actionEl = target?.closest?.("button, [role='button'], a");
  if (!actionEl) return false;

  const text = `${actionEl.getAttribute("aria-label") || ""} ${actionEl.getAttribute("title") || ""} ${actionEl.textContent || ""}`.toLowerCase();
  return /\b(delete|remove|trash|danger|destroy)\b/.test(text);
}

export default function CustomCursor() {
  const rootRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const { customCursor } = useTheme();

  useEffect(() => {
    if (!customCursor) {
      document.documentElement.classList.remove("fs-custom-cursor-enabled");
      return undefined;
    }

    const supportsFinePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
    if (!supportsFinePointer) return undefined;

    const root = document.documentElement;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const shell = rootRef.current;
    if (!dot || !ring || !shell) return undefined;

    root.classList.add("fs-custom-cursor-enabled");

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const follower = { x: pointer.x, y: pointer.y };
    let raf = 0;

    const setCursorMode = (target) => {
      const isDanger = targetLooksDanger(target);
      const interactive = target?.closest?.(INTERACTIVE_SELECTOR);
      const text = !interactive && target?.closest?.(TEXT_SELECTOR);

      shell.classList.toggle("is-interactive", Boolean(interactive));
      shell.classList.toggle("is-text", Boolean(text));
      shell.classList.toggle("is-danger", isDanger);
      shell.classList.toggle("is-hidden", false);
    };

    const handlePointerMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%)`;
      setCursorMode(event.target);
    };

    const handlePointerLeave = () => {
      shell.classList.add("is-hidden");
    };

    const handlePointerEnter = (event) => {
      shell.classList.remove("is-hidden");
      setCursorMode(event.target);
    };

    const animate = () => {
      follower.x += (pointer.x - follower.x) * 0.18;
      follower.y += (pointer.y - follower.y) * 0.18;
      ring.style.transform = `translate3d(${follower.x}px, ${follower.y}px, 0) translate(-50%, -50%)`;
      raf = window.requestAnimationFrame(animate);
    };

    raf = window.requestAnimationFrame(animate);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerenter", handlePointerEnter);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerenter", handlePointerEnter);
      root.classList.remove("fs-custom-cursor-enabled");
    };
  }, [customCursor]);

  if (!customCursor) return null;

  return (
    <div ref={rootRef} className="fs-custom-cursor" aria-hidden="true">
      <span ref={ringRef} className="fs-custom-cursor__ring" />
      <span ref={dotRef} className="fs-custom-cursor__dot" />
    </div>
  );
}
