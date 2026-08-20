import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-border bg-raised px-1",
        "font-mono text-[10px] font-medium leading-none text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
