import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Mark } from "../ui/Mark";
import { navIcons } from "./navIcons";
import { futureNavItems, primaryNavItems } from "./navItems";

/** Off-canvas navigation drawer for tablet/mobile widths. */
export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const drawerRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const lastPath = useRef(location.pathname);

  // Close the drawer only when the route actually changes (a destination chosen).
  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      onClose();
    }
  }, [location.pathname, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-nav" role="presentation">
      <div className="mobile-nav-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mobile-nav-drawer panel" role="dialog" aria-modal="true" aria-label="Navigation" ref={drawerRef}>
        <div className="mobile-nav-head">
          <Link to="/app/overview" className="brand" onClick={onClose}>
            <Mark />
            <span className="brand-name">ProjectOps</span>
          </Link>
          <button type="button" className="button ghost" aria-label="Close navigation menu" onClick={onClose}>
            Close
          </button>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {primaryNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={onClose}>
              <span className="nav-icon" aria-hidden="true">
                {navIcons[item.label]}
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
          {futureNavItems.map((item) => (
            <button type="button" className="coming" disabled aria-disabled="true" key={item}>
              <span className="nav-icon" aria-hidden="true">
                {navIcons[item]}
              </span>
              <span className="nav-label">{item}</span>
              <small>Later</small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
