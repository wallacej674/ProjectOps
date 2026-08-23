import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "../../api/projects";
import { listActivity } from "../projects/api/projectActivity";

export interface OverviewStats {
  activeCount: number;
  recentProjectCount: number;
  activityEventCount: number;
  needsSetupCount: number;
}

/** Cross-project counts shown in the sidebar "At a glance" block and reused by the Overview page. */
export function useOverviewStats() {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [projects, events] = await Promise.all([projectsApi.list(true), listActivity({ limit: 25 })]);
      const active = projects.filter((project) => project.status !== "archived");
      setStats({
        activeCount: active.length,
        recentProjectCount: new Set(events.map((event) => event.project_id)).size,
        activityEventCount: events.length,
        needsSetupCount: active.filter((project) => !project.repo_url || !project.production_url).length,
      });
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, refresh };
}
