"use client";

import { Focus, Maximize, Maximize2, Minimize2, Minus, Network, Plus, Scan, Columns2, Rows2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import type { LayoutDirection } from "@/lib/graph/types";

interface CanvasControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onAutoLayout: (direction?: LayoutDirection) => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  direction: LayoutDirection;
  onDirectionChange: (dir: LayoutDirection) => void;
  focusMode: boolean;
  canFocus: boolean;
  onToggleFocus: () => void;
}

export function CanvasControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onAutoLayout,
  onReset,
  onToggleFullscreen,
  isFullscreen,
  direction,
  onDirectionChange,
  focusMode,
  canFocus,
  onToggleFocus,
}: CanvasControlsProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-elevated shadow-node">
      <Tooltip content="Zoom in" shortcut="+" side="left">
        <IconButton label="Zoom in" onClick={onZoomIn} className="rounded-none">
          <Plus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <div className="h-px bg-border-subtle" />
      <Tooltip content="Zoom out" shortcut="−" side="left">
        <IconButton label="Zoom out" onClick={onZoomOut} className="rounded-none">
          <Minus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <div className="h-px bg-border-subtle" />
      <Tooltip content="Fit view" shortcut="F" side="left">
        <IconButton label="Fit view" onClick={onFit} className="rounded-none">
          <Scan className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <div className="h-px bg-border-subtle" />
      <Tooltip content="Reset view" shortcut="0" side="left">
        <IconButton label="Reset view" onClick={onReset} className="rounded-none">
          <Maximize className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <div className="h-px bg-border-subtle" />
      <Tooltip content="Auto layout" shortcut="L" side="left">
        <IconButton label="Auto layout" onClick={() => onAutoLayout()} className="rounded-none">
          <Network className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <div className="h-px bg-border-subtle" />
      <Tooltip content={focusMode ? "Exit focus mode" : "Focus selected table"} side="left">
        <IconButton
          label={focusMode ? "Exit focus mode" : "Focus selected table"}
          onClick={onToggleFocus}
          disabled={!canFocus && !focusMode}
          active={focusMode}
          className="rounded-none"
        >
          <Focus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <div className="h-px bg-border-subtle" />
      <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"} shortcut="⇧F" side="left">
        <IconButton
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={onToggleFullscreen}
          className="rounded-none"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </IconButton>
      </Tooltip>

      <div className="h-px bg-border-subtle" />
      <div className="flex flex-col gap-1 p-1">
        <DirectionButton
          active={direction === "LR"}
          onClick={() => onDirectionChange("LR")}
          label="Left to right"
          icon={<Columns2 className="h-3.5 w-3.5" />}
        />
        <DirectionButton
          active={direction === "TB"}
          onClick={() => onDirectionChange("TB")}
          label="Top to bottom"
          icon={<Rows2 className="h-3.5 w-3.5" />}
        />
      </div>
    </div>
  );
}

function DirectionButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Tooltip content={label} side="left">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors",
          "hover:bg-raised hover:text-secondary focus-visible:outline-2 focus-visible:outline-accent",
          active && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
