import { useState } from 'react';
import { releaseRequest } from '../api/releases';
import { useReleaseWorkspace } from '../hooks/useReleaseWorkspace';
import type { Release } from '../../../types/releases';
import { ReleaseBriefForm } from './ReleaseBriefForm';
import { ReleaseRequirementForm } from './ReleaseRequirementForm';
import { ReleaseRevisionHistory } from './ReleaseRevisionHistory';
import { ReleaseMaterials } from './ReleaseMaterials';
import './releaseReadiness.css';

export function ReleaseReadinessPanel({ projectId, projectArchived = false }: { projectId: string; projectArchived?: boolean }) {
  const state = useReleaseWorkspace(projectId);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const { release } = state;
  const requirement = state.requirements.items.find(r => r.id === selected);
  const disabled = projectArchived || state.busy || state.loading || Boolean(state.error);
  const readOnly = disabled || Boolean(release?.archived);
  const needsBrief = !release?.brief.confirmed_at;
  const base = release ? `/${release.id}` : '';
  return <section className="panel release-readiness" aria-labelledby="release-title">
    <div className="eyebrow">Release Readiness</div><h2 id="release-title">Define what ready means</h2>
    <p>Agree on your release scope and requirements, then collect material to verify them. Confirmation records intent; evidence assessment comes next.</p>
    {state.loading && <p role="status">Loading release workspace…</p>}
    {state.error && <div role="alert">{state.error}<button className="button" onClick={state.reload}>Reload saved records</button></div>}
    {state.notice && <p role="status">{state.notice}</p>}
    {projectArchived && <p>This Project is archived. Its release history is available to read.</p>}
    <div className="release-toolbar"><label>Release<select value={release?.id || ''} disabled={state.busy} onChange={e => { if (e.target.value) { state.choose(Number(e.target.value)); setSelected(null); setAdding(false); setCreating(false); } }}><option value="">Choose a release</option>{release && !state.releases.items.some(r => r.id === release.id) && <option value={release.id}>{release.name}</option>}{state.releases.items.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_active ? ' · active' : ''}{r.archived ? ' · archived' : ''}</option>)}</select></label>
      <button className="button" disabled={disabled} onClick={() => setCreating(v => !v)}>{creating ? 'Cancel new release' : 'New release'}</button>
      <button className="button" disabled={!state.offset} onClick={() => state.setOffset(v => Math.max(0, v - 25))}>Newer releases</button><button className="button" disabled={state.offset + 25 >= state.releases.total} onClick={() => state.setOffset(v => v + 25)}>Older releases</button>
    </div>
    {creating && <ReleaseBriefForm create disabled={disabled} submitLabel="Create release brief" onSave={(brief, name) => void state.act(async () => { const created = await releaseRequest<Release>(projectId, '', { name, brief }); setCreating(false); setAdding(false); setSelected(null); state.choose(created.id); }, 'Release created as the active release. Review and confirm its brief.')} />}
    {!release && !creating && !state.loading && <p>Create a release to define its audience, critical journey, and unacceptable failure outcomes.</p>}
    {release && <>
      <header className="release-summary"><h3>{release.name}</h3><p>{release.brief.content.stage.replaceAll('_', ' ')} · brief revision {release.brief.revision} · {release.brief.confirmed_at ? 'Confirmed scope' : 'Draft scope'}{release.archived ? ' · archived' : ''}</p>
        <p>{release.brief.content.goal}</p><dl>{Object.entries(release.brief.content).filter(([key]) => !['goal', 'stage'].includes(key)).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value || 'Not specified'}</dd></div>)}</dl>
      </header>
      <div className="release-toolbar">
        {needsBrief && <button className="button" disabled={readOnly} onClick={() => void state.act(async () => { await releaseRequest(projectId, `${base}/brief/confirm`, { version: release.version }); }, 'Brief confirmed. You can now define requirements.')}>Confirm saved brief</button>}
        {!release.is_active && <button className="button" disabled={readOnly} onClick={() => void state.act(async () => { await releaseRequest(projectId, `${base}/activate`, { version: release.version }); }, 'Active release updated.')}>Make active release</button>}
        {!release.archived && <button className="button" disabled={readOnly} onClick={() => void state.act(async () => { await releaseRequest(projectId, `${base}/archive`, { version: release.version }); }, 'Release archived. Its history is preserved.')}>Archive release</button>}
      </div>
      {!release.archived && <details><summary>Edit release brief</summary><p>Saving creates a draft revision. Requirements must be reviewed against the new scope.</p><ReleaseBriefForm key={release.id} revision={release.brief.revision} initial={release.brief.content} disabled={readOnly} submitLabel="Save brief revision" onSave={brief => void state.act(async () => { await releaseRequest(projectId, `${base}/brief`, { version: release.version, brief }); }, 'New brief revision saved. Confirm it after review.')} /></details>}
      <ReleaseRevisionHistory key={`brief:${release.id}:${release.version}`} projectId={projectId} path={`${base}/brief/history`} title="Brief revision history" />
      <h3>Release requirements</h3><p>All requirements are not yet verified. Adding supporting material does not change that status.</p>
      {needsBrief && <p>Confirm the saved brief before adding or revising requirements.</p>}
      <button className="button" disabled={readOnly || needsBrief} onClick={() => { setAdding(v => !v); setSelected(null); }}>{adding ? 'Cancel requirement' : 'Add requirement'}</button>
      {adding && <ReleaseRequirementForm key={`new:${release.id}`} revision={release.brief.revision} disabled={readOnly || needsBrief} onSave={draft => void state.act(async () => { await releaseRequest(projectId, `${base}/requirements`, { ...draft, brief_revision: release.brief.revision }); setAdding(false); state.setRequirementOffset(0); }, 'Requirement saved as a proposal. Confirm it after review.')} />}
      <div className="release-grid"><div className="release-requirements">{state.requirements.items.map(r => <button className="release-requirement" key={r.id} aria-pressed={selected === r.id} onClick={() => { setSelected(r.id); setAdding(false); }}><strong>{r.revision.content.title}</strong><span>{r.state} · {r.revision.content.applicability.replaceAll('_', ' ')} · not verified</span>{r.needs_review && <span>Release scope changed: review required</span>}</button>)}{state.requirements.total === 0 && <p>No requirements defined yet.</p>}</div>
        {requirement && <aside className="release-detail" key={`${release.id}:${requirement.id}`}><h4>{requirement.revision.content.title}</h4><p>{requirement.revision.content.criterion}</p><p><strong>Verification:</strong> {requirement.revision.content.verification_method}</p>
          <p>Requirement revision {requirement.revision.revision} · {requirement.state} · not verified</p>
          {requirement.needs_review && <p>The release scope changed. Review the criterion and save a new revision before confirming.</p>}
          {requirement.state === 'proposed' && <button className="button" disabled={readOnly || needsBrief || requirement.needs_review} onClick={() => void state.act(async () => { await releaseRequest(projectId, `${base}/requirements/${requirement.id}/confirm`, { version: requirement.version }); }, 'Requirement confirmed. Verification is still outstanding.')}>Confirm saved requirement</button>}
          <details><summary>Revise requirement</summary><ReleaseRequirementForm key={requirement.id} revision={`${requirement.revision.revision}:${release.brief.revision}`} initial={requirement.revision.content} disabled={readOnly || needsBrief} onSave={draft => void state.act(async () => { await releaseRequest(projectId, `${base}/requirements/${requirement.id}`, { ...draft, version: requirement.version, brief_revision: release.brief.revision }, 'PATCH'); }, 'Requirement revision saved for confirmation.')} /></details>
          <ReleaseRevisionHistory key={`req:${requirement.id}:${requirement.version}`} projectId={projectId} path={`${base}/requirements/${requirement.id}/history`} title="Requirement revision history" />
          <ReleaseMaterials projectId={projectId} path={`${base}/requirements/${requirement.id}`} version={requirement.version} disabled={readOnly || needsBrief || requirement.needs_review} onLinked={state.reload} />
        </aside>}
      </div>
      <button className="button" disabled={!state.requirementOffset} onClick={() => { setSelected(null); state.setRequirementOffset(v => Math.max(0, v - 25)); }}>Previous requirements</button><button className="button" disabled={state.requirementOffset + 25 >= state.requirements.total} onClick={() => { setSelected(null); state.setRequirementOffset(v => v + 25); }}>Next requirements</button>
    </>}
  </section>;
}
