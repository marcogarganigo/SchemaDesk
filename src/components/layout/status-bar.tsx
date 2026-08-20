"use client";

import { Check, CircleAlert, Database, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatabaseSchema } from "@/lib/schema/types";
import type { ParseDiagnostic } from "@/lib/schema/types";
import type { CursorPosition } from "@/components/editor/sql-editor";

interface StatusBarProps {
  schema: DatabaseSchema | null;
  error: ParseDiagnostic | null;
  cursor: CursorPosition | null;
  zoom: number;
  selectedNodeName: string | null;
  selectedEdgeLabel: string | null;
  isDirty: boolean;
}

export function StatusBar({
  schema,
  error,
  cursor,
  zoom,
  selectedNodeName,
  selectedEdgeLabel,
  isDirty,
}: StatusBarProps) {
  const parsed = schema && schema.tables.length > 0;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-[11px] text-muted">
      {/* Parse status */}
      <div className="flex min-w-0 items-center gap-1.5">
        {error ? (
          <>
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-danger" />
            <span className="truncate text-danger" title={`${error.message} (line ${error.line}, column ${error.column})`}>
              Parse error at line {error.line}: {error.message}
            </span>
          </>
        ) : parsed ? (
          <>
            <Check className="h-3.5 w-3.5 shrink-0 text-success" />
            <span className="flex items-center gap-1.5">
              <span>
                {schema.tables.length} tables
              </span>
              <span className="text-faint">·</span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {schema.relationships.length} relationships
              </span>
            </span>
          </>
        ) : (
          <>
            <Database className="h-3.5 w-3.5 shrink-0 text-faint" />
            <span className="text-faint">Ready — paste SQL to begin</span>
          </>
        )}
      </div>

      {!error && schema && (
        <span className="hidden rounded border border-border-subtle bg-raised px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-faint sm:inline">
          {schema.dialect}
        </span>
      )}

      {isDirty && <span className="hidden text-faint md:inline">● unsaved</span>}

      <div className="flex-1" />

      {selectedNodeName && (
        <span className="hidden max-w-[180px] truncate text-secondary md:inline">
          {selectedNodeName}
        </span>
      )}
      {selectedEdgeLabel && (
        <span className="hidden max-w-[220px] truncate font-mono text-secondary md:inline">
          {selectedEdgeLabel}
        </span>
      )}

      {cursor && (
        <span className={cn("hidden tabular-nums text-faint sm:inline")}>
          Ln {cursor.line}, Col {cursor.column}
        </span>
      )}
      <span className="tabular-nums text-faint">{Math.round(zoom * 100)}%</span>
    </footer>
  );
}
