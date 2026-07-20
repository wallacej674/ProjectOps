import { Link } from "react-router-dom";
import { Mark } from "../../components/ui/Mark";
import { hero, product, workflow } from "./copy";
import { InstrumentTiles } from "./InstrumentTiles";
import { LandingFooter } from "./LandingFooter";
import { StatTicker } from "./StatTicker";
import { TerminalReplay } from "./TerminalReplay";
import { TransparencyPanel } from "./TransparencyPanel";
import { WorkflowRail } from "./WorkflowRail";
import "./landing.css";

/** Marketing landing page: terminal session-replay hero + instrument tiles. */
export function LandingPage() {
  return (
    <div className="app landing grid">
      <header className="landing-header">
        <Link to="/" className="brand">
          <Mark />
          ProjectOps
        </Link>
        <nav aria-label="Marketing navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#transparency">Transparency</a>
          <span title="Authentication is coming later">Sign in</span>
        </nav>
        <Link className="button primary" to="/app/overview">
          Open ProjectOps
        </Link>
      </header>
      <section className="hero">
        <div>
          <p className="hero-eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p className="hero-sub">{hero.subtitle}</p>
          <div className="hero-actions">
            <Link className="button primary" to="/app/overview">
              {hero.primaryCta}
            </Link>
            <a className="button" href="#how-it-works">
              {hero.secondaryCta}
            </a>
          </div>
        </div>
        <TerminalReplay />
      </section>
      <StatTicker />
      <section className="landing-section" id="product">
        <div className="eyebrow">{product.eyebrow}</div>
        <h2>{product.title}</h2>
        <p className="section-lede">{product.lede}</p>
        <InstrumentTiles />
      </section>
      <section className="landing-section" id="how-it-works">
        <div className="eyebrow">{workflow.eyebrow}</div>
        <h2>{workflow.title}</h2>
        <WorkflowRail />
      </section>
      <section className="landing-section" id="transparency">
        <TransparencyPanel />
      </section>
      <LandingFooter />
    </div>
  );
}
