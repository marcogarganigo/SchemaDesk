/**
 * Normalized, dialect-agnostic representation of a database schema.
 *
 * This module is intentionally free of any React / React Flow imports so it
 * can be reused, unit-tested, and later serialized independently of the UI.
 */

export type SqlDialect = "mysql" | "postgresql" | "sqlite" | "generic";

export interface Column {
  /** Logical id, unique within a table. */
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  /** Participates in a foreign key (i.e. is the referencing side). */
  foreignKey: boolean;
  defaultValue?: string;
  autoIncrement: boolean;
  /** Position in the original DDL (0-indexed). */
  order: number;
}

export interface Index {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

export interface Table {
  id: string;
  name: string;
  /** Optional schema / namespace qualifier, e.g. `public.users`. */
  schema?: string;
  columns: Column[];
  indexes: Index[];
  /** Line in the source SQL where this table definition starts. */
  sourceLine: number;
}

export interface Relationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  /** Cardinality hints collected from ON DELETE / ON UPDATE rules. */
  onDelete?: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
  name?: string;
}

export interface DatabaseSchema {
  tables: Table[];
  relationships: Relationship[];
  /** Best-guess dialect inferred from the DDL. */
  dialect: SqlDialect;
}

export interface ParseDiagnostic {
  line: number;
  column: number;
  message: string;
  /** Raw token that triggered the error, if any. */
  token?: string;
}
