"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useState, but persisted to localStorage. Writes are debounced so rapid
 * updates (typing, dragging) don't thrash storage.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be unavailable (private mode, quota) — fail silently.
    }
  }, [key, value]);

  useEffect(() => {
    timer.current = setTimeout(flush, 120);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  return [value, setValue, flush] as const;
}
