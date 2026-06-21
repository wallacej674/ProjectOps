import type { ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** Small, on-brand line icons keyed by navigation label. */
export const navIcons: Record<string, ReactNode> = {
  Overview: svg(
    <>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </>,
  ),
  Projects: svg(
    <>
      <path d="M2 5.2 8 2l6 3.2-6 3.2z" />
      <path d="M2 10.8 8 14l6-3.2" />
    </>,
  ),
  "Repository Analysis": svg(
    <>
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="12" cy="8" r="1.6" />
      <path d="M4 5.6v4.8M5.4 4.4 10.6 7M5.4 11.6 10.6 9" />
    </>,
  ),
  "Health Monitoring": svg(<path d="M1.5 8h3l1.5-4 2.5 8 1.5-4h3.5" />),
  Readiness: svg(
    <>
      <path d="M8 1.5 13.5 4v4c0 3.4-2.4 5.4-5.5 6.5C4.9 13.4 2.5 11.4 2.5 8V4z" />
      <path d="M5.8 8 7.4 9.6 10.4 6.4" />
    </>,
  ),
  Artifacts: svg(
    <>
      <path d="M2 5 8 2l6 3v6l-6 3-6-3z" />
      <path d="M2 5l6 3 6-3M8 8v6" />
    </>,
  ),
  Settings: svg(
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
    </>,
  ),
};
