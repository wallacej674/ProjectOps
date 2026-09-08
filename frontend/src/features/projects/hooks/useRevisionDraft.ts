import { useState } from 'react';

// Keep local edits across reloads. Reusing them against a new revision requires
// an explicit choice so a conflict never silently becomes an overwrite.
export function useRevisionDraft<T>(initial: T, revision: string | number = '') {
  const [draft, setDraft] = useState(initial);
  const [base, setBase] = useState(revision);
  const changed = base !== revision;
  if (changed && JSON.stringify(draft) === JSON.stringify(initial)) setBase(revision);
  return { draft, setDraft, changed: changed && JSON.stringify(draft) !== JSON.stringify(initial),
    keep: () => setBase(revision), discard: () => { setDraft(initial); setBase(revision); } };
}
