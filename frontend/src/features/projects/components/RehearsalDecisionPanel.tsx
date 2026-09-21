import { useState } from 'react';
import type { Decision, RehearsalPanelProps, RehearsalRequirement } from '../../../types/rehearsal';
import { rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';
import { useRehearsalRecords } from '../hooks/useRehearsalRecords';

export function RehearsalDecisionPanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const records = useRehearsalRecords<Decision>(base, '/decisions', summary);
  const [preview, setPreview] = useState<{ manifest: unknown; digest: string; identity: string; requestKey: string } | null>(null);
  const [decision, setDecision] = useState('defer');
  const [reason, setReason] = useState('');
  const [baseline, setBaseline] = useState('');
  const [comparison, setComparison] = useState<{ scope_changed?: boolean; changes?: { requirement_id: number; before: RehearsalRequirement | null; after: RehearsalRequirement | null }[]; limitations?: string[] } | null>(null);
  const action = useRehearsalAction();
  const identity = JSON.stringify(summary);
  return <section aria-label="Release decisions"><h4>Review changes and record a decision</h4><p>A decision records your judgment against specific evidence. Historical decisions remain unchanged when the current scope changes.</p>
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    {records.error && <p role="alert">{records.error}<button onClick={records.retry}>Reload decisions</button></p>}
    <label>Compare with decision<select value={baseline} onChange={e => { setBaseline(e.target.value); setComparison(null); }}><option value="">Choose prior decision</option>{records.items.map(record => <option key={record.id} value={record.id}>Decision {record.id} · {record.decision}</option>)}</select></label>
    <button disabled={action.busy} onClick={() => void action.act(async () => setComparison(await rehearsalRequest(base, `/comparison${baseline ? `?baseline_decision_id=${baseline}` : ''}`)))}>Compare release evidence</button>
    {comparison !== null && <section aria-label="Changes since selected decision"><h5>Changes since selected decision</h5><p>{comparison.scope_changed ? 'The selected source or environment changed. Review affected evidence.' : 'No source or environment change reported.'}</p>{comparison.changes?.map(change => <article key={change.requirement_id}><h5>{change.after?.title || change.before?.title}: {change.before?.state.replaceAll('_', ' ') || 'absent'} → {change.after?.state.replaceAll('_', ' ') || 'absent'}</h5>{change.after?.reasons.map((text, i) => <p key={i}>{text}</p>)}</article>)}{!comparison.changes?.length && <p>No requirement changes to show. Select a saved decision to compare.</p>}{comparison.limitations?.map((text, i) => <p key={i}>{text}</p>)}<details><summary>Full comparison evidence</summary><pre>{JSON.stringify(comparison, null, 2)}</pre></details></section>}
    <fieldset disabled={disabled || action.busy || !summary.scope}>
      <button className="button" onClick={() => void action.act(async () => { const result = await rehearsalRequest<{ digest: string; manifest: unknown }>(base, '/decisions/preview'); setPreview({ ...result, identity, requestKey: crypto.randomUUID() }); })}>Preview release decision</button>
      {preview && preview.identity === identity && <div><p>Decision preview digest: {preview.digest}</p><pre>{JSON.stringify(preview.manifest, null, 2)}</pre>
        <label>Release decision<select value={decision} onChange={e => setDecision(e.target.value)}><option value="defer">Defer</option><option value="no_go">No go</option><option value="go">Go</option></select></label>
        <label>Release decision reason<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button className="button" disabled={!reason.trim()} onClick={() => void action.act(async () => { await rehearsalRequest(base, '/decisions', { request_key: preview.requestKey, digest: preview.digest, decision, reason }); setPreview(null); records.retry(); reload(); }, 'Release decision recorded against the reviewed evidence.')}>Record reviewed release decision</button>
      </div>}
    </fieldset>
    <h5>Decision history</h5>{records.items.map(record => <details key={record.id}><summary>Decision {record.id} · {record.decision.replaceAll('_', ' ')} · {record.created_at}</summary><p>{record.reason}</p><pre>{JSON.stringify(record.manifest, null, 2)}</pre></details>)}
  </section>;
}

