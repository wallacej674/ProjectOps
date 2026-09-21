import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { RehearsalWorkspace } from './RehearsalWorkspace';
import { RehearsalEvidencePanel } from './RehearsalEvidencePanel';
import { RehearsalAssessmentPanel } from './RehearsalAssessmentPanel';
import { RehearsalStepsPanel } from './RehearsalStepsPanel';
import { RehearsalWorkflowPanel } from './RehearsalWorkflowPanel';
import { RehearsalHandoffPanel } from './RehearsalHandoffPanel';
import { RehearsalDecisionPanel } from './RehearsalDecisionPanel';
import type { RehearsalSummary } from '../../../types/rehearsal';

const summary: RehearsalSummary = { scope: { id: 1, version: 1, source: { target: null, snapshot: 'abc', files: {}, coverage: 'partial' }, environment: 'local' }, requirements: [{ id: 4, title: 'Download isolation', requirement_revision: 1, criterion: 'Only owners download', verification_method: 'Two accounts', consequence: 'high', applicability: 'applicable', state: 'not_verified', outcome: 'not_verified', freshness: 'unknown', reasons: [], assessment_id: null, disposition: 'open' }], next_steps: [], limitations: [] };

afterEach(() => vi.restoreAllMocks());

test('comparison explains the changed requirement without requiring JSON inspection', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(JSON.stringify(String(input).includes('/comparison') ? { scope_changed: true, changes: [{ requirement_id: 4, before: { ...summary.requirements[0], state: 'supported' }, after: { ...summary.requirements[0], state: 'stale', reasons: ['Source changed.'] } }], limitations: ['Supplied evidence only.'] } : { items: [], total: 0 })));
  render(<RehearsalDecisionPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare release evidence' }));
  expect(await screen.findByText('Download isolation: supported → stale')).toBeInTheDocument();
});

test('returned verification becomes visible in saved evidence after the workspace refreshes', async () => {
  let imported = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ items: imported ? [{ id: 2, requirement_id: 4, requirement_revision: 1, scope_id: 1, kind: 'verification', origin: 'user_imported', limitations: [], payload: {} }] : [], total: imported ? 1 : 0 })));
  const { rerender } = render(<RehearsalEvidencePanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  await screen.findByText('No saved evidence in this page.');
  imported = true;
  rerender(<RehearsalEvidencePanel base="/rehearsal" summary={{ ...summary }} disabled={false} reload={() => {}} />);
  expect(await screen.findByText(/Evidence 2 · verification/)).toBeInTheDocument();
});

test('a result that cannot be imported stays blocked while the draft remains editable', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(JSON.stringify(new URL(String(input)).pathname.endsWith('/preview') ? { digest: 'blocked-result', can_import: false, stale_reasons: [], warnings: ['Packet requires a new review.'] } : { items: [], total: 0 })));
  render(<RehearsalHandoffPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.change(screen.getByLabelText('Agent result JSON'), { target: { value: '{"packet_id":2}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview agent result' }));
  expect(await screen.findByRole('button', { name: 'Import reviewed agent result' })).toBeDisabled();
  expect(screen.getByLabelText('Agent result JSON')).toHaveValue('{"packet_id":2}');
  fireEvent.change(screen.getByLabelText('Agent result JSON'), { target: { value: '{"packet_id":3}' } });
  expect(screen.queryByRole('button', { name: 'Import reviewed agent result' })).not.toBeInTheDocument();
});

