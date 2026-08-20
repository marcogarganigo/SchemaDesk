"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string;
  disabled?: boolean;
  perform: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

function matchScore(command: PaletteCommand, query: string): number {
  if (!query) return 0;
  const haystack = `${command.label} ${command.description ?? ""} ${command.keywords ?? ""}`.toLowerCase();
  const q = query.toLowerCase();
  if (haystack.includes(q)) return 10 - Math.abs(haystack.indexOf(q));
  return -1;
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const scored = commands
      .map((c) => ({ command: c, score: matchScore(c, query) }))
      .filter((e) => e.score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((e) => e.command);
  }, [commands, query]);

  // Reset the search state when the palette opens — adjusted during render
  // (React's documented pattern) so no effect round-trip is needed.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  // Keep the highlighted row at the top whenever the query changes.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const run = (command: PaletteCommand) => {
    if (command.disabled) return;
    onClose();
    command.perform();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) run(command);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative flex w-full max-w-[540px] flex-col overflow-hidden rounded-xl border border-border bg-elevated shadow-float"
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search…"
                aria-label="Search commands"
                spellCheck={false}
                autoComplete="off"
                className="h-12 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint"
              />
              <Kbd className="border-border-subtle bg-transparent text-faint">esc</Kbd>
            </div>

            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-[13px] text-faint">
                  No matching commands
                </div>
              ) : (
                filtered.map((command, i) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      type="button"
                      data-index={i}
                      disabled={command.disabled}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => run(command)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        "disabled:pointer-events-none disabled:opacity-40",
                        i === activeIndex ? "bg-raised" : "bg-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface",
                          i === activeIndex ? "text-accent" : "text-muted",
                        )}
                      >
                        {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {command.label}
                        </span>
                        {command.description && (
                          <span className="block truncate text-[11px] text-muted">
                            {command.description}
                          </span>
                        )}
                      </span>
                      {command.shortcut && <Kbd>{command.shortcut}</Kbd>}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
