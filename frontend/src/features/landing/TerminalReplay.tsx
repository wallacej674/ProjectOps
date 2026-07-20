import { REPLAY_SCRIPT, REPLAY_SUMMARY } from "./replayScript";
import { useReplay } from "./useReplay";

/** Animated terminal that replays an illustrative analysis session once,
 *  then settles. The full script is rendered up front (hidden lines keep the
 *  height stable); assistive tech gets the static summary instead. */
export function TerminalReplay() {
  const { revealed, settled, reduced } = useReplay();

  return (
    <div className="terminal" role="img" aria-label={REPLAY_SUMMARY}>
      <div className="terminal-titlebar">
        <span className="terminal-dot" />
        <span className="terminal-dot" />
        <span className="terminal-dot" />
        <span className="terminal-title">projectops ▸ analyze — session replay</span>
      </div>
      <div className="terminal-body" aria-hidden="true">
        {REPLAY_SCRIPT.map((line, index) => (
          <div className={`terminal-line${index < revealed ? " is-revealed" : ""}`} key={index}>
            {line.segments.map((segment, segmentIndex) => (
              <span className={segment.tone ? `t-${segment.tone}` : undefined} key={segmentIndex}>
                {segment.text}
              </span>
            ))}
            {line.kind === "progress" && (
              <span className="replay-bar">
                <span className="replay-bar-fill" style={{ width: index < revealed ? "67%" : "0%" }} />
              </span>
            )}
          </div>
        ))}
        <div className={`terminal-line${settled ? " is-revealed" : ""}`}>
          <span className="t-prompt">projectops ▸ </span>
          <span className={`terminal-cursor${reduced ? " static" : ""}`} />
        </div>
      </div>
    </div>
  );
}
