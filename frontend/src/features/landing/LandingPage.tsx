import { Link } from "react-router-dom";
import { Mark } from "../../components/ui/Mark";
import { StatusBadge } from "../../components/ui/StatusBadge";

const features: [string, string][] = [
  ["Repository analysis", "Understand project structure without digging through every folder."],
  ["Health monitoring", "See whether a production endpoint responds when you need it."],
  ["Production readiness", "Turn technical checks into a reviewable delivery conversation."],
  ["Project knowledge", "Keep essential project context visible to the whole team."],
];

const workflow = [
  "Create a project",
  "Attach a repository",
  "Analyze architecture",
  "Check the application",
  "Review readiness",
];

/** High-contrast marketing landing page and command-center preview. */
export function LandingPage() {
  return (
    <div className="app landing grid">
      <header className="landing-header">
        <Link to="/" className="brand">
          <Mark />
          ProjectOps
        </Link>
        <nav aria-label="Marketing navigation">
          <a href="#platform">Product</a>
          <a href="#workflow">Solutions</a>
          <a href="#developers">Developers</a>
          <a href="#documentation">Documentation</a>
          <span title="Authentication is coming later">Sign in</span>
        </nav>
        <Link className="button primary" to="/app/overview">
          Open ProjectOps
        </Link>
      </header>
      <section className="hero">
        <div>
          <div className="eyebrow">Engineering clarity, operationally grounded</div>
          <h1>See the state of every project. Know what to do next.</h1>
          <p>
            ProjectOps brings repository structure, application health, production readiness, and engineering next steps
            into one command center.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/app/overview">
              Open the Command Center
            </Link>
            <a className="button" href="#platform">
              Explore the Platform
            </a>
          </div>
        </div>
        <div className="panel command-preview">
          <div className="preview-top">
            <div>
              <div className="eyebrow">Preview: CivicPermit API</div>
              <div className="score">84</div>
              <div className="meta">Readiness score: advisory</div>
            </div>
            <div className="system-status">
              <span aria-hidden="true" className="system-status-orb">
                <span className="system-status-dot" />
              </span>
              <span>System status: Healthy</span>
            </div>
          </div>
          <div className="signal-map">
            <i />
            <i />
            <i />
          </div>
          <div className="row">
            <div>
              <strong>Recommended next action</strong>
              <div className="meta">Review the remaining secrets checklist item.</div>
            </div>
            <StatusBadge status="warning" />
          </div>
        </div>
      </section>
      <section className="landing-section" id="platform">
        <div className="eyebrow">One view across the engineering lifecycle</div>
        <h2>Evidence from the systems that shape delivery.</h2>
        <div className="feature-grid">
          {features.map(([title, text]) => (
            <article className="panel feature" key={title}>
              <div className="eyebrow">Signal</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-section" id="workflow">
        <div className="eyebrow">A practical workflow</div>
        <h2>From project record to a clearer production decision.</h2>
        <div className="feature-grid">
          {workflow.map((item, index) => (
            <article className="panel feature" key={item}>
              <div className="eyebrow">0{index + 1}</div>
              <h3>{item}</h3>
              <p>Clear evidence and next actions, with human review kept in the loop.</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-section" id="developers">
        <div className="panel preview-note">
          <div className="eyebrow">Transparency and security</div>
          <h2>ProjectOps makes assessments visible, not magical.</h2>
          <p>
            Signals are evidence-backed. Human review remains important, and a readiness score does not guarantee
            production safety.
          </p>
        </div>
      </section>
      <footer className="footer" id="documentation">
        <span>Copyright 2026 ProjectOps</span>
        <span>Product | Documentation | GitHub | Privacy | Terms | Contact</span>
      </footer>
    </div>
  );
}
