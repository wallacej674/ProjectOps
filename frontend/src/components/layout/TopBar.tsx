import { useLocation } from "react-router-dom";
import type { Theme } from "../../hooks/useTheme";
import type { AuthUser } from "../../api/authTypes";
import { useBreadcrumbSegments } from "./BreadcrumbContext";
import { AccountMenu } from "./AccountMenu";

function defaultBreadcrumbFor(pathname: string): string[] {
  if (pathname === "/app/overview") return ["Overview"];
  if (pathname === "/app/projects/new") return ["Projects", "New Project"];
  if (pathname.startsWith("/app/projects")) return ["Projects"];
  return ["ProjectOps"];
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="3.2" />
        <path d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M13.5 9.8A5.6 5.6 0 1 1 6.2 2.5a4.4 4.4 0 0 0 7.3 7.3z" />
    </svg>
  );
}

/** Top bar: mobile menu trigger, breadcrumb, theme, and account utilities. */
export function TopBar({
  theme,
  onToggleTheme,
  mobileOpen,
  onOpenMobileNav,
  currentUser,
  onLogout,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  mobileOpen: boolean;
  onOpenMobileNav: () => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
}) {
  const next = theme === "dark" ? "light" : "dark";
  const location = useLocation();
  const activeSegments = useBreadcrumbSegments();
  const segments = activeSegments ?? defaultBreadcrumbFor(location.pathname);

  return (
    <header className="topbar">
      <div className="topbar-start">
        <button
          type="button"
          className="button ghost mobile-nav-trigger"
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          aria-expanded={mobileOpen}
          onClick={onOpenMobileNav}
        >
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M1 3h14M1 8h14M1 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="crumb">
          {segments.map((segment, index) => (
            <span key={segment}>
              {index > 0 && <span className="crumb-sep">/</span>}
              <span className={index === segments.length - 1 ? "crumb-current" : undefined}>{segment}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="top-actions" aria-label="Workspace utilities">
        <button
          className="button ghost icon-button"
          type="button"
          aria-label={`Switch to ${next} theme`}
          onClick={onToggleTheme}
        >
          <ThemeIcon theme={theme} />
        </button>
        {currentUser && <AccountMenu user={currentUser} onLogout={onLogout} />}
      </div>
    </header>
  );
}
