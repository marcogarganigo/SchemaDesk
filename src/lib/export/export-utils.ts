import type { EdgeStyle, SchemaEdge, SchemaNode } from "@/lib/graph/types";
import { readPalette, renderSvg, type ExportPalette } from "./render-svg";

export interface ExportInput {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  selectedNodeId?: string | null;
  palette?: ExportPalette;
  edgeStyle?: EdgeStyle;
  showCardinality?: boolean;
}

function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to create canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url);
        if (png) resolve(png);
        else reject(new Error("Unable to render PNG"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to render diagram"));
    };
    img.src = url;
  });
}

function buildSvg(input: ExportInput) {
  const palette = input.palette ?? readPalette();
  return renderSvg(input.nodes, input.edges, {
    scale: 2,
    palette,
    selectedNodeId: input.selectedNodeId,
    edgeStyle: input.edgeStyle ?? "orthogonal",
    showCardinality: input.showCardinality ?? true,
  });
}

export async function exportPng(input: ExportInput, filename = "schemaflow.png") {
  const { svg, width, height } = buildSvg(input);
  const png = await svgToPngBlob(svg, width, height);
  const url = URL.createObjectURL(png);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export function exportSvg(input: ExportInput, filename = "schemaflow.svg") {
  const { svg } = buildSvg(input);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

/** Download the SQL source itself as a plain-text .sql file. */
export function exportSql(sql: string, filename = "schemaflow.sql") {
  downloadTextFile(sql, filename, "text/plain;charset=utf-8");
}

/** Download any text as a file. */
export function downloadTextFile(
  text: string,
  filename: string,
  mime = "text/plain;charset=utf-8",
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export async function copyPngToClipboard(input: ExportInput): Promise<void> {
  const { svg, width, height } = buildSvg(input);
  const png = await svgToPngBlob(svg, width, height);
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": png }),
  ]);
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
