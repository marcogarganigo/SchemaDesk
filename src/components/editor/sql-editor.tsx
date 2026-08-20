"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SqlHighlight } from "./sql-highlight";

export interface CursorPosition {
  line: number;
  column: number;
}

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  errorLine?: number | null;
  onCursorChange?: (pos: CursorPosition) => void;
  placeholder?: string;
}

const LINE_HEIGHT = 24;

export function SqlEditor({ value, onChange, errorLine, onCursorChange, placeholder }: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const lineNumbers = useMemo(
    () => Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1),
    [lineCount],
  );

  const emitCursor = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !onCursorChange) return;
    const before = value.slice(0, ta.selectionStart);
    const lines = before.split("\n");
    onCursorChange({ line: lines.length, column: lines[lines.length - 1].length + 1 });
  }, [onCursorChange, value]);

  const setCaret = useCallback((pos: number) => {
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.selectionStart = ta.selectionEnd = pos;
      ta.focus();
    });
  }, []);

  const insertText = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      setCaret(start + text.length);
    },
    [onChange, setCaret, value],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current;
      if (!ta) return;

      if (event.key === "Tab") {
        event.preventDefault();
        insertText("  ");
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const start = ta.selectionStart;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const indent = currentLine.match(/^\s*/)?.[0] ?? "";
        const extra = /\(\s*$/.test(currentLine.trimEnd()) ? "  " : "";
        insertText("\n" + indent + extra);
      }
    },
    [insertText, value],
  );

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
  }, []);

  return (
    <div className="sql-editor relative flex h-full min-h-0 flex-1 overflow-hidden bg-surface font-mono text-[13px]">
      {/* Line number gutter */}
      <div className="relative w-12 shrink-0 select-none overflow-hidden border-r border-border-subtle">
        <div
          ref={gutterRef}
          className="pt-3 pb-4 text-right will-change-transform"
          style={{ transform: `translateY(${-scroll.top}px)` }}
        >
          {lineNumbers.map((n) => (
            <div
              key={n}
              className={cn(
                "pr-3 text-[11px] leading-6 tabular-nums",
                n === errorLine ? "font-semibold text-danger" : "text-faint",
              )}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* Code area */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <pre
          ref={preRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 m-0 min-w-full px-4 pt-3 pb-4 will-change-transform"
          style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)`, lineHeight: `${LINE_HEIGHT}px` }}
        >
          <SqlHighlight sql={value} errorLine={errorLine} />
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onClick={emitCursor}
          onKeyUp={emitCursor}
          onSelect={emitCursor}
          onFocus={emitCursor}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          aria-label="SQL editor"
          className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-4 pt-3 pb-4 whitespace-pre outline-none placeholder:text-faint"
          style={{
            color: "transparent",
            WebkitTextFillColor: "transparent",
            caretColor: "var(--text-primary)",
            lineHeight: `${LINE_HEIGHT}px`,
          }}
        />
      </div>
    </div>
  );
}
