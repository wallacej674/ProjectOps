import { useState } from 'react';
import type { Evidence, NextStep, RehearsalPanelProps } from '../../../types/rehearsal';
import { rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';
import { useRehearsalRecords } from '../hooks/useRehearsalRecords';

export function RehearsalStepsPanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const records = useRehearsalRecords<NextStep>(base, '/next-steps', summary);
  const evidence = useRehearsalRecords<Evidence>(base, '/evidence', summary);
  const [requirements, setRequirements] = useState<number[]>([]);
  const [dependencies, setDependencies] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [checks, setChecks] = useState('');
  const action = useRehearsalAction();
  const topIds = summary.next_steps.map(item => item.id);
  return <section aria-label="Verification tasks"><h4>Choose the next check</h4><p>The first three open tasks are prioritized by confirmed release relevance and evidence gaps. Closing work records a verification review, not release approval.</p>
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    {records.error && <p role="alert">{records.error}<button onClick={records.retry}>Reload tasks</button></p>}
    <fieldset disabled={disabled || action.busy}>
      <legend>Propose a verification task</legend>
      {summary.requirements.map(r => <label key={r.id}><input type="checkbox" checked={requirements.includes(r.id)} onChange={e => setRequirements(v => e.target.checked ? [...v, r.id] : v.filter(id => id !== r.id))} />Task for {r.title}</label>)}
      <label>Verification task title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Why this check matters<textarea value={rationale} onChange={e => setRationale(e.target.value)} /></label>
      <label>Acceptance checks (one per line)<textarea value={checks} onChange={e => setChecks(e.target.value)} /></label>
      <details><summary>Task dependencies</summary>{records.items.map(item => <label key={item.id}><input type="checkbox" checked={dependencies.includes(item.id)} onChange={e => setDependencies(v => e.target.checked ? [...v, item.id] : v.filter(id => id !== item.id))} />Depends on {item.title}</label>)}</details>
      <button className="button" disabled={!requirements.length || !title.trim() || !rationale.trim() || !checks.trim()} onClick={() => void action.act(async () => { await rehearsalRequest(base, '/next-steps', { requirement_ids: requirements, title, rationale, acceptance_checks: checks.split('\n').filter(Boolean), dependencies }); records.retry(); reload(); }, 'Verification task proposed. Accept it before export.')}>Propose verification task</button>
    </fieldset>
    <h5>Prioritized tasks</h5>{summary.next_steps.map(item => <Task key={item.id} item={item} base={base} disabled={disabled} evidence={evidence.items} reload={() => { records.retry(); reload(); }} />)}
    <details><summary>Remaining tasks and history</summary>{records.items.filter(item => !topIds.includes(item.id)).map(item => <Task key={item.id} item={item} base={base} disabled={disabled} evidence={evidence.items} reload={() => { records.retry(); reload(); }} />)}</details>
  </section>;
}

function Task({ item, base, disabled, evidence, reload }: { item: NextStep; base: string; disabled: boolean; evidence: Evidence[]; reload: () => void }) {
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [rationale, setRationale] = useState(item.rationale);
  const [checks, setChecks] = useState(item.acceptance_checks.join('\n'));
  const [draftVersion, setDraftVersion] = useState(item.version);
  const [selected, setSelected] = useState<number[]>([]);
  const action = useRehearsalAction();
  const transitions: Record<string, string[]> = { proposed: ['accepted', 'cancelled'], accepted: ['in_progress', 'cancelled'], in_progress: ['awaiting_verification', 'cancelled'], awaiting_verification: ['closed', 'in_progress', 'cancelled'], closed: [], cancelled: [] };
  return <article><h5>{item.title}</h5><p>{item.status.replaceAll('_', ' ')} · {item.rationale}</p><p>{item.priority_rationale}</p><p>Origin: {item.provenance?.origin || 'Unspecified'}</p><details><summary>Task revision history</summary><pre>{JSON.stringify(item.history || [], null, 2)}</pre></details><ul>{item.acceptance_checks.map((check, i) => <li key={i}>{check}</li>)}</ul>{item.dependencies.length > 0 && <p>Depends on tasks: {item.dependencies.join(', ')}</p>}
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    <fieldset disabled={disabled || action.busy}><label>Review reason for task {item.id}<textarea value={reason} onChange={e => setReason(e.target.value)} /></label>
      {['proposed', 'accepted'].includes(item.status) && <button onClick={() => setEditing(v => !v)}>Revise task {item.id}</button>}
      {editing && <div>{draftVersion !== item.version && <p role="alert">Task changed. Draft preserved. <button onClick={() => setDraftVersion(item.version)}>Keep task draft against latest revision</button></p>}<label>Revised title for task {item.id}<input value={title} onChange={e => setTitle(e.target.value)} /></label><label>Revised rationale for task {item.id}<textarea value={rationale} onChange={e => setRationale(e.target.value)} /></label><label>Revised acceptance checks for task {item.id}<textarea value={checks} onChange={e => setChecks(e.target.value)} /></label><button disabled={draftVersion !== item.version || !title.trim() || !rationale.trim() || !checks.trim()} onClick={() => void action.act(async () => { await rehearsalRequest(base, `/next-steps/${item.id}`, { version: draftVersion, requirement_ids: item.requirement_ids, title, rationale, acceptance_checks: checks.split('\n').filter(Boolean), dependencies: item.dependencies }, 'PATCH'); setEditing(false); reload(); }, 'Task revised. Confirm the new proposal before export.')}>Save task {item.id} revision</button></div>}
      {item.status === 'awaiting_verification' && <fieldset><legend>Evidence reviewed before closing task {item.id}</legend>{evidence.filter(e => item.requirement_ids.includes(e.requirement_id)).map(e => <label key={e.id}><input type="checkbox" checked={selected.includes(e.id)} onChange={event => setSelected(v => event.target.checked ? [...v, e.id] : v.filter(id => id !== e.id))} />Reviewed evidence {e.id}</label>)}</fieldset>}
      {(transitions[item.status] || []).map(status => <button key={status} disabled={!reason.trim() || (status === 'closed' && !selected.length)} onClick={() => void action.act(async () => { await rehearsalRequest(base, `/next-steps/${item.id}/transition`, { version: item.version, status, reason, evidence_ids: status === 'closed' ? selected : [] }); reload(); }, 'Task status recorded. Requirements still need assessment.')}>{status === 'accepted' ? 'Accept' : status === 'closed' ? 'Close after verification review' : status.replaceAll('_', ' ')} task {item.id}</button>)}
    </fieldset>
  </article>;
}

