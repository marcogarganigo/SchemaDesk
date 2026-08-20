"use client";

import {
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";
import type { LucideIcon } from "lucide-react";

export interface DropdownItem {
  type?: "item";
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  checked?: boolean;
}

export interface DropdownSeparator {
  type: "separator";
}

export interface DropdownLabel {
  type: "label";
  label: string;
}

export type DropdownEntry = DropdownItem | DropdownSeparator | DropdownLabel;

export function DropdownMenu({
  trigger,
  items,
  align = "end",
  label,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  items: DropdownEntry[];
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectable = useMemo(
    () => items.filter((i): i is DropdownItem => i.type !== "separator" && i.type !== "label"),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const runItem = (item: DropdownItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (selectable.length ? (i + 1) % selectable.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (selectable.length ? (i - 1 + selectable.length) % selectable.length : 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = selectable[activeIndex];
      if (item) runItem(item);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(selectable.length - 1);
    }
  };

  const triggerElement = cloneElement(trigger, {
    onClick: (event: React.MouseEvent) => {
      const original = trigger.props.onClick as ((e: React.MouseEvent) => void) | undefined;
      original?.(event);
      setOpen((o) => !o);
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-label": (trigger.props["aria-label"] as string | undefined) ?? label,
    onKeyDown: handleKeyDown,
  });

  return (
    <div ref={containerRef} className="relative inline-flex">
      {triggerElement}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            className={cn(
              "absolute top-full z-[90] mt-1.5 min-w-[210px] origin-top rounded-xl border border-border bg-elevated p-1.5 shadow-float",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {items.map((entry, i) => {
              if (entry.type === "separator") {
                return <div key={i} className="my-1.5 h-px bg-border-subtle" />;
              }
              if (entry.type === "label") {
                return (
                  <div key={i} className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
                    {entry.label}
                  </div>
                );
              }
              const Icon = entry.icon;
              const isActive = activeIndex === selectable.indexOf(entry);
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={entry.disabled}
                  onMouseEnter={() => setActiveIndex(selectable.indexOf(entry))}
                  onClick={() => runItem(entry)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium",
                    "disabled:pointer-events-none disabled:opacity-40",
                    entry.danger ? "text-danger" : "text-secondary",
                    isActive && (entry.danger ? "bg-danger-soft text-danger" : "bg-raised text-foreground"),
                  )}
                >
                  {Icon && <Icon className={cn("h-4 w-4 shrink-0", entry.danger ? "text-danger" : "text-muted")} />}
                  <span className="flex-1 truncate">{entry.label}</span>
                  {entry.checked && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  {entry.shortcut && <Kbd>{entry.shortcut}</Kbd>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
