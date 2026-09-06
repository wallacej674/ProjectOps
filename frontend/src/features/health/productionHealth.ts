import type { ProjectHealthSummary } from "../../types/healthCheck";

/** Never attribute a one-time alternative target's result to production. */
export function productionCheck(row?: ProjectHealthSummary) {
  if (!row?.production_url) return null;
  if (row.latest_check?.target_url === row.production_url) return row.latest_check;
  return row.latest_scheduled_check?.target_url === row.production_url ? row.latest_scheduled_check : null;
}
