import type { Column, DatabaseSchema, Table } from "@/lib/schema/types";

/* Deterministic PRNG so the same schema always yields the same seed data. */
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
  "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
  "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
  "xray", "yankee", "zulu", "quartz", "amber", "cedar", "moss",
];

const FIRST_NAMES = [
  "Liam", "Emma", "Noah", "Olivia", "Ava", "Sophia", "Mason", "Isabella",
  "James", "Mia", "Lucas", "Amelia", "Ethan", "Harper", "Logan", "Evelyn",
];
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson",
];

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function sentence(rnd: () => number): string {
  const n = 5 + Math.floor(rnd() * 5);
  const words = Array.from({ length: n }, () => pick(rnd, WORDS));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function hex(rnd: () => number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += "0123456789abcdef"[Math.floor(rnd() * 16)];
  return out;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isNumericType(type: string): boolean {
  const t = type.toLowerCase();
  return /^(int|integer|bigint|smallint|tinyint|mediumint|serial|numeric|decimal|real|float|double|money)/.test(t);
}

function isDateType(type: string): boolean {
  const t = type.toLowerCase();
  return /(date|time|timestamp|datetime)/.test(t);
}

function isBoolType(type: string): boolean {
  return /^(bool|boolean)$/i.test(type);
}

function isJsonType(type: string): boolean {
  return /^(json|jsonb)$/i.test(type);
}

function columnNameHint(col: Column): "email" | "name" | "username" | "slug" | "title" | "password" | "url" | "status" | "phone" | "uuid" | "timestamp" | "text" | "other" {
  const n = col.name.toLowerCase();
  if (n.includes("email")) return "email";
  if (n.includes("password") || n.includes("hash") || n.includes("token") || n.includes("secret")) return "password";
  if (n.includes("slug")) return "slug";
  if (n.includes("url") || n.includes("link")) return "url";
  if (n.includes("username") || n.includes("login")) return "username";
  if (n === "name" || n.endsWith("_name") || n.includes("first_name") || n.includes("last_name") || n.includes("full_name")) return "name";
  if (n === "title" || n.endsWith("_title") || n.includes("subject")) return "title";
  if (n.includes("status") || n.includes("state")) return "status";
  if (n.includes("phone") || n.includes("mobile") || n.includes("tel")) return "phone";
  if (n.includes("uuid") || n.includes("guid") || n.includes("uid") || n === "id" && n.length > 6) return "uuid";
  if (n.includes("created") || n.includes("updated") || n.includes("deleted") || n.includes("at") && n.endsWith("_at")) return "timestamp";
  if (n === "body" || n === "content" || n === "description" || n === "bio" || n === "comment" || n === "text" || n.includes("message")) return "text";
  return "other";
}

/** Order tables so referenced tables come first (topological sort). */
function dependencyOrder(schema: DatabaseSchema): Table[] {
  const byId = new Map(schema.tables.map((t) => [t.id, t]));
  const rels = schema.relationships.filter(
    (r) => byId.has(r.sourceTable) && byId.has(r.targetTable),
  );
  const dependsOn = new Map<string, Set<string>>();
  for (const t of schema.tables) dependsOn.set(t.id, new Set());
  for (const r of rels) dependsOn.get(r.sourceTable)!.add(r.targetTable);

  const order: Table[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (visited.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const dep of dependsOn.get(id) ?? []) visit(dep);
    visiting.delete(id);
    visited.add(id);
    const t = byId.get(id);
    if (t) order.push(t);
  };

  for (const t of schema.tables) visit(t.id);
  return order;
}

export function generateMockSql(
  schema: DatabaseSchema,
  rowsPerTable = 10,
  seed?: number,
): string {
  const seedBase =
    seed ??
    [...schema.tables.map((t) => t.name)].join("").split("").reduce(
      (acc, c) => acc + c.charCodeAt(0),
      7,
    );
  const rnd = mulberry32(seedBase);

  // Generated values per table id → column name → array of raw values.
  const generated = new Map<string, Map<string, string[]>>();

  const valueFor = (table: Table, col: Column, rowIndex: number): string => {
    const hint = columnNameHint(col);

    // Foreign key: reference a value that exists in the target table.
    if (col.foreignKey) {
      const rel = schema.relationships.find(
        (r) => r.sourceTable === table.id && r.sourceColumn === col.name,
      );
      if (rel) {
        const targetValues = generated.get(rel.targetTable)?.get(rel.targetColumn);
        if (targetValues && targetValues.length > 0) {
          return targetValues[rowIndex % targetValues.length];
        }
      }
    }

    if (isNumericType(col.type)) return String(rowIndex + 1);
    if (isBoolType(col.type)) return rnd() < 0.5 ? "TRUE" : "FALSE";
    if (isJsonType(col.type)) return `'{"key": "${pick(rnd, WORDS)}", "value": ${rowIndex + 1}}'`;
    if (isDateType(col.type)) {
      const base = Date.UTC(2026, 0, 1) - rowIndex * 86400000 * (1 + Math.floor(rnd() * 3));
      const d = new Date(base);
      if (col.type.toLowerCase().includes("date") && !col.type.toLowerCase().includes("time")) {
        return quote(d.toISOString().slice(0, 10));
      }
      return quote(d.toISOString().slice(0, 19).replace("T", " "));
    }

    switch (hint) {
      case "email":
        return quote(
          `${pick(rnd, FIRST_NAMES).toLowerCase()}.${pick(rnd, LAST_NAMES).toLowerCase()}${rowIndex + 1}@example.com`,
        );
      case "username":
        return quote(`${pick(rnd, WORDS)}_${rowIndex + 1}`);
      case "name":
        return quote(`${pick(rnd, FIRST_NAMES)} ${pick(rnd, LAST_NAMES)}`);
      case "slug":
        return quote(`${pick(rnd, WORDS)}-${pick(rnd, WORDS)}-${rowIndex + 1}`);
      case "title":
        return quote(sentence(rnd));
      case "password":
        return quote(`$2b$10$${hex(rnd, 22)}`);
      case "url":
        return quote(`https://example.com/${pick(rnd, WORDS)}/${rowIndex + 1}`);
      case "status":
        return quote(pick(rnd, ["draft", "published", "pending", "archived", "active", "inactive"]));
      case "phone":
        return quote(`+39 ${300 + Math.floor(rnd() * 600)} ${100 + Math.floor(rnd() * 900)} ${1000 + Math.floor(rnd() * 9000)}`);
      case "uuid":
        return quote(`${hex(rnd, 8)}-${hex(rnd, 4)}-4${hex(rnd, 3)}-${"89ab"[Math.floor(rnd() * 4)]}${hex(rnd, 3)}-${hex(rnd, 12)}`);
      case "timestamp":
        return quote(new Date(Date.UTC(2025, 0, 1) + Math.floor(rnd() * 400 * 86400000)).toISOString().slice(0, 19).replace("T", " "));
      case "text":
        return quote(sentence(rnd));
      default: {
        const t = col.type.toLowerCase();
        if (t.includes("char") || t.includes("text") || t.includes("clob")) {
          return quote(sentence(rnd));
        }
        return quote(pick(rnd, WORDS));
      }
    }
  };

  const order = dependencyOrder(schema);

  for (const table of order) {
    const values = new Map<string, string[]>();
    for (const col of table.columns) {
      const arr: string[] = [];
      for (let i = 0; i < rowsPerTable; i++) {
        const nullable = col.nullable && !col.primaryKey && !col.foreignKey;
        if (nullable && rnd() < 0.15) {
          arr.push("NULL");
          continue;
        }
        arr.push(valueFor(table, col, i));
      }
      values.set(col.name, arr);
    }
    generated.set(table.id, values);
  }

  const lines: string[] = [
    `-- Schema Desk seed data · ${schema.dialect}`,
    `-- Generated deterministically from the current schema.`,
    "",
  ];
  for (const table of order) {
    const cols = table.columns.map((c) => c.name);
    if (cols.length === 0) continue;
    const perRow: string[] = [];
    for (let i = 0; i < rowsPerTable; i++) {
      const rowVals = cols.map((c) => generated.get(table.id)!.get(c)![i] ?? "NULL");
      perRow.push(`(${rowVals.join(", ")})`);
    }
    lines.push(
      `INSERT INTO "${table.name.replace(/"/g, '""')}" (${cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ")}) VALUES`,
    );
    lines.push(perRow.join(",\n"));
    lines.push(";");
    lines.push("");
  }

  return lines.join("\n");
}
