"use client";

import { useCallback, useSyncExternalStore } from "react";

// localStorage-backed state without hydration mismatches: the server
// snapshot is null, and the client picks up the stored value on mount.
export function useLocalStorage(
  key: string
): [string | null, (value: string | null) => void] {
  const eventName = `local-storage:${key}`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(eventName, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(eventName, onChange);
      };
    },
    [eventName]
  );

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        // storage unavailable — nothing to persist
      }
      window.dispatchEvent(new Event(eventName));
    },
    [key, eventName]
  );

  return [value, setValue];
}
