import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import type { SchemaEdge, SchemaNode, LayoutDirection } from "./types";

interface LayoutOptions {
  direction: LayoutDirection;
  nodeSeparation?: number;
  rankSeparation?: number;
}

/* ------------------------------------------------------------------ */
/*  Edge handle assignment                                            */
/* ------------------------------------------------------------------ */

/**
 * After dagre positions every node, assign each edge the optimal
 * source/target handle IDs so React Flow routes the path to the
 * correct side of each table (right, left, top, or bottom).
 *
 * Handle IDs follow the convention: `{side}:{columnName}`
 * where side is one of sr (source-right), sl (source-left),
 * st (source-top), sb (source-bottom), tl (target-left),
 * etc.
 */
export function assignEdgeHandles(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
): SchemaEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Parallel-edge tracker: edges sharing the same node pair get offset
  // perpendicular to their side so they don't overlap.
  const pairCounts = new Map<string, number>();

  return edges.map((edge) => {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) return edge;

    const srcW = src.data.width;
    const srcH = src.data.height;
    const tgtW = tgt.data.width;
    const tgtH = tgt.data.height;

    // Node centers (dagre positions are top-left after layoutGraph).
    const sx = src.position.x + srcW / 2;
    const sy = src.position.y + srcH / 2;
    const tx = tgt.position.x + tgtW / 2;
    const ty = tgt.position.y + tgtH / 2;

    const dx = tx - sx;
    const dy = ty - sy;

    // Choose source side: the side of the source node that faces the target.
    let srcSide: Position;
    let tgtSide: Position;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal-dominant → prefer Right/Left.
      srcSide = dx > 0 ? Position.Right : Position.Left;
      tgtSide = dx > 0 ? Position.Left : Position.Right;
    } else {
      // Vertical-dominant → prefer Bottom/Top.
      srcSide = dy > 0 ? Position.Bottom : Position.Top;
      tgtSide = dy > 0 ? Position.Top : Position.Bottom;
    }

    // Build handle IDs: {side-letter}:{columnName}
    const sideLetter: Record<Position, string> = {
      [Position.Right]: "sr",
      [Position.Left]: "sl",
      [Position.Top]: "st",
      [Position.Bottom]: "sb",
    };
    const tgtSideLetter: Record<Position, string> = {
      [Position.Right]: "tr",
      [Position.Left]: "tl",
      [Position.Top]: "tt",
      [Position.Bottom]: "tb",
    };

    // Parallel edge offset.
    const pairKey = [edge.source, edge.target].sort().join("::");
    const idx = pairCounts.get(pairKey) ?? 0;
    pairCounts.set(pairKey, idx + 1);
    const parallelOffset = idx * 16; // 16px spacing between parallel edges

    return {
      ...edge,
      sourceHandle: `${sideLetter[srcSide]}:${edge.data?.sourceColumn ?? ""}`,
      targetHandle: `${tgtSideLetter[tgtSide]}:${edge.data?.targetColumn ?? ""}`,
      data: { ...(edge.data ?? ({} as SchemaEdge["data"])), parallelOffset },
    } as SchemaEdge;
  });
}

/**
 * Lay out a graph hierarchically. Dagre reports node centers; React Flow
 * expects top-left positions, so we translate each node by half its size.
 */
export function layoutGraph(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  options: LayoutOptions,
): SchemaNode[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    nodesep: options.nodeSeparation ?? 56,
    ranksep: options.rankSeparation ?? 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: node.data.width, height: node.data.height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: pos.x - node.data.width / 2,
        y: pos.y - node.data.height / 2,
      },
    };
  });
}
