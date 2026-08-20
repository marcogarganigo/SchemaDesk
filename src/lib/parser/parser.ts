import type {
  Column,
  DatabaseSchema,
  ParseDiagnostic,
  Relationship,
  SqlDialect,
  Table,
} from "@/lib/schema/types";
import { isSignificant, tokenize, type Token } from "./tokenizer";

/** Column-level keywords that terminate a data type expression. */
const TYPE_STOP = new Set<string>([
  "PRIMARY",
  "NOT",
  "NULL",
  "UNIQUE",
  "DEFAULT",
  "REFERENCES",
  "CHECK",
  "CONSTRAINT",
  "COLLATE",
  "COMMENT",
  "ON",
  "GENERATED",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
]);

export class SqlParseError extends Error {
  readonly diagnostic: ParseDiagnostic;

  constructor(message: string, line: number, column: number, token?: string) {
    super(message);
    this.name = "SqlParseError";
    this.diagnostic = { message, line, column, token };
  }
}

interface PendingRelationship {
  sourceTableId: string;
  sourceColumn: string;
  targetTableName: string;
  targetColumn?: string;
  onDelete?: Relationship["onDelete"];
  onUpdate?: Relationship["onUpdate"];
  name?: string;
  line: number;
}

interface ParsedColumn extends Column {
  foreignKey: boolean;
}

export function parseSql(sql: string): DatabaseSchema {
  const tokens = tokenize(sql);
  return new Parser(tokens).parse();
}

class Parser {
  private pos = 0;
  private tables: Table[] = [];
  private pending: PendingRelationship[] = [];
  private dialect: SqlDialect = "generic";
  private tableIds = new Set<string>();
  private indexSeq = 0;
  private relSeq = 0;

  constructor(private tokens: Token[]) {
    this.skipInsignificant();
  }

