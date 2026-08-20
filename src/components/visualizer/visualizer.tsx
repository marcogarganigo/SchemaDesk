"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  Clipboard,
  CornerDownRight,
  FileCode2,
  FileDown,
  FileImage,
  FileText,
  FileUp,
  FlaskConical,
  Grid3x3,
  Link2,
  Map,
  Moon,
  Network,
  PanelLeft,
  Play,
  Presentation,
  RotateCcw,
  Scan,
  Sparkles,
  Spline,
  StickyNote,
  Sun,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pickSqlFile } from "@/lib/import-file";
import { useVisualizer } from "@/hooks/use-visualizer";
import { useHotkey } from "@/hooks/use-hotkey";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme } from "@/components/providers/theme-provider";
import { AppHeader } from "@/components/layout/app-header";
import { StatusBar } from "@/components/layout/status-bar";
import { SplitPane } from "@/components/layout/split-pane";
import { EditorPanel } from "@/components/editor/editor-panel";
import { DiagramCanvas } from "@/components/diagram/diagram-canvas";
import { CommandPalette, type PaletteCommand } from "@/components/ui/command-palette";
import { QueryBuilderModal } from "./query-builder-modal";
import { MockDataModal } from "./mock-data-modal";
import { EXAMPLES } from "@/lib/examples";

