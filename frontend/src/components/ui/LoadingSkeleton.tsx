/** Six shimmering card placeholders for the Project grid loading state. */
export function SkeletonCards() {
  return (
    <div className="project-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="panel skeleton skeleton-card" key={i} />
      ))}
    </div>
  );
}

/** A single shimmering panel placeholder of a fixed height. */
export function SkeletonPanel({ height }: { height: number }) {
  return <div className="panel skeleton" style={{ height }} />;
}
