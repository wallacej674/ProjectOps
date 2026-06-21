import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "../../hooks/useTheme";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Application chrome: sidebar + top bar + mobile drawer wrapping each page. */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className={`app shell ${collapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} />
      <main id="main-content" tabIndex={-1}>
        <TopBar
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          mobileOpen={mobileOpen}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        {children}
      </main>
      <MobileNavigation open={mobileOpen} onClose={closeMobile} />
    </div>
  );
}
