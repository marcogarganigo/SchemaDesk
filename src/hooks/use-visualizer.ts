"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import { parseSql, SqlParseError } from "@/lib/parser";
import { formatSql } from "@/lib/format/sql-formatter";
import { buildGraph } from "@/lib/graph/build-graph";
import { layoutGraph, assignEdgeHandles } from "@/lib/graph/layout";
import { copyPngToClipboard, downloadTextFile, exportPng, exportSql, exportSvg } from "@/lib/export/export-utils";
import { copyTextToClipboard, decodeNotesFromHash, decodeSqlFromHash, encodeNotesToHash, encodeSqlToHash, parseHashParams } from "@/lib/share";
import { generateMarkdownDocs } from "@/lib/docs/generate-docs";
import { NOTE_NODE } from "@/components/diagram/note-node";
import type { DatabaseSchema, ParseDiagnostic } from "@/lib/schema/types";
import type { LayoutDirection, SchemaEdge, SchemaNode } from "@/lib/graph/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/components/ui/toast";
import type { CursorPosition } from "@/components/editor/sql-editor";
import type { DiagramPreferences } from "@/components/diagram/diagram-canvas";
import { getExample, type ExampleSchema } from "@/lib/examples";

interface StoredNote {
  id: string;
  position: XYPosition;
  text: string;
}

const DEFAULT_PREFS: DiagramPreferences = {
  minimap: true,
  grid: true,
  snap: false,
  direction: "LR",
  edgeStyle: "orthogonal",
  showCardinality: true,
};