export function Visualizer({ initialExampleId }: { initialExampleId?: string }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { theme, toggleTheme } = useTheme();
  const v = useVisualizer(initialExampleId);

  const [presentMode, setPresentMode] = useState(false);
  const [mockOpen, setMockOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [queryTable, setQueryTable] = useState<string | null>(null);



  // Drag & drop a .sql file anywhere in the window to import it.
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragOver(true);
  }, []);
  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);
  const handleDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }, []);
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) v.importSqlFile(file);
    },
    [v],
  );

  // Leave presentation mode with Escape.
  useEffect(() => {
    if (!presentMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresentMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presentMode]);

  useHotkey("mod+Enter", () => v.visualize(), { allowInEditable: true });
  useHotkey("mod+s", () => v.save(), { allowInEditable: true });
  useHotkey("mod+k", () => v.setPaletteOpen(true), { allowInEditable: true });
  useHotkey("mod+/", () => v.setSqlPanelOpen((open) => !open));
  useHotkey("f", () => v.fitView());
  useHotkey("l", () => v.autoLayout());
  useHotkey("0", () => v.resetView());
  useHotkey("p", () => setPresentMode((open) => !open));
  useHotkey("n", () => v.addNote());

  const openQueryBuilder = useCallback(() => {
    setQueryTable(v.selectedNodeId);
    setQueryOpen(true);
  }, [v.selectedNodeId]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "visualize",
        label: "Visualize SQL",
        description: "Parse SQL and generate the diagram",
        icon: Play,
        shortcut: "⌘↵",
        disabled: !v.sql.trim(),
        perform: () => v.visualize(),
      },
      {
        id: "format",
        label: "Format SQL",
        description: "Normalize and indent the schema",
        icon: Braces,
        disabled: !v.sql.trim(),
        perform: () => v.format(),
      },
      {
        id: "import",
        label: "Import SQL File",
        description: "Load a .sql file from your computer",
        icon: FileUp,
        perform: () => pickSqlFile(v.importSqlFile),
      },
      {
        id: "layout",
        label: "Auto Layout",
        description: "Rearrange tables based on relationships",
        icon: Network,
        shortcut: "L",
        disabled: !v.nodes.length,
        perform: () => v.autoLayout(),
      },
      {
        id: "fit",
        label: "Fit View",
        description: "Zoom to fit the whole diagram",
        icon: Scan,
        shortcut: "F",
        disabled: !v.nodes.length,
        perform: () => v.fitView(),
      },
      {
        id: "focus",
        label: v.focusMode ? "Exit Focus Mode" : "Focus Selected Table",
        description: "Isolate a table and its neighbors",
        icon: Presentation,
        disabled: !v.focusMode && !v.selectedNodeId,
        perform: () => v.toggleFocus(),
      },
      {
        id: "present",
        label: presentMode ? "Exit Presentation Mode" : "Presentation Mode",
        description: "Fullscreen diagram without UI",
        icon: Presentation,
        shortcut: "P",
        perform: () => setPresentMode((open) => !open),
      },
      {
        id: "note",
        label: "Add Note",
        description: "Stick an annotation on the canvas",
        icon: StickyNote,
        shortcut: "N",
        disabled: !v.schema,
        perform: () => v.addNote(),
      },
      {
        id: "mock",
        label: "Mock Data (Seed)",
        description: "Generate realistic INSERT statements",
        icon: FlaskConical,
        disabled: !v.schema,
        perform: () => setMockOpen(true),
      },
      {
        id: "query",
        label: "Query Builder",
        description: "Generate a SELECT … JOIN between two tables",
        icon: Terminal,
        disabled: !v.schema,
        perform: openQueryBuilder,
      },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        icon: theme === "dark" ? Sun : Moon,
        perform: toggleTheme,
      },
      {
        id: "sql-panel",
        label: "Toggle SQL Panel",
        icon: PanelLeft,
        shortcut: "⌘/",
        perform: () => v.setSqlPanelOpen((open) => !open),
      },
      {
        id: "minimap",
        label: "Toggle Minimap",
        icon: Map,
        perform: () => v.updatePrefs({ minimap: !v.prefs.minimap }),
      },
      {
        id: "grid",
        label: "Toggle Grid",
        icon: Grid3x3,
        perform: () => v.updatePrefs({ grid: !v.prefs.grid }),
      },
      {
        id: "edge-style",
        label: v.prefs.edgeStyle === "orthogonal" ? "Use Free (Curved) Edges" : "Use Angled (Orthogonal) Edges",
        icon: v.prefs.edgeStyle === "orthogonal" ? Spline : CornerDownRight,
        perform: () => v.updatePrefs({ edgeStyle: v.prefs.edgeStyle === "orthogonal" ? "curved" : "orthogonal" }),
      },
      {
        id: "export-png",
        label: "Export PNG",
        description: "Download the diagram as an image",
        icon: FileImage,
        disabled: !v.schema,
        perform: () => void v.handleExportPng(),
      },
      {
        id: "export-svg",
        label: "Export SVG",
        description: "Download the diagram as a vector",
        icon: FileCode2,
        disabled: !v.schema,
        perform: () => v.handleExportSvg(),
      },
      {
        id: "export-sql",
        label: "Export SQL Source",
        description: "Download the current SQL as a .sql file",
        icon: FileDown,
        disabled: !v.sql.trim(),
        perform: () => v.handleExportSql(),
      },
      {
        id: "export-docs",
        label: "Export Documentation (.md)",
        description: "Download a markdown reference of the schema",
        icon: FileText,
        disabled: !v.schema,
        perform: () => v.handleExportDocs(),
      },
      {
        id: "share-link",
        label: "Copy Share Link",
        description: "Copy a URL that opens this exact schema",
        icon: Link2,
        disabled: !v.sql.trim(),
        perform: () => void v.handleCopyShareLink(),
      },
      {
        id: "copy",
        label: "Copy Diagram to Clipboard",
        icon: Clipboard,
        disabled: !v.schema,
        perform: () => void v.handleCopy(),
      },
      {
        id: "reset",
        label: "Reset Diagram",
        description: "Clear the current diagram",
        icon: RotateCcw,
        disabled: !v.schema,
        perform: () => v.resetDiagram(),
      },
      {
        id: "example",
        label: "Load Example",
        description: `Open the ${EXAMPLES[0].name} example schema`,
        icon: Sparkles,
        perform: () => v.loadExample(EXAMPLES[0]),
      },
    ],
    [openQueryBuilder, presentMode, theme, toggleTheme, v],
  );

  const editorPanel = (
    <EditorPanel
      sql={v.sql}
      onChange={(value) => {
        v.setSql(value);
        if (!v.isDirty) v.setIsDirty(true);
      }}
      error={v.error}
      onVisualize={() => v.visualize()}
      onFormat={() => v.format()}
      onClear={() => v.clearSql()}
      onLoadExample={v.loadExample}
      onImportFile={v.importSqlFile}
      onCursorChange={v.setCursor}
    />
  );

  const diagramPanel = (
    <DiagramCanvas
      nodes={v.nodes}
      edges={v.edges}
      schema={v.schema}
      prefs={v.prefs}
      onNodesChange={v.onNodesChange}
      onEdgesChange={v.onEdgesChange}
      onSelectionChange={v.onSelectionChange}
      onNodeDragStop={v.onNodeDragStop}
      onInit={v.onInit}
      onViewportChange={v.onViewportChange}
      onZoomIn={v.zoomIn}
      onZoomOut={v.zoomOut}
      onFit={v.fitView}
      onReset={v.resetView}
      onAutoLayout={v.autoLayout}
      onDirectionChange={v.changeDirection}
      onLoadExample={() => v.loadExample(EXAMPLES[0])}
      onToggleCollapse={v.toggleCollapse}
      onNoteChange={v.updateNote}
      onNoteDelete={v.deleteNote}
      selectedNodeId={v.selectedNodeId}
      focusMode={v.focusMode}
      onToggleFocus={v.toggleFocus}
      presentMode={presentMode}
    />
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/40" />
          <div className="relative flex items-center gap-3 rounded-xl border-2 border-dashed border-accent bg-elevated px-6 py-4 shadow-[var(--shadow-node)]">
            <FileUp className="h-5 w-5 text-accent" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Drop to import your schema</p>
              <p className="text-[12px] text-muted">.sql or .txt files are parsed instantly</p>
            </div>
          </div>
        </div>
      )}

      {presentMode ? (
        <div className="relative min-h-0 flex-1">
          {diagramPanel}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center p-3">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-elevated/90 px-3.5 py-1.5 shadow-node backdrop-blur">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
                <Presentation className="h-3 w-3 text-accent" />
                Presentation
              </span>
              <span className="text-[11px] text-faint">P or Esc to exit</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <AppHeader
            projectName={v.projectName}
            onProjectNameChange={v.setProjectName}
            onSave={v.save}
            onExportPng={() => void v.handleExportPng()}
            onExportSvg={v.handleExportSvg}
            onExportSql={v.handleExportSql}
            onCopyToClipboard={() => void v.handleCopy()}
            onCopyShareLink={() => void v.handleCopyShareLink()}
            theme={theme}
            onToggleTheme={toggleTheme}
            prefs={v.prefs}
            onPrefChange={v.updatePrefs}
            onOpenPalette={() => v.setPaletteOpen(true)}
            hasSchema={!!v.schema && v.schema.tables.length > 0}
            hasSql={!!v.sql.trim()}
            onOpenQueryBuilder={openQueryBuilder}
            onOpenMockData={() => setMockOpen(true)}
          />

          {isDesktop ? (
            <main className="min-h-0 flex-1">
              {v.sqlPanelOpen ? (
                <SplitPane
                  size={v.panelSize}
                  onSizeChange={v.setPanelSize}
                  left={editorPanel}
                  right={diagramPanel}
                />
              ) : (
                <div className="h-full w-full">{diagramPanel}</div>
              )}
            </main>
          ) : (
            <>
              <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
                <MobileTab
                  active={v.mobileTab === "diagram"}
                  onClick={() => v.setMobileTab("diagram")}
                  label="Diagram"
                />
                <MobileTab
                  active={v.mobileTab === "sql"}
                  onClick={() => v.setMobileTab("sql")}
                  label="SQL"
                />
              </div>
              <main className="min-h-0 flex-1">
                {v.mobileTab === "sql" ? editorPanel : diagramPanel}
              </main>
            </>
          )}

          <StatusBar
            schema={v.schema}
            error={v.error}
            cursor={v.cursor}
            zoom={v.zoom}
            selectedNodeName={v.selectedNodeName}
            selectedEdgeLabel={v.selectedEdgeLabel}
            isDirty={v.isDirty}
          />
        </>
      )}

      <CommandPalette
        open={v.paletteOpen}
        onClose={() => v.setPaletteOpen(false)}
        commands={commands}
      />

      <QueryBuilderModal
        open={queryOpen}
        schema={v.schema}
        initialTable={queryTable}
        onClose={() => setQueryOpen(false)}
      />
      <MockDataModal
        open={mockOpen}
        schema={v.schema}
        projectName={v.projectName}
        onClose={() => setMockOpen(false)}
      />
    </div>
  );
}

function MobileTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 flex-1 rounded-md text-[12px] font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent",
        active ? "bg-raised text-foreground" : "text-muted hover:text-secondary",
      )}
    >
      {label}
    </button>
  );
}
