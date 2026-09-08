import { useState } from 'react';
import { useRevisionDraft } from '../hooks/useRevisionDraft';
import type { ReleaseBrief } from '../../../types/releases';

const blank: ReleaseBrief = { goal: '', stage: 'private_beta', audience: '', critical_journey: '', data_handled: '', failure_outcomes: '', constraints: '', exclusions: '' };
const fields = [ ['goal', 'Release goal'], ['audience', 'Intended users'], ['critical_journey', 'Critical user journey'], ['data_handled', 'Data handled'], ['failure_outcomes', 'Unacceptable failure outcomes'], ['constraints', 'Constraints'], ['exclusions', 'Excluded scope'] ] as const;

export function ReleaseBriefForm({ initial, disabled, submitLabel, onSave, revision = '', create = false }: {
  revision?: string | number; initial?: ReleaseBrief; disabled: boolean; submitLabel: string; create?: boolean; onSave: (brief: ReleaseBrief, name: string) => void;
}) {
  const { draft, setDraft, changed, keep, discard } = useRevisionDraft(initial || blank, revision);
  const [name, setName] = useState('');
  return <form className="release-form" onSubmit={e => { e.preventDefault(); if (!changed) onSave(draft, name); }}>
    <fieldset disabled={disabled}>
      {changed && <p role="alert">The saved scope changed. Your draft is preserved. Review the saved scope above, then choose:<button type="button" onClick={keep}>Keep draft against latest scope</button><button type="button" onClick={discard}>Discard draft and load saved scope</button></p>}
      {create && <label>Release name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="Document-sharing private beta" /></label>}
      <label>Release stage<select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value as ReleaseBrief['stage'] })}>{['prototype', 'private_beta', 'public_beta', 'production'].map(stage => <option key={stage} value={stage}>{stage.replaceAll('_', ' ')}</option>)}</select></label>
      {fields.map(([key, label]) => <label key={key}>{label}<textarea maxLength={2000} required={!['constraints', 'exclusions'].includes(key)} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      <button className="button" type="submit" disabled={changed}>{submitLabel}</button>
    </fieldset>
  </form>;
}