export function useVisualizer(initialExampleId?: string) {
  const { toast } = useToast();

  const [sql, setSql, flushSql] = useLocalStorage("schemaflow:sql", "");
  const [projectName, setProjectName] = useLocalStorage("schemaflow:project-name", "Untitled schema");
  const [savedPrefs, setPrefs] = useLocalStorage<DiagramPreferences>("schemaflow:prefs", DEFAULT_PREFS);
  // Merge with defaults so prefs saved before a field existed still behave.
  const prefs = useMemo<DiagramPreferences>(
    () => ({ ...DEFAULT_PREFS, ...savedPrefs }),
    [savedPrefs],
  );
  const [panelSize, setPanelSize] = useLocalStorage("schemaflow:panel-size", 440);
  const [positions, setPositions] = useLocalStorage<Record<string, XYPosition>>("schemaflow:positions", {});
  const [sqlPanelOpen, setSqlPanelOpen] = useLocalStorage("schemaflow:sql-panel", true);

  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [error, setError] = useState<ParseDiagnostic | null>(null);
  const [nodes, setNodes] = useState<SchemaNode[]>([]);
  const [edges, setEdges] = useState<SchemaEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<CursorPosition | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sql" | "diagram">("diagram");
  const [focusMode, setFocusMode] = useState(false);
  const [storedNotes, setNotes] = useLocalStorage<StoredNote[]>("schemaflow:notes", []);

  const rfInstanceRef = useRef<ReactFlowInstance<SchemaNode, SchemaEdge> | null>(null);
  const pendingFitRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const pendingFocusTableRef = useRef<string | null>(null);
  const pendingNotesRef = useRef<Array<{ id: string; position: XYPosition; text: string }> | null>(null);
  // Mirrors whether the flow is currently mounted in the DOM (the diagram tab
  // unmounts in the mobile layout, which would otherwise leave a stale
  // instance behind).
  const flowConnectedRef = useRef(false);
  const setFlowConnected = useCallback((connected: boolean) => {
    flowConnectedRef.current = connected;
  }, []);

  const buildFromSql = useCallback(
    (text: string, restorePositions: boolean): DatabaseSchema | null => {
      const trimmed = text.trim();
      if (!trimmed) {
        setSchema(null);
        setError(null);
        setNodes([]);
        setEdges([]);
        return null;
      }
      try {
        const parsed = parseSql(trimmed);
        const graph = buildGraph(parsed);
        let laidOut = layoutGraph(graph.nodes, graph.edges, { direction: prefs.direction });

        if (restorePositions) {
          laidOut = laidOut.map((node) => {
            const saved = positions[node.id];
            return saved ? { ...node, position: { x: saved.x, y: saved.y } } : node;
          });
        }

        const posMap: Record<string, XYPosition> = {};
        for (const node of laidOut) posMap[node.id] = node.position;

        setSchema(parsed);
        setError(null);
        // Preserve canvas notes across schema rebuilds.
        setNodes((prev) => {
          const existingNotes = prev.filter((n) => String(n.id).startsWith("note_"));
          return [...laidOut, ...existingNotes];
        });
        setEdges(assignEdgeHandles(laidOut, graph.edges));
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setPositions(posMap);
        return parsed;
      } catch (e) {
        if (e instanceof SqlParseError) {
          setError(e.diagnostic);
        } else {
          setError({ message: "Unexpected error while parsing SQL", line: 1, column: 1 });
        }
        return null;
      }
    },
    [positions, prefs.direction, setPositions],
  );

  // Bootstrap: restore the saved SQL and positions once. Priority goes to a
  // shared-link schema in the URL hash (#schema=...), then to an import
  // queued by the landing page, and finally to the previously saved work.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let text = sql;
    let importedName: string | null = null;

    // 1) A shared link is the strongest signal: decode it and clean the URL
    //    so later edits and reloads don't fight the hash.
    try {
      const params = parseHashParams(window.location.hash);
      if (params.schema) {
        const decoded = decodeSqlFromHash(params.schema);
        if (decoded && decoded.trim()) {
          text = decoded;
          importedName = "Shared schema";
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
      if (params.notes) {
        const decodedNotes = decodeNotesFromHash(params.notes);
        if (decodedNotes && decodedNotes.length > 0) {
          // Notes are injected into the nodes array after the schema is built;
          // store them for the post-build step below.
          pendingNotesRef.current = decodedNotes;
        }
      }
      if (params.table) pendingFocusTableRef.current = params.table;
    } catch {
      // Malformed hash — ignore.
    }

    // 2) Otherwise consume a schema queued by the landing page's import flow.
    if (text === sql) {
      try {
        const pending = sessionStorage.getItem("schemaflow:pending-import");
        if (pending) {
          sessionStorage.removeItem("schemaflow:pending-import");
          const data = JSON.parse(pending) as { name?: string; sql?: string };
          if (data.sql && data.sql.trim()) {
            text = data.sql;
            importedName = data.name ?? null;
          }
        }
      } catch {
        // Storage unavailable — fall back to the saved work.
      }
    }

    if (importedName) setProjectName(importedName);
    if (text !== sql) setSql(text);

    const parsed = buildFromSql(text, text === sql);
    if (parsed && parsed.tables.length > 0) pendingFitRef.current = true;

    // Restore any notes saved in localStorage. They are injected after the
    // schema build so they sit on top of the freshly laid-out table nodes.
    if (storedNotes.length > 0) {
      const noteNodes = storedNotes.map((n) => ({
        id: n.id,
        type: NOTE_NODE,
        position: n.position,
        data: { text: n.text },
        style: { width: 190 },
      })) as unknown as SchemaNode[];
      setNodes((prev) => {
        // Avoid duplicating notes that buildFromSql may have already preserved.
        const existingIds = new Set(prev.filter((n) => String(n.id).startsWith("note_")).map((n) => n.id));
        const fresh = noteNodes.filter((n) => !existingIds.has(n.id));
        return [...prev, ...fresh];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Import a schema from a local .sql file: load the text, derive a project
  // name from the filename, and generate the diagram immediately.
  const importSqlFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        if (!text.trim()) {
          toast({
            title: "Nothing to import",
            description: `\u201C${file.name}\u201D is empty.`,
            variant: "error",
          });
          return;
        }
        if (text.includes("\u0000")) {
          toast({
            title: "Not a text file",
            description: `\u201C${file.name}\u201D doesn't look like a SQL schema.`,
            variant: "error",
          });
          return;
        }
        const base = file.name
          .replace(/\.(sql|txt)$/i, "")
          .replace(/[_-]+/g, " ")
          .trim();
        setProjectName(base || "Untitled schema");
        setSql(text);
        setIsDirty(true);
        const parsed = buildFromSql(text, false);
        if (parsed) {
          pendingFitRef.current = true;
          toast({
            title: `Imported ${file.name}`,
            description: `${parsed.tables.length} tables \u00B7 ${parsed.relationships.length} relationships`,
            variant: "success",
          });
        } else {
          toast({
            title: "Imported file",
            description: "The SQL has parse errors \u2014 check the editor.",
            variant: "error",
          });
        }
      };
      reader.onerror = () => {
        toast({ title: "Could not read file", description: file.name, variant: "error" });
      };
      reader.readAsText(file);
    },
    [buildFromSql, setProjectName, setSql, toast],
  );

  // Also consume a share link when the app is already open and the URL hash
  // changes (e.g. the user pastes a shared link in the address bar). Fresh
  // page loads are handled by the bootstrap effect above.
  useEffect(() => {
    const onHashChange = () => {
      const params = parseHashParams(window.location.hash);
      if (params.schema) {
        const decoded = decodeSqlFromHash(params.schema);
        if (decoded && decoded.trim()) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
          setProjectName("Shared schema");
          setSql(decoded);
          setIsDirty(true);
          const parsed = buildFromSql(decoded, false);
          pendingFitRef.current = true;
          if (parsed) {
            // Inject any notes from the shared link.
            if (params.notes) {
              const decodedNotes = decodeNotesFromHash(params.notes);
              if (decodedNotes && decodedNotes.length > 0) {
                const noteNodes = decodedNotes.map((n) => ({
                  id: n.id,
                  type: NOTE_NODE,
                  position: n.position,
                  data: { text: n.text },
                  style: { width: 190 },
                })) as unknown as SchemaNode[];
                setNodes((prev) => [...prev, ...noteNodes]);
                setNotes(decodedNotes.map((n) => ({ id: n.id, position: n.position, text: n.text })));
              }
            }
            toast({
              title: "Loaded shared schema",
              description: `${parsed.tables.length} tables \u00B7 ${parsed.relationships.length} relationships`,
              variant: "success",
            });
          }
        }
      }
      if (params.table) pendingFocusTableRef.current = params.table;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [buildFromSql, setNotes, setProjectName, setSql, toast]);

  // Load an example passed via URL (?example=...) exactly once. Applied
  // during render (React's documented pattern) so the bootstrap effect below
  // picks it up without a separate state-setting effect.
  const [appliedExample, setAppliedExample] = useState<string | null>(null);
  if (initialExampleId && initialExampleId !== appliedExample) {
    const example = getExample(initialExampleId);
    setAppliedExample(initialExampleId);
    if (example) {
      setSql(example.sql);
      setProjectName(example.name);
    }
  }

  const fitView = useCallback(() => {
    const instance = rfInstanceRef.current;
    if (instance) {
      void instance.fitView({ padding: 0.22, maxZoom: 1, duration: 450 });
    } else {
      pendingFitRef.current = true;
    }
  }, []);

  // Fit once the flow instance is ready after a generation. The instance is
  // only trusted while the flow is actually mounted: in the mobile layout the
  // diagram tab unmounts, so a stale instance would otherwise swallow the
  // pending fit and the fresh mount would never frame the graph.
  useEffect(() => {
    const instance = rfInstanceRef.current;
    if (pendingFitRef.current && instance && flowConnectedRef.current) {
      pendingFitRef.current = false;
      const timer = setTimeout(() => {
        void instance.fitView({ padding: 0.22, maxZoom: 1, duration: 450 });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [nodes]);

  const visualize = useCallback(
    (textOverride?: string) => {
      const text = (textOverride ?? sql).trim();
      if (!text) {
        toast({ title: "Nothing to visualize", description: "Paste some SQL first.", variant: "info" });
        return;
      }
      const parsed = buildFromSql(text, false);
      if (parsed) {
        pendingFitRef.current = true;
        toast({
          title: "Diagram generated",
          description: `${parsed.tables.length} tables · ${parsed.relationships.length} relationships`,
          variant: "success",
        });
      } else {
        toast({ title: "Unable to parse SQL", description: "Check the editor for details.", variant: "error" });
      }
    },
    [sql, buildFromSql, toast],
  );

  const loadExample = useCallback(
    (example: ExampleSchema) => {
      setSql(example.sql);
      setProjectName(example.name);
      const parsed = buildFromSql(example.sql, false);
      pendingFitRef.current = true;
      if (parsed) {
        toast({ title: `Loaded ${example.name} example`, variant: "success" });
      }
    },
    [buildFromSql, setProjectName, setSql, toast],
  );

  const format = useCallback(() => {
    const formatted = formatSql(sql);
    if (formatted === sql.trim()) {
      toast({ title: "SQL is already formatted", variant: "info" });
      return;
    }
    setSql(formatted);
    setIsDirty(true);
  }, [setSql, sql, toast]);

  // Collapse / expand a table node. The header keeps its row of hidden
  // handles so edges converge on the header band instead of breaking.
  const toggleCollapse = useCallback((nodeId: string) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        const collapsed = !node.data.collapsed;
        const collapsedHeight = node.data.headerHeight + 26;
        return {
          ...node,
          style: { ...node.style, height: collapsed ? collapsedHeight : node.data.height },
          data: { ...node.data, collapsed },
        };
      }),
    );
  }, []);

  // Canvas notes live in the same nodes array as tables (type discriminators
  // handle rendering). They are also persisted in the notes state for
  // localStorage, but React Flow reconciles everything through setNodes.
  const addNote = useCallback(() => {
    const id = `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let position: XYPosition = { x: 40, y: 40 };
    const instance = rfInstanceRef.current;
    if (instance) {
      try {
        position = instance.screenToFlowPosition({
          x: window.innerWidth / 2 - 95,
          y: window.innerHeight / 2 - 60,
        });
      } catch {
        // keep the default position
      }
    }
    const noteNode = {
      id,
      type: NOTE_NODE,
      position,
      data: { text: "" },
      style: { width: 190 },
    } as unknown as SchemaNode;
    setNodes((prev) => [...prev, noteNode]);
    setNotes((prev) => [...prev, { id, position, text: "" }]);
  }, [setNodes, setNotes]);

  const updateNote = useCallback(
    (noteId: string, text: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, data: { ...n.data, text } } as SchemaNode : n,
        ),
      );
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, text } : n)));
    },
    [setNodes, setNotes],
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== noteId));
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    },
    [setNodes, setNotes],
  );

  const clearSql = useCallback(() => {
    setSql("");
    setSchema(null);
    setError(null);
    setNodes([]);
    setEdges([]);
    setIsDirty(false);
    toast({ title: "Editor cleared", variant: "info" });
  }, [setSql, toast]);

  const save = useCallback(() => {
    flushSql();
    setIsDirty(false);
    toast({ title: "Saved locally", description: "Your work is persisted in this browser.", variant: "success" });
  }, [flushSql, toast]);

  const resetDiagram = useCallback(() => {
    setSchema(null);
    setError(null);
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    toast({ title: "Diagram reset", variant: "info" });
  }, [toast]);

  // Table nodes flow through the normal apply pipeline. Note position
  // changes are captured in a ref (no React state, no re-render) and
  // committed to the notes state only on drag stop — this eliminates the
  // per-frame flickering that happened when setNotes → noteNodes → allNodes
  // rebuilt the entire nodes array every frame.
  // ALL changes (including note positions) go through a single setNodes
  // call — same path as tables. Notes live in the same nodes array, so
  // React Flow reconciles them identically and drag is real-time smooth.
  const onNodesChange = useCallback(
    (changes: NodeChange<SchemaNode>[]) => {
      setNodes((prev) => applyNodeChanges(changes, prev));
    },
    [],
  );

  const onEdgesChange = useCallback((changes: EdgeChange<SchemaEdge>[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const applySelectionState = useCallback(
    (nodeId: string | null, edgeId: string | null) => {
      const hasSelection = !!nodeId || !!edgeId;
      const relatedNodes = new Set<string>();
      const relatedEdges = new Set<string>();

      if (nodeId) {
        relatedNodes.add(nodeId);
        for (const edge of edges) {
          if (edge.source === nodeId || edge.target === nodeId) {
            relatedEdges.add(edge.id);
            relatedNodes.add(edge.source);
            relatedNodes.add(edge.target);
          }
        }
      } else if (edgeId) {
        const edge = edges.find((e) => e.id === edgeId);
        if (edge) {
          relatedEdges.add(edge.id);
          relatedNodes.add(edge.source);
          relatedNodes.add(edge.target);
        }
      }

      let nodesChanged = false;
      const nextNodes = nodes.map((node) => {
        const dimmed = hasSelection && !relatedNodes.has(node.id);
        const related = hasSelection && relatedNodes.has(node.id) && node.id !== nodeId;
        const spotlight = focusMode && !!nodeId && !relatedNodes.has(node.id);
        const focused = focusMode && nodeId === node.id;
        if (
          node.data.dimmed === dimmed &&
          node.data.related === related &&
          (node.data.spotlight ?? false) === spotlight &&
          (node.data.focused ?? false) === focused
        ) {
          return node;
        }
        nodesChanged = true;
        return { ...node, data: { ...node.data, dimmed, related, spotlight, focused } };
      });

      let edgesChanged = false;
      const nextEdges = edges.map((edge) => {
        const dimmed = hasSelection && !relatedEdges.has(edge.id);
        const current = edge.data?.dimmed ?? false;
        if (current === dimmed) return edge;
        edgesChanged = true;
        return edge.data ? { ...edge, data: { ...edge.data, dimmed } } : edge;
      });

      if (nodesChanged) setNodes(nextNodes);
      if (edgesChanged) setEdges(nextEdges);
    },
    [edges, focusMode, nodes],
  );

  const relatedNodeIds = useCallback(
    (nodeId: string) => {
      const ids = new Set<string>([nodeId]);
      for (const edge of edges) {
        if (edge.source === nodeId || edge.target === nodeId) {
          ids.add(edge.source);
          ids.add(edge.target);
        }
      }
      return [...ids];
    },
    [edges],
  );

  const fitToNodes = useCallback((ids: string[]) => {
    window.setTimeout(() => {
      void rfInstanceRef.current?.fitView({
        padding: 0.3,
        maxZoom: 1,
        duration: 450,
        nodes: ids.map((id) => ({ id })),
      });
    }, 30);
  }, []);

  const enterFocus = useCallback(
    (nodeId: string) => {
      setFocusMode(true);
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      applySelectionState(nodeId, null);
      fitToNodes(relatedNodeIds(nodeId));
    },
    [applySelectionState, fitToNodes, relatedNodeIds],
  );

  const exitFocus = useCallback(() => {
    setFocusMode(false);
    window.setTimeout(() => {
      void rfInstanceRef.current?.fitView({ padding: 0.22, maxZoom: 1, duration: 450 });
    }, 30);
  }, []);

  const toggleFocus = useCallback(() => {
    if (focusMode) {
      exitFocus();
    } else if (selectedNodeId) {
      enterFocus(selectedNodeId);
    }
  }, [enterFocus, exitFocus, focusMode, selectedNodeId]);

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams<SchemaNode, SchemaEdge>) => {
      const nodeId = params.nodes[0]?.id ?? null;
      const edgeId = params.edges[0]?.id ?? null;
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(edgeId);
      applySelectionState(nodeId, edgeId);
      if (focusMode) {
        if (nodeId) {
          fitToNodes(relatedNodeIds(nodeId));
        } else {
          exitFocus();
        }
      }
    },
    [applySelectionState, exitFocus, fitToNodes, focusMode, relatedNodeIds],
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: SchemaNode) => {
      if ((node.type as string) === NOTE_NODE) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, position: node.position } : n,
          ),
        );
        return;
      }
      setPositions((prev) => ({ ...prev, [node.id]: node.position }));
    },
    [setNotes, setPositions],
  );

  // Inject notes from a shared link after the schema is built. The pending
  // notes are decoded from the URL hash during bootstrap and stored in a ref;
  // this effect picks them up once nodes have table content.
  useEffect(() => {
    const pending = pendingNotesRef.current;
    if (!pending || pending.length === 0 || nodes.length === 0) return;
    pendingNotesRef.current = null;
    const noteNodes = pending.map((n) => ({
      id: n.id,
      type: NOTE_NODE,
      position: n.position,
      data: { text: n.text },
      style: { width: 190 },
    })) as unknown as SchemaNode[];
    setNodes((prev) => [...prev, ...noteNodes]);
    setNotes(pending.map((n) => ({ id: n.id, position: n.position, text: n.text })));
  }, [nodes.length, setNotes]);

  // Deep link: after the graph is ready, select and zoom to the requested table.
  useEffect(() => {
    const table = pendingFocusTableRef.current;
    if (!table) return;
    const node = nodes.find((n) => n.id === table);
    if (!node) return;
    pendingFocusTableRef.current = null;
    setSelectedNodeId(table);
    setSelectedEdgeId(null);
    applySelectionState(table, null);
    window.setTimeout(() => {
      void rfInstanceRef.current?.fitView({
        padding: 0.3,
        maxZoom: 1,
        duration: 450,
        nodes: [{ id: table }],
      });
    }, 60);
  }, [applySelectionState, nodes]);

  const lastZoomRef = useRef(0);
  const onViewportChange = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    const rounded = Math.round(viewport.zoom * 1000) / 1000;
    if (rounded !== lastZoomRef.current) {
      lastZoomRef.current = rounded;
      setZoom(rounded);
    }
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance<SchemaNode, SchemaEdge>) => {
    rfInstanceRef.current = instance;
    if (pendingFitRef.current) {
      pendingFitRef.current = false;
      setTimeout(() => {
        void instance.fitView({ padding: 0.22, maxZoom: 1, duration: 450 });
      }, 30);
    }
  }, []);


  const autoLayout = useCallback(
    (direction?: LayoutDirection) => {
      if (!nodes.length) return;
      const dir = direction ?? prefs.direction;
      const laidOut = layoutGraph(nodes, edges, { direction: dir });
      setEdges(assignEdgeHandles(laidOut, edges));
      setNodes(laidOut);
      const posMap: Record<string, XYPosition> = {};
      for (const node of laidOut) posMap[node.id] = node.position;
      setPositions(posMap);
      setTimeout(() => {
        void rfInstanceRef.current?.fitView({ padding: 0.22, maxZoom: 1, duration: 450 });
      }, 30);
    },
    [edges, nodes, prefs.direction, setPositions],
  );

  const zoomIn = useCallback(() => void rfInstanceRef.current?.zoomIn({ duration: 200 }), []);
  const zoomOut = useCallback(() => void rfInstanceRef.current?.zoomOut({ duration: 200 }), []);
  const resetView = useCallback(() => {
    void rfInstanceRef.current?.fitView({ padding: 0.22, maxZoom: 1, duration: 350 });
  }, []);

  const updatePrefs = useCallback(
    (patch: Partial<DiagramPreferences>) => {
      setPrefs((prev) => ({ ...prev, ...patch }));
    },
    [setPrefs],
  );

  const changeDirection = useCallback(
    (direction: LayoutDirection) => {
      updatePrefs({ direction });
      autoLayout(direction);
    },
    [autoLayout, updatePrefs],
  );

  const exportInput = useMemo(
    () => ({ nodes, edges, selectedNodeId, edgeStyle: prefs.edgeStyle, showCardinality: prefs.showCardinality }),
    [nodes, edges, selectedNodeId, prefs.edgeStyle, prefs.showCardinality],
  );

  const handleExportPng = useCallback(async () => {
    if (!schema) return;
    try {
      await exportPng(exportInput, `schemaflow-${projectName.toLowerCase().replace(/\W+/g, "-")}.png`);
      toast({ title: "Exported PNG", variant: "success" });
    } catch {
      toast({ title: "Export failed", description: "Could not render the diagram.", variant: "error" });
    }
  }, [exportInput, projectName, schema, toast]);

  const handleExportSvg = useCallback(() => {
    if (!schema) return;
    try {
      exportSvg(exportInput, `schemaflow-${projectName.toLowerCase().replace(/\W+/g, "-")}.svg`);
      toast({ title: "Exported SVG", variant: "success" });
    } catch {
      toast({ title: "Export failed", description: "Could not render the diagram.", variant: "error" });
    }
  }, [exportInput, projectName, schema, toast]);

  const handleExportDocs = useCallback(() => {
    if (!schema) return;
    const slug = projectName.toLowerCase().replace(/\W+/g, "-") || "schemaflow";
    downloadTextFile(
      generateMarkdownDocs(schema, projectName),
      `${slug}-schema.md`,
      "text/markdown;charset=utf-8",
    );
    toast({ title: "Documentation exported", variant: "success" });
  }, [projectName, schema, toast]);

  const handleExportSql = useCallback(() => {
    if (!sql.trim()) {
      toast({ title: "Nothing to export", description: "The editor is empty.", variant: "info" });
      return;
    }
    const slug = projectName.toLowerCase().replace(/\W+/g, "-") || "schemaflow";
    exportSql(sql, `${slug}.sql`);
    toast({ title: "Exported SQL", variant: "success" });
  }, [projectName, sql, toast]);

  const handleCopyShareLink = useCallback(async () => {
    if (!sql.trim()) {
      toast({ title: "Nothing to share", description: "Paste some SQL first.", variant: "info" });
      return;
    }
    const url = new URL(window.location.href);
    const noteData = nodes
      .filter((n) => String(n.id).startsWith("note_"))
      .map((n) => ({ id: n.id, position: n.position, text: String(n.data.text ?? "") }));
    let hash = `schema=${encodeSqlToHash(sql)}`;
    if (noteData.length > 0) {
      hash += `&notes=${encodeNotesToHash(noteData)}`;
    }
    url.hash = hash;
    const ok = await copyTextToClipboard(url.toString());
    if (ok) {
      toast({
        title: "Share link copied",
        description: noteData.length > 0
          ? `Schema + ${noteData.length} note${noteData.length === 1 ? "" : "s"} in the link.`
          : "The schema travels inside the link.",
        variant: "success",
      });
    } else {
      toast({
        title: "Could not copy link",
        description: "Copy the address-bar URL instead.",
        variant: "error",
      });
    }
  }, [nodes, sql, toast]);

  const handleCopy = useCallback(async () => {
    if (!schema) return;
    try {
      await copyPngToClipboard(exportInput);
      toast({ title: "Copied to clipboard", variant: "success" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser may not support clipboard images.",
        variant: "error",
      });
    }
  }, [exportInput, schema, toast]);

  const selectedNodeName = useMemo(() => {
    if (!selectedNodeId || !schema) return null;
    return schema.tables.find((t) => t.id === selectedNodeId)?.name ?? null;
  }, [schema, selectedNodeId]);

  const selectedEdgeLabel = useMemo(() => {
    if (!selectedEdgeId) return null;
    const edge = edges.find((e) => e.id === selectedEdgeId);
    if (!edge?.data) return null;
    return `${edge.data.sourceColumn} → ${edge.data.targetColumn}`;
  }, [edges, selectedEdgeId]);

  return {
    // Data
    sql,
    setSql,
    projectName,
    setProjectName,
    schema,
    error,
    nodes,
    edges,
    prefs,
    panelSize,
    setPanelSize,
    sqlPanelOpen,
    setSqlPanelOpen,
    cursor,
    setCursor,
    zoom,
    isDirty,
    setIsDirty,
    paletteOpen,
    setPaletteOpen,
    mobileTab,
    setMobileTab,
    selectedNodeName,
    selectedEdgeLabel,

    // Actions
    visualize,
    loadExample,
    importSqlFile,
    format,
    clearSql,
    save,
    resetDiagram,
    autoLayout,
    fitView,
    resetView,
    zoomIn,
    zoomOut,
    updatePrefs,
    changeDirection,
    toggleCollapse,
    onNodesChange,
    onEdgesChange,
    onSelectionChange,
    onNodeDragStop,
    onViewportChange,
    onInit,
    setFlowConnected,
    handleExportPng,
    handleExportSvg,
    handleExportSql,
    handleExportDocs,
    handleCopy,
    handleCopyShareLink,

    // Notes
    addNote,
    updateNote,
    deleteNote,

    // Focus / selection
    selectedNodeId,
    focusMode,
    enterFocus,
    exitFocus,
    toggleFocus,
  };
}

export type VisualizerApi = ReturnType<typeof useVisualizer>;
