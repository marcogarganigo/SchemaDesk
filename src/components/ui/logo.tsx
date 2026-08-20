"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The intro animation plays once per page session — on the very first logo
 * mount — and never replays on re-renders or client-side navigation.
 * `settled` is seeded from the module flag, so later mounts render static.
 */
let introPlayed = false;

interface LogoProps {
  className?: string;
  /** Extra classes for the wordmark span (e.g. hiding it on small screens). */
  wordmarkClassName?: string;
  size?: "sm" | "md";
}

/**
 * SchemaFlow logo — a minimal "flow" mark: three nodes joined by two curves
 * that trace an abstract S (SchemaFlow), followed by the wordmark. The accent
 * dot between "Schema" and "Flow" is the junction where they connect.
 */
export function Logo({ className, wordmarkClassName, size = "sm" }: LogoProps) {
  const [settled, setSettled] = useState(introPlayed);
  const playIntro = !introPlayed && !settled;

  useEffect(() => {
    introPlayed = true;
    // Safety net: force the logo into its final, fully visible state even if
    // the CSS animation is interrupted (reduced motion, suspended renderer).
    // Prefers-reduced-motion is handled in CSS, so this is a no-op there.
    // Scheduled unconditionally so StrictMode's effect cleanup can't drop it.
    const t = setTimeout(() => setSettled(true), 1050);
    return () => clearTimeout(t);
  }, []);

  const markClass = size === "md" ? "h-[19px] w-[19px]" : "h-[16px] w-[16px]";
  const textClass = size === "md" ? "text-[15px]" : "text-[13px]";
  const dotClass = size === "md" ? "h-[4px] w-[4px]" : "h-[3.5px] w-[3.5px]";

  return (
    <span className={cn("inline-flex select-none items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn("shrink-0 text-accent", markClass)}
      >
        <path
          className={playIntro ? "sf-logo-line sf-logo-line-a" : undefined}
          d="M 17 5.8 C 13.2 3.2, 9.4 8.4, 6 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          className={playIntro ? "sf-logo-line sf-logo-line-b" : undefined}
          d="M 6 12 C 9.4 15.6, 13.2 20.8, 17 18.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle
          className={playIntro ? "sf-logo-node sf-logo-node-a" : undefined}
          cx="17"
          cy="5.8"
          r="2.1"
          fill="currentColor"
        />
        <circle
          className={playIntro ? "sf-logo-node sf-logo-node-b" : undefined}
          cx="6"
          cy="12"
          r="2.1"
          fill="currentColor"
        />
        <circle
          className={playIntro ? "sf-logo-node sf-logo-node-c" : undefined}
          cx="17"
          cy="18.2"
          r="2.1"
          fill="currentColor"
        />
      </svg>

      <span
        className={cn(
          "inline-flex items-center font-semibold tracking-tight text-foreground",
          textClass,
          playIntro && "sf-logo-text",
          wordmarkClassName,
        )}
      >
        Schema
        <span
          className={cn(
            "mx-[4px] inline-block shrink-0 rounded-full bg-accent",
            dotClass,
            playIntro && "sf-logo-dot",
          )}
        />
        Flow
      </span>
    </span>
  );
}
