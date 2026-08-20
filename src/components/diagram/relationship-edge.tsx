"use client";

import { createContext, memo, useContext, useMemo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from "@xyflow/react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RELATIONSHIP_EDGE, type EdgeStyle, type SchemaEdge } from "@/lib/graph/types";

/**
 * Edge routing style, provided by the canvas so edges and export share the
 * same preference without threading it through every edge's data.
 */
export const EdgeStyleContext = createContext<EdgeStyle>("orthogonal");

export function useEdgeStyle(): EdgeStyle {
  return useContext(EdgeStyleContext);
}

/** Whether to show cardinality badges (1:N, N:M, etc.) on edges. */
export const CardinalityContext = createContext<boolean>(true);

/* ------------------------------------------------------------------ */
/*  Arrowhead — derived from the actual curve tangent at the endpoint  */
/* ------------------------------------------------------------------ */

/**
 * Compute the endpoint tangent of any SVG path (bezier or smoothstep).
 *
 * Bezier ("M sx,sy C cp1,cp1 cp2,cp2 tx,ty"): tangent = (tx - cp2x, ty - cp2y)
 * Smoothstep ("M sx,sy L x,y L x,y ... L tx,ty"): tangent = (tx - prevX, ty - prevY)
 *
 * We extract the last two numeric coordinate pairs from the path: those are
 * always (prevPoint, endpoint), regardless of command. This makes the
 * arrowhead always align with the actual path direction at the endpoint.
 */
/**
 * Extract all numeric coordinate pairs from an SVG path string. Returns
 * them in order: [[x0,y0], [x1,y1], ...]. M, L, C, Q, T, S, A commands
 * all consume coordinates; we just grab every number pair.
 */
function extractPathPoints(path: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  // Match every pair of signed numbers separated by comma, space, or both.
  const re = /(-?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*[,\s]\s*(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    points.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  return points;
}

function pathEndpointTangent(path: string): { dx: number; dy: number } | null {
  const pts = extractPathPoints(path);
  if (pts.length < 2) return null;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { dx: b[0] - a[0], dy: b[1] - a[1] };
}

/**
 * Compute a filled-arrowhead polygon at the target endpoint.
 * Uses the actual path tangent at the endpoint — derived from the
 * last two coordinate pairs of the path string. This works for both
 * bezier and smoothstep paths and always aligns with the curve.
 */
function arrowheadPolygon(
  path: string,
  tx: number,
  ty: number,
  size = 7.5,
): { points: string; angle: number } {
  // Extract the actual endpoint tangent from the path string.
  const tangent = pathEndpointTangent(path);
  let dx = 1;
  let dy = 0;
  if (tangent && (tangent.dx !== 0 || tangent.dy !== 0)) {
    dx = tangent.dx;
    dy = tangent.dy;
  }
  const angle = Math.atan2(dy, dx);
  // Draw the arrowhead so its TIP sits exactly at (tx, ty).
  const tipX = tx;
  const tipY = ty;
  // Two base corners, perpendicular to the arrow direction.
  const baseX = tipX - size * Math.cos(angle);
  const baseY = tipY - size * Math.sin(angle);
  const perpX = size * 0.55 * Math.cos(angle + Math.PI / 2);
  const perpY = size * 0.55 * Math.sin(angle + Math.PI / 2);
  const bx1 = baseX + perpX;
  const by1 = baseY + perpY;
  const bx2 = baseX - perpX;
  const by2 = baseY - perpY;
  return {
    points: `${tipX},${tipY} ${bx1},${by1} ${bx2},${by2}`,
    angle,
  };
}

export const RelationshipEdge = memo(function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<SchemaEdge>) {
  const edgeStyle = useEdgeStyle();
  const showCardinality = useContext(CardinalityContext);
  const [hovered, setHovered] = useState(false);

  const srcPos = sourcePosition ?? Position.Right;
  const tgtPos = targetPosition ?? Position.Left;

  const [path, labelX, labelY] =
    edgeStyle === "curved"
      ? getBezierPath({
          sourceX,
          sourceY,
          sourcePosition: srcPos,
          targetX,
          targetY,
          targetPosition: tgtPos,
          curvature: 0.3,
        })
      : getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition: srcPos,
          targetX,
          targetY,
          targetPosition: tgtPos,
          borderRadius: 14,
        });

  const dimmed = data?.dimmed;
  const rel = data?.relationship;
  const cardinality = data?.cardinality ?? "1:N";
  const active = selected || hovered;
  const stroke = active ? "var(--edge-selected)" : "var(--edge)";

  // Manual arrowhead — always aligns with the actual path tangent at the
  // endpoint (works for both bezier and smoothstep).
  const { points: arrowPoints } = useMemo(
    () => arrowheadPolygon(path, targetX, targetY, active ? 9 : 7.5),
    [path, targetX, targetY, active],
  );

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: active ? 2 : 1.4,
          opacity: dimmed ? 0.18 : 1,
        }}
      />
      {/* Arrowhead polygon — sits exactly on the path endpoint with correct tangent */}
      <polygon
        points={arrowPoints}
        fill={stroke}
        opacity={dimmed ? 0.18 : 1}
        style={{ pointerEvents: "none" }}
      />
      {rel && (
        <EdgeLabelRenderer>
          {showCardinality && (
            <div
              className="nodrag nopan pointer-events-none absolute z-10"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                opacity: dimmed ? 0.18 : 1,
              }}
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-[5px] border px-1.5 py-px font-mono text-[9px] font-bold tracking-wide transition-colors",
                  "border-border bg-elevated text-faint",
                  active && "border-accent/60 bg-raised text-accent shadow-pop",
                )}
              >
                {cardinality}
              </span>
            </div>
          )}

          {active && (
            <div
              className="nodrag nopan pointer-events-none absolute z-10"
              style={{
                transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 16}px)`,
                opacity: dimmed ? 0.18 : 1,
              }}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-elevated px-2 py-0.5 font-mono text-[10px] text-secondary shadow-pop">
                {rel.sourceColumn}
                <span className="text-faint">→</span>
                {rel.targetColumn}
              </span>
            </div>
          )}

          {selected && (
            <div
              className="nodrag nopan pointer-events-none absolute z-10"
              style={{ transform: `translate(-50%, 0) translate(${labelX}px, ${labelY + 14}px)` }}
            >
              <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-elevated px-2 py-1 shadow-pop">
                <span className="font-mono text-[10.5px] leading-tight text-foreground">
                  {rel.sourceColumn}
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                  <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  {rel.onDelete ? `on delete ${rel.onDelete.toLowerCase()}` : "references"}
                </span>
                <span className="font-mono text-[10.5px] leading-tight text-foreground">
                  {rel.targetColumn}
                </span>
              </div>
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

export const edgeTypes = { [RELATIONSHIP_EDGE]: RelationshipEdge };
