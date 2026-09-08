import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ReleaseBriefForm } from './ReleaseBriefForm';
import { ReleaseRequirementForm } from './ReleaseRequirementForm';
import type { ReleaseBrief, RequirementContent } from '../../../types/releases';

test('brief draft survives a newer saved revision and requires reconciliation', () => {
  const initial: ReleaseBrief = { goal: 'Original', stage: 'private_beta', audience: 'Testers', critical_journey: 'Search', data_handled: 'Documents', failure_outcomes: 'Exposure', constraints: '', exclusions: '' };
  const save = vi.fn();
  const { rerender } = render(<ReleaseBriefForm initial={initial} revision={1} disabled={false} submitLabel="Save" onSave={save} />);
  fireEvent.change(screen.getByLabelText('Release goal'), { target: { value: 'My unsaved goal' } });
  rerender(<ReleaseBriefForm initial={{ ...initial, goal: 'Another session' }} revision={2} disabled={false} submitLabel="Save" onSave={save} />);
  expect(screen.getByLabelText('Release goal')).toHaveValue('My unsaved goal');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft against latest scope' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ goal: 'My unsaved goal' }), '');
});

test('requirement draft survives a scope change and can explicitly load the saved record', () => {
  const initial: RequirementContent = { title: 'Isolate documents', criterion: 'Only owners can search', verification_method: 'Two account test', consequence: 'high', applicability: 'applicable', applicability_reason: '' };
  const save = vi.fn();
  const { rerender } = render(<ReleaseRequirementForm initial={initial} revision="1:1" disabled={false} onSave={save} />);
  fireEvent.change(screen.getByLabelText('What must be true?'), { target: { value: 'Unsaved criterion' } });
  rerender(<ReleaseRequirementForm initial={initial} revision="1:2" disabled={false} onSave={save} />);
  expect(screen.getByLabelText('What must be true?')).toHaveValue('Unsaved criterion');
  expect(screen.getByRole('button', { name: 'Save requirement revision' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft and load saved requirement' }));
  expect(screen.getByLabelText('What must be true?')).toHaveValue(initial.criterion);
  expect(screen.getByRole('button', { name: 'Save requirement revision' })).toBeEnabled();
});
