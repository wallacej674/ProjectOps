import { useEffect, useState, type CSSProperties } from "react";
import { codemapSignals, stackGroups } from "./copy";
import { usePrefersReducedMotion } from "./useReplay";
import { useRevealOnScroll } from "./useRevealOnScroll";

const RESPONSE_TIMES_MS = [310, 262, 291, 240, 268, 233, 251, 245];

function useCountUp(target: number, active: boolean, reduced: boolean) {
  const [value, setValue] = useState(() => (reduced ? target : 0));

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setValue(target);
      return;
    }
    const started = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, target]);

  return value;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 120;
      const y = 26 - ((value - min) / span) * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--success)" strokeWidth="1.5" />
    </svg>
  );
}

/** Four data tiles mirroring the real project dashboard payload. */
export function InstrumentTiles() {
  const reduced = usePrefersReducedMotion();
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();
  const score = useCountUp(67, visible, reduced);

  return (
    <div className={`tile-grid${visible ? " is-visible" : ""}`} ref={ref}>
      <article className="tile" style={{ "--reveal-delay": "0s" } as CSSProperties}>
        <div className="tile-label">Readiness</div>
        <div className="tile-value accent">
          {score}
          <small>/100</small>
        </div>
        <div className="tile-meta">in progress · 6 of 9 passed</div>
        <span className="tile-bar">
          <span className="tile-bar-fill" />
        </span>
        <div className="tile-note warn">top gap: secrets management review</div>
      </article>
      <article className="tile" style={{ "--reveal-delay": ".08s" } as CSSProperties}>
        <div className="tile-label">Health</div>
        <div className="tile-value ok">
          200 <small>OK</small>
        </div>
        <div className="tile-meta">245 ms · api.civicpermit.dev</div>
        <Sparkline values={RESPONSE_TIMES_MS} />
        <div className="tile-note">recent on-demand checks</div>
      </article>
      <article className="tile" style={{ "--reveal-delay": ".16s" } as CSSProperties}>
        <div className="tile-label">CodeMap</div>
        <ul className="tile-checklist">
          {codemapSignals.map((signal) => (
            <li key={signal.label}>
              <span className={signal.passed ? "t-ok" : "t-err"}>{signal.passed ? "✓" : "✗"}</span> {signal.label}
            </li>
          ))}
        </ul>
        <div className="tile-note">15 structural signals · paths only</div>
      </article>
      <article className="tile" style={{ "--reveal-delay": ".24s" } as CSSProperties}>
        <div className="tile-label">Detected stack</div>
        {stackGroups.map((group) => (
          <div className="chip-group" key={group.label}>
            <span className="chip-group-label">{group.label}</span>
            <span className="chip-row">
              {group.chips.map((chip) => (
                <span className="chip" key={chip}>
                  {chip}
                </span>
              ))}
            </span>
          </div>
        ))}
        <div className="tile-note">grouped from the CodeMap scan</div>
      </article>
    </div>
  );
}
