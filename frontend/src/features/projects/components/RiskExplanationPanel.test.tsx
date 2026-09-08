import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { RiskExplanationPanel } from './RiskExplanationPanel';

const output = { explanation: 'Dynamic input may execute.', impact_prerequisites: ['Untrusted input reaches eval.'],
  uncertainty: ['No source supplied.'], proposed_change: 'Use a constrained parser.', verification_steps: ['Reject executable input.'],
  citations: ['finding'], work_item: { title: 'Replace eval', rationale: 'Avoid dynamic execution.', affected_files: ['app.py'], acceptance_checks: ['Input stays data.'], priority: 'high' } };

test('preview requires explicit consent and suggestions remain editable drafts', async () => {
  const onDraft = vi.fn(); let sent = 0;
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const body = url.endsWith('/explanation-preview') ? { available: true, destination: 'OpenAI API (external)', model: 'test-model', context_digest: 'a'.repeat(64), packet: { evidence: [{ id: 'finding', path: 'app.py' }] } }
      : init?.method === 'POST' ? (sent++, { id: 7, status: 'completed', model: 'test-model', output, packet: {}, context_digest: 'a'.repeat(64) }) : { items: [], total: 0 };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  render(<RiskExplanationPanel projectId="1" occurrenceId={9} onDraft={onDraft} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview AI evidence' }));
  expect(await screen.findByText(/test-model/)).toBeInTheDocument();
  const send = screen.getByRole('button', { name: 'Send to OpenAI' });
  expect(send).toBeDisabled(); expect(sent).toBe(0);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(send);
  expect(await screen.findByText('Dynamic input may execute.')).toBeInTheDocument();
  expect(onDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Use suggestion in work-item draft' }));
  await waitFor(() => expect(onDraft).toHaveBeenCalledWith(output.work_item, 7));
  expect(sent).toBe(1);
  mock.mockRestore();
});
