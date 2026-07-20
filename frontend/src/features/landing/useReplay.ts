import { useEffect, useRef, useState } from "react";
import { REPLAY_SCRIPT } from "./replayScript";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user prefers reduced motion, or when matchMedia is
 *  unavailable (jsdom) — animations then settle to their final frame. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window.matchMedia !== "function" || window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Reveals the replay script line by line; plays once and settles. */
export function useReplay() {
  const reduced = usePrefersReducedMotion();
  const total = REPLAY_SCRIPT.length;
  const [revealed, setRevealed] = useState(() => (reduced ? total : 0));
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    if (reduced) {
      setRevealed(total);
      return;
    }
    setRevealed(0);
    let elapsed = 0;
    REPLAY_SCRIPT.forEach((line, index) => {
      elapsed += line.delayMs;
      timeouts.current.push(window.setTimeout(() => setRevealed(index + 1), elapsed));
    });
    return () => {
      timeouts.current.forEach((id) => window.clearTimeout(id));
      timeouts.current = [];
    };
  }, [reduced, total]);

  return { revealed, settled: revealed >= total, reduced };
}
