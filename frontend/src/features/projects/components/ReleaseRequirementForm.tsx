import { useRevisionDraft } from '../hooks/useRevisionDraft';
import type { RequirementContent } from '../../../types/releases';

const blank: RequirementContent = { title: '', criterion: '', verification_method: '', consequence: 'high', applicability: 'applicable', applicability_reason: '' };
export function ReleaseRequirementForm({ initial, disabled, onSave, revision = '' }: { revision?: string | number; initial?: RequirementContent; disabled: boolean; onSave: (draft: RequirementContent) => void }) {
  const { draft, setDraft, changed, keep, discard } = useRevisionDraft(initial || blank, revision);
  return <form className="release-form" onSubmit={e => { e.preventDefault(); if (!changed) onSave(draft); }}><fieldset disabled={disabled}>
    {changed && <p role="alert">The saved requirement or release scope changed. Your draft is preserved. Review the saved records, then choose:<button type="button" onClick={keep}>Keep draft against latest scope</button><button type="button" onClick={discard}>Discard draft and load saved requirement</button></p>}
    <label>Requirement title<input required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <label>What must be true?<textarea required maxLength={2000} value={draft.criterion} onChange={e => setDraft({ ...draft, criterion: e.target.value })} /></label>
    <label>How will you verify it?<textarea required maxLength={2000} value={draft.verification_method} onChange={e => setDraft({ ...draft, verification_method: e.target.value })} /></label>
    <label>Consequence of failure<select value={draft.consequence} onChange={e => setDraft({ ...draft, consequence: e.target.value as RequirementContent['consequence'] })}>{['high', 'medium', 'low'].map(v => <option key={v}>{v}</option>)}</select></label>
    <label>Applicability<select value={draft.applicability} onChange={e => setDraft({ ...draft, applicability: e.target.value as RequirementContent['applicability'] })}>{['applicable', 'not_applicable', 'undecided'].map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></label>
    <label>Applicability reason<textarea maxLength={2000} required={draft.applicability === 'not_applicable'} value={draft.applicability_reason} onChange={e => setDraft({ ...draft, applicability_reason: e.target.value })} /></label>
    <button className="button" disabled={changed}>{initial ? 'Save requirement revision' : 'Save proposed requirement'}</button>
  </fieldset></form>;
}
