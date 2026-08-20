/**
 * Sharing a schema through the URL hash: the SQL is UTF-8 encoded and
 * base64'd into `#schema=<payload>`, so a link can carry an entire schema
 * without any server or storage. The payload is prefixed to stay
 * distinguishable from other future hash payloads.
 */

const PREFIX = "schema-desk:v1:";

/** Encode SQL into a URL-hash-safe string (UTF-8 aware base64). */
export function encodeSqlToHash(sql: string): string {
  const bytes = new TextEncoder().encode(sql);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return PREFIX + btoa(binary);
}

/** Decode a `#schema=` payload back into SQL; null when malformed. */
export function decodeSqlFromHash(value: string): string | null {
  const raw = value.startsWith("#") ? value.slice(1) : value;
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const binary = atob(raw.slice(PREFIX.length));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export interface HashParams {
  /** Encoded schema payload (see encodeSqlToHash). */
  schema?: string;
  /** Encoded notes payload (JSON array of {id, position, text}). */
  notes?: string;
  /** Table id to select and focus after load. */
  table?: string;
}

/** Parse a `#key=value&key=value` hash into params. */
export function parseHashParams(hash: string): HashParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params: HashParams = {};
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? "" : part.slice(eq + 1);
    if (key === "schema") params.schema = value;
    else if (key === "notes") params.notes = value;
    else if (key === "table") {
      try {
        params.table = decodeURIComponent(value);
      } catch {
        params.table = value;
      }
    }
  }
  return params;
}

interface StoredNote {
  id: string;
  position: { x: number; y: number };
  text: string;
}

/** Encode notes into a URL-hash-safe string. */
export function encodeNotesToHash(notes: StoredNote[]): string {
  const json = JSON.stringify(notes);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Decode a `notes=` payload back into a StoredNote array; null when malformed. */
export function decodeNotesFromHash(value: string): StoredNote[] | null {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (n): n is StoredNote =>
        typeof n === "object" &&
        n !== null &&
        typeof n.id === "string" &&
        typeof n.text === "string" &&
        typeof n.position?.x === "number" &&
        typeof n.position?.y === "number",
    );
  } catch {
    return null;
  }
}

/** Copy text to the clipboard, falling back for restricted contexts. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
