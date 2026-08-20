"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook. Uses `useSyncExternalStore` so the server and the
 * first client render agree (no hydration mismatch), then tracks live changes.
 */
export function useMediaQuery(query: string, defaultValue = true): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => defaultValue,
  );
}
