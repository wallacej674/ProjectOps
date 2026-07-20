import { Link } from "react-router-dom";
import { footerLinks } from "./copy";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <span>Copyright 2026 ProjectOps</span>
      <nav aria-label="Footer">
        {footerLinks.map((link) => (
          <a href={link.href} key={link.label}>
            {link.label}
          </a>
        ))}
        <Link to="/app/overview">Open app</Link>
      </nav>
    </footer>
  );
}
