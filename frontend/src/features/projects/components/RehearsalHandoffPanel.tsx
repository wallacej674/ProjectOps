import { useState } from 'react';
import type { Evidence, NextStep, Packet, RehearsalPanelProps } from '../../../types/rehearsal';
import { download, parseImport, rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';
import { useRehearsalRecords } from '../hooks/useRehearsalRecords';

export function RehearsalHandoffPanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const steps = useRehearsalRecords<NextStep>(base, '/next-steps', summary);
  const packets = useRehearsalRecords<Packet>(base, '/packets', summary);
  const evidence = useRehearsalRecords<Evidence>(base, '/evidence', summary);
  const results = useRehearsalRecords<{ id: number; outcome: string; summary: string; limitations: string[] }>(base, '/results', summary);
  const [stepId, setStepId] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState<{ digest: string; can_import?: boolean; stale_reasons?: string[]; warnings?: string[]; limitations?: string[]; [key: string]: unknown } | null>(null);
  const [previewInput, setPreviewInput] = useState<{ text: string; scope: number | undefined; envelope: Record<string, unknown> } | null>(null);
  const action = useRehearsalAction();
  const currentPreview = previewInput?.text === result && previewInput?.scope === summary.scope?.id;
  return <section aria-label="Agent handoff"><h4>Agent handoff and return</h4><p>Export one accepted task. Review the returned checks before importing evidence; an agent’s completion claim is not a verified fix.</p>
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    {(steps.error || packets.error || evidence.error || results.error) && <p role="alert">{steps.error || packets.error || evidence.error || results.error}<button onClick={() => { steps.retry(); packets.retry(); evidence.retry(); results.retry(); }}>Reload handoff records</button></p>}
    <fieldset disabled={disabled || action.busy || !summary.scope}>
      <label>Accepted task to export<select value={stepId} onChange={e => setStepId(e.target.value)}><option value="">Choose accepted task</option>{steps.items.filter(s => ['accepted', 'in_progress'].includes(s.status)).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <fieldset><legend>Evidence to include in assignment</legend>{evidence.items.map(e => <label key={e.id}><input type="checkbox" checked={selected.includes(e.id)} onChange={event => setSelected(v => event.target.checked ? [...v, e.id] : v.filter(id => id !== e.id))} />Include evidence {e.id} · {e.kind}</label>)}</fieldset>
      <button disabled={!stepId} onClick={() => void action.act(async () => { const selectedStep = steps.items.find(s => s.id === Number(stepId)); const created = await rehearsalRequest<Packet>(base, '/packets', { next_step_id: Number(stepId), version: selectedStep?.version, evidence_ids: selected }); setPacket(created); packets.retry(); }, 'Assignment prepared. Inspect the packet before sharing it.')}>Prepare assignment preview</button>
    </fieldset>
    <label>Saved assignment<select value={packet?.id || ''} onChange={e => { if (e.target.value) void action.act(async () => setPacket(await rehearsalRequest<Packet>(base, `/packets/${e.target.value}`))); }}><option value="">Choose saved packet</option>{packet && !packets.items.some(p => p.id === packet.id) && <option value={packet.id}>Packet {packet.id}</option>}{packets.items.map(p => <option key={p.id} value={p.id}>Packet {p.id}</option>)}</select></label>
    {packet && <div><h5>Assignment {packet.id}</h5><pre>{packet.markdown}</pre><button onClick={() => download(`release-assignment-${packet.id}.md`, packet.markdown, 'text/markdown')}>Download assignment Markdown</button><button onClick={() => download(`release-assignment-${packet.id}.json`, JSON.stringify({ id: packet.id, digest: packet.digest, manifest: packet.manifest }, null, 2), 'application/json')}>Download assignment JSON</button><button disabled={disabled} onClick={() => { setResult(JSON.stringify({ schema_version: 1, request_key: crypto.randomUUID(), packet_id: packet.id, packet_digest: packet.digest, outcome: 'partial', summary: 'Describe actual changes and checks, then replace this example.', scope_id: summary.scope?.id, checks: [], limitations: ['No checks supplied yet.'] }, null, 2)); setPreview(null); }}>Start result template for this packet</button></div>}
    <fieldset disabled={disabled || action.busy || !summary.scope}>
      <label>Agent result JSON<textarea rows={12} value={result} onChange={e => { setResult(e.target.value); setPreview(null); }} placeholder="Paste the versioned JSON result returned for your packet" /></label>
      <button disabled={!result.trim()} onClick={() => void action.act(async () => { const envelope = parseImport(result); if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new Error('The result must be a JSON object.'); const data = await rehearsalRequest<NonNullable<typeof preview>>(base, '/results/preview', envelope); setPreview(data); setPreviewInput({ text: result, scope: summary.scope?.id, envelope: envelope as Record<string, unknown> }); })}>Preview agent result</button>
      {preview && currentPreview && <div><h5>Returned work preview</h5><p>Review digest: {preview.digest}</p>{preview.stale_reasons?.map((reason, i) => <p key={i}>{reason}</p>)}{preview.warnings?.map((warning, i) => <p key={i}>{warning}</p>)}<pre>{JSON.stringify(preview, null, 2)}</pre><button disabled={!preview.can_import} onClick={() => void action.act(async () => { await rehearsalRequest(base, '/results', { ...previewInput?.envelope, preview_digest: preview.digest }); setPreview(null); results.retry(); reload(); }, 'Agent result imported. Reassess requirements against the returned evidence.')}>Import reviewed agent result</button></div>}
    </fieldset>
    <details><summary>Returned result history</summary>{results.items.map(item => <article key={item.id}><h5>Result {item.id} · {item.outcome}</h5><p>{item.summary}</p>{item.limitations?.map((text, i) => <p key={i}>{text}</p>)}</article>)}</details>
  </section>;
}

