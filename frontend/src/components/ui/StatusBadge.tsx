/** A status pill. The status word is shown as text, so meaning is not color-only. */
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}
