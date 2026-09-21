import { useEffect, useState } from 'react';
import type { Evidence, RehearsalPanelProps, Workflow } from '../../../types/rehearsal';
import { rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';
import { useRehearsalRecords } from '../hooks/useRehearsalRecords';

export function RehearsalWorkflowPanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const [selectedRequirements, setSelectedRequirements] = useState<number[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<number[]>([]);
  const [preview, setPreview] = useState<{ digest: string; manifest: unknown; available: boolean; limits: unknown; identity: string; requestKey: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const evidence = useRehearsalRecords<Evidence>(base, '/evidence', summary);
  const runs = useRehearsalRecords<Workflow>(base, '/workflows', refresh);
  const action = useRehearsalAction();
  const identity = JSON.stringify([selectedRequirements, selectedEvidence, summary]);
  const active = runs.items.some(run => ['queued', 'running'].includes(run.status));
  useEffect(() => { if (!active) return; const timer = setInterval(() => setRefresh(v => v + 1), 3000); return () => clearInterval(timer); }, [active]);
  return <section aria-label="AI gap review"><h4>AI-assisted gap review</h4><p>AI receives only the previewed material. It proposes assessments and up to three next checks. You review the result.</p>
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    {(runs.error || evidence.error) && <p role="alert">{runs.error || evidence.error}<button onClick={() => { runs.retry(); evidence.retry(); }}>Reload AI records</button></p>}
    <fieldset disabled={disabled || action.busy || !summary.scope || active}>
      <legend>Select the review scope</legend>{summary.requirements.map(r => <label key={r.id}><input type="checkbox" checked={selectedRequirements.includes(r.id)} onChange={e => setSelectedRequirements(v => e.target.checked ? [...v, r.id] : v.filter(id => id !== r.id))} />Review {r.title} with AI</label>)}
      {evidence.items.map(e => <label key={e.id}><input type="checkbox" checked={selectedEvidence.includes(e.id)} onChange={event => setSelectedEvidence(v => event.target.checked ? [...v, e.id] : v.filter(id => id !== e.id))} />Send evidence {e.id} · {e.kind} · {e.origin}</label>)}
      <button className="button" disabled={!selectedRequirements.length} onClick={() => void action.act(async () => { const response = await rehearsalRequest<{ digest: string; manifest: unknown; available: boolean; limits: unknown }>(base, '/workflows/preview', { evidence_ids: selectedEvidence, requirement_ids: selectedRequirements }); setPreview({ ...response, identity, requestKey: crypto.randomUUID() }); })}>Preview AI gap review</button>
      {preview && preview.identity === identity && <div><h5>Exact AI submission preview</h5><p>Destination: OpenAI. Preview digest: {preview.digest}</p><pre>{JSON.stringify(preview.manifest, null, 2)}</pre><p>Usage limits</p><pre>{JSON.stringify(preview.limits, null, 2)}</pre>{!preview.available && <p>AI is unavailable. Manual assessment remains available.</p>}<button className="button" disabled={!preview.available} onClick={() => void action.act(async () => { await rehearsalRequest(base, '/workflows', { request_key: preview.requestKey, digest: preview.digest, evidence_ids: selectedEvidence, requirement_ids: selectedRequirements, consent: true }); setPreview(null); setRefresh(v => v + 1); }, 'AI review queued. Results remain proposals.')}>Send this preview to AI</button></div>}
    </fieldset>
    <button onClick={() => { setRefresh(v => v + 1); reload(); }}>Refresh review status and assessments</button>
    {runs.items.map(run => <article key={run.id}><h5>Review {run.id} · {run.status.replaceAll('_', ' ')}</h5>{run.failure && <p role="alert">{run.failure}</p>}{run.warning && <p>{run.warning}</p>}{run.status === 'queued' && <p>The local workflow worker must be running. Refresh status if this stays queued.</p>}<details><summary>Review inputs, output and usage</summary><pre>{JSON.stringify({ manifest: run.manifest, output: run.output, usage: run.usage ?? 'Unknown' }, null, 2)}</pre></details>{['queued', 'running', 'waiting_for_review'].includes(run.status) && <button disabled={disabled || action.busy} onClick={() => void action.act(async () => { await rehearsalRequest(base, `/workflows/${run.id}/cancel`, {}); setRefresh(v => v + 1); }, 'Cancellation requested. Already incurred usage may remain.')}>Cancel review {run.id}</button>}</article>)}
  </section>;
}