  // ---------------------------------------------------------------- stream

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private peekAhead(offset: number): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (t && t.type !== "eof") this.pos++;
    this.skipInsignificant();
    return t;
  }

  private skipInsignificant() {
    while (true) {
      const t = this.tokens[this.pos];
      if (!t || t.type === "eof" || isSignificant(t)) return;
      this.pos++;
    }
  }

  /** Peek at the n-th significant token ahead of the current position. */
  private significantOffset(offset: number): Token {
    let idx = this.pos;
    let count = 0;
    while (idx < this.tokens.length) {
      const t = this.tokens[idx];
      if (isSignificant(t)) {
        if (count === offset) return t;
        count++;
      }
      idx++;
    }
    return this.tokens[this.tokens.length - 1];
  }

  /**
   * Disambiguates keywords that can start a table-level constraint (KEY, INDEX,
   * UNIQUE…) from columns that happen to be named with those keywords.
   * e.g. `key VARCHAR(10)` is a column; `KEY idx (col)` is an index.
   */
  private looksLikeConstraint(): boolean {
    const t1 = this.significantOffset(1);
    if (t1.type === "identifier" || t1.type === "string") {
      const t2 = this.significantOffset(2);
      return t2.type === "punct" && t2.value === "(";
    }
    return (
      (t1.type === "punct" && t1.value === "(") ||
      (t1.type === "keyword" &&
        (t1.value.toUpperCase() === "KEY" || t1.value.toUpperCase() === "INDEX"))
    );
  }

  private fail(message: string, token?: Token): never {
    const t = token ?? this.peek();
    throw new SqlParseError(message, t.line, t.column, t.value || undefined);
  }

  private isKeyword(value: string, offset = 0): boolean {
    const t = this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    return t.type === "keyword" && t.value.toUpperCase() === value;
  }

  private matchKeyword(value: string): boolean {
    if (this.isKeyword(value)) {
      this.next();
      return true;
    }
    return false;
  }

  private expectKeyword(value: string): void {
    if (!this.matchKeyword(value)) {
      this.fail(`Expected "${value}"`);
    }
  }

  private isPunct(value: string): boolean {
    const t = this.peek();
    return t.type === "punct" && t.value === value;
  }

  private matchPunct(value: string): boolean {
    if (this.isPunct(value)) {
      this.next();
      return true;
    }
    return false;
  }

  private expectPunct(value: string): void {
    if (!this.matchPunct(value)) {
      this.fail(`Expected "${value}"`);
    }
  }

  private parseIdentifier(what = "identifier"): string {
    const t = this.peek();
    if (t.type === "identifier" || t.type === "string") {
      this.next();
      return t.value;
    }
    this.fail(`Expected ${what}`, t);
  }

  private parseQualifiedName(): { schema?: string; name: string; full: string } {
    const first = this.parseIdentifier("table name");
    if (this.matchPunct(".")) {
      const second = this.parseIdentifier("table name");
      return { schema: first, name: second, full: `${first}.${second}` };
    }
    return { schema: undefined, name: first, full: first };
  }

  private parseColumnList(): string[] {
    this.expectPunct("(");
    const cols: string[] = [];
    if (this.isPunct(")")) {
      this.next();
      return cols;
    }
    while (true) {
      cols.push(this.parseColumnName());
      if (this.matchPunct(",")) continue;
      this.expectPunct(")");
      break;
    }
    return cols;
  }

  private parseColumnName(): string {
    const t = this.peek();
    if (t.type === "identifier" || t.type === "string" || t.type === "keyword") {
      this.next();
      return t.value;
    }
    this.fail("Expected column name", t);
  }

  private consumeStatementEnd() {
    while (this.peek().type !== "eof") {
      const t = this.next();
      if (t.type === "punct" && t.value === ";") return;
    }
  }

  // ---------------------------------------------------------------- entry

  parse(): DatabaseSchema {
    while (this.peek().type !== "eof") {
      this.parseStatement();
    }
    return this.finalize();
  }

  private parseStatement() {
    const t = this.peek();
    if (t.type === "punct" && t.value === ";") {
      this.next();
      return;
    }
    if (t.type === "keyword") {
      const kw = t.value.toUpperCase();
      if (kw === "CREATE") this.parseCreate();
      else if (kw === "ALTER") this.parseAlter();
      else this.consumeStatementEnd();
      return;
    }
    // Unknown statement start — skip to the next semicolon rather than crash.
    this.consumeStatementEnd();
  }

  // ---------------------------------------------------------------- CREATE

  private parseCreate() {
    this.expectKeyword("CREATE");
    if (!this.matchKeyword("TEMPORARY")) this.matchKeyword("TEMP");

    if (this.isKeyword("UNIQUE") || this.isKeyword("INDEX")) {
      this.parseCreateIndex();
      this.consumeStatementEnd();
      return;
    }

    this.expectKeyword("TABLE");
    if (this.matchKeyword("IF")) {
      this.expectKeyword("NOT");
      this.expectKeyword("EXISTS");
    }

    const qualified = this.parseQualifiedName();
    const table = this.createTable(qualified, this.peek().line);

    if (!this.isPunct("(")) {
      // CREATE TABLE ... AS SELECT or similar — record an empty table.
      this.consumeStatementEnd();
      return;
    }

    this.expectPunct("(");
    while (!this.isPunct(")") && this.peek().type !== "eof") {
      this.parseTableElement(table);
      if (!this.matchPunct(",")) break;
    }
    this.expectPunct(")");
    this.consumeStatementEnd();
  }

  private parseCreateIndex() {
    let unique = false;
    if (this.matchKeyword("UNIQUE")) unique = true;
    // MySQL: CREATE UNIQUE INDEX / CREATE INDEX
    if (!this.matchKeyword("INDEX")) this.matchKeyword("KEY");

    if (this.matchKeyword("IF")) {
      this.expectKeyword("NOT");
      this.expectKeyword("EXISTS");
    }

    const indexName = this.parseIdentifier("index name");
    this.expectKeyword("ON");
    const tableName = this.parseQualifiedName();
    const columns = this.parseColumnList();

    const table = this.findTable(tableName.name) ?? this.createTable(tableName, this.peek().line);
    table.indexes.push({
      id: `idx_${this.indexSeq++}`,
      name: indexName,
      columns,
      unique,
      primary: false,
    });
  }

  private parseAlter() {
    this.expectKeyword("ALTER");
    this.expectKeyword("TABLE");
    const tableName = this.parseQualifiedName();
    this.expectKeyword("ADD");

    if (this.matchKeyword("CONSTRAINT")) {
      this.parseIdentifier("constraint name");
    }

    if (this.isKeyword("FOREIGN")) {
      const table = this.findTable(tableName.name) ?? this.createTable(tableName, this.peek().line);
      this.parseForeignKeyConstraint(table, undefined);
    }
    this.consumeStatementEnd();
  }

  // ---------------------------------------------------------------- table elements

  private parseTableElement(table: Table) {
    const t = this.peek();
    if (t.type === "punct" && t.value === ",") {
      this.next();
      return;
    }
    if (t.type === "keyword") {
      const kw = t.value.toUpperCase();
      if (kw === "CONSTRAINT") {
        this.next();
        const name = this.parseIdentifier("constraint name");
        this.parseTableConstraint(table, name);
        return;
      }
      if (kw === "PRIMARY") {
        this.parsePrimaryKey(table);
        return;
      }
      if (kw === "FOREIGN") {
        this.parseForeignKeyConstraint(table, undefined);
        return;
      }
      if (kw === "UNIQUE") {
        if (this.looksLikeConstraint()) this.parseUnique(table);
        else this.parseColumnDef(table, this.next().value);
        return;
      }
      if (kw === "KEY" || kw === "INDEX" || kw === "FULLTEXT" || kw === "SPATIAL") {
        if (this.looksLikeConstraint()) this.parseIndex(table);
        else this.parseColumnDef(table, this.next().value);
        return;
      }
      if (kw === "CHECK") {
        this.skipBalanced();
        return;
      }
    }
    this.parseColumnDef(table);
  }

  private parseTableConstraint(table: Table, name?: string) {
    const t = this.peek();
    const kw = t.type === "keyword" ? t.value.toUpperCase() : "";
    if (kw === "PRIMARY") this.parsePrimaryKey(table, name);
    else if (kw === "FOREIGN") this.parseForeignKeyConstraint(table, name);
    else if (kw === "UNIQUE") this.parseUnique(table, name);
    else if (kw === "CHECK") this.skipBalanced();
    else this.fail("Expected a table constraint");
  }

  private parsePrimaryKey(table: Table, name?: string) {
    this.expectKeyword("PRIMARY");
    this.expectKeyword("KEY");
    const columns = this.parseColumnList();
    for (const col of columns) {
      const c = this.findColumn(table, col);
      if (c) {
        c.primaryKey = true;
        c.nullable = false;
      }
    }
    table.indexes.push({
      id: `idx_${this.indexSeq++}`,
      name: name ?? "PRIMARY",
      columns,
      unique: true,
      primary: true,
    });
  }

  private parseForeignKeyConstraint(table: Table, name?: string) {
    this.expectKeyword("FOREIGN");
    this.expectKeyword("KEY");
    const sourceColumns = this.parseColumnList();
    this.expectKeyword("REFERENCES");
    const target = this.parseQualifiedName();
    let targetColumns: string[] = [];
    if (this.isPunct("(")) {
      targetColumns = this.parseColumnList();
    }

    let onDelete: Relationship["onDelete"];
    let onUpdate: Relationship["onUpdate"];
    while (this.matchKeyword("ON")) {
      if (this.matchKeyword("DELETE")) onDelete = this.parseReferentialAction();
      else if (this.matchKeyword("UPDATE")) onUpdate = this.parseReferentialAction();
      else this.fail("Expected \"DELETE\" or \"UPDATE\"");
    }

    sourceColumns.forEach((sourceColumn, i) => {
      const col = this.findColumn(table, sourceColumn);
      if (col) col.foreignKey = true;
      this.pending.push({
        sourceTableId: table.id,
        sourceColumn,
        targetTableName: target.full,
        targetColumn: targetColumns[i],
        onDelete,
        onUpdate,
        name,
        line: this.peek().line,
      });
    });
  }

  private parseUnique(table: Table, name?: string) {
    this.expectKeyword("UNIQUE");
    if (!this.matchKeyword("KEY")) this.matchKeyword("INDEX");
    if (this.peek().type === "identifier") {
      this.next(); // optional index name
    }
    const columns = this.parseColumnList();
    for (const col of columns) {
      const c = this.findColumn(table, col);
      if (c) c.unique = true;
    }
    table.indexes.push({
      id: `idx_${this.indexSeq++}`,
      name: name ?? `uq_${table.name}_${columns.join("_")}`,
      columns,
      unique: true,
      primary: false,
    });
  }

  private parseIndex(table: Table) {
    // KEY / INDEX / FULLTEXT / SPATIAL [name] (cols)
    this.next(); // consume KEY | INDEX | FULLTEXT | SPATIAL
    const explicitName = this.peek().type === "identifier" ? this.next().value : undefined;
    const columns = this.parseColumnList();
    table.indexes.push({
      id: `idx_${this.indexSeq++}`,
      name: explicitName ?? `idx_${table.name}_${columns.join("_")}`,
      columns,
      unique: false,
      primary: false,
    });
  }

  // ---------------------------------------------------------------- column def

  private parseColumnDef(table: Table, preConsumedName?: string) {
    const name = preConsumedName ?? this.parseIdentifier("column name");
    const column: ParsedColumn = {
      id: `${table.id}.${name}`,
      name,
      type: "",
      nullable: true,
      primaryKey: false,
      unique: false,
      foreignKey: false,
      autoIncrement: false,
      order: table.columns.length,
    };
    column.type = this.parseType();

    // Column-level constraints
    while (this.peek().type !== "eof") {
      const t = this.peek();
      if (t.type === "punct" && (t.value === "," || t.value === ")")) break;
      if (t.type !== "keyword") break;

      const kw = t.value.toUpperCase();
      if (kw === "NOT") {
        this.next();
        this.matchKeyword("NULL");
        column.nullable = false;
      } else if (kw === "NULL") {
        this.next();
        column.nullable = true;
      } else if (kw === "PRIMARY") {
        this.next();
        this.expectKeyword("KEY");
        column.primaryKey = true;
        column.nullable = false;
        table.indexes.push({
          id: `idx_${this.indexSeq++}`,
          name: "PRIMARY",
          columns: [name],
          unique: true,
          primary: true,
        });
      } else if (kw === "UNIQUE") {
        this.next();
        if (!this.matchKeyword("KEY")) this.matchKeyword("INDEX");
        column.unique = true;
        table.indexes.push({
          id: `idx_${this.indexSeq++}`,
          name: `uq_${table.name}_${name}`,
          columns: [name],
          unique: true,
          primary: false,
        });
      } else if (kw === "DEFAULT") {
        column.defaultValue = this.parseDefaultValue();
      } else if (kw === "REFERENCES") {
        column.foreignKey = true;
        this.parseInlineReferences(table, name);
      } else if (kw === "CHECK") {
        this.skipBalanced();
      } else if (kw === "COLLATE") {
        this.next();
        this.next();
      } else if (kw === "COMMENT") {
        this.next();
        if (this.peek().type === "string") this.next();
      } else if (kw === "AUTO_INCREMENT" || kw === "AUTOINCREMENT") {
        this.next();
        column.autoIncrement = true;
      } else if (kw === "GENERATED") {
        column.autoIncrement = this.parseGenerated();
      } else if (kw === "CONSTRAINT") {
        this.next();
        this.parseIdentifier("constraint name");
        continue;
      } else if (kw === "ON") {
        // e.g. ON UPDATE CURRENT_TIMESTAMP
        this.next();
        if (this.matchKeyword("UPDATE") || this.matchKeyword("DELETE")) {
          // skip the expression
          this.skipExpression();
        } else {
          break;
        }
      } else {
        break;
      }
    }

    table.columns.push(column);
  }

  private parseType(): string {
    const parts: string[] = [];
    let depth = 0;

    while (this.peek().type !== "eof") {
      const t = this.peek();

      if (t.type === "punct") {
        if (t.value === "(") {
          depth++;
          parts.push(this.next().value);
          continue;
        }
        if (t.value === ")") {
          if (depth === 0) break;
          depth--;
          parts.push(this.next().value);
          continue;
        }
        if (t.value === "," && depth === 0) break;
        parts.push(this.next().value);
        continue;
      }

      if (depth === 0 && t.type === "keyword" && TYPE_STOP.has(t.value.toUpperCase())) {
        break;
      }
      parts.push(this.next().value);
    }

    const type = this.joinTokens(parts);
    if (!type) this.fail("Expected a data type");
    return type;
  }

  private parseDefaultValue(): string | undefined {
    this.expectKeyword("DEFAULT");
    const parts: string[] = [];
    let depth = 0;

    while (this.peek().type !== "eof") {
      const t = this.peek();
      if (t.type === "punct") {
        if (t.value === "(") {
          depth++;
          parts.push(this.next().value);
          continue;
        }
        if (t.value === ")") {
          if (depth === 0) break;
          depth--;
          parts.push(this.next().value);
          continue;
        }
        if (t.value === "," && depth === 0) break;
        if (t.value === ";") break;
        parts.push(this.next().value);
        continue;
      }
      if (depth === 0 && t.type === "keyword" && TYPE_STOP.has(t.value.toUpperCase())) {
        break;
      }
      parts.push(this.next().value);
    }

    const value = this.joinTokens(parts);
    return value || undefined;
  }

  private joinTokens(parts: string[]): string {
    const noSpaceBefore = new Set(["(", ")", "[", "]", ".", ","]);
    let out = "";
    for (const p of parts) {
      if (noSpaceBefore.has(p)) {
        out += p;
      } else if (p === "-" || p === "+") {
        out += p;
      } else if (
        out === "" ||
        noSpaceBefore.has(out[out.length - 1]) ||
        out.endsWith("-") ||
        out.endsWith("+")
      ) {
        out += p;
      } else {
        out += " " + p;
      }
    }
    return out;
  }

  private parseGenerated(): boolean {
    // GENERATED ALWAYS AS (expr) [STORED] | GENERATED ... AS IDENTITY
    this.expectKeyword("GENERATED");
    if (!this.matchKeyword("ALWAYS")) this.matchKeyword("BY");
    this.expectKeyword("AS");
    if (this.matchKeyword("IDENTITY")) {
      // optional (START WITH ...)
      if (this.isPunct("(")) this.skipBalanced();
      return true;
    }
    // expression form
    this.skipExpression();
    return false;
  }

  private parseInlineReferences(table: Table, sourceColumn: string) {
    this.expectKeyword("REFERENCES");
    const target = this.parseQualifiedName();
    let targetColumns: string[] = [];
    if (this.isPunct("(")) targetColumns = this.parseColumnList();

    let onDelete: Relationship["onDelete"];
    let onUpdate: Relationship["onUpdate"];
    while (this.matchKeyword("ON")) {
      if (this.matchKeyword("DELETE")) onDelete = this.parseReferentialAction();
      else if (this.matchKeyword("UPDATE")) onUpdate = this.parseReferentialAction();
      else this.fail("Expected \"DELETE\" or \"UPDATE\"");
    }

    this.pending.push({
      sourceTableId: table.id,
      sourceColumn,
      targetTableName: target.full,
      targetColumn: targetColumns[0],
      onDelete,
      onUpdate,
      line: this.peek().line,
    });
  }

  private parseReferentialAction(): Relationship["onDelete"] {
    if (this.matchKeyword("CASCADE")) return "CASCADE";
    if (this.matchKeyword("RESTRICT")) return "RESTRICT";
    if (this.isKeyword("SET")) {
      this.next();
      if (this.matchKeyword("NULL")) return "SET NULL";
      if (this.matchKeyword("DEFAULT")) return "SET DEFAULT";
      this.fail("Expected \"NULL\" or \"DEFAULT\" after SET");
    }
    if (this.isKeyword("NO")) {
      this.next();
      this.expectKeyword("ACTION");
      return "NO ACTION";
    }
    this.fail("Expected a referential action (CASCADE, SET NULL, RESTRICT…)");
  }

  // ---------------------------------------------------------------- helpers

  private skipExpression() {
    let depth = 0;
    while (this.peek().type !== "eof") {
      const t = this.peek();
      if (t.type === "punct") {
        if (t.value === "(") depth++;
        else if (t.value === ")") {
          if (depth === 0) return;
          depth--;
        } else if ((t.value === "," || t.value === ";") && depth === 0) return;
        this.next();
        continue;
      }
      if (depth === 0 && t.type === "keyword" && TYPE_STOP.has(t.value.toUpperCase())) return;
      this.next();
    }
  }

  private skipBalanced() {
    // Assumes we are AT an opening paren.
    if (this.isPunct("(")) {
      let depth = 0;
      while (this.peek().type !== "eof") {
        const t = this.next();
        if (t.type === "punct" && t.value === "(") depth++;
        else if (t.type === "punct" && t.value === ")") {
          depth--;
          if (depth === 0) return;
        }
      }
      return;
    }
    // CHECK constraint without parens is malformed; consume one token.
    this.next();
  }

  private createTable(qualified: { name: string; schema?: string }, sourceLine: number): Table {
    let id = qualified.name;
    if (this.tableIds.has(id)) {
      let n = 2;
      while (this.tableIds.has(`${id}_${n}`)) n++;
      id = `${id}_${n}`;
    }
    this.tableIds.add(id);
    const table: Table = {
      id,
      name: qualified.name,
      schema: qualified.schema,
      columns: [],
      indexes: [],
      sourceLine,
    };
    this.tables.push(table);
    return table;
  }

  private findTable(name: string): Table | undefined {
    const lower = name.toLowerCase();
    return this.tables.find((t) => t.name.toLowerCase() === lower);
  }

  private findColumn(table: Table, name: string): ParsedColumn | undefined {
    return table.columns.find((c) => c.name.toLowerCase() === name.toLowerCase()) as ParsedColumn | undefined;
  }

  private finalize(): DatabaseSchema {
    const relationships: Relationship[] = [];

    for (const rel of this.pending) {
      let targetTable = this.tables.find((t) => t.name.toLowerCase() === rel.targetTableName.toLowerCase());
      if (!targetTable) {
        // Also try matching the full qualified name.
        targetTable = this.tables.find(
          (t) => (t.schema ? `${t.schema}.${t.name}` : t.name).toLowerCase() === rel.targetTableName.toLowerCase(),
        );
      }
      if (!targetTable) continue;

      let targetColumn = rel.targetColumn;
      if (!targetColumn) {
        const pk = targetTable.columns.find((c) => c.primaryKey);
        targetColumn = pk?.name ?? targetTable.columns[0]?.name;
      }
      if (!targetColumn) continue;

      const source = this.findColumn(
        this.tables.find((t) => t.id === rel.sourceTableId)!,
        rel.sourceColumn,
      );
      if (source) source.foreignKey = true;

      relationships.push({
        id: `rel_${this.relSeq++}`,
        sourceTable: rel.sourceTableId,
        sourceColumn: rel.sourceColumn,
        targetTable: targetTable.id,
        targetColumn,
        onDelete: rel.onDelete,
        onUpdate: rel.onUpdate,
        name: rel.name,
      });
    }

    // Infer a dialect from the tokens we saw.
    this.inferDialect();

    return { tables: this.tables, relationships, dialect: this.dialect };
  }

  private inferDialect() {
    let saw = false;
    const mark = (d: SqlDialect) => {
      if (!saw) {
        this.dialect = d;
        saw = true;
      }
    };
    for (const t of this.tokens) {
      if (t.type === "whitespace" || t.type === "comment" || t.type === "eof") continue;
      const v = t.value.toUpperCase();
      if (v === "AUTO_INCREMENT" || v === "ENUM" || v === "TINYINT" || v === "MEDIUMINT" || v === "ZEROFILL") {
        mark("mysql");
      } else if (
        v === "TIMESTAMPTZ" ||
        v === "JSONB" ||
        v === "SERIAL" ||
        v === "GEN_RANDOM_UUID"
      ) {
        mark("postgresql");
      } else if (v === "AUTOINCREMENT") {
        mark("sqlite");
      }
    }
  }
}
