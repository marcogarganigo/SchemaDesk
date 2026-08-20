"use client";

import { useMemo, useState } from "react";
import { Braces, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useToast } from "@/components/ui/toast";
import { copyTextToClipboard } from "@/lib/share";
import type { DatabaseSchema } from "@/lib/schema/types";
import { buildJoinQuery, relatedTables } from "@/lib/query/query-builder";

interface QueryBuilderModalProps {
  open: boolean;
  schema: DatabaseSchema | null;
  initialTable?: string | null;
  onClose: () => void;
}

export function QueryBuilderModal({ open, schema, initialTable, onClose }: QueryBuilderModalProps) {
  const { toast } = useToast();
  const tables = useMemo(() => (schema ? schema.tables : []), [schema]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Reset the selection every time the modal opens with a new context —
  // adjusting state during render (React's documented pattern), keyed on the
  // open + initialTable pair instead of an effect.
  const currentSchema = open ? schema : null;
  const openKey = currentSchema ? `${initialTable ?? ""}|${currentSchema.tables.length}` : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (currentSchema && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    const first =
      initialTable && currentSchema.tables.some((t) => t.id === initialTable)
        ? initialTable
        : currentSchema.tables[0]?.id ?? "";
    setFrom(first);
    setTo("");
  }

  const related = useMemo(() => (from ? relatedTables(schema!, from) : []), [from, schema]);

  // Keep the JOIN side in sync with FROM: whenever the current target is
  // missing from the related set (or nothing is chosen yet), fall back to the
  // first related table. Derived during render — no effect needed.
  if (from && related.length > 0 && (!to || !related.includes(to))) {
    setTo(related[0]);
  }

  const result = useMemo(
    () => (from && to ? buildJoinQuery(schema!, from, to) : null),
    [from, to, schema],
  );

  const copy = async () => {
    if (!result) return;
    const ok = await copyTextToClipboard(result.sql);
    toast(ok
      ? { title: "Query copied", variant: "success" }
      : { title: "Could not copy", description: "Your browser may not support clipboard access.", variant: "error" });
  };

  const selectClass =
    "h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-accent/60 hover:border-border-strong";

  return (
    <Modal open={open} title="Query builder" onClose={onClose} className="max-w-[640px]">
      {!schema || tables.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">
          Visualize a schema first — the query builder needs at least one table.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">From</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass} aria-label="From table">
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Join</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className={selectClass} aria-label="Join table">
                {related.length === 0 ? (
                  <option value="">No connected tables</option>
                ) : (
                  related.map((id) => {
                    const t = tables.find((x) => x.id === id);
                    return t ? <option key={id} value={id}>{t.name}</option> : null;
                  })
                )}
              </select>
            </label>
          </div>

          {result ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  <Braces className="h-3 w-3" />
                  {result.description}
                </span>
                <Button variant="secondary" size="sm" onClick={() => void copy()}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                  <Kbd className="ml-0.5 hidden sm:inline-flex">⌘C</Kbd>
                </Button>
              </div>
              <pre className="max-h-[300px] overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[12px] leading-relaxed text-secondary">
                {result.sql}
              </pre>
            </div>
          ) : (
            <p className="rounded-lg border border-border-subtle bg-surface px-3 py-4 text-center text-[12.5px] text-muted">
              {related.length === 0
                ? "This table has no relationships — pick one that is connected."
                : "Choose two connected tables to build the query."}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
