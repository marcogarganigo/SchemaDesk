"use client";

import { useMemo, useState } from "react";
import { Copy, Download, FlaskConical } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyTextToClipboard } from "@/lib/share";
import { downloadTextFile } from "@/lib/export/export-utils";
import { generateMockSql } from "@/lib/mock/mock-data";
import type { DatabaseSchema } from "@/lib/schema/types";

interface MockDataModalProps {
  open: boolean;
  schema: DatabaseSchema | null;
  projectName: string;
  onClose: () => void;
}

export function MockDataModal({ open, schema, projectName, onClose }: MockDataModalProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState(10);

  // Reset the row count each time the modal opens — adjusting state during
  // render (React's documented pattern) keyed on the open transition.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setRows(10);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const sql = useMemo(() => {
    if (!schema) return "";
    const clamped = Math.min(1000, Math.max(1, Math.round(rows) || 10));
    return generateMockSql(schema, clamped);
  }, [schema, rows]);

  const slug = projectName.toLowerCase().replace(/\W+/g, "-") || "schemaflow";

  const copy = async () => {
    const ok = await copyTextToClipboard(sql);
    toast(ok
      ? { title: "Seed data copied", variant: "success" }
      : { title: "Could not copy", description: "Your browser may not support clipboard access.", variant: "error" });
  };

  const download = () => {
    downloadTextFile(sql, `${slug}-seed.sql`);
    toast({ title: "Seed data downloaded", variant: "success" });
  };

  return (
    <Modal open={open} title="Mock data (seed)" onClose={onClose} className="max-w-[680px]">
      {!schema || schema.tables.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">
          Visualize a schema first — there is nothing to generate yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12.5px] text-secondary">
              <FlaskConical className="h-4 w-4 text-accent" />
              Rows per table
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={1000}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value, 10) || 10)}
                aria-label="Rows per table"
                className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-right font-mono text-[13px] text-foreground outline-none transition-colors focus:border-accent/60"
              />
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="primary" size="sm" onClick={download}>
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </div>

          <pre className="max-h-[46vh] overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-[11.5px] leading-relaxed text-secondary">
            {sql}
          </pre>
          <p className="text-[11.5px] text-muted">
            Values are generated deterministically from your schema — types, nullability and
            foreign keys are respected, so the seed can be loaded into a fresh database.
          </p>
        </div>
      )}
    </Modal>
  );
}
