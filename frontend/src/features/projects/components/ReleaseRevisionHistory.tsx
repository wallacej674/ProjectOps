import { useState } from 'react';
import { releaseRequest } from '../api/releases';
import type { ReleasePage } from '../../../types/releases';

type Revision = { revision: number; content: object; confirmed_at: string | null; created_at: string };
export function ReleaseRevisionHistory({ projectId, path, title }: { projectId: string; path: string; title: string }) {
  const [items, setItems] = useState<Revision[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true); setError('');
    try { const result = await releaseRequest<ReleasePage<Revision>>(projectId, `${path}?offset=${items.length}`); setItems(old => [...old, ...result.items]); setTotal(result.total); }
    catch { setError('Revision history could not load.'); }
    finally { setBusy(false); }
  }
  return <details className="release-history"><summary>{title}</summary>
    {error && <p role="alert">{error}</p>}
    {items.map(item => <article key={item.revision}><h4>Revision {item.revision} · {item.confirmed_at ? 'Confirmed' : 'Draft'}</h4>
      <p className="meta">{new Date(item.created_at).toLocaleString()}</p>
      <dl>{Object.entries(item.content).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(value || 'Not specified')}</dd></div>)}</dl>
    </article>)}
    <button className="button" disabled={busy || (total !== null && items.length >= total)} onClick={() => void load()}>{items.length ? 'Load older revisions' : 'Load revision history'}</button>
  </details>;
}
