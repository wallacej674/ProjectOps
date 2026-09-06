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

/** Top bar: mobile menu trigger, breadcrumb, and compact account utilities. */
export function TopBar({
  theme,
  onChangeTheme,
  mobileOpen,
  onOpenMobileNav,
  currentUser,
  onLogout,
}: {
  theme: Theme;
  onChangeTheme: (theme: Theme) => void;
  mobileOpen: boolean;
  onOpenMobileNav: () => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
}) {
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
        {currentUser && (
          <AccountMenu user={currentUser} theme={theme} onChangeTheme={onChangeTheme} onLogout={onLogout} />
        )}
      </div>
    </header>
  );
}
