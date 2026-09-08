import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { CodeRiskReviewPanel } from './CodeRiskReviewPanel';

test('owner creates a local target without repository or production setup', async () => {
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const body = url.endsWith('/targets') ? (init?.method === 'POST' ? { id: 5, name: 'Working tree', archived: false } : []) : { items: [], total: 0 };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  render(<MemoryRouter><CodeRiskReviewPanel projectId="1" /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Scan target name'), { target: { value: 'Working tree' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create scan target' }));
  expect(await screen.findByText(/--target-id 5/)).toBeInTheDocument();
  expect(screen.getByLabelText('Import scan report')).toBeInTheDocument();
  mock.mockRestore();
});


test('owner reviews a finding and accepts a work item while AI is unavailable', async () => {
  const occurrence = { id: 9, finding_id: 4, scan_id: 2, disposition: 'unreviewed', review_version: 0, review_history: [],
    evidence: { tool: 'semgrep', rule_id: 'python-eval', path: 'app.py', line: 3, severity: 'high', raw_severity: 'ERROR', message: 'Review dynamic evaluation.', snippet: '' } };
  const scan = { id: 2, target_id: 5, outcome: 'partial', imported_at: '2026-09-07T00:00:00Z', report: { snapshot_hash: 'a'.repeat(64), finished_at: '2026-09-07T00:00:00Z', exclusions: [], tools: [{ name: 'osv', version: '2.2.2', profile: 'v1', outcome: 'unavailable', covered_files: [], errors: ['No resolved inventory.'] }] } };
  let created = false;
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    let body: unknown = { items: [], total: 0 };
    if (url.endsWith('/targets')) body = [{ id: 5, name: 'Source', archived: false }];
    else if (url.endsWith('/scans/2')) body = scan;
    else if (url.includes('/scans?')) body = { items: [scan], total: 1 };
    else if (url.includes('/findings?')) body = { items: [occurrence], total: 1 };
    else if (url.endsWith('/review')) { occurrence.review_version++; occurrence.disposition = 'acknowledged'; body = occurrence; }
    else if (url.endsWith('/work-items') && init?.method === 'POST') { created = true; body = { id: 1 }; }
    return new Response(JSON.stringify(body), { status: 200 });
  });
  render(<MemoryRouter initialEntries={['/?view=repository&section=risks&scan=2']}><CodeRiskReviewPanel projectId="1" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /HIGH.*python-eval/ }));
  expect(screen.getByText('No resolved inventory.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save review' }));
  expect(await screen.findByText('Review decision saved.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Acceptance checks (one per line)'), { target: { value: 'Untrusted input cannot execute code.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept work item' }));
  expect(await screen.findByText('Work item accepted and saved.')).toBeInTheDocument();
  expect(created).toBe(true);
  mock.mockRestore();
});

import { Link } from 'react-router-dom';

test('URL navigation resets the work draft to the selected occurrence', async () => {
  const items = [4, 5].map(id => ({ id, finding_id: id, scan_id: 2, disposition: 'unreviewed', review_version: 0, review_history: [],
    evidence: { tool: 'semgrep', rule_id: `rule-${id}`, path: 'app.py', line: id, severity: 'high', raw_severity: 'ERROR', message: `Finding ${id}`, snippet: '' } }));
  const scan = { id: 2, target_id: 1, outcome: 'completed', report: { snapshot_hash: 'a'.repeat(64), finished_at: '2026-09-07T00:00:00Z', exclusions: [], tools: [] } };
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    const body = url.endsWith('/scans/2') ? scan : url.includes('/findings?') ? { items, total: 2 } : url.endsWith('/targets') ? [] : { items: [], total: 0 };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  render(<MemoryRouter initialEntries={['/?scan=2&finding=4']}><Link to="/?scan=2&finding=5">Open second finding</Link><CodeRiskReviewPanel projectId="1" /></MemoryRouter>);
  const input = await screen.findByLabelText('Work item title');
  fireEvent.change(input, { target: { value: 'Draft belonging to first finding' } });
  fireEvent.click(screen.getByRole('link', { name: 'Open second finding' }));
  await screen.findByRole('heading', { name: 'rule-5' });
  expect(screen.getByLabelText('Work item title')).toHaveValue('Review rule-5');
  mock.mockRestore();
});
