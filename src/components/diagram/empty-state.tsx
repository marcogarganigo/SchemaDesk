"use client";

import { motion } from "motion/react";
import { ArrowRight, Database, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ onLoadExample }: { onLoadExample: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="pointer-events-auto flex max-w-sm flex-col items-center text-center"
      >
        <div className="mb-5 flex items-end gap-3">
          <MiniTable className="origin-bottom" delay={0} x={-4} />
          <MiniTable className="origin-bottom" delay={0.12} highlight />
          <MiniTable className="origin-bottom" delay={0.24} x={4} />
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          Your database diagram will appear here
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Paste SQL on the left and press{" "}
          <kbd className="rounded border border-border bg-raised px-1 font-mono text-[10.5px] text-secondary">
            ⌘↵
          </kbd>{" "}
          to visualize your schema.
        </p>
        <Button variant="subtle" size="sm" className="mt-4" onClick={onLoadExample}>
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Try an example
        </Button>
      </motion.div>
    </div>
  );
}

function MiniTable({
  className,
  delay,
  highlight,
  x = 0,
}: {
  className?: string;
  delay: number;
  highlight?: boolean;
  x?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delay + 0.3, duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay }}
        className="relative"
        style={{ x }}
      >
        <div
          className={
            "w-[88px] rounded-lg border bg-[var(--node-bg)] shadow-node " +
            (highlight ? "border-accent/50" : "border-border")
          }
        >
          <div className="flex items-center gap-1 border-b border-[var(--node-row-border)] px-2 py-1.5">
            <Database className="h-2.5 w-2.5 text-faint" />
            <span className="h-1.5 w-10 rounded-sm bg-[var(--text-faint)]/40" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between px-2 py-[5px]">
              <span className="h-1 w-8 rounded-sm bg-[var(--text-faint)]/25" />
              <span className="h-1 w-4 rounded-sm bg-[var(--accent)]/30" />
            </div>
          ))}
        </div>
        {highlight && (
          <ArrowRight className="absolute -left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent" />
        )}
      </motion.div>
    </motion.div>
  );
}
