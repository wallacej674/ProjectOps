import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { releaseRequest } from '../api/releases';
import type { Release } from '../../../types/releases';

export function useReleaseLanding(projectId: string) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!projectId || location.search || location.hash) return;
    let active = true;
    releaseRequest<Release | null>(projectId, '/active').then(release => {
      if (active && release && typeof release.id === 'number') navigate(`?view=release&release=${release.id}`, { replace: true });
    }).catch(() => { /* The existing overview remains usable if release lookup fails. */ });
    return () => { active = false; };
  }, [projectId, location.search, location.hash, navigate]);
}
