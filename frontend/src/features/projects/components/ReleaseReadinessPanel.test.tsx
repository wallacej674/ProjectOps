import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { ReleaseReadinessPanel } from './ReleaseReadinessPanel';

test('developer creates a release brief and confirms its saved scope without AI', async () => {
  let release: unknown = null;
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === 'POST' && url.endsWith('/releases')) {
      const data = JSON.parse(String(init.body));
      release = { id: 1, name: data.name, version: 0, is_active: true, archived: false,
        brief: { revision: 1, content: data.brief, confirmed_at: null } };
      return new Response(JSON.stringify(release));
    }
    if (url.endsWith('/brief/confirm')) {
      release = { ...release as object, version: 1, brief: { ...(release as { brief: object }).brief, confirmed_at: '2026-09-07T00:00:00Z' } };
      return new Response(JSON.stringify(release));
    }
    if (url.includes('/brief/history')) return new Response(JSON.stringify({ items: [{ ...(release as { brief: object }).brief, created_at: '2026-09-07T00:00:00Z' }], total: 1 }));
    const body = url.endsWith('/active') || url.endsWith('/releases/1') ? release
      : url.includes('/requirements') || url.includes('/releases?') ? { items: [], total: 0 } : [];
    return new Response(JSON.stringify(body));
  });
  render(<MemoryRouter><ReleaseReadinessPanel projectId="1" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'New release' }));
  for (const [label, value] of Object.entries({ 'Release name': 'Document beta', 'Release goal': 'Invite testers', 'Intended users': 'Ten testers', 'Critical user journey': 'Upload and find documents', 'Data handled': 'Private documents', 'Unacceptable failure outcomes': 'Cross-user access' })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Create release brief' }));
  await screen.findByRole('button', { name: 'Confirm saved brief' });
  fireEvent.click(screen.getByText('Brief revision history'));
  fireEvent.click(screen.getByRole('button', { name: 'Load revision history' }));
  expect(await screen.findByText(/Revision 1 .* Draft/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm saved brief' }));
  expect(await screen.findByText('Brief confirmed. You can now define requirements.')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add requirement' })).toBeEnabled());
  fireEvent.click(screen.getByText('Brief revision history'));
  fireEvent.click(screen.getByRole('button', { name: 'Load revision history' }));
  expect(await screen.findByText(/Revision 1 .* Confirmed/)).toBeInTheDocument();
  mock.mockRestore();
});
