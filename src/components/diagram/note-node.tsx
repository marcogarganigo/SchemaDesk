"use client";

import { memo, useContext, useEffect, useRef, useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { StickyNote, X } from "lucide-react";
import { NodeActionsContext } from "./node-actions";

export const NOTE_NODE = "schema-note";

export interface NoteNodeData extends Record<string, unknown> {
  text: string;
}

export type SchemaNoteNode = Node<NoteNodeData, typeof NOTE_NODE>;

export const NoteNode = memo(function NoteNode({ id, data }: NodeProps<SchemaNoteNode>) {
  const { onNoteChange, onNoteDelete } = useContext(NodeActionsContext);

  /*
   * The textarea edits a local draft so keystrokes never rebuild the canvas
   * node list (which would re-render every table and edge — the lag). The
   * draft is committed to the parent when you stop typing (debounced) and on
   * blur, so notes still persist.
   */
  const [draft, setDraft] = useState(data.text);
  // Kept in sync immediately (not just on render) so a blur right after a
  // keystroke commits the latest text.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  const handleChange = (value: string) => {
    draftRef.current = value;
    setDraft(value);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onNoteChange(id, draftRef.current), 400);
  };

  const commit = () => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    onNoteChange(id, draftRef.current);
  };

  const lineCount = Math.max(1, (draft.match(/\n/g)?.length ?? 0) + 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="w-full rounded-xl border border-warning/35 bg-[var(--warning-soft)] shadow-node transition-shadow duration-200 hover:shadow-[var(--shadow-float)] focus-within:border-warning/60 focus-within:shadow-[var(--shadow-float)]"
    >
      <div className="flex items-center gap-1.5 border-b border-warning/20 px-2.5 py-1.5">
        <StickyNote className="h-3 w-3 text-warning" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
          Note
        </span>
        <button
          type="button"
          aria-label="Delete note"
          onClick={() => onNoteDelete(id)}
          className="nodrag rounded p-0.5 text-warning/70 transition-colors hover:bg-warning/15 hover:text-warning"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        rows={lineCount}
        placeholder="Write a note…"
        spellCheck={false}
        aria-label="Note text"
        className="w-full min-h-[34px] resize-none rounded-b-xl bg-transparent px-2.5 py-2 text-[12px] leading-snug text-foreground outline-none transition-colors placeholder:text-faint"
      />
    </motion.div>
  );
});
