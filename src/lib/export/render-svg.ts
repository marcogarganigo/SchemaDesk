import { getBezierPath, getSmoothStepPath, Position } from "@xyflow/react";
import type { EdgeStyle, SchemaEdge, SchemaNode } from "@/lib/graph/types";

export interface ExportPalette {
  background: string;
  nodeBg: string;
  nodeHeader: string;
  rowBorder: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  edge: string;
  edgeSelected: string;
  pk: string;
  pkSoft: string;
  fk: string;
  fkSoft: string;
  uq: string;
  uqSoft: string;
  accent: string;
}

export interface RenderOptions {
  scale?: number;
  palette: ExportPalette;
  selectedNodeId?: string | null;
  edgeStyle?: EdgeStyle;
  showCardinality?: boolean;
}

// Font stacks must use single quotes inside the double-quoted XML attributes.
const FONT =
  "ui-monospace, 'SF Mono', 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, -apple-system, 'Segoe UI', system-ui, sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnY(node: SchemaNode, index: number): number {
  return node.position.y + node.data.headerHeight + index * node.data.rowHeight + node.data.rowHeight / 2;
}

function edgePath(
  edge: SchemaEdge,
  nodes: Map<string, SchemaNode>,
  edgeStyle: EdgeStyle,
): { path: string; labelX: number; labelY: number; source: SchemaNode; target: SchemaNode; sourceIndex: number; targetIndex: number } | null {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  const data = edge.data;
  if (!source || !target || !data) return null;

  const sourceIndex = source.data.table.columns.findIndex(
    (c) => c.name === data.sourceColumn,
  );
  const targetIndex = target.data.table.columns.findIndex(
    (c) => c.name === data.targetColumn,
  );

  const sourceY = columnY(source, Math.max(0, sourceIndex));
  const targetY = columnY(target, Math.max(0, targetIndex));

  const [path, labelX, labelY] =
    edgeStyle === "curved"
      ? getBezierPath({
          sourceX: source.position.x + source.data.width,
          sourceY,
          sourcePosition: Position.Right,
          targetX: target.position.x,
          targetY,
          targetPosition: Position.Left,
          curvature: 0.25,
        })
      : getSmoothStepPath({
          sourceX: source.position.x + source.data.width,
          sourceY,
          sourcePosition: Position.Right,
          targetX: target.position.x,
          targetY,
          targetPosition: Position.Left,
          borderRadius: 16,
        });
  return { path, labelX, labelY, source, target, sourceIndex, targetIndex };
}

