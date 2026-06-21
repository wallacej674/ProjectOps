import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "projectops-theme";

/** Theme state, applied to <html data-theme> and persisted across sessions. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme) || "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  return [theme, setTheme] as const;
}
