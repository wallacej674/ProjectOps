import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { releaseRequest } from '../api/releases';
import type { Release, ReleaseRequirement, ReleasePage } from '../../../types/releases';

export function useReleaseWorkspace(projectId: string) {
  const [params, setParams] = useSearchParams();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const selectedId = params.get('release');
  const [releases, setReleases] = useState<ReleasePage<Release>>({ items: [], total: 0 });
  const [release, setRelease] = useState<Release | null>(null);
  const [requirements, setRequirements] = useState<ReleasePage<ReleaseRequirement>>({ items: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [requirementOffset, setRequirementOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([releaseRequest<ReleasePage<Release>>(projectId, `?offset=${offset}`),
      releaseRequest<Release | null>(projectId, selectedId ? `/${selectedId}` : '/active')])
      .then(async ([items, selected]) => {
        const reqs = selected ? await releaseRequest<ReleasePage<ReleaseRequirement>>(projectId, `/${selected.id}/requirements?offset=${requirementOffset}`) : { items: [], total: 0 };
        if (active) { setReleases(items); setRelease(selected); setRequirements(reqs); }
      }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Release workspace could not load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, selectedId, offset, requirementOffset, refresh]);

  const reload = useCallback(() => setRefresh(v => v + 1), []);
  function choose(id: number) {
    if (!mounted.current) return;
    const next = new URLSearchParams(params); next.set('view', 'release'); next.set('release', String(id));
    setRelease(null); setRequirements({ items: [], total: 0 }); setRequirementOffset(0); setParams(next);
  }
  async function act(operation: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); if (mounted.current) { setNotice(message); reload(); } }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Change could not be saved.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return { releases, release, requirements, offset, setOffset, requirementOffset, setRequirementOffset,
    loading, busy, error, notice, reload, choose, act };
}
