import { useEffect, useRef, useState } from 'react';

export function useRehearsalAction() {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function act(operation: () => Promise<void>, message = '') {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); if (mounted.current) setNotice(message); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Operation failed. Your draft is preserved.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return { busy, error, notice, act };
}
