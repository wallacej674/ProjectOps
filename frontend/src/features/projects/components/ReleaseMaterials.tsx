import { useEffect, useState } from 'react';
import { releaseRequest } from '../api/releases';
import { listProjectArtifacts } from '../api/projectArtifacts';
import type { ReleasePage, RequirementMaterial } from '../../../types/releases';
import type { ProjectArtifact } from '../../../types/projectArtifact';

export function ReleaseMaterials({ projectId, path, version, disabled, onLinked }: { projectId: string; path: string; version: number; disabled: boolean; onLinked: () => void }) {
  const [materials, setMaterials] = useState<ReleasePage<RequirementMaterial>>({ items: [], total: 0 });
  const [artifacts, setArtifacts] = useState<ProjectArtifact[]>([]);
  const [artifactId, setArtifactId] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([releaseRequest<ReleasePage<RequirementMaterial>>(projectId, `${path}/materials?offset=${offset}`), listProjectArtifacts(projectId)])
      .then(([records, choices]) => { if (active) { setMaterials(records); setArtifacts(choices); setError(''); } })
      .catch(() => { if (active) setError('Supporting material could not load.'); });
    return () => { active = false; };
  }, [projectId, path, offset, version]);
  async function link() {
    setBusy(true); setError('');
    try { await releaseRequest(projectId, `${path}/materials`, { version, artifact_id: Number(artifactId) }); setArtifactId(''); onLinked(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Material could not be linked.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Supporting material"><h4>Supporting material</h4>
    <p>Save an artifact snapshot for review. Linking material does not verify this requirement.</p>
    {error && <p role="alert">{error}</p>}
    <label>Project artifact<select value={artifactId} onChange={e => setArtifactId(e.target.value)} disabled={disabled || busy}><option value="">Choose an artifact</option>{artifacts.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
    <button className="button" disabled={disabled || busy || !artifactId} onClick={() => void link()}>Save supporting snapshot</button>
    {materials.items.map(item => <details key={item.id}><summary>{item.snapshot.title}{item.source_changed ? ' · source changed' : ''}</summary><p>{item.snapshot.summary}</p>{item.snapshot.url && /^https?:\/\//i.test(item.snapshot.url) && <a href={item.snapshot.url} target="_blank" rel="noopener noreferrer">Saved source link</a>}<pre>{item.snapshot.content || 'No text content was supplied.'}</pre><p className="meta">Saved {new Date(item.linked_at).toLocaleString()} · requirement revision record {item.requirement_revision_id}</p></details>)}
    {materials.total === 0 && <p>No supporting snapshots linked yet.</p>}
    <button className="button" disabled={!offset} onClick={() => setOffset(v => Math.max(0, v - 25))}>Newer material</button>
    <button className="button" disabled={offset + 25 >= materials.total} onClick={() => setOffset(v => v + 25)}>Older material</button>
  </section>;
}
