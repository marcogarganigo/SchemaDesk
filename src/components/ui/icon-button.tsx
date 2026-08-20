"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, active, size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-active={active || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-secondary transition-colors duration-150",
        "hover:bg-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        className,
      )}
      {...props}
    />
  );
});
