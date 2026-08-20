/**
 * Opens a native file picker restricted to SQL / plain-text files and
 * invokes the callback with the chosen file (if any).
 */
export function pickSqlFile(onFile: (file: File) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".sql,.txt,text/plain";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  };
  input.click();
}
