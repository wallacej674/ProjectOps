import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface BreadcrumbContextValue {
  segments: string[] | null;
  setSegments: (segments: string[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

/** Holds the active page's breadcrumb trail, read by TopBar. */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [segments, setSegments] = useState<string[] | null>(null);
  const value = useMemo(() => ({ segments, setSegments }), [segments]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumb must be used within BreadcrumbProvider");
  return ctx;
}

/** Registers the current page's breadcrumb trail; clears it again on unmount/route change. */
export function useBreadcrumb(segments: string[] | null) {
  const { setSegments } = useBreadcrumbContext();
  const key = segments ? segments.join("›") : "";

  useEffect(() => {
    setSegments(segments);
    return () => setSegments(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the joined `key` actually changes, not on every new array literal
  }, [key, setSegments]);
}

export function useBreadcrumbSegments() {
  return useBreadcrumbContext().segments;
}
