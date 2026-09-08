import { useEffect, useRef, useState } from 'react';
import { riskRequest } from '../api/codeRisk';
import type { Page, RiskExplanation, RiskExplanationPreview, SuggestedRiskWork } from '../../../types/codeRisk';

export function RiskExplanationPanel({ projectId, occurrenceId, onDraft }: {
  projectId: string; occurrenceId: number; onDraft: (draft: SuggestedRiskWork, explanationId: number) => void;
}) {
  const [preview, setPreview] = useState<RiskExplanationPreview | null>(null);
  const [consent, setConsent] = useState(false);
  const [record, setRecord] = useState<RiskExplanation | null>(null);
  const [history, setHistory] = useState<Page<RiskExplanation>>({ items: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const requestKey = useRef<string | null>(null);
  const mounted = useRef(true);
  const base = `/occurrences/${occurrenceId}`;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    riskRequest<Page<RiskExplanation>>(projectId, `${base}/explanations?offset=${offset}`)
      .then(result => { if (active) setHistory(result); })
      .catch(() => { if (active) setError('Could not load explanation history.'); });
    return () => { active = false; };
  }, [projectId, base, offset, revision]);

  async function act(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'AI request failed.'); }
    finally { if (mounted.current) setBusy(false); }
  }

  async function prepare() {
    const result = await riskRequest<RiskExplanationPreview>(projectId, `${base}/explanation-preview`, {});
    if (!mounted.current) return;
    setPreview(result); setConsent(false); requestKey.current = null;
  }

  async function send(regenerate = false) {
    if (!preview || !consent) return;
    // Keep the same key after a disconnected request, so checking again cannot double charge.
    requestKey.current ??= crypto.randomUUID();
    const result = await riskRequest<RiskExplanation>(projectId, `${base}/explanations`, {
      request_key: requestKey.current, context_digest: preview.context_digest, consent: true, regenerate,
    });
    if (!mounted.current) return;
    setRecord(result); setRevision(v => v + 1);
  }

  return <section className="risk-ai" aria-label="AI explanation">
    <h4>AI explanation</h4>
    <p>OpenAI can explain the supplied evidence and propose work. Suggestions require your review.</p>
    {error && <p role="alert">{error}</p>}
    <button className="button" disabled={busy} onClick={() => void act(prepare)}>Preview AI evidence</button>
    {preview && <>
      <p>{preview.destination} · {preview.model}</p>
      <p>This request contains scanner metadata. No source code or runtime evidence is included.</p>
      <pre aria-label="Evidence sent to OpenAI">{JSON.stringify(preview.packet, null, 2)}</pre>
      {!preview.available && <p role="status">{preview.unavailable_reason}</p>}
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to send this evidence to OpenAI. API usage may incur charges.</label>
      <button className="button" disabled={busy || !consent || !preview.available} onClick={() => void act(() => send())}>Send to OpenAI</button>
      {record && record.status !== 'pending' && <button className="button" disabled={busy || !consent || !preview.available}
        onClick={() => { requestKey.current = null; void act(() => send(true)); }}>Generate again (new request)</button>}
    </>}
    {busy && <p role="status">Processing AI request…</p>}
    {record && <article>
      <p>Explanation {record.id} · {record.status} · {record.model}</p>
      {record.status === 'pending' && <><p>Request is still pending. Refresh to check its outcome; interrupted requests expire.</p><button className="button" disabled={busy} onClick={() => void act(async () => {
        const next = await riskRequest<RiskExplanation>(projectId, `/explanations/${record.id}`); if (mounted.current) setRecord(next);
      })}>Refresh explanation</button></>}
      {record.failure && <p role="alert">{record.failure}</p>}
      {record.output && <>
        <p>{record.output.explanation}</p><h5>Conditions for impact</h5><ul>{record.output.impact_prerequisites.map((v, i) => <li key={i}>{v}</li>)}</ul>
        <h5>Uncertainty</h5><ul>{record.output.uncertainty.map((v, i) => <li key={i}>{v}</li>)}</ul>
        <h5>Proposed change</h5><p>{record.output.proposed_change}</p>
        <h5>Verification</h5><ul>{record.output.verification_steps.map((v, i) => <li key={i}>{v}</li>)}</ul>
        <p>Evidence references: {record.output.citations.join(', ')}</p>
        <details><summary>Original evidence packet</summary><pre>{JSON.stringify(record.packet, null, 2)}</pre></details>
        <p>Suggested priority: {record.output.work_item.priority}. Scanner severity is unchanged.</p>
        <button className="button" onClick={() => onDraft(record.output!.work_item, record.id)}>Use suggestion in work-item draft</button>
      </>}
    </article>}
    <details><summary>Explanation history ({history.total})</summary>
      {history.items.map(item => <button className="button" key={item.id} onClick={() => { setRecord(item); requestKey.current = null; }}>Explanation {item.id} · {item.status}</button>)}
      <button className="button" disabled={!offset} onClick={() => setOffset(v => Math.max(0, v - 25))}>Newer explanations</button>
      <button className="button" disabled={offset + 25 >= history.total} onClick={() => setOffset(v => v + 25)}>Older explanations</button>
    </details>
  </section>;
}
