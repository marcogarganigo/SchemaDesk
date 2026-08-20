import { parseSql } from "@/lib/parser";
import { tokenize } from "@/lib/parser/tokenizer";
import type { DatabaseSchema, Relationship } from "@/lib/schema/types";

function quoteIdentifier(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function formatSchema(schema: DatabaseSchema): string {
  const blocks: string[] = [];

  for (const table of schema.tables) {
    const relsByColumn = new Map<string, Relationship>();
    const compositeRels = new Map<string, Relationship[]>();

    for (const rel of schema.relationships.filter((r) => r.sourceTable === table.id)) {
      const key = `${rel.sourceTable}:${rel.targetTable}:${rel.name ?? ""}`;
      if (!compositeRels.has(key)) compositeRels.set(key, []);
      compositeRels.get(key)!.push(rel);
    }

    const compositeKeys = [...compositeRels.entries()].filter(
      ([, rels]) => rels.length > 1,
    );

    // Mark columns that are part of a composite FK.
    const compositeColumns = new Set<string>();
    for (const [, rels] of compositeKeys) {
      for (const r of rels) compositeColumns.add(r.sourceColumn);
    }

    for (const rel of schema.relationships.filter((r) => r.sourceTable === table.id)) {
      const group = compositeRels.get(`${rel.sourceTable}:${rel.targetTable}:${rel.name ?? ""}`);
      if (group && group.length === 1) relsByColumn.set(rel.sourceColumn, rel);
    }

    const pkColumns = table.columns.filter((c) => c.primaryKey).map((c) => c.name);
    const hasTrailing = pkColumns.length > 1 || compositeKeys.length > 0;

    const lines: string[] = [];
    lines.push(`CREATE TABLE ${quoteIdentifier(table.name)} (`);

    const rowLines: string[] = [];
    table.columns.forEach((col, i) => {
      const parts = [`  ${quoteIdentifier(col.name)}`, col.type.toUpperCase()];
      const inlineRel = relsByColumn.get(col.name);

      if (col.primaryKey) parts.push("PRIMARY KEY");
      if (!col.nullable && !col.primaryKey) parts.push("NOT NULL");
      if (col.unique) parts.push("UNIQUE");
      if (col.defaultValue != null && col.defaultValue !== "") parts.push(`DEFAULT ${col.defaultValue}`);
      if (inlineRel && !compositeColumns.has(col.name)) {
        const target = schema.tables.find((t) => t.id === inlineRel.targetTable);
        parts.push(`REFERENCES ${quoteIdentifier(target?.name ?? inlineRel.targetTable)}(${quoteIdentifier(inlineRel.targetColumn)})`);
      }
      if (col.autoIncrement) parts.push("AUTO_INCREMENT");

      const isLast = i === table.columns.length - 1 && !hasTrailing;
      rowLines.push(parts.join(" ") + (isLast ? "" : ","));
    });

    lines.push(...rowLines);

    if (pkColumns.length > 1) {
      lines.push(`,  PRIMARY KEY (${pkColumns.map(quoteIdentifier).join(", ")})`);
    }

    for (const [, rels] of compositeKeys) {
      const rel = rels[0];
      const target = schema.tables.find((t) => t.id === rel.targetTable);
      lines.push(
        `,  FOREIGN KEY (${rels.map((r) => quoteIdentifier(r.sourceColumn)).join(", ")}) REFERENCES ${quoteIdentifier(
          target?.name ?? rel.targetTable,
        )}(${rels.map((r) => quoteIdentifier(r.targetColumn)).join(", ")})`,
      );
    }

    lines.push(");");
    blocks.push(lines.join("\n"));

    // Standalone indexes
    for (const index of table.indexes) {
      if (index.primary) continue;
      blocks.push(
        `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(index.name)} ON ${quoteIdentifier(
          table.name,
        )} (${index.columns.map(quoteIdentifier).join(", ")});`,
      );
    }
  }

  return blocks.join("\n\n");
}

/** Lightweight normalization used when the SQL cannot be parsed. */
function fallbackFormat(sql: string): string {
  const tokens = tokenize(sql);
  const noSpaceBefore = new Set([")", "]", ".", ",", ";"]);
  const noSpaceAfter = new Set(["(", "[", "."]);
  let out = "";
  let lastValue = "";

  for (const t of tokens) {
    if (t.type === "eof") break;
    if (t.type === "whitespace") {
      if (t.value.includes("\n") && /\S/.test(out) && !out.endsWith("\n")) {
        // preserve line breaks, but never emit two in a row
        out = out.replace(/\n+$/, "") + "\n";
      }
      continue;
    }
    if (t.type === "comment") {
      if (out && !out.endsWith(" ") && !out.endsWith("\n")) out += " ";
      out += t.value;
      lastValue = t.value;
      continue;
    }

    let value = t.value;
    if (t.type === "keyword") value = value.toUpperCase();
    if (t.type === "string") value = `'${value.replace(/'/g, "''")}'`;

    const needSpace =
      out !== "" &&
      !out.endsWith(" ") &&
      !out.endsWith("\n") &&
      !noSpaceBefore.has(value) &&
      !noSpaceAfter.has(lastValue);
    if (needSpace) out += " ";
    out += value;

    lastValue = value;
  }

  return out
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatSql(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) return "";
  try {
    const schema = parseSql(trimmed);
    if (schema.tables.length === 0) return fallbackFormat(trimmed);
    return formatSchema(schema);
  } catch {
    return fallbackFormat(trimmed);
  }
}
