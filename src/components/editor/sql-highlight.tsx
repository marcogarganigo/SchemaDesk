import { memo, type ReactNode } from "react";
import { tokenize, type Token } from "@/lib/parser/tokenizer";

interface Line {
  spans: ReactNode[];
  key: string;
  error: boolean;
}

function colorFor(type: Token["type"]): string | undefined {
  switch (type) {
    case "keyword":
      return "var(--editor-keyword)";
    case "string":
      return "var(--editor-string)";
    case "number":
      return "var(--editor-number)";
    case "comment":
      return "var(--editor-comment)";
    case "punct":
      return "var(--editor-punct)";
    default:
      return undefined;
  }
}

function tokenToSpan(token: Token, index: number): ReactNode {
  const color = colorFor(token.type);
  if (token.type === "whitespace") return token.value;
  return (
    <span
      key={index}
      style={color ? { color } : undefined}
      className={token.type === "comment" ? "italic" : undefined}
    >
      {token.value}
    </span>
  );
}

export const SqlHighlight = memo(function SqlHighlight({
  sql,
  errorLine,
}: {
  sql: string;
  errorLine?: number | null;
}) {
  const tokens = tokenize(sql);
  const lines: Line[] = [];

  let spans: ReactNode[] = [];
  let lineNumber = 1;

  const flush = () => {
    lines.push({
      spans,
      key: `line-${lineNumber}`,
      error: errorLine != null && lineNumber === errorLine,
    });
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "eof") break;

    if (token.type === "whitespace" && token.value.includes("\n")) {
      const parts = token.value.split("\n");
      for (let p = 0; p < parts.length; p++) {
        if (p > 0) {
          flush();
          lineNumber++;
          spans = [];
        }
        if (parts[p]) spans.push(parts[p]);
      }
      continue;
    }

    spans.push(tokenToSpan(token, i));
  }
  flush();

  return (
    <>
      {lines.map((line) => (
        <div
          key={line.key}
          aria-hidden="true"
          className={
            "whitespace-pre" +
            (line.error
              ? " -mx-2 rounded-sm bg-danger-soft px-2 shadow-[inset_2px_0_0_var(--danger)]"
              : "")
          }
        >
          {line.spans.length ? line.spans : "\u00a0"}
        </div>
      ))}
    </>
  );
});