test('accepted task can be revised with optimistic version before preparing a new packet', async () => {
  const updates: unknown[] = [];
  const task = { id: 3, version: 2, status: 'accepted', title: 'Check download', rationale: 'Prevent exposure', requirement_ids: [4], acceptance_checks: ['Use two accounts'], dependencies: [] };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (init?.method === 'PATCH') updates.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(String(input).includes('/next-steps') ? { items: [task], total: 1 } : { items: [], total: 0 }));
  });
  render(<RehearsalStepsPanel base="/rehearsal" summary={{ ...summary, next_steps: [task] }} disabled={false} reload={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Revise task 3' }));
  fireEvent.change(screen.getByLabelText('Revised title for task 3'), { target: { value: 'Check download and preview access' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save task 3 revision' }));
  await screen.findByText('Task revised. Confirm the new proposal before export.');
  expect(updates[0]).toMatchObject({ version: 2, title: 'Check download and preview access', requirement_ids: [4] });
});

test('developer chooses a named saved source instead of guessing record IDs', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(JSON.stringify(String(input).includes('/sources?') ? { items: [{ id: 13, title: 'Frozen isolation specification' }], total: 1 } : { items: [], total: 0 })));
  render(<RehearsalEvidencePanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.change(screen.getByLabelText('Evidence requirement'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Evidence kind'), { target: { value: 'material' } });
  await screen.findByRole('option', { name: 'Frozen isolation specification' });
  fireEvent.change(screen.getByLabelText('Saved evidence source'), { target: { value: '13' } });
  expect(screen.getByRole('button', { name: 'Preview evidence' })).toBeEnabled();
});

test('archived release exposes readable evidence and disables rehearsal mutations', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(JSON.stringify(new URL(String(input)).pathname.endsWith('/summary') ? summary : { items: [], total: 0 })));
  render(<RehearsalWorkspace projectId="1" releaseId={2} readOnly />);
  expect(await screen.findByRole('button', { name: 'Preview evidence' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Preview AI gap review' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Preview release decision' })).toBeDisabled();
  expect(screen.getByText(/not verified · evidence/)).toBeInTheDocument();
});

test('human release decision freezes the reviewed summary digest', async () => {
  const writes: Record<string, unknown>[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (init?.method) writes.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(new URL(String(input)).pathname.endsWith('/preview') ? { digest: 'decision-scope', manifest: { requirements: [{ title: 'Download isolation', state: 'not_verified' }] } } : { items: [], total: 0 }));
  });
  render(<RehearsalDecisionPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview release decision' }));
  await screen.findByText('Decision preview digest: decision-scope');
  fireEvent.change(screen.getByLabelText('Release decision'), { target: { value: 'defer' } });
  fireEvent.change(screen.getByLabelText('Release decision reason'), { target: { value: 'Need search isolation evidence' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record reviewed release decision' }));
  await screen.findByText('Release decision recorded against the reviewed evidence.');
  expect(writes[0]).toMatchObject({ digest: 'decision-scope', decision: 'defer', reason: 'Need search isolation evidence' });
});

test('agent result import carries the reviewed digest and remains separate from assessment', async () => {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method) writes.push({ path, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(path.endsWith('/preview') ? { digest: 'reviewed-result', can_import: true, stale_reasons: [], claims: { outcome: 'completed' }, limitations: [] } : { items: [], total: 0 }));
  });
  render(<RehearsalHandoffPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.change(screen.getByLabelText('Agent result JSON'), { target: { value: JSON.stringify({ request_key: 'test', packet_id: 2, packet_digest: 'packet', outcome: 'completed', summary: 'Reported pass', scope_id: 1, checks: [], limitations: [] }) } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview agent result' }));
  await screen.findByText('Review digest: reviewed-result');
  fireEvent.click(screen.getByRole('button', { name: 'Import reviewed agent result' }));
  await screen.findByText('Agent result imported. Reassess requirements against the returned evidence.');
  expect(writes[1].body.preview_digest).toBe('reviewed-result');
});

test('AI starts only with the displayed preview digest and explicit consent', async () => {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method) writes.push({ path, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(path.endsWith('/preview') ? { digest: 'exact-preview', manifest: { destination: 'OpenAI', requirements: [4] }, available: true, limits: { max_calls: 1 } } : init?.method ? { id: 9, status: 'queued' } : { items: [], total: 0 }));
  });
  render(<RehearsalWorkflowPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.click(screen.getByLabelText('Review Download isolation with AI'));
  fireEvent.click(screen.getByRole('button', { name: 'Preview AI gap review' }));
  await screen.findByText(/exact-preview/);
  expect(writes).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Send this preview to AI' }));
  await screen.findByText('AI review queued. Results remain proposals.');
  expect(writes[1].body).toMatchObject({ digest: 'exact-preview', requirement_ids: [4], evidence_ids: [], consent: true });
});

test('verification task needs explicit acceptance checks before proposal', async () => {
  const writes: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    if (init?.method) writes.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ items: [], total: 0 }));
  });
  render(<RehearsalStepsPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.click(screen.getByLabelText('Task for Download isolation'));
  fireEvent.change(screen.getByLabelText('Verification task title'), { target: { value: 'Check second account download' } });
  fireEvent.change(screen.getByLabelText('Why this check matters'), { target: { value: 'Account disclosure has high consequence' } });
  fireEvent.change(screen.getByLabelText('Acceptance checks (one per line)'), { target: { value: 'Two accounts cannot access each other’s files' } });
  fireEvent.click(screen.getByRole('button', { name: 'Propose verification task' }));
  await screen.findByText('Verification task proposed. Accept it before export.');
  expect(writes).toContainEqual({ requirement_ids: [4], title: 'Check second account download', rationale: 'Account disclosure has high consequence', acceptance_checks: ['Two accounts cannot access each other’s files'], dependencies: [] });
});

