/**
 * A small, dependency-free SQL tokenizer with precise line/column tracking.
 *
 * It emits *every* token (including whitespace and comments) so the same
 * stream can drive both the parser and the syntax highlighter.
 */

export type TokenType =
  | "keyword"
  | "identifier"
  | "string"
  | "number"
  | "punct"
  | "comment"
  | "whitespace"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  /** 1-indexed line number. */
  line: number;
  /** 1-indexed column number. */
  column: number;
  /** Absolute offset into the source string. */
  start: number;
  end: number;
}

export const SQL_KEYWORDS = new Set<string>([
  "ADD",
  "ALL",
  "ALTER",
  "ALWAYS",
  "AS",
  "ASC",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
  "BIGINT",
  "BINARY",
  "BLOB",
  "BOOLEAN",
  "BOOL",
  "BY",
  "CASCADE",
  "CHAR",
  "CHARACTER",
  "CHECK",
  "COLLATE",
  "COLUMN",
  "COMMENT",
  "CONSTRAINT",
  "CREATE",
  "CURRENT_TIMESTAMP",
  "DATETIME",
  "DATE",
  "DECIMAL",
  "DEC",
  "DEFAULT",
  "DELETE",
  "DESC",
  "DOUBLE",
  "DROP",
  "ENUM",
  "EXISTS",
  "FLOAT",
  "FOREIGN",
  "GENERATED",
  "IDENTITY",
  "IF",
  "INCREMENT",
  "INDEX",
  "INET",
  "INT",
  "INTEGER",
  "JSON",
  "JSONB",
  "KEY",
  "MEDIUMINT",
  "NO",
  "NOT",
  "NULL",
  "NUMERIC",
  "ON",
  "PRECISION",
  "PRIMARY",
  "REAL",
  "REFERENCES",
  "RESTRICT",
  "SERIAL",
  "SET",
  "SMALLINT",
  "TABLE",
  "TEMP",
  "TEMPORARY",
  "TEXT",
  "TIME",
  "TIMESTAMP",
  "TIMESTAMPTZ",
  "TINYINT",
  "UNIQUE",
  "UNSIGNED",
  "UPDATE",
  "USING",
  "UUID",
  "VARBINARY",
  "VARCHAR",
  "VARYING",
  "WITH",
  "WITHOUT",
  "ZEROFILL",
  "ZONE",
]);

const PUNCT = new Set(["(", ")", ",", ";", ".", "=", "+", "-", "*", "/", "<", ">"]);

function isWordStart(ch: string) {
  return /[A-Za-z_$]/.test(ch);
}

function isWordPart(ch: string) {
  return /[A-Za-z0-9_$]/.test(ch);
}

function isDigit(ch: string) {
  return /[0-9]/.test(ch);
}

export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  const len = sql.length;

  const advance = (count = 1) => {
    for (let k = 0; k < count; k++) {
      if (sql[i] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      i++;
    }
  };

  const push = (type: TokenType, value: string, start: number, startLine: number, startColumn: number) => {
    tokens.push({
      type,
      value,
      line: startLine,
      column: startColumn,
      start,
      end: i,
    });
  };

  while (i < len) {
    const ch = sql[i];
    const start = i;
    const startLine = line;
    const startColumn = column;

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      let value = "";
      while (i < len && (sql[i] === " " || sql[i] === "\t" || sql[i] === "\r" || sql[i] === "\n")) {
        value += sql[i];
        advance();
      }
      push("whitespace", value, start, startLine, startColumn);
      continue;
    }

    // Line comments: -- and # (MySQL)
    if (ch === "-" && sql[i + 1] === "-") {
      let value = "";
      while (i < len && sql[i] !== "\n") {
        value += sql[i];
        advance();
      }
      push("comment", value, start, startLine, startColumn);
      continue;
    }
    if (ch === "#") {
      let value = "";
      while (i < len && sql[i] !== "\n") {
        value += sql[i];
        advance();
      }
      push("comment", value, start, startLine, startColumn);
      continue;
    }

    // Block comments
    if (ch === "/" && sql[i + 1] === "*") {
      let value = "";
      advance(2);
      while (i < len && !(sql[i] === "*" && sql[i + 1] === "/")) {
        value += sql[i];
        advance();
      }
      if (i < len) advance(2);
      push("comment", "/*" + value + (i <= len ? "*/" : ""), start, startLine, startColumn);
      continue;
    }

    // Strings / quoted identifiers
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      let value = "";
      advance();
      let closed = false;
      while (i < len) {
        const c = sql[i];
        if (c === quote) {
          if (sql[i + 1] === quote) {
            // Escaped quote
            value += quote;
            advance(2);
            continue;
          }
          advance();
          closed = true;
          break;
        }
        value += c;
        advance();
      }
      push("string", value, start, startLine, startColumn);
      void closed;
      continue;
    }

    // Bracket-quoted identifiers (SQL Server / some MySQL tools)
    if (ch === "[") {
      let value = "";
      advance();
      while (i < len && sql[i] !== "]") {
        value += sql[i];
        advance();
      }
      if (i < len) advance();
      push("string", value, start, startLine, startColumn);
      continue;
    }

    // Numbers
    if (isDigit(ch) || (ch === "." && isDigit(sql[i + 1] ?? ""))) {
      let value = "";
      while (i < len && /[0-9.]/.test(sql[i])) {
        value += sql[i];
        advance();
      }
      push("number", value, start, startLine, startColumn);
      continue;
    }

    // Words
    if (isWordStart(ch)) {
      let value = "";
      while (i < len && isWordPart(sql[i])) {
        value += sql[i];
        advance();
      }
      const upper = value.toUpperCase();
      push(SQL_KEYWORDS.has(upper) ? "keyword" : "identifier", value, start, startLine, startColumn);
      continue;
    }

    // Punctuation
    if (PUNCT.has(ch)) {
      advance();
      push("punct", ch, start, startLine, startColumn);
      continue;
    }

    // Unknown char — treat as punctuation to stay resilient.
    advance();
    push("punct", ch, start, startLine, startColumn);
  }

  tokens.push({ type: "eof", value: "", line, column, start: len, end: len });
  return tokens;
}

export function isSignificant(token: Token): boolean {
  return token.type !== "whitespace" && token.type !== "comment" && token.type !== "eof";
}
