import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { useReleaseLanding } from './useReleaseLanding';
import { projectWorkspaceLocation } from '../utils/projectWorkspace';

function Landing() { useReleaseLanding('1'); return <p>{useLocation().search || 'overview'}</p>; }
afterEach(() => vi.restoreAllMocks());
test('a Project with an active release opens its release workspace by default', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 12 })));
  render(<MemoryRouter><Landing /></MemoryRouter>);
  expect(await screen.findByText('?view=release&release=12')).toBeInTheDocument();
});
test('explicit and legacy navigation retain their existing destinations', () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  render(<MemoryRouter initialEntries={['/?view=repository']}><Landing /></MemoryRouter>);
  expect(screen.getByText('?view=repository')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  expect(projectWorkspaceLocation('', '#readiness').view).toBe('launch');
  expect(projectWorkspaceLocation('?view=release', '').view).toBe('release');
});