test('developer selects an explicit source and environment before collecting release evidence', async () => {
  const writes: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    if (init?.method === 'POST') writes.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(path.endsWith('/summary') ? { scope: null, requirements: [], next_steps: [], limitations: [] } : path.endsWith('/scope') && init?.method ? { id: 1, version: 1 } : { items: [], total: 0 }));
  });
  render(<RehearsalWorkspace projectId="1" releaseId={2} readOnly={false} />);
  fireEvent.change(await screen.findByLabelText('Source snapshot'), { target: { value: 'commit-123' } });
  fireEvent.change(screen.getByLabelText('Verification environment'), { target: { value: 'local synthetic accounts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save assessment scope' }));
  await screen.findByText('Assessment scope saved. Review earlier evidence for changes.');
  expect(writes).toContainEqual({ version: 0, source: { target: null, snapshot: 'commit-123', files: {}, coverage: 'partial' }, environment: 'local synthetic accounts' });
});

test('manual assessment is a proposal with selected evidence and explicit review', async () => {
  const writes: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (init?.method) writes.push(JSON.parse(String(init.body)));
    const items = String(input).includes('/evidence') ? [{ id: 8, requirement_id: 4, kind: 'verification', origin: 'user_imported', limitations: [] }] : [];
    return new Response(JSON.stringify({ items, total: items.length }));
  });
  render(<RehearsalAssessmentPanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.change(screen.getByLabelText('Assess requirement'), { target: { value: '4' } });
  fireEvent.click(await screen.findByLabelText(/Use evidence 8/));
  fireEvent.change(screen.getByLabelText('Assessment outcome'), { target: { value: 'supported' } });
  fireEvent.change(screen.getByLabelText('Assessment rationale'), { target: { value: 'Reported two-account download check passed in local scope.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save proposed assessment' }));
  await screen.findByText('Assessment proposed. Review it before adoption.');
  expect(writes).toContainEqual({ requirement_id: 4, requirement_revision: 1, scope_id: 1, evidence_ids: [8], outcome: 'supported', rationale: 'Reported two-account download check passed in local scope.', limitations: [] });
});

test('evidence is previewed before import and never claims verification by attachment', async () => {
  const writes: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (init?.method) writes.push(new URL(String(input)).pathname);
    return new Response(JSON.stringify(String(input).endsWith('/preview') ? { digest: 'abc', evidence: { origin: 'user_imported' }, limitations: ['Reported result has not been independently observed.'] } : { items: [], total: 0 }));
  });
  render(<RehearsalEvidencePanel base="/rehearsal" summary={summary} disabled={false} reload={() => {}} />);
  fireEvent.change(screen.getByLabelText('Evidence requirement'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview evidence' }));
  await screen.findByText('Reported result has not been independently observed.');
  expect(writes).toEqual(['/rehearsal/evidence/preview']);
  fireEvent.click(screen.getByRole('button', { name: 'Import reviewed evidence' }));
  await screen.findByText('Evidence imported. Requirement assessment is still separate.');
  expect(writes).toEqual(['/rehearsal/evidence/preview', '/rehearsal/evidence']);
});




