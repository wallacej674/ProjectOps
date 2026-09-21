import { useEffect, useState } from 'react';
import type { Evidence, Page, RehearsalPanelProps } from '../../../types/rehearsal';
import { parseImport, rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';

const example = JSON.stringify({ check_id: 'download-isolation', criterion: 'A user cannot download another account’s document', expected: 'Other account receives no document', command: 'pytest tests/test_document_access.py', executed: false, outcome: 'not_run', output: '', not_run_reason: 'Run the check and replace this example with actual results.', tool: 'pytest', tool_version: 'unknown', started_at: null, finished_at: null }, null, 2);

export function RehearsalEvidencePanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const [requirementId, setRequirementId] = useState('');
  const [kind, setKind] = useState('verification');
  const [sourceId, setSourceId] = useState('');
  const [sources, setSources] = useState<{ id: number; title: string }[]>([]);
  const [sourceError, setSourceError] = useState('');
  const [sourceOffset, setSourceOffset] = useState(0);
  const [sourceTotal, setSourceTotal] = useState(0);
  const [report, setReport] = useState(example);
  const [records, setRecords] = useState<Evidence[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [preview, setPreview] = useState<{ digest: string; evidence: unknown; limitations: string[]; envelope: unknown; identity: string } | null>(null);
  const action = useRehearsalAction();
  const identity = JSON.stringify([requirementId, kind, sourceId, report, summary.scope?.id, summary.requirements.find(r => r.id === Number(requirementId))?.requirement_revision]);
  useEffect(() => { let active = true; setSources([]); setSourceError(''); if (kind === 'verification' || !requirementId) return;
    rehearsalRequest<Page<{ id: number; title: string }>>(base, `/evidence/sources?kind=${kind}&requirement_id=${requirementId}&offset=${sourceOffset}`).then(data => { if (active) { setSources(data.items); setSourceTotal(data.total); } }).catch(e => { if (active) setSourceError(e.message); }); return () => { active = false; };
  }, [base, kind, requirementId, sourceOffset, revision]);
  useEffect(() => { let active = true; rehearsalRequest<Page<Evidence>>(base, `/evidence?offset=${offset}`).then(data => { if (active) { setRecords(data.items); setTotal(data.total); setLoadError(''); } }).catch(e => { if (active) setLoadError(e.message); }); return () => { active = false; }; }, [base, offset, revision, summary]);
  return <section aria-label="Release evidence"><h4>Collect evidence</h4><p>Import reported checks or select a saved source. Attaching evidence does not verify a requirement.</p>
    {!summary.scope && <p>Save an assessment scope first.</p>}
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    <fieldset disabled={disabled || action.busy || !summary.scope}>
      <label>Evidence requirement<select value={requirementId} onChange={e => { setRequirementId(e.target.value); setSourceId(''); setSourceOffset(0); }}><option value="">Choose requirement</option>{summary.requirements.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
      <label>Evidence kind<select value={kind} onChange={e => { setKind(e.target.value); setSourceId(''); setSourceOffset(0); }}>{['verification', 'material', 'scan', 'health', 'readiness', 'analysis'].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      {kind === 'verification' ? <><label>Verification report JSON<textarea rows={12} value={report} onChange={e => setReport(e.target.value)} /></label><button disabled={!requirementId} onClick={() => void action.act(async () => { const current = parseImport(report); if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('Report must be an object.'); setReport(JSON.stringify({ ...current, criterion: summary.requirements.find(r => r.id === Number(requirementId))?.criterion }, null, 2)); })}>Use selected requirement criterion</button></> : <><label>Saved evidence source<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Choose saved source</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>{!sources.length && <p>No sources in this page. Save supporting material or run the relevant Project check first.</p>}{sourceError && <p role="alert">{sourceError}<button onClick={() => setRevision(v => v + 1)}>Reload source choices</button></p>}<button disabled={!sourceOffset} onClick={() => setSourceOffset(v => Math.max(0, v - 25))}>Newer sources</button><button disabled={sourceOffset + 25 >= sourceTotal} onClick={() => setSourceOffset(v => v + 25)}>Older sources</button></>}
      <button className="button" disabled={!requirementId || (kind !== 'verification' && !sourceId)} onClick={() => void action.act(async () => {
        const requirement = summary.requirements.find(r => r.id === Number(requirementId));
        const envelope = { request_key: crypto.randomUUID(), requirement_id: Number(requirementId), requirement_revision: requirement?.requirement_revision, scope_id: summary.scope?.id, kind, source_id: kind === 'verification' ? null : Number(sourceId), verification: kind === 'verification' ? parseImport(report) : null };
        const result = await rehearsalRequest<{ digest: string; evidence: unknown; limitations: string[] }>(base, '/evidence/preview', envelope);
        setPreview({ ...result, envelope, identity });
      })}>Preview evidence</button>
      {preview && preview.identity === identity && <div><h5>Evidence import preview</h5>{preview.limitations.map((text, index) => <p key={index}>{text}</p>)}<pre>{JSON.stringify(preview.evidence, null, 2)}</pre><button className="button" onClick={() => void action.act(async () => { await rehearsalRequest(base, '/evidence', preview.envelope); setPreview(null); setRevision(v => v + 1); reload(); }, 'Evidence imported. Requirement assessment is still separate.')}>Import reviewed evidence</button></div>}
    </fieldset>
    <h5>Saved evidence</h5>{loadError && <p role="alert">{loadError}<button onClick={() => setRevision(v => v + 1)}>Reload evidence</button></p>}
    {records.map(record => <details key={record.id}><summary>Evidence {record.id} · {record.kind} · {record.origin}</summary><p>Requirement {record.requirement_id}, revision {record.requirement_revision} · scope {record.scope_id}</p>{record.limitations.map((text, i) => <p key={i}>{text}</p>)}<pre>{JSON.stringify(record.payload, null, 2)}</pre></details>)}
    {!records.length && <p>No saved evidence in this page.</p>}<button disabled={!offset} onClick={() => setOffset(v => Math.max(0, v - 25))}>Newer evidence</button><button disabled={offset + 25 >= total} onClick={() => setOffset(v => v + 25)}>Older evidence</button>
  </section>;
}

