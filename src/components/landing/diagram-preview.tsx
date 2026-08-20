"use client";

import { motion, useReducedMotion } from "motion/react";
import { getSmoothStepPath, Position } from "@xyflow/react";

interface PreviewColumn {
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  uq?: boolean;
}

interface PreviewTable {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: PreviewColumn[];
}

/* Same geometry as the visualizer's table node. */
const ROW = 28;
const HEADER = 46;
const MIN_WIDTH = 224;
const MAX_WIDTH = 340;
const MONO_CHAR = 7.3;
const SMALL_CHAR = 6.7;

/* Mirrors the visualizer's blog example, including unique constraints. */
const TABLES: PreviewTable[] = [
  {
    id: "users",
    name: "users",
    x: 700,
    y: 140,
    columns: [
      { name: "id", type: "INTEGER", pk: true },
      { name: "username", type: "VARCHAR(50)", uq: true },
      { name: "email", type: "VARCHAR(120)", uq: true },
      { name: "password_hash", type: "VARCHAR(255)" },
      { name: "bio", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
  {
    id: "posts",
    name: "posts",
    x: 420,
    y: 120,
    columns: [
      { name: "id", type: "INTEGER", pk: true },
      { name: "author_id", type: "INTEGER", fk: true },
      { name: "title", type: "VARCHAR(200)" },
      { name: "slug", type: "VARCHAR(200)", uq: true },
      { name: "content", type: "TEXT" },
      { name: "status", type: "VARCHAR(20)" },
      { name: "published_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
  {
    id: "comments",
    name: "comments",
    x: 60,
    y: 50,
    columns: [
      { name: "id", type: "INTEGER", pk: true },
      { name: "post_id", type: "INTEGER", fk: true },
      { name: "author_id", type: "INTEGER", fk: true },
      { name: "body", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
  {
    id: "tags",
    name: "tags",
    x: 420,
    y: 410,
    columns: [
      { name: "id", type: "INTEGER", pk: true },
      { name: "name", type: "VARCHAR(50)", uq: true },
    ],
  },
  {
    id: "post_tags",
    name: "post_tags",
    x: 60,
    y: 400,
    columns: [
      { name: "post_id", type: "INTEGER", pk: true, fk: true },
      { name: "tag_id", type: "INTEGER", pk: true, fk: true },
    ],
  },
];

function tableWidth(table: PreviewTable): number {
  const header = table.name.length * 8 + 72;
  let body = 0;
  for (const col of table.columns) {
    const badges = (col.pk ? 1 : 0) + (col.fk ? 1 : 0) + (col.uq ? 1 : 0);
    const w = col.name.length * MONO_CHAR + col.type.length * SMALL_CHAR + badges * 22 + 58;
    if (w > body) body = w;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.max(header, body)));
}

function rowMidY(table: PreviewTable, index: number): number {
  return table.y + HEADER + index * ROW + ROW / 2;
}

function columnIndex(table: PreviewTable, name: string): number {
  const i = table.columns.findIndex((c) => c.name === name);
  return i < 0 ? 0 : i;
}

/* Icon glyphs matching the visualizer's lucide icons (24×24 stroke style). */
const KEY_ICON = (
  <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
);
const TABLE_ICON = (
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M12 3v18" />
  </>
);

interface PreviewEdge {
  key: string;
  from: string;
  col: string;
  to: string;
  col2: string;
}

const EDGES: PreviewEdge[] = [
  { key: "posts.author_id", from: "posts", col: "author_id", to: "users", col2: "id" },
  { key: "comments.post_id", from: "comments", col: "post_id", to: "posts", col2: "id" },
  { key: "comments.author_id", from: "comments", col: "author_id", to: "users", col2: "id" },
  { key: "post_tags.post_id", from: "post_tags", col: "post_id", to: "posts", col2: "id" },
  { key: "post_tags.tag_id", from: "post_tags", col: "tag_id", to: "tags", col2: "id" },
];

export function DiagramPreview() {
  const widths = new Map(TABLES.map((t) => [t.id, tableWidth(t)]));
  const byId = new Map(TABLES.map((t) => [t.id, t]));
  const reduceMotion = useReducedMotion();

  const edgePaths = EDGES.map((e) => {
    const source = byId.get(e.from)!;
    const target = byId.get(e.to)!;
    const x1 = source.x + widths.get(source.id)!;
    const y1 = rowMidY(source, columnIndex(source, e.col));
    const x2 = target.x;
    const y2 = rowMidY(target, columnIndex(target, e.col2));
    const [d] = getSmoothStepPath({
      sourceX: x1,
      sourceY: y1,
      sourcePosition: Position.Right,
      targetX: x2,
      targetY: y2,
      targetPosition: Position.Left,
      borderRadius: 16,
    });
    return { key: e.key, d, source: { x: x1, y: y1 }, target: { x: x2, y: y2 } };
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-elevated shadow-float">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-3 flex-1 truncate text-center font-mono text-[11px] text-faint">
          schema desk — blog.sql
        </span>
      </div>

      <svg
        viewBox="0 0 1000 560"
        className="block w-full"
        role="img"
        aria-label="Preview of a database diagram"
      >
        <defs>
          <pattern id="preview-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="var(--canvas-dot)" />
          </pattern>
          <marker
            id="preview-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge)" />
          </marker>
        </defs>

        <rect width="1000" height="560" fill="url(#preview-dots)" />

        {/* One quick fade-in; nothing moves afterward. */}
        <motion.g
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: "easeOut" }}
        >
          {/* Edges — orthogonal, matching the visualizer */}
          {edgePaths.map((e) => (
            <path
              key={e.key}
              d={e.d}
              fill="none"
              stroke="var(--edge)"
              strokeWidth="1.4"
              markerEnd="url(#preview-arrow)"
            />
          ))}

          {/* Handle dots on related columns, like the visualizer */}
          {TABLES.map((table) => {
            const w = widths.get(table.id)!;
            return table.columns.flatMap((col, ci) => {
              const related = EDGES.some(
                (e) =>
                  (e.from === table.id && e.col === col.name) ||
                  (e.to === table.id && e.col2 === col.name),
              );
              if (!related) return [];
              const midY = rowMidY(table, ci);
              return [
                <circle
                  key={`${table.id}.${col.name}.l`}
                  cx={table.x}
                  cy={midY}
                  r="3"
                  fill="var(--text-faint)"
                  stroke="var(--bg)"
                  strokeWidth="1"
                  opacity="0.85"
                />,
                <circle
                  key={`${table.id}.${col.name}.r`}
                  cx={table.x + w}
                  cy={midY}
                  r="3"
                  fill="var(--text-faint)"
                  stroke="var(--bg)"
                  strokeWidth="1"
                  opacity="0.85"
                />,
              ];
            });
          })}

          {/* Tables */}
          {TABLES.map((table) => {
            const w = widths.get(table.id)!;
            const h = HEADER + table.columns.length * ROW;
            return (
              <g key={table.id}>
                {/* Card */}
                <rect
                  x={table.x}
                  y={table.y}
                  width={w}
                  height={h}
                  rx="10"
                  fill="var(--node-bg)"
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <path
                  d={`M ${table.x} ${table.y + 10} A 10 10 0 0 1 ${table.x + 10} ${table.y} L ${table.x + w - 10} ${table.y} A 10 10 0 0 1 ${table.x + w} ${table.y + 10} L ${table.x + w} ${table.y + HEADER} L ${table.x} ${table.y + HEADER} Z`}
                  fill="var(--node-header)"
                />

                {/* Header: table icon + name + column count */}
                <svg
                  x={table.x + 12}
                  y={table.y + 15}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-faint)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {TABLE_ICON}
                </svg>
                <text
                  x={table.x + 34}
                  y={table.y + 26}
                  fontFamily="var(--font-geist-sans)"
                  fontSize="13"
                  fontWeight="600"
                  fill="var(--text-primary)"
                >
                  {table.name}
                </text>
                <text
                  x={table.x + w - 12}
                  y={table.y + 26}
                  textAnchor="end"
                  fontFamily="var(--font-geist-mono)"
                  fontSize="10.5"
                  fill="var(--text-muted)"
                >
                  {table.columns.length}
                </text>

                {/* Rows */}
                {table.columns.map((col, ci) => {
                  const rowY = table.y + HEADER + ci * ROW;
                  const midY = rowY + ROW / 2;
                  let nameX = table.x + 16;
                  const badges: Array<{ label: string; fill: string; color: string }> = [];
                  if (col.fk) badges.push({ label: "FK", fill: "var(--fk-soft)", color: "var(--fk)" });
                  if (col.uq) badges.push({ label: "UQ", fill: "var(--uq-soft)", color: "var(--uq)" });
                  const badgeSpace = badges.length * 26;
                  return (
                    <g key={col.name}>
                      {ci > 0 && (
                        <line
                          x1={table.x + 12}
                          y1={rowY}
                          x2={table.x + w - 12}
                          y2={rowY}
                          stroke="var(--node-row-border)"
                        />
                      )}
                      {col.pk && (
                        <svg
                          x={nameX}
                          y={midY - 6}
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--pk)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {KEY_ICON}
                          <circle cx="16.5" cy="7.5" r="0.5" fill="var(--pk)" stroke="none" />
                        </svg>
                      )}
                      {col.pk && (nameX += 18)}
                      <text
                        x={nameX}
                        y={midY + 4}
                        fontFamily="var(--font-geist-mono)"
                        fontSize="12"
                        fill={col.pk ? "var(--text-primary)" : "var(--text-secondary)"}
                      >
                        {col.name}
                      </text>
                      {badges.map((b, bi) => (
                        <g key={b.label}>
                          <rect
                            x={table.x + w - 16 - badgeSpace + bi * 26}
                            y={midY - 7.5}
                            width="22"
                            height="15"
                            rx="3.5"
                            fill={b.fill}
                          />
                          <text
                            x={table.x + w - 16 - badgeSpace + bi * 26 + 11}
                            y={midY + 4.5}
                            textAnchor="middle"
                            fontFamily="var(--font-geist-mono)"
                            fontSize="8.5"
                            fontWeight="700"
                            fill={b.color}
                          >
                            {b.label}
                          </text>
                        </g>
                      ))}
                      <text
                        x={table.x + w - 16 - badgeSpace - 4}
                        y={midY + 4}
                        textAnchor="end"
                        fontFamily="var(--font-geist-mono)"
                        fontSize="11"
                        fill="var(--text-muted)"
                      >
                        {col.type}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </motion.g>
      </svg>
    </div>
  );
}
