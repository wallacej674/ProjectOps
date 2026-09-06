import "./healthMonitoring.css";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { usePolledResource } from "../../hooks/usePolledResource";
import { listCrossProjectHealth } from "./api/crossProjectHealth";
import { productionCheck } from "./productionHealth";
import { HealthProjectDetail } from "./HealthProjectDetail";

export function HealthMonitoringPage() {
  const { data: summaries, error, refresh } = usePolledResource(listCrossProjectHealth);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const rows = summaries?.filter(row => {
    const matchesFilter = filter === "active" ? !!row.monitor?.active_alert : filter === "overdue" ? row.monitor?.freshness === "overdue" : true;
    return matchesFilter && `${row.project_name} ${row.production_url ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  }) ?? [];
  const selected = rows.find(row => String(row.project_id) === params.get("project")) ?? rows[0];

  return <AppShell><section className="content health-overview" aria-labelledby="health-monitoring-title">
    <div className="page-head"><div><div className="eyebrow">Cross-Project Monitoring</div>
      <h1 id="health-monitoring-title">Health Monitoring</h1>
      <p>Select a project to inspect its health, scheduled alerts, and recent checks.</p>
    </div><button className="button" onClick={() => void refresh()}>Refresh health</button></div>
    {error && <p role="alert">Health Monitoring could not refresh. Displayed data may be stale. {error}</p>}
    {!summaries ? <p aria-live="polite">{error ? "Health status unavailable." : "Loading health monitoring..."}</p> : !summaries.length ? <p>No projects yet.</p> : <>
      <div className="health-counts" aria-label="Health monitoring summary">
        <span>Projects <strong>{summaries.length}</strong></span>
        <span>Active alerts <strong>{summaries.filter(row => row.monitor?.active_alert).length}</strong></span>
        <span>Monitoring overdue <strong>{summaries.filter(row => row.monitor?.freshness === "overdue").length}</strong></span>
        <span>No target <strong>{summaries.filter(row => !row.production_url).length}</strong></span>
      </div>
      <div className="health-inbox">
        <aside className="health-projects" aria-label="Project selector">
          <div className="health-project-filters">
            <label htmlFor="health-search">Find a project</label>
            <input className="control" id="health-search" type="search" placeholder="Search projects or URLs" value={search} onChange={event => setSearch(event.target.value)} />
            <label htmlFor="health-filter">Show health</label>
            <select className="control" id="health-filter" value={filter} onChange={event => setFilter(event.target.value)}>
              <option value="all">All Projects</option><option value="active">Active alerts</option><option value="overdue">Monitoring overdue</option>
            </select>
          </div>
          {!rows.length && <p className="health-list-empty">No Projects match this filter.</p>}
          <ol className="health-project-list" aria-label="Project health status">{rows.map(row => {
            const check = productionCheck(row);
            const status = row.monitor?.active_alert ? "Active alert" : row.monitor?.freshness === "overdue" ? "Monitoring overdue" : check?.status ?? (row.production_url ? "Not checked yet" : "No target");
            return <li key={row.project_id}><button className="health-project-choice" aria-current={selected?.project_id === row.project_id ? "true" : undefined} aria-controls="health-project-detail" onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.set("project", String(row.project_id)); return next; })}>
              <strong>{row.project_name}</strong>
              <span className="health-project-target">{row.production_url ?? "No production URL configured"}</span>
              <span className={`health-list-status ${status === "healthy" ? "is-healthy" : ""}`}>{status}</span>
            </button></li>;
          })}</ol>
        </aside>
        {selected ? <HealthProjectDetail key={selected.project_id} row={selected} onRefresh={() => void refresh()} /> : <div className="health-inspector-empty">Choose another filter to find a project.</div>}
      </div>
    </>}
  </section></AppShell>;
}
