import { useCallback, useEffect, useState } from 'react';
import type { RehearsalSummary } from '../../../types/rehearsal';
import { rehearsalRequest } from '../api/rehearsal';
import { RehearsalScopePanel } from './RehearsalScopePanel';
import { RehearsalEvidencePanel } from './RehearsalEvidencePanel';
import { RehearsalAssessmentPanel } from './RehearsalAssessmentPanel';
import { RehearsalStepsPanel } from './RehearsalStepsPanel';
import { RehearsalWorkflowPanel } from './RehearsalWorkflowPanel';
import { RehearsalHandoffPanel } from './RehearsalHandoffPanel';
import { RehearsalDecisionPanel } from './RehearsalDecisionPanel';
import './rehearsal.css';

export function RehearsalWorkspace({ projectId, releaseId, readOnly }: { projectId: string; releaseId: number; readOnly: boolean }) {
  const base = `/api/v1/projects/${projectId}/releases/${releaseId}/rehearsal`;
  const [summary, setSummary] = useState<RehearsalSummary | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh(v => v + 1), []);
  useEffect(() => { let active = true; rehearsalRequest<RehearsalSummary>(base, '/summary').then(result => { if (active) { setSummary(result); setError(''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [base, refresh]);
  return <section className="rehearsal-workspace" aria-label="Release rehearsal"><h3>Release rehearsal</h3><p>Review supplied evidence, choose verification work, and record what this release still needs.</p>
    {error && <p role="alert">{error} <button onClick={reload}>Reload rehearsal</button></p>}
    {!summary && !error && <p role="status">Loading rehearsal…</p>}
    {summary && <>
      <RehearsalScopePanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
      <RehearsalEvidencePanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
      <RehearsalAssessmentPanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
      <RehearsalWorkflowPanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
      <RehearsalStepsPanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
      <RehearsalHandoffPanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
      <RehearsalDecisionPanel base={base} summary={summary} disabled={readOnly || Boolean(error)} reload={reload} />
    </>}
  </section>;
}
