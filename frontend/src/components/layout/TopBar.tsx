import type { Theme } from "../../hooks/useTheme";

/** Top bar: mobile menu trigger, workspace context, theme, and profile utilities. */
export function TopBar({
  theme,
  onToggleTheme,
  mobileOpen,
  onOpenMobileNav,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  mobileOpen: boolean;
  onOpenMobileNav: () => void;
}) {
  const next = theme === "dark" ? "light" : "dark";
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
        <div className="crumb">Engineering command center</div>
      </div>
      <div className="top-actions" aria-label="Workspace utilities">
        <button
          className="button utility-theme"
          type="button"
          aria-label={`Switch to ${next} theme`}
          onClick={onToggleTheme}
        >
          Theme: {theme === "dark" ? "Dark" : "Light"}
        </button>
        <div
          className="profile-placeholder"
          title="Workspace profile controls are coming later"
          aria-label="Workspace profile placeholder"
        >
          PO
        </div>
      </div>
    </header>
  );
}
