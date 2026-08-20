"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStoreApi,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DatabaseSchema } from "@/lib/schema/types";
import type { EdgeStyle, LayoutDirection, SchemaEdge, SchemaNode } from "@/lib/graph/types";
import { CanvasControls } from "./canvas-controls";
import { EmptyState } from "./empty-state";
import { nodeTypes as tableNodeTypes } from "./table-node";
import { NoteNode, NOTE_NODE } from "./note-node";
import { NodeActionsContext } from "./node-actions";
import { CardinalityContext, EdgeStyleContext, edgeTypes } from "./relationship-edge";

export interface DiagramPreferences {
  minimap: boolean;
  grid: boolean;
  snap: boolean;
  direction: LayoutDirection;
  edgeStyle: EdgeStyle;
  showCardinality: boolean;
}

interface DiagramCanvasProps {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  schema: DatabaseSchema | null;
  prefs: DiagramPreferences;
  onNodesChange: (changes: NodeChange<SchemaNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<SchemaEdge>[]) => void;
  onSelectionChange: OnSelectionChangeFunc<SchemaNode, SchemaEdge>;
  onNodeDragStop: OnNodeDrag<SchemaNode>;
  onInit: (instance: ReactFlowInstance<SchemaNode, SchemaEdge>) => void;
  onViewportChange: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onAutoLayout: (direction?: LayoutDirection) => void;
  onDirectionChange: (direction: LayoutDirection) => void;
  onLoadExample: () => void;
  onToggleCollapse: (nodeId: string) => void;
  onNoteChange: (noteId: string, text: string) => void;
  onNoteDelete: (noteId: string) => void;
  selectedNodeId?: string | null;
  focusMode: boolean;
  onToggleFocus: () => void;
  presentMode?: boolean;
  onFlowConnectedChange?: (connected: boolean) => void;
}

/** Props consumed by the flow itself (everything except canvas-level chrome). */
interface CanvasFlowProps {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  prefs: DiagramPreferences;
  onNodesChange: (changes: NodeChange<SchemaNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<SchemaEdge>[]) => void;
  onSelectionChange: OnSelectionChangeFunc<SchemaNode, SchemaEdge>;
  onNodeDragStop: OnNodeDrag<SchemaNode>;
  onInit: (instance: ReactFlowInstance<SchemaNode, SchemaEdge>) => void;
  onViewportChange: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onAutoLayout: (direction?: LayoutDirection) => void;
  onDirectionChange: (direction: LayoutDirection) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  hasSchema: boolean;
  selectedNodeId?: string | null;
  focusMode: boolean;
  onToggleFocus: () => void;
  presentMode?: boolean;
  onFlowConnectedChange?: (connected: boolean) => void;
}

export function DiagramCanvas({
  nodes,
  edges,
  schema,
  prefs,
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
  onNodeDragStop,
  onInit,
  onViewportChange,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onAutoLayout,
  onDirectionChange,
  onLoadExample,
  onToggleCollapse,
  onNoteChange,
  onNoteDelete,
  selectedNodeId,
  focusMode,
  onToggleFocus,
  presentMode = false,
  onFlowConnectedChange,
}: DiagramCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasSchema = !!schema && schema.tables.length > 0;

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const nodeActions = useMemo(
    () => ({ onToggleCollapse, onNoteChange, onNoteDelete }),
    [onNoteChange, onNoteDelete, onToggleCollapse],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full" data-canvas-root>
      <EdgeStyleContext.Provider value={prefs.edgeStyle}>
        <CardinalityContext.Provider value={prefs.showCardinality}>
        <NodeActionsContext.Provider value={nodeActions}>
          <ReactFlowProvider>
            <CanvasFlow
              nodes={nodes}
              edges={edges}
              prefs={prefs}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onSelectionChange={onSelectionChange}
              onNodeDragStop={onNodeDragStop}
              onInit={onInit}
              onViewportChange={onViewportChange}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onFit={onFit}
              onReset={onReset}
              onAutoLayout={onAutoLayout}
              onDirectionChange={onDirectionChange}
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              hasSchema={hasSchema}
              selectedNodeId={selectedNodeId}
              focusMode={focusMode}
              onToggleFocus={onToggleFocus}
              presentMode={presentMode}
              onFlowConnectedChange={onFlowConnectedChange}
            />
          </ReactFlowProvider>
        </NodeActionsContext.Provider>
        </CardinalityContext.Provider>
      </EdgeStyleContext.Provider>

      {!hasSchema && <EmptyState onLoadExample={onLoadExample} />}
    </div>
  );
}

