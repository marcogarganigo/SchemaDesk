"use client";

import {
  Clipboard,
  Columns2,
  CornerDownRight,
  Download,
  FileCode2,
  FileDown,
  FileImage,
  FlaskConical,
  Grid3x3,
  Link2,
  Magnet,
  Map,
  Moon,
  Rows2,
  Save,
  Settings2,
  Spline,
  Sun,
  Terminal,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { DropdownMenu, type DropdownEntry } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { KoFiButton } from "@/components/ui/kofi-button";
import { Tooltip } from "@/components/ui/tooltip";
import type { DiagramPreferences } from "@/components/diagram/diagram-canvas";
import type { Theme } from "@/components/providers/theme-provider";

interface AppHeaderProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSave: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportSql: () => void;
  onCopyToClipboard: () => void;
  onCopyShareLink: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  prefs: DiagramPreferences;
  onPrefChange: (patch: Partial<DiagramPreferences>) => void;
  onOpenPalette: () => void;
  hasSchema: boolean;
  hasSql: boolean;
  onOpenQueryBuilder: () => void;
  onOpenMockData: () => void;
}

export function AppHeader({
  projectName,
  onProjectNameChange,
  onSave,
  onExportPng,
  onExportSvg,
  onExportSql,
  onCopyToClipboard,
  onCopyShareLink,
  theme,
  onToggleTheme,
  prefs,
  onPrefChange,
  onOpenPalette,
  hasSchema,
  hasSql,
  onOpenQueryBuilder,
  onOpenMockData,
}: AppHeaderProps) {
  const exportItems: DropdownEntry[] = [
    {
      type: "label",
      label: "Export diagram",
    },
    { label: "PNG image", icon: FileImage, onSelect: onExportPng, disabled: !hasSchema },
    { label: "SVG vector", icon: FileCode2, onSelect: onExportSvg, disabled: !hasSchema },
    { label: "SQL source", icon: FileDown, onSelect: onExportSql, disabled: !hasSql },
    { type: "separator" },
    {
      label: "Copy to clipboard",
      icon: Clipboard,
      onSelect: onCopyToClipboard,
      disabled: !hasSchema,
    },
    {
      label: "Copy share link",
      icon: Link2,
      onSelect: onCopyShareLink,
      disabled: !hasSql,
    },
  ];

  const toolsItems: DropdownEntry[] = [
    {
      label: "Query Builder",
      icon: Terminal,
      onSelect: onOpenQueryBuilder,
      disabled: !hasSchema,
    },
    {
      label: "Mock Data (Seed)",
      icon: FlaskConical,
      onSelect: onOpenMockData,
      disabled: !hasSchema,
    },
  ];

  const settingsItems: DropdownEntry[] = [
    { type: "label", label: "Canvas" },
    { label: "Grid", icon: Grid3x3, checked: prefs.grid, onSelect: () => onPrefChange({ grid: !prefs.grid }) },
    { label: "Minimap", icon: Map, checked: prefs.minimap, onSelect: () => onPrefChange({ minimap: !prefs.minimap }) },
    { label: "Snap to grid", icon: Magnet, checked: prefs.snap, onSelect: () => onPrefChange({ snap: !prefs.snap }) },
    { type: "separator" },
    { type: "label", label: "Layout direction" },
    {
      label: "Left to right",
      icon: Columns2,
      checked: prefs.direction === "LR",
      onSelect: () => onPrefChange({ direction: "LR" }),
    },
    {
      label: "Top to bottom",
      icon: Rows2,
      checked: prefs.direction === "TB",
      onSelect: () => onPrefChange({ direction: "TB" }),
    },
    { type: "separator" },
    { type: "label", label: "Edge style" },
    {
      label: "Angled (orthogonal)",
      icon: CornerDownRight,
      checked: prefs.edgeStyle === "orthogonal",
      onSelect: () => onPrefChange({ edgeStyle: "orthogonal" }),
    },
    {
      label: "Free (curved)",
      icon: Spline,
      checked: prefs.edgeStyle === "curved",
      onSelect: () => onPrefChange({ edgeStyle: "curved" }),
    },
    { type: "separator" },
    { type: "label", label: "Display" },
    {
      label: "Show relationship type",
      checked: prefs.showCardinality,
      onSelect: () => onPrefChange({ showCardinality: !prefs.showCardinality }),
    },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2 pr-1" aria-label="Schema Desk home">
        <Logo wordmarkClassName="hidden sm:block" animate />
      </Link>

      <div className="mx-1 h-5 w-px bg-border-subtle" />

      {/* Project name */}
      <input
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
        aria-label="Project name"
        spellCheck={false}
        className="h-7 w-40 rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium text-secondary outline-none transition-colors hover:border-border hover:bg-raised focus:border-accent/50 focus:bg-raised focus:text-foreground"
      />

      <div className="flex-1" />

      <Tooltip content="Save" shortcut="⌘S">
        <Button variant="ghost" size="sm" onClick={onSave} className="hidden sm:inline-flex">
          <Save className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">Save</span>
        </Button>
      </Tooltip>

      <DropdownMenu
        label="Export diagram"
        items={exportItems}
        trigger={
          <Button variant="secondary" size="sm">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        }
      />

      <DropdownMenu
        label="Tools"
        items={toolsItems}
        trigger={
          <IconButton label="Tools">
            <Wrench className="h-4 w-4" />
          </IconButton>
        }
      />

      <DropdownMenu
        label="Settings"
        items={settingsItems}
        trigger={
          <IconButton label="Settings">
            <Settings2 className="h-4 w-4" />
          </IconButton>
        }
      />

      <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"}>
        <IconButton label="Toggle theme" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </IconButton>
      </Tooltip>

      <Tooltip content="Support on Ko-fi">
        <KoFiButton variant="icon" />
      </Tooltip>

      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-1 hidden items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-muted transition-colors hover:bg-raised md:flex"
      >
        <span>Commands</span>
        <Kbd>⌘K</Kbd>
      </button>
    </header>
  );
}
