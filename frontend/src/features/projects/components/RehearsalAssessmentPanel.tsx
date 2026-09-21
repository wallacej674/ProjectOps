import { useState } from 'react';
import type { Assessment, Evidence, RehearsalPanelProps } from '../../../types/rehearsal';
import { rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';
import { useRehearsalRecords } from '../hooks/useRehearsalRecords';

export function RehearsalAssessmentPanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const assessments = useRehearsalRecords<Assessment>(base, '/assessments', summary);
  const evidence = useRehearsalRecords<Evidence>(base, '/evidence', summary);
  const [requirementId, setRequirementId] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [outcome, setOutcome] = useState('not_verified');
  const [rationale, setRationale] = useState('');
  const [limitations, setLimitations] = useState('');
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState('open');
  const action = useRehearsalAction();
  const requirement = summary.requirements.find(r => r.id === Number(requirementId));
  return <section aria-label="Requirement assessments"><h4>Review release gaps</h4>
    {summary.requirements.map(r => <article key={r.id}><h5>{r.title}</h5><p>{r.state.replaceAll('_', ' ')} · evidence: {r.outcome.replaceAll('_', ' ')} · freshness: {r.freshness} · disposition: {r.disposition.replaceAll('_', ' ')}</p><p>{r.criterion}</p><p>Verify: {r.verification_method}</p><p>Applicability: {r.applicability} · consequence: {r.consequence}</p>{r.reasons.map((text, i) => <p key={i}>{text}</p>)}</article>)}
    {!summary.requirements.length && <p>Confirm a requirement in the release workspace to assess it.</p>}
    {summary.limitations.map((text, i) => <p key={i}>{text}</p>)}
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    {(assessments.error || evidence.error) && <p role="alert">{assessments.error || evidence.error}<button onClick={() => { assessments.retry(); evidence.retry(); }}>Reload assessment records</button></p>}
    <fieldset disabled={disabled || action.busy || !summary.scope}>
      <label>Assess requirement<select value={requirementId} onChange={e => { setRequirementId(e.target.value); setSelected([]); }}><option value="">Choose requirement</option>{summary.requirements.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
      <fieldset><legend>Supporting or contrary evidence</legend>{evidence.items.filter(e => e.requirement_id === Number(requirementId)).map(e => <label key={e.id}><input type="checkbox" checked={selected.includes(e.id)} onChange={event => setSelected(v => event.target.checked ? [...v, e.id] : v.filter(id => id !== e.id))} />Use evidence {e.id}<span> · {e.kind} · {e.origin}</span></label>)}</fieldset>
      <label>Assessment outcome<select value={outcome} onChange={e => setOutcome(e.target.value)}>{['not_verified', 'supported', 'gap_found', 'conflicting'].map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Assessment rationale<textarea value={rationale} onChange={e => setRationale(e.target.value)} /></label>
      <label>Assessment limitations (one per line)<textarea value={limitations} onChange={e => setLimitations(e.target.value)} /></label>
      <button className="button" disabled={!requirement || !rationale.trim()} onClick={() => void action.act(async () => {
        await rehearsalRequest(base, '/assessments', { requirement_id: requirement?.id, requirement_revision: requirement?.requirement_revision, scope_id: summary.scope?.id, evidence_ids: selected, outcome, rationale, limitations: limitations.split('\n').filter(Boolean) }); assessments.retry(); reload();
      }, 'Assessment proposed. Review it before adoption.')}>Save proposed assessment</button>
      <label>Review or disposition reason<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
      <label>Human disposition<select value={disposition} onChange={e => setDisposition(e.target.value)}>{['open', 'accepted_risk', 'deferred'].map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></label>
      <button disabled={!requirement || !reason.trim()} onClick={() => void action.act(async () => { await rehearsalRequest(base, `/requirements/${requirementId}/disposition`, { disposition, reason }); reload(); }, 'Disposition recorded. Evidence outcome is unchanged.')}>Record disposition</button>
      {assessments.items.map(a => <article key={a.id}><h5>Assessment {a.id} · {a.outcome.replaceAll('_', ' ')}</h5><p>{a.rationale}</p><p>Origin: {a.provenance?.origin || 'Unspecified'}{a.provenance?.model ? ` · ${a.provenance.model}` : ''}</p><p>{a.review_status || a.status || 'proposed'} · {a.freshness || 'Inspect current summary for freshness'}</p><p>Cited evidence: {a.evidence_ids.join(', ') || 'None supplied'}</p><details><summary>Assessment review history</summary><pre>{JSON.stringify(a.reviews || [], null, 2)}</pre></details>{a.limitations.map((text, i) => <p key={i}>{text}</p>)}<button disabled={!reason.trim()} onClick={() => void action.act(async () => { await rehearsalRequest(base, `/assessments/${a.id}/review`, { version: a.version, action: 'accept', reason }); assessments.retry(); reload(); }, 'Assessment review recorded.')}>Accept assessment {a.id}</button><button disabled={!reason.trim()} onClick={() => void action.act(async () => { await rehearsalRequest(base, `/assessments/${a.id}/review`, { version: a.version, action: 'supersede', reason }); assessments.retry(); reload(); }, 'Assessment superseded.')}>Supersede assessment {a.id}</button></article>)}
    </fieldset>
  </section>;
}