export function renderSvg(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  options: RenderOptions,
): { svg: string; width: number; height: number } {
  const p = options.palette;
  const scale = options.scale ?? 2;
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const minX = nodes.length ? Math.min(...xs) : 0;
  const minY = nodes.length ? Math.min(...ys) : 0;
  const maxX = nodes.length ? Math.max(...xs.map((x, i) => x + nodes[i].data.width)) : 0;
  const maxY = nodes.length ? Math.max(...ys.map((y, i) => y + nodes[i].data.height)) : 0;

  const PAD = 48;
  const bx = minX - PAD;
  const by = minY - PAD;
  const bw = Math.max(1, maxX - minX + PAD * 2);
  const bh = Math.max(1, maxY - minY + PAD * 2);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(bw * scale)}" height="${Math.round(bh * scale)}" viewBox="${bx} ${by} ${bw} ${bh}" font-family="${SANS}">`,
  );
  parts.push(`<defs></defs>`);
  parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${p.background}"/>`);

  // Edges
  const edgeStyle = options.edgeStyle ?? "orthogonal";
  for (const edge of edges) {
    const routed = edgePath(edge, nodesById, edgeStyle);
    if (!routed || !edge.data) continue;
    const { path, labelX, labelY, source, target, sourceIndex, targetIndex } = routed;
    const selected = edge.data.selected;
    const stroke = selected ? p.edgeSelected : p.edge;
    const width = selected ? 2 : 1.5;
    parts.push(
      `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`,
    );
    // Manual arrowhead — uses the actual path endpoint tangent. Works for
    // both bezier (tangent from cp2→end) and smoothstep (tangent from the
    // last L command's previous point → end).
    {
      const tx = target.position.x;
      const ty = columnY(target, targetIndex);
      // Extract last two coordinate pairs from the path string.
      const re = /(-?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*[,\s]\s*(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
      let dx = 1, dy = 0;
      const matches: Array<[number, number]> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(path)) !== null) {
        matches.push([parseFloat(m[1]), parseFloat(m[2])]);
      }
      if (matches.length >= 2) {
        const last = matches[matches.length - 1];
        const prev = matches[matches.length - 2];
        dx = last[0] - prev[0];
        dy = last[1] - prev[1];
        if (dx === 0 && dy === 0) dx = 1;
      }
      const angle = Math.atan2(dy, dx);
      const size = selected ? 9 : 7.5;
      const tipX = tx;
      const tipY = ty;
      const baseX = tipX - size * Math.cos(angle);
      const baseY = tipY - size * Math.sin(angle);
      const perpX = size * 0.55 * Math.cos(angle + Math.PI / 2);
      const perpY = size * 0.55 * Math.sin(angle + Math.PI / 2);
      parts.push(
        `<polygon points="${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}" fill="${stroke}"/>`,
      );
    }
    // Cardinality badge, centered on the edge.
    if (options.showCardinality !== false) {
      const cardinality = edge.data.cardinality ?? "1:N";
      const badgeFill = selected ? p.accent : p.nodeBg;
      const badgeStroke = selected ? p.accent : p.border;
      const badgeText = selected ? "#ffffff" : p.textMuted;
      parts.push(
        `<g transform="translate(${labelX}, ${labelY})">` +
          `<rect x="-15" y="-8.5" width="30" height="17" rx="5" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="1"/>` +
          `<text x="0" y="3" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="700" fill="${badgeText}">${cardinality}</text>` +
          `</g>`,
      );
    }
  }

  // Nodes
  for (const node of nodes) {
    const { table, width, height, headerHeight, rowHeight } = node.data;
    const x = node.position.x;
    const y = node.position.y;
    const isSelected = node.id === options.selectedNodeId;
    const stroke = isSelected ? p.accent : p.border;
    const strokeWidth = isSelected ? 1.5 : 1;

    parts.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${p.nodeBg}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
      `<path d="M ${x} ${y + 10} A 10 10 0 0 1 ${x + 10} ${y} L ${x + width - 10} ${y} A 10 10 0 0 1 ${x + width} ${y + 10} L ${x + width} ${y + headerHeight} L ${x} ${y + headerHeight} Z" fill="${p.nodeHeader}"/>`,
    );

    // Table name + column count
    parts.push(
      `<text x="${x + 14}" y="${y + 21}" font-size="13" font-weight="600" fill="${p.text}">${escapeXml(table.name)}</text>`,
      `<text x="${x + width - 14}" y="${y + 21}" text-anchor="end" font-size="10.5" fill="${p.textMuted}">${table.columns.length} ${table.columns.length === 1 ? "column" : "columns"}</text>`,
    );

    table.columns.forEach((col, i) => {
      const rowTop = y + headerHeight + i * rowHeight;
      if (i > 0) {
        parts.push(`<line x1="${x + 12}" y1="${rowTop}" x2="${x + width - 12}" y2="${rowTop}" stroke="${p.rowBorder}"/>`);
      }
      const midY = rowTop + rowHeight / 2;

      let nameX = x + 16;
      if (col.primaryKey) {
        parts.push(
          `<rect x="${nameX}" y="${midY - 7.5}" width="24" height="15" rx="3.75" fill="${p.pkSoft}"/><text x="${nameX + 12}" y="${midY + 4}" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="700" fill="${p.pk}">PK</text>`,
        );
        nameX += 30;
      }
      const nameColor = col.nullable && !col.primaryKey ? p.textSecondary : p.text;
      parts.push(
        `<text x="${nameX}" y="${midY + 4}" font-family="${FONT}" font-size="12" fill="${nameColor}">${escapeXml(col.name)}</text>`,
      );

      let typeX = x + width - 16;
      const badges: Array<{ label: string; color: string; soft: string }> = [];
      if (col.foreignKey) badges.push({ label: "FK", color: p.fk, soft: p.fkSoft });
      if (col.unique) badges.push({ label: "UQ", color: p.uq, soft: p.uqSoft });
      for (const b of badges) {
        typeX -= 28;
        parts.push(
          `<rect x="${typeX}" y="${midY - 7.5}" width="24" height="15" rx="3.75" fill="${b.soft}"/><text x="${typeX + 12}" y="${midY + 4}" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="700" fill="${b.color}">${b.label}</text>`,
        );
      }
      typeX -= 4;
      parts.push(
        `<text x="${typeX}" y="${midY + 4}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${p.textMuted}">${escapeXml(col.type)}</text>`,
      );
    });
  }

  parts.push(`</svg>`);
  return {
    svg: parts.join(""),
    width: Math.round(bw * scale),
    height: Math.round(bh * scale),
  };
}

export function readPalette(): ExportPalette {
  if (typeof window === "undefined" || typeof getComputedStyle === "undefined") {
    return {
      background: "#0a0b0d",
      nodeBg: "#16181c",
      nodeHeader: "rgba(255,255,255,0.03)",
      rowBorder: "rgba(255,255,255,0.045)",
      border: "rgba(255,255,255,0.09)",
      text: "#ecedef",
      textSecondary: "#a5abb3",
      textMuted: "#767d87",
      edge: "#4d535c",
      edgeSelected: "#818cf8",
      pk: "#fbbf24",
      pkSoft: "rgba(251,191,36,0.12)",
      fk: "#38bdf8",
      fkSoft: "rgba(56,189,248,0.12)",
      uq: "#a78bfa",
      uqSoft: "rgba(167,139,250,0.13)",
      accent: "#818cf8",
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim() || undefined;
  return {
    background: read("--bg") ?? "#0a0b0d",
    nodeBg: read("--node-bg") ?? "#16181c",
    nodeHeader: read("--node-header") ?? "rgba(255,255,255,0.03)",
    rowBorder: read("--node-row-border") ?? "rgba(255,255,255,0.045)",
    border: read("--border") ?? "rgba(255,255,255,0.09)",
    text: read("--text-primary") ?? "#ecedef",
    textSecondary: read("--text-secondary") ?? "#a5abb3",
    textMuted: read("--text-muted") ?? "#767d87",
    edge: read("--edge") ?? "#4d535c",
    edgeSelected: read("--edge-selected") ?? "#818cf8",
    pk: read("--pk") ?? "#fbbf24",
    pkSoft: read("--pk-soft") ?? "rgba(251,191,36,0.12)",
    fk: read("--fk") ?? "#38bdf8",
    fkSoft: read("--fk-soft") ?? "rgba(56,189,248,0.12)",
    uq: read("--uq") ?? "#a78bfa",
    uqSoft: read("--uq-soft") ?? "rgba(167,139,250,0.13)",
    accent: read("--accent") ?? "#818cf8",
  };
}
