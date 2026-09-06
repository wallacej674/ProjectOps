import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthUser } from "../../api/authTypes";
import type { Theme } from "../../hooks/useTheme";

function initials(user: AuthUser) {
  const source = user.display_name?.trim() || user.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

function AppearanceIcon({ theme }: { theme: Theme }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.3v1.5M8 13.2v1.5M1.3 8h1.5M13.2 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M3.3 12.7l1.1-1.1M11.6 4.4l1.1-1.1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 9.8A5.6 5.6 0 1 1 6.2 2.5a4.4 4.4 0 0 0 7.3 7.3z" />
    </svg>
  );
}

/** Compact account trigger with appearance preferences and account actions. */
export function AccountMenu({
  user,
  theme,
  onChangeTheme,
  onLogout,
}: {
  user: AuthUser;
  theme: Theme;
  onChangeTheme: (theme: Theme) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-menu-avatar" aria-hidden="true">
          {initials(user)}
        </span>
        <svg
          className="account-menu-chevron"
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m3.25 4.75 2.75 2.5 2.75-2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-identity">
            <strong>{user.display_name || "ProjectOps account"}</strong>
            <span>{user.email}</span>
          </div>
          <div className="account-menu-section-label">Appearance</div>
          <div className="account-menu-appearance" aria-label="Appearance">
            {(["light", "dark"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option}
                className="account-menu-theme"
                onClick={() => onChangeTheme(option)}
              >
                <AppearanceIcon theme={option} />
                <span>{option === "light" ? "Light" : "Dark"}</span>
                <span className="account-menu-theme-check" aria-hidden="true">
                  {theme === option ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="account-menu-divider" />
          <Link className="account-menu-item" role="menuitem" to="/app/settings" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="account-menu-item"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
