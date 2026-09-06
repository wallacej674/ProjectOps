import { useCallback, useEffect, useRef, useState } from "react";

/** Visible-page polling with one request at a time and retained stale data. */
export function usePolledResource<T>(load: () => Promise<T>, enabled = true) {
  const [data, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const revision = useRef(0);
  const refresh = useCallback(() => refreshRef.current(), []);
  const setData = useCallback((value: T) => { revision.current++; setValue(value); }, []);
  useEffect(() => {
    let active = true;
    let pending: Promise<void> | null = null;
    let queued = false;
    setValue(null);
    setError("");
    setLoading(enabled);
    const run = (): Promise<void> => {
      if (!active || !enabled) return Promise.resolve();
      if (pending) { queued = true; return pending; }
      const version = revision.current;
      pending = (async () => {
        try {
          const result = await load();
          if (active && version === revision.current) { setValue(result); setError(""); }
        } catch (e) {
          if (active) setError(e instanceof Error ? e.message : "Could not refresh monitoring.");
        } finally {
          if (active) setLoading(false);
          pending = null;
          if (active && queued) { queued = false; void run(); }
        }
      })();
      return pending;
    };
    refreshRef.current = run;
    const visibleRefresh = () => { if (document.visibilityState === "visible" && !pending) void run(); };
    if (enabled) void run();
    const timer = window.setInterval(visibleRefresh, 60_000);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("focus", visibleRefresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibleRefresh);
      window.removeEventListener("focus", visibleRefresh);
    };
  }, [load, enabled]);
  return { data, error, loading, refresh, setData, setError };
}