/**
 * The actual flow. Lives inside ReactFlowProvider so it can reach the store
 * (useStoreApi) and the instance (useReactFlow) — those hooks require the
 * provider to be an ancestor of the component that calls them.
 */
function CanvasFlow({
  nodes,
  edges,
  prefs,
  onNodesChange,
  onEdgesChange,
  onSelectionChange,
  onNodeDragStop,
  onInit,
  onViewportChange: onMove,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onAutoLayout,
  onDirectionChange,
  onToggleFullscreen,
  isFullscreen,
  hasSchema,
  selectedNodeId,
  focusMode,
  onToggleFocus,
  presentMode = false,
  onFlowConnectedChange,
}: CanvasFlowProps) {
  const snapGrid = useMemo<[number, number]>(() => [16, 16], []);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const store = useStoreApi();
  const nodeTypes = useMemo<NodeTypes>(
    () => ({ ...tableNodeTypes, [NOTE_NODE]: NoteNode }),
    [],
  );

  // Let the parent hook know when the flow mounts/unmounts (mobile layout
  // unmounts the diagram tab, which can strand a stale instance).
  useEffect(() => {
    onFlowConnectedChange?.(true);
    return () => onFlowConnectedChange?.(false);
  }, [onFlowConnectedChange]);

  /*
   * One batched re-measure after a graph is (re)built: the handle bounds are
   * read while the entrance animation runs, which can leave edges a fraction
   * off. A single pass over all nodes keeps large schemas cheap (one
   * updateNodeInternals call instead of one per node).
   */
  const prevTableCount = useRef(0);
  const tableCount = useMemo(
    () => nodes.filter((n) => !String(n.id).startsWith("note_")).length,
    [nodes],
  );
  useEffect(() => {
    const count = tableCount;
    if (count === 0 || prevTableCount.current === count) return;
    prevTableCount.current = count;
    const timer = window.setTimeout(() => {
      const domNode = store.getState().domNode;
      if (!domNode) return;
      const entries = new Map();
      for (const node of nodes) {
        // Notes are plain boxes with no handles — they don't need a re-measure.
        if (String(node.id).startsWith("note_")) continue;
        const el = domNode.querySelector<HTMLDivElement>(`.react-flow__node[data-id="${node.id}"]`);
        if (el) entries.set(node.id, { id: node.id, nodeElement: el, force: true });
      }
      if (entries.size > 0) {
        store.getState().updateNodeInternals(entries);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [tableCount, nodes, store]);

  return (
    <ReactFlow<SchemaNode, SchemaEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
      onNodeDragStop={onNodeDragStop}
      onInit={onInit}
      onMove={onMove}
      minZoom={0.05}
      maxZoom={2.5}
      snapToGrid={prefs.snap}
      snapGrid={snapGrid}
      deleteKeyCode={null}
      nodesConnectable={false}
      proOptions={proOptions}
      zoomOnDoubleClick
      selectionOnDrag={false}
      onlyRenderVisibleElements
    >
      <PresentModeFit active={presentMode} />
      {prefs.grid && (
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.3}
          color="var(--canvas-dot)"
        />
      )}
      {!presentMode && prefs.minimap && hasSchema && (
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          style={{ width: 168, height: 110 }}
          nodeColor={(node) =>
            node.selected ? "var(--accent)" : "var(--text-faint)"
          }
          maskColor="var(--bg-overlay)"
        />
      )}
      {!presentMode && hasSchema && (
        <Panel position="top-right" className="!m-3">
          <CanvasControls
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onFit={onFit}
            onReset={onReset}
            onAutoLayout={onAutoLayout}
            onToggleFullscreen={onToggleFullscreen}
            isFullscreen={isFullscreen}
            direction={prefs.direction}
            onDirectionChange={onDirectionChange}
            focusMode={focusMode}
            canFocus={!!selectedNodeId}
            onToggleFocus={onToggleFocus}
          />
        </Panel>
      )}
    </ReactFlow>
  );
}

/**
 * Fits the whole diagram when presentation mode turns on. Rendered inside the
 * flow so it can reach the instance through useReactFlow (the store itself
 * only exposes fitView on the instance, not on its state).
 */
function PresentModeFit({ active }: { active: boolean }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.18, maxZoom: 1, duration: 500 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [active, fitView]);
  return null;
}
