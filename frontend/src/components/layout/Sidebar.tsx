import { Link, NavLink } from "react-router-dom";
import { Mark } from "../ui/Mark";
import { navIcons } from "./navIcons";
import { futureNavItems, primaryNavItems } from "./navItems";

/** Collapsible desktop sidebar with primary and future navigation. */
export function Sidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <Link to="/app/overview" className="brand" aria-label="ProjectOps overview">
        <Mark />
        <span className="brand-name">ProjectOps</span>
      </Link>
      <nav className="nav" aria-label="Primary navigation">
        {primaryNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined}>
            <span className="nav-icon" aria-hidden="true">
              {navIcons[item.label]}
            </span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
        {futureNavItems.map((item) => (
          <button type="button" className="coming" title={`${item} is coming later`} key={item} aria-disabled="true">
            <span className="nav-icon" aria-hidden="true">
              {navIcons[item]}
            </span>
            <span className="nav-label">{item}</span>
            <small>Later</small>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="button ghost"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          onClick={onToggleCollapse}
        >
          <span className="nav-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </aside>
  );
}
