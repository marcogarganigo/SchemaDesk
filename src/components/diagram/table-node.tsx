"use client";

import { Fragment, memo, useContext, useEffect, useMemo, useRef } from "react";
import { Handle, Position, useStoreApi, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { Asterisk, ChevronDown, KeyRound, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TABLE_NODE, type SchemaNode } from "@/lib/graph/types";
import { NodeActionsContext } from "./node-actions";

/** Collapsed table height: header plus a compact "N columns" summary row. */
export const COLLAPSED_ROW_HEIGHT = 26;

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[15px] items-center rounded-[3.5px] px-1 font-mono text-[8.5px] font-bold tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

export const TableNode = memo(function TableNode({
  id,
  data,
  selected,
}: NodeProps<SchemaNode>) {
  const {
    table,
    width,
    height,
    headerHeight,
    rowHeight,
    dimmed,
    related,
    order,
    sourceColumns,
    targetColumns,
    collapsed,
    spotlight,
    focused,
  } = data;
  const isEmpty = table.columns.length === 0;
  // Columns where a relationship starts FROM (FK sources) — visible dots.
  const sourceColSet = useMemo(() => new Set(sourceColumns), [sourceColumns]);
  // Columns where a relationship arrives AT (FK targets) — needed for edge
  // routing but rendered invisibly.
  const targetColSet = useMemo(() => new Set(targetColumns), [targetColumns]);
  const { onToggleCollapse } = useContext(NodeActionsContext);
  const nodeHeight = collapsed ? headerHeight + COLLAPSED_ROW_HEIGHT : height;

  const store = useStoreApi();

  /* When the table collapses, its handles move from their rows up to the
     header band. Re-measure them (once per actual toggle) so every edge
     reconnects to the header instead of dangling at the old row offsets. */
  const prevCollapsed = useRef(data.collapsed);
  useEffect(() => {
    if (prevCollapsed.current === data.collapsed) return;
    prevCollapsed.current = data.collapsed;
    const timer = window.setTimeout(() => {
      const domNode = store.getState().domNode;
      const nodeElement = domNode?.querySelector<HTMLDivElement>(`.react-flow__node[data-id="${id}"]`);
      if (!nodeElement) return;
      store
        .getState()
        .updateNodeInternals(new Map([[id, { id, nodeElement, force: true }]]));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [data.collapsed, id, store]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(order, 6) * 0.01, duration: 0.18, ease: "easeOut" }}
      className={cn(
        "relative h-full w-full transition-opacity duration-200",
        spotlight ? "opacity-[0.12]" : dimmed ? "opacity-30" : "opacity-100",
      )}
      style={{ width, height: nodeHeight }}
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-[10px] border bg-[var(--node-bg)]",
          "transition-[border-color,box-shadow] duration-150",
          focused
            ? "border-accent shadow-[0_0_0_2px_var(--accent),var(--shadow-float)]"
            : selected
              ? "border-accent shadow-[0_0_0_1px_var(--accent),var(--shadow-float)]"
              : related
                ? "border-border-strong shadow-node"
                : "border-border shadow-node",
          "hover:border-border-strong",
        )}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 border-b border-[var(--node-row-border)] px-3"
          style={{ height: headerHeight, background: "var(--node-header)" }}
        >
          <Table2 className="h-3.5 w-3.5 shrink-0 text-faint" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-foreground">
            {table.name}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] text-faint tabular-nums">
            {table.columns.length}
          </span>
          <button
            type="button"
            aria-label={collapsed ? `Expand ${table.name}` : `Collapse ${table.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(id);
            }}
            className="nodrag nopan -mr-1 shrink-0 rounded p-0.5 text-faint transition-colors hover:bg-[var(--bg-raised)] hover:text-secondary"
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform duration-150", collapsed && "-rotate-90")}
            />
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1">
          {collapsed ? (
            <div className="flex h-full items-center justify-center px-3 font-mono text-[10.5px] text-faint">
              {table.columns.length} {table.columns.length === 1 ? "column" : "columns"}
            </div>
          ) : isEmpty ? (
            <div className="flex h-full items-center justify-center px-3 text-[11px] text-faint italic">
              No columns
            </div>
          ) : (
            table.columns.map((col, i) => {
              const title = [
                col.type,
                col.nullable ? "nullable" : "NOT NULL",
                col.defaultValue != null ? `default ${col.defaultValue}` : undefined,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={col.id}
                  title={title}
                  className={cn(
                    "group/row flex items-center justify-between px-3",
                    "transition-colors duration-100 hover:bg-[var(--bg-raised)]",
                    i > 0 && "border-t border-[var(--node-row-border)]",
                  )}
                  style={{ height: rowHeight }}
                >
                  {/* Name + badges */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    {col.primaryKey && (
                      <KeyRound className="h-3 w-3 shrink-0 text-[var(--pk)]" aria-label="Primary key" />
                    )}
                    <span
                      className={cn(
                        "truncate font-mono text-[12px] leading-none",
                        col.nullable && !col.primaryKey ? "text-secondary" : "text-foreground",
                        col.primaryKey && "font-medium",
                      )}
                    >
                      {col.name}
                    </span>
                    {col.foreignKey && (
                      <Badge label="FK" className="bg-[var(--fk-soft)] text-[var(--fk)]" />
                    )}
                    {col.unique && (
                      <Badge label="UQ" className="bg-[var(--uq-soft)] text-[var(--uq)]" />
                    )}
                  </span>

                  {/* Type */}
                  <span className="ml-3 flex shrink-0 items-center gap-1">
                    {col.autoIncrement && (
                      <Asterisk className="h-2.5 w-2.5 text-faint" aria-label="Auto increment" />
                    )}
                    <span className="font-mono text-[11px] text-muted">{col.type}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Connection handles live outside the clipped card so they are never cut
          off at the node edge. The card above uses overflow-hidden for its
          rounded corners; handles are positioned node-relative here instead.
          top is relative to the motion wrapper: header + row center. When the
          table is collapsed every handle stacks at the header band (hidden,
          non-interactive) so the connected edges converge there instead of
          breaking — the lines stay attached, the dots stay invisible. */}
      {!isEmpty &&
        table.columns.map((col, i) => {
          const top = collapsed ? headerHeight / 2 : headerHeight + i * rowHeight + rowHeight / 2;
          // Render SOURCE handles only on FK source columns (where lines start).
          // Render TARGET handles only on FK target columns (where lines arrive).
          // Both are invisible in CSS; they only exist for React Flow's routing.
          const isSource = sourceColSet.has(col.name);
          const isTarget = targetColSet.has(col.name);
          if (!isSource && !isTarget) return null;
          const baseHandleStyle: React.CSSProperties = {
            width: 5,
            height: 5,
            pointerEvents: "none", // read-only: no drag-to-connect
          };
          return (
            <Fragment key={col.id}>
              {/* Left side — targets for incoming edges (target columns only) */}
              {isTarget && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`tl:${col.name}`}
                  isConnectable={false}
                  style={{ ...baseHandleStyle, top }}
                />
              )}
              {/* Right side — sources for outgoing edges (source columns only) */}
              {isSource && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`sr:${col.name}`}
                  isConnectable={false}
                  style={{ ...baseHandleStyle, top }}
                />
              )}
              {/* Top side — alternate source/target for vertical routing */}
              {isSource && (
                <Handle
                  type="source"
                  position={Position.Top}
                  id={`st:${col.name}`}
                  isConnectable={false}
                  style={{ ...baseHandleStyle, left: "50%", top: 0 }}
                />
              )}
              {isTarget && (
                <Handle
                  type="target"
                  position={Position.Top}
                  id={`tt:${col.name}`}
                  isConnectable={false}
                  style={{ ...baseHandleStyle, left: "50%", top: 0 }}
                />
              )}
              {/* Bottom side — alternate source/target for vertical routing */}
              {isSource && (
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={`sb:${col.name}`}
                  isConnectable={false}
                  style={{ ...baseHandleStyle, left: "50%", top: nodeHeight }}
                />
              )}
              {isTarget && (
                <Handle
                  type="target"
                  position={Position.Bottom}
                  id={`tb:${col.name}`}
                  isConnectable={false}
                  style={{ ...baseHandleStyle, left: "50%", top: nodeHeight }}
                />
              )}
            </Fragment>
          );
        })}
    </motion.div>
  );
});

export const nodeTypes = { [TABLE_NODE]: TableNode };
