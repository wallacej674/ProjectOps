import { useState } from 'react';
import type { RehearsalPanelProps } from '../../../types/rehearsal';
import { parseImport, rehearsalRequest } from '../api/rehearsal';
import { useRehearsalAction } from '../hooks/useRehearsalAction';

export function RehearsalScopePanel({ base, summary, disabled, reload }: RehearsalPanelProps) {
  const { scope } = summary;
  const [target, setTarget] = useState(scope?.source.target || '');
  const [snapshot, setSnapshot] = useState(scope?.source.snapshot || '');
  const [environment, setEnvironment] = useState(scope?.environment || '');
  const [files, setFiles] = useState(JSON.stringify(scope?.source.files || {}, null, 2));
  const [coverage, setCoverage] = useState<'partial' | 'complete'>(scope?.source.coverage || 'partial');
  const [draftVersion, setDraftVersion] = useState(scope?.version || 0);
  const action = useRehearsalAction();
  const changed = draftVersion !== (scope?.version || 0);
  return <section aria-label="Assessment scope"><h4>Assessment scope</h4>
    <p>Describe the code and environment this evidence concerns. Unknown dependencies require conservative review when scope changes.</p>
    {scope && <p>Saved scope {scope.id} · version {scope.version} · {scope.source.snapshot || 'Source unknown'} · {scope.environment || 'Environment unknown'}</p>}
    {action.error && <p role="alert">{action.error}</p>}{action.notice && <p role="status">{action.notice}</p>}
    {changed && <p role="alert">Saved scope changed. Your draft is preserved. <button type="button" onClick={() => setDraftVersion(scope?.version || 0)}>Keep draft against latest scope</button></p>}
    <form onSubmit={e => { e.preventDefault(); void action.act(async () => {
      const saved = await rehearsalRequest<{ version: number }>(base, '/scope', { version: draftVersion, source: { target: target || null, snapshot: snapshot || null, files: parseImport(files), coverage }, environment: environment || null });
      setDraftVersion(saved.version); reload();
    }, 'Assessment scope saved. Review earlier evidence for changes.'); }}>
      <fieldset disabled={disabled || action.busy || changed}>
        <label>Source target<input value={target} onChange={e => setTarget(e.target.value)} placeholder="Document application" /></label>
        <label>Source snapshot<input value={snapshot} onChange={e => setSnapshot(e.target.value)} placeholder="Commit or declared source identity" /></label>
        <label>Verification environment<input value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="Local synthetic accounts" /></label>
        <details><summary>File identity and change scope</summary><label>File digests JSON<textarea value={files} onChange={e => setFiles(e.target.value)} /></label><label>File coverage<select value={coverage} onChange={e => setCoverage(e.target.value as 'partial' | 'complete')}><option value="partial">Partial or unknown</option><option value="complete">Complete inventory</option></select></label><p>Map relative paths to SHA-256 digests. A supplied digest is a claim about identity, not proof of execution.</p></details>
        <button className="button">Save assessment scope</button>
      </fieldset>
    </form>
  </section>;
}
