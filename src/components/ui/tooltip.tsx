"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Kbd } from "./kbd";

export interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  disabled?: boolean;
}

const OFFSET = 10;

export function Tooltip({ content, shortcut, side = "top", children, disabled }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const [resolvedSide, setResolvedSide] = useState(side);

  const show = useCallback(() => {
    if (disabled) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = rect.left + rect.width / 2;
    let y = rect.top;
    let finalSide = side;

    if (side === "top") {
      y = rect.top - OFFSET;
    } else if (side === "bottom") {
      y = rect.bottom + OFFSET;
    } else if (side === "left") {
      x = rect.left - OFFSET;
      y = rect.top + rect.height / 2;
    } else if (side === "right") {
      x = rect.right + OFFSET;
      y = rect.top + rect.height / 2;
    }

    // For top/bottom: check if tooltip text would overflow horizontally
    if (finalSide === "top" || finalSide === "bottom") {
      // Estimate tooltip width based on content length
      const contentStr = String(content ?? "");
      const estimatedWidth = Math.min(contentStr.length * 7 + (shortcut ? 50 : 0) + 32, 220);
      const halfW = estimatedWidth / 2;
      
      // If tooltip would go off left or right edge, flip to the other side vertically
      if (x - halfW < 8 || x + halfW > vw - 8) {
        // Keep horizontal position, just let CSS clamp handle it
      }
      
      // Check vertical space
      if (finalSide === "top" && rect.top < 50) {
        finalSide = "bottom";
        y = rect.bottom + OFFSET;
      } else if (finalSide === "bottom" && rect.bottom > vh - 50) {
        finalSide = "top";
        y = rect.top - OFFSET;
      }
    }

    // For left/right: check if tooltip would overflow vertically
    if (finalSide === "left" || finalSide === "right") {
      if (y < 40) {
        y = 40;
      } else if (y > vh - 40) {
        y = vh - 40;
      }
      
      // Check horizontal space and flip if needed
      if (finalSide === "left" && rect.left < 120) {
        finalSide = "right";
        x = rect.right + OFFSET;
      } else if (finalSide === "right" && rect.right > vw - 120) {
        finalSide = "left";
        x = rect.left - OFFSET;
      }
    }

    setPos({ x, y });
    setResolvedSide(finalSide);
    timer.current = setTimeout(() => setOpen(true), 250);
  }, [disabled, side, content, shortcut]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }, []);

  const transform =
    resolvedSide === "top"
      ? "translate(-50%, -100%)"
      : resolvedSide === "bottom"
        ? "translate(-50%, 0)"
        : resolvedSide === "left"
          ? "translate(-100%, -50%)"
          : "translate(0, -50%)";

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="tooltip"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="pointer-events-none fixed z-[120] flex items-center gap-1.5"
                style={{ left: pos.x, top: pos.y, transform }}
              >
                <span className="rounded-md border border-border bg-elevated px-2 py-1 text-[11px] font-medium text-secondary shadow-pop whitespace-nowrap">
                  {content}
                </span>
                {shortcut && <Kbd className="shadow-pop">{shortcut}</Kbd>}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
