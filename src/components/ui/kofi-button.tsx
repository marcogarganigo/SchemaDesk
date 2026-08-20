"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export const KO_FI_URL = "https://ko-fi.com/marcogarganigo";

interface KoFiButtonProps {
  /** icon: square icon button · pill: bordered pill with text · text: plain inline link */
  variant?: "icon" | "pill" | "text";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Dedicated donation button pointing at the project's Ko-fi page. The solid
 * heart matches Ko-fi's brand mark; it opens in a new tab.
 */
export function KoFiButton({ variant = "pill", className, children }: KoFiButtonProps) {
  return (
    <a
      href={KO_FI_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Support Schema Desk on Ko-fi"
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        variant === "icon" &&
          "h-8 w-8 rounded-lg text-secondary hover:bg-raised hover:text-foreground",
        variant === "pill" &&
          "h-8 rounded-lg border border-border bg-elevated px-3 text-[13px] font-medium text-foreground hover:bg-raised",
        variant === "text" && "text-[12.5px] text-muted hover:text-foreground",
        className,
      )}
    >
      <Heart className="h-3.5 w-3.5 shrink-0 text-[#ff5f5f] fill-[#ff5f5f]" aria-hidden="true" />
      {variant !== "icon" && (children ?? "Support on Ko-fi")}
    </a>
  );
}
