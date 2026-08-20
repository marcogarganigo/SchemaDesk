"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  size: number;
  onSizeChange: (size: number) => void;
  min?: number;
  max?: number;
}

export function SplitPane({
  left,
  right,
  size,
  onSizeChange,
  min = 300,
  max = 760,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, value)),
    [min, max],
  );

  // Never leave the diagram with less than 300px — clamp on mount and resize.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const constrain = () => {
      const available = container.clientWidth - 320;
      if (available > min && size > available) onSizeChange(available);
    };
    constrain();
    const observer = new ResizeObserver(constrain);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, size]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        onSizeChange(clamp(ev.clientX - rect.left));
      };
      const onUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clamp, onSizeChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSizeChange(clamp(size - 24));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onSizeChange(clamp(size + 24));
      } else if (event.key === "Home") {
        event.preventDefault();
        onSizeChange(min);
      } else if (event.key === "End") {
        event.preventDefault();
        onSizeChange(max);
      }
    },
    [clamp, max, min, onSizeChange, size],
  );

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div style={{ width: size }} className="shrink-0 overflow-hidden">
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(size)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={cn(
          "group relative z-20 flex w-[10px] shrink-0 cursor-col-resize items-center justify-center",
          "focus-visible:outline-none",
        )}
      >
        {/* Hairline separator */}
        <div
          className={cn(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150",
            dragging ? "bg-accent" : hovering ? "bg-border-strong" : "bg-border-subtle",
          )}
        />
        {/* Grip handle — three dots, so it reads as a drag handle rather
            than a scrollbar thumb. */}
        <div
          className={cn(
            "flex h-8 w-[6px] items-center justify-center rounded-full border transition-all duration-150",
            dragging
              ? "border-accent/50 bg-raised shadow-[0_0_0_3px_var(--accent-soft)]"
              : hovering
                ? "border-border-strong bg-raised shadow-node"
                : "border-border-subtle bg-surface",
          )}
        >
          <div className="flex flex-col items-center gap-[3px]">
            <span
              className={cn(
                "h-[2px] w-[2px] rounded-full transition-colors duration-150",
                dragging || hovering ? "bg-accent" : "bg-faint",
              )}
            />
            <span
              className={cn(
                "h-[2px] w-[2px] rounded-full transition-colors duration-150",
                dragging || hovering ? "bg-accent" : "bg-faint",
              )}
            />
            <span
              className={cn(
                "h-[2px] w-[2px] rounded-full transition-colors duration-150",
                dragging || hovering ? "bg-accent" : "bg-faint",
              )}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
