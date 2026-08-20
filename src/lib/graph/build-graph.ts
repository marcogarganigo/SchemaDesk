import type { DatabaseSchema, Table } from "@/lib/schema/types";
import {
  RELATIONSHIP_EDGE,
  TABLE_NODE,
  type Cardinality,
  type SchemaEdge,
  type SchemaNode,
  type TableNodeData,
} from "./types";

export const HEADER_HEIGHT = 46;
export const ROW_HEIGHT = 28;
const MIN_WIDTH = 224;
const MAX_WIDTH = 340;
const MONO_CHAR = 7.3; // approximate width of a 12px monospace glyph
const SMALL_CHAR = 6.7;

/** Approximate node width from its content, so we can lay out before render. */
export function estimateNodeWidth(table: Table): number {
  const header = table.name.length * 8 + 72;
  let body = 0;
  for (const col of table.columns) {
    const badge = (col.primaryKey ? 1 : 0) + (col.foreignKey ? 1 : 0) + (col.unique ? 1 : 0);
    const w = col.name.length * MONO_CHAR + col.type.length * SMALL_CHAR + badge * 22 + 58;
    if (w > body) body = w;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.max(header, body)));
}

export function createNodeData(
  table: Table,
  order: number,
  sourceColumns: string[],
  targetColumns: string[],
  relationshipColumns: string[],
): TableNodeData {
  const width = estimateNodeWidth(table);
  const height = HEADER_HEIGHT + table.columns.length * ROW_HEIGHT;
  return {
    table,
    width,
    height,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
    selected: false,
    dimmed: false,
    related: false,
    order,
    sourceColumns,
    targetColumns,
    relationshipColumns,
    collapsed: false,
  };
}

/** True when the column is guaranteed unique (inline UNIQUE, PK, unique index). */
function isUniqueColumn(table: Table, columnName: string): boolean {
  const col = table.columns.find((c) => c.name === columnName);
  if (!col) return false;
  if (col.unique || col.primaryKey) return true;
  return table.indexes.some(
    (idx) => idx.unique && idx.columns.length === 1 && idx.columns[0] === columnName,
  );
}

/** True for junction tables: a composite primary key made only of FKs. */
function isJunctionTable(table: Table): boolean {
  const pk = table.columns.filter((c) => c.primaryKey);
  return pk.length >= 2 && pk.every((c) => c.foreignKey);
}

/**
 * Crow's-foot-style cardinality for one relationship:
 * - N:M when the referencing table is a junction (composite FK-only PK);
 * - 1:1 when the referencing column is unique (or the shared primary key);
 * - 1:N otherwise.
 */
export function relationshipCardinality(
  schema: DatabaseSchema,
  rel: { sourceTable: string; sourceColumn: string },
): Cardinality {
  const sourceTable = schema.tables.find((t) => t.id === rel.sourceTable);
  if (!sourceTable) return "1:N";
  if (isJunctionTable(sourceTable)) return "N:M";
  if (isUniqueColumn(sourceTable, rel.sourceColumn)) return "1:1";
  return "1:N";
}

export function buildGraph(schema: DatabaseSchema): { nodes: SchemaNode[]; edges: SchemaEdge[] } {
  // Track columns per role: source (FK starting), target (PK referenced).
  // A column can be in both (e.g. self-referential PKs).
  const sourcesByTable = new Map<string, Set<string>>();
  const targetsByTable = new Map<string, Set<string>>();
  for (const rel of schema.relationships) {
    if (!sourcesByTable.has(rel.sourceTable)) sourcesByTable.set(rel.sourceTable, new Set());
    sourcesByTable.get(rel.sourceTable)!.add(rel.sourceColumn);
    if (!targetsByTable.has(rel.targetTable)) targetsByTable.set(rel.targetTable, new Set());
    targetsByTable.get(rel.targetTable)!.add(rel.targetColumn);
  }

  const nodes: SchemaNode[] = schema.tables.map((table, i) => {
    const sourceCols = [...(sourcesByTable.get(table.id) ?? [])];
    const targetCols = [...(targetsByTable.get(table.id) ?? [])];
    const all = [...new Set([...sourceCols, ...targetCols])];
    const data = createNodeData(table, i, sourceCols, targetCols, all);
    return {
      id: table.id,
      type: TABLE_NODE,
      position: { x: 0, y: 0 },
      data,
      style: { width: data.width, height: data.height },
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const edges: SchemaEdge[] = schema.relationships
    .filter((rel) => nodeById.has(rel.sourceTable) && nodeById.has(rel.targetTable))
    .map((rel) => ({
      id: rel.id,
      type: RELATIONSHIP_EDGE,
      source: rel.sourceTable,
      target: rel.targetTable,
      // Handle IDs are assigned post-layout by assignEdgeHandles().
      // These placeholders are replaced with sr:col / tl:col etc. after
      // dagre computes node positions.
      data: {
        relationship: rel,
        sourceColumn: rel.sourceColumn,
        targetColumn: rel.targetColumn,
        selected: false,
        dimmed: false,
        cardinality: relationshipCardinality(schema, rel),
      },
    }));

  return { nodes, edges };
}
