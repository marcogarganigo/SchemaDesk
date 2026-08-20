import type { DatabaseSchema } from "@/lib/schema/types";

export interface JoinPath {
  /** The FROM table id. */
  from: string;
  /** The JOINed table id. */
  to: string;
  /** Junction table id when the path goes through an N:M bridge, else null. */
  junction: string | null;
  /** SQL fragments for the join clause. */
  sql: string;
  description: string;
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** Tables reachable from `from` in one hop or through a junction table. */
export function relatedTables(schema: DatabaseSchema, from: string): string[] {
  const direct = new Set<string>();
  const viaJunction = new Set<string>();
  const junctionIds = new Set<string>(
    schema.tables
      .filter((t) => {
        const pk = t.columns.filter((c) => c.primaryKey);
        return pk.length >= 2 && pk.every((c) => c.foreignKey);
      })
      .map((t) => t.id),
  );

  for (const rel of schema.relationships) {
    if (rel.sourceTable === from) direct.add(rel.targetTable);
    if (rel.targetTable === from) direct.add(rel.sourceTable);
  }
  // N:M: from → junction → other side.
  for (const j of junctionIds) {
    const neighbors = new Set<string>();
    for (const rel of schema.relationships) {
      if (rel.sourceTable === j) neighbors.add(rel.targetTable);
      if (rel.targetTable === j) neighbors.add(rel.sourceTable);
    }
    if (neighbors.has(from)) {
      for (const n of neighbors) {
        if (n !== from) viaJunction.add(n);
      }
    }
  }

  return [...new Set([...direct, ...viaJunction])].sort();
}

/** Build the SELECT … JOIN for two tables, or null when not connected. */
export function buildJoinQuery(
  schema: DatabaseSchema,
  from: string,
  to: string,
): JoinPath | null {
  const tableOf = (id: string) => schema.tables.find((t) => t.id === id);
  const fromTable = tableOf(from);
  const toTable = tableOf(to);
  if (!fromTable || !toTable || from === to) return null;

  const a = quote(fromTable.name);
  const b = quote(toTable.name);

  // Direct relationship either way.
  const direct = schema.relationships.find(
    (r) =>
      (r.sourceTable === from && r.targetTable === to) ||
      (r.sourceTable === to && r.targetTable === from),
  );
  if (direct) {
    if (direct.sourceTable === from) {
      return {
        from,
        to,
        junction: null,
        sql:
          `SELECT ${a}.*, ${b}.*\n` +
          `FROM ${a} a\n` +
          `INNER JOIN ${b} b ON a.${quote(direct.sourceColumn)} = b.${quote(direct.targetColumn)};`,
        description: `${fromTable.name}.${direct.sourceColumn} → ${toTable.name}.${direct.targetColumn}`,
      };
    }
    return {
      from,
      to,
      junction: null,
      sql:
        `SELECT ${a}.*, ${b}.*\n` +
        `FROM ${a} a\n` +
        `INNER JOIN ${b} b ON b.${quote(direct.sourceColumn)} = a.${quote(direct.targetColumn)};`,
      description: `${toTable.name}.${direct.sourceColumn} → ${fromTable.name}.${direct.targetColumn}`,
    };
  }

  // Junction path: from → junction → to.
  for (const junction of schema.tables) {
    const pk = junction.columns.filter((c) => c.primaryKey);
    if (!(pk.length >= 2 && pk.every((c) => c.foreignKey))) continue;
    const relA = schema.relationships.find(
      (r) => r.sourceTable === junction.id && r.targetTable === from,
    );
    const relB = schema.relationships.find(
      (r) => r.sourceTable === junction.id && r.targetTable === to,
    );
    if (!relA || !relB) continue;
    const j = quote(junction.name);
    return {
      from,
      to,
      junction: junction.id,
      sql:
        `SELECT ${a}.*, ${b}.*\n` +
        `FROM ${a} a\n` +
        `INNER JOIN ${j} j ON a.${quote(relA.targetColumn)} = j.${quote(relA.sourceColumn)}\n` +
        `INNER JOIN ${b} b ON j.${quote(relB.sourceColumn)} = b.${quote(relB.targetColumn)};`,
      description: `${fromTable.name} —${junction.name}— ${toTable.name}`,
    };
  }

  return null;
}
