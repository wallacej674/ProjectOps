import { useEffect, useState } from 'react';
import type { Page } from '../../../types/rehearsal';
import { rehearsalRequest } from '../api/rehearsal';

export function useRehearsalRecords<T>(base: string, path: string, revision: unknown) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true;
    async function load() {
      const all: T[] = []; let offset = 0;
      while (true) {
        const result = await rehearsalRequest<Page<T>>(base, `${path}${path.includes('?') ? '&' : '?'}offset=${offset}`);
        all.push(...result.items); offset += result.items.length;
        if (!result.items.length || offset >= result.total) break;
      }
      if (active) { setItems(all); setError(''); }
    }
    void load().catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [base, path, revision, retry]);
  return { items, error, retry: () => setRetry(v => v + 1) };
}
