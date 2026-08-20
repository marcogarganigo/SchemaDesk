import type { Edge, Node } from "@xyflow/react";
import type { Relationship, Table } from "@/lib/schema/types";

export const TABLE_NODE = "schema-table";
export const RELATIONSHIP_EDGE = "schema-relationship";

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  width: number;
  height: number;
  headerHeight: number;
  rowHeight: number;
  /** Visual state, driven by selection. */
  selected: boolean;
  dimmed: boolean;
  related: boolean;
  /** Index of the first column, used for subtle stagger on mount. */
  order: number;
  /** Names of columns that are FK sources — where lines start FROM. */
  sourceColumns: string[];
  /** Names of columns that are FK targets — where lines arrive AT. */
  targetColumns: string[];
  /** @deprecated kept for back-compat; merge of sourceColumns + targetColumns. */
  relationshipColumns: string[];
  /** When true the table renders as its header only. */
  collapsed: boolean;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
  relationship: Relationship;
  sourceColumn: string;
  targetColumn: string;
  selected: boolean;
  dimmed: boolean;
  /** Crow's-foot-style cardinality, derived from the schema. */
  cardinality: Cardinality;
}

/** Cardinality of a relationship, in the classic 1:1 / 1:N / N:M notation. */
export type Cardinality = "1:1" | "1:N" | "N:M";

export type SchemaNode = Node<TableNodeData, typeof TABLE_NODE>;
export type SchemaEdge = Edge<RelationshipEdgeData, typeof RELATIONSHIP_EDGE>;

export type LayoutDirection = "LR" | "TB";

export type EdgeStyle = "orthogonal" | "curved";
