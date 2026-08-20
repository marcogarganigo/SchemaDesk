"use client";

import { useState } from "react";
import {
  Braces,
  ChevronDown,
  CircleAlert,
  Eraser,
  FileUp,
  Play,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, type DropdownEntry } from "@/components/ui/dropdown";
import { Kbd } from "@/components/ui/kbd";
import { SqlEditor, type CursorPosition } from "./sql-editor";
import { EXAMPLES, type ExampleSchema } from "@/lib/examples";
import { pickSqlFile } from "@/lib/import-file";
import type { ParseDiagnostic } from "@/lib/schema/types";

interface EditorPanelProps {
  sql: string;
  onChange: (sql: string) => void;
  error: ParseDiagnostic | null;
  onVisualize: () => void;
  onFormat: () => void;
  onClear: () => void;
  onLoadExample: (example: ExampleSchema) => void;
  onImportFile: (file: File) => void;
  onCursorChange: (pos: CursorPosition) => void;
}

export function EditorPanel({
  sql,
  onChange,
  error,
  onVisualize,
  onFormat,
  onClear,
  onLoadExample,
  onImportFile,
  onCursorChange,
}: EditorPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  const exampleItems: DropdownEntry[] = EXAMPLES.map((example) => ({
    label: example.name,
    onSelect: () => onLoadExample(example),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        <div className="flex items-center gap-2 pr-1">
          <Braces className="h-3.5 w-3.5 text-accent" />
          <span className="text-[12px] font-semibold text-secondary">SQL</span>
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" onClick={() => pickSqlFile(onImportFile)}>
          <FileUp className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Import</span>
        </Button>
        <DropdownMenu
          label="Load example"
          align="end"
          items={exampleItems}
          trigger={
            <Button variant="ghost" size="sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Examples</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          }
        />
        <Button variant="ghost" size="sm" onClick={onFormat}>
          <Braces className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Format</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={!sql.trim()}>
          <Eraser className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Clear</span>
        </Button>

        <div className="mx-1 h-4 w-px bg-border-subtle" />

        <Button variant="primary" size="sm" onClick={onVisualize} disabled={!sql.trim()}>
          <Play className="h-3.5 w-3.5" />
          Visualize
          <Kbd className="ml-0.5 hidden border-accent-contrast/30 bg-accent-contrast/10 text-accent-contrast sm:inline-flex">
            ⌘↵
          </Kbd>
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-danger-soft bg-danger-soft/60 px-3 py-2">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-danger">
                Unable to parse SQL
                <span className="ml-2 font-mono text-[11px] opacity-80">Line {error.line}</span>
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-secondary">{error.message}</p>
              {showDetails && (
                <pre className="mt-1.5 overflow-x-auto rounded-md border border-danger-soft bg-surface/70 p-2 font-mono text-[11px] leading-relaxed text-secondary">
                  {error.message}
                  {error.token ? `\nNear token: "${error.token}"` : ""}
                  {"\nColumn " + error.column}
                </pre>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDetails((s) => !s)}
              className="shrink-0 text-[11px] font-medium text-danger/90 hover:text-danger"
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
          </div>
        </div>
      )}

      <SqlEditor
        value={sql}
        onChange={onChange}
        errorLine={error?.line ?? null}
        onCursorChange={onCursorChange}
        placeholder={"-- Paste your SQL schema here…\n-- e.g. CREATE TABLE users (\n--   id INTEGER PRIMARY KEY\n-- );\n--\n-- Tip: you can also drop a .sql file anywhere in this window"}
      />
    </div>
  );
}
