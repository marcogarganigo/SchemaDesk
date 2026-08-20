"use client";

import dynamic from "next/dynamic";

interface VisualizerClientProps {
  initialExampleId?: string;
}

/**
 * The visualizer is a localStorage-driven client app (SQL, table positions,
 * panel size, preferences). Server-rendering it would hydrate a tree that
 * mismatches the stored values, so it loads only in the browser.
 */
export const VisualizerClient = dynamic<VisualizerClientProps>(
  () => import("./visualizer").then((m) => m.Visualizer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Loading visualizer…
      </div>
    ),
  },
);
