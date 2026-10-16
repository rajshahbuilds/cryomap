import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  /** Screen position (clientX/clientY). */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** A small popover menu anchored at a screen position. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Start at the anchor; clamp into the viewport once we can measure the menu,
  // so it never spills off the bottom/right edge near the screen border.
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const { width, height } = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (top + height > window.innerHeight - margin) {
      top = window.innerHeight - height - margin;
    }
    setPos({ left: Math.max(margin, left), top: Math.max(margin, top) });
  }, [x, y]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-20 min-w-36 rounded-lg border border-border bg-surface p-1 shadow-md"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40 ${
            item.danger ? "text-status-broken" : "text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
