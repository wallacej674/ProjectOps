import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { riskRequest } from '../api/codeRisk';
import type { Page, RiskTarget, RiskScan, RiskOccurrence, RiskWorkItem } from '../../../types/codeRisk';
import './codeRisk.css';
import { RiskExplanationPanel } from './RiskExplanationPanel';

const empty = <T,>(): Page<T> => ({ items: [], total: 0 });
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The operation failed.';

export function CodeRiskReviewPanel({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const [targets, setTargets] = useState<RiskTarget[]>([]);
  const [target, setTarget] = useState<number>(0);
  const [name, setName] = useState('');
  const [scans, setScans] = useState<Page<RiskScan>>(empty);
  const [scan, setScan] = useState<RiskScan | null>(null);
  const [findings, setFindings] = useState<Page<RiskOccurrence>>(empty);
  const [selected, setSelected] = useState<RiskOccurrence | null>(null);
  const [work, setWork] = useState<Page<RiskWorkItem>>(empty);
  const [offset, setOffset] = useState(0);
  const [scanOffset, setScanOffset] = useState(0);
  const [workOffset, setWorkOffset] = useState(0);
  const [baseline, setBaseline] = useState('');
  const [severity, setSeverity] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [disposition, setDisposition] = useState('acknowledged');
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState('');
  const [checks, setChecks] = useState('');
  const [rationale, setRationale] = useState('');
  const [priority, setPriority] = useState('medium');
  const [explanationId, setExplanationId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [findingError, setFindingError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const requestedScan = params.get('scan');
  const requestedFinding = params.get('finding');
  const selectedId = selected?.id;
  const selectedRule = selected?.evidence.rule_id;
  const selectedMessage = selected?.evidence.message;
  const selectedSeverity = selected?.evidence.severity;

  useEffect(() => {
    setExplanationId(null);
    setTitle(selectedRule ? `Review ${selectedRule}` : '');
    setRationale(selectedMessage || ''); setChecks(''); setReason('');
    setPriority(selectedSeverity === 'critical' || selectedSeverity === 'high' ? selectedSeverity : 'medium');
  }, [selectedId, selectedRule, selectedMessage, selectedSeverity]);


  useEffect(() => {
    let active = true;
    riskRequest<RiskTarget[]>(projectId, '/targets').then(items => {
      if (active) { setTargets(items); setTarget(current => current || items.find(t => !t.archived)?.id || 0); }
    }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!requestedScan) { setScan(null); return; }
    let active = true;
    setScan(null); setSelected(null); setFindings(empty());
    riskRequest<RiskScan>(projectId, `/scans/${requestedScan}`).then(item => {
      if (active) { setScan(item); setTarget(item.target_id); }
    }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [projectId, requestedScan]);

  useEffect(() => {
    if (!target) return;
    let active = true;
    riskRequest<Page<RiskScan>>(projectId, `/targets/${target}/scans?offset=${scanOffset}`).then(items => {
      if (active) setScans(items);
    }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [projectId, target, scanOffset, refresh]);

  useEffect(() => {
    if (!scan) return;
    let active = true;
    setFindingError('');
    const path = baseline ? `/scans/${scan.id}/comparison?baseline_id=${baseline}&offset=${offset}`
      : `/scans/${scan.id}/findings?offset=${offset}${severity ? `&severity=${severity}` : ''}${reviewFilter ? `&disposition=${reviewFilter}` : ''}`;
    riskRequest<Page<RiskOccurrence>>(projectId, path).then(items => {
      if (active) { setFindings(items); setSelected(current => items.items.find(i => String(i.finding_id) === requestedFinding) ?? (current && items.items.find(i => i.id === current.id)) ?? null); }
    }).catch(e => { if (active) setFindingError(`Could not refresh findings. Displayed evidence may be stale. ${errorText(e)}`); });
    return () => { active = false; };
  }, [projectId, scan, baseline, offset, severity, reviewFilter, refresh, requestedFinding]);

  useEffect(() => {
    let active = true;
    riskRequest<Page<RiskWorkItem>>(projectId, `/work-items?offset=${workOffset}`).then(items => { if (active) setWork(items); })
      .catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [projectId, refresh, workOffset]);

  const act = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setRefresh(v => v + 1); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }, []);

  function chooseScan(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set('scan', id); else next.delete('scan');
    next.delete('finding'); setParams(next); setOffset(0); setBaseline('');
  }

  function inspect(item: RiskOccurrence) {
    setSelected(item);
    const next = new URLSearchParams(params); next.set('finding', String(item.finding_id)); setParams(next);
  }

  async function importFile(file: File) {
    if (file.size > 10 * 1024 * 1024) throw new Error('Report exceeds 10 MiB.');
    const raw = await file.text();
    let report: unknown;
    try { report = JSON.parse(raw); } catch { throw new Error('Choose a valid JSON scan report.'); }
    const imported = await riskRequest<RiskScan>(projectId, `/targets/${target}/scans/import`, report);
    chooseScan(String(imported.id)); setNotice('Scan imported. Review coverage before interpreting findings.');
  }

  return <section className="panel code-risk" aria-labelledby="risk-title">
    <header><div className="eyebrow">Local evidence · Human review</div><h2 id="risk-title">Code Risk Review</h2>
      <p>Inspect source and dependency risks, decide what to work on, and compare scans. No deployment required.</p></header>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="risk-toolbar" onSubmit={e => { e.preventDefault(); void act(async () => {
      const item = await riskRequest<RiskTarget>(projectId, '/targets', { name });
      setTargets(items => [...items, item]); setTarget(item.id); setName(''); chooseScan('');
    }); }}>
      <label>Scan target name<input value={name} onChange={e => setName(e.target.value)} maxLength={200} required /></label>
      <button className="button" disabled={busy || !name.trim()}>Create scan target</button>
    </form>
    <label>Scan target<select value={target} onChange={e => { setTarget(Number(e.target.value)); setScanOffset(0); setScans(empty()); chooseScan(''); }}>
      <option value={0}>Choose a target</option>{targets.map(t => <option key={t.id} value={t.id}>{t.name}{t.archived ? ' (archived)' : ''}</option>)}
    </select></label>
    {target > 0 && <>
      <details open><summary>Run a local scan</summary><p>From the repository root, use the local Python environment. OSV queries advisory data using dependency identities. Source code stays local.</p>
        <pre><code>{`backend/.venv/Scripts/python.exe backend/scripts/scan_code_risks.py PATH_TO_REPOSITORY --target-id ${target} --output scan-report.json`}</code></pre>
        <label>Import scan report<input type="file" accept=".json,application/json" disabled={busy || targets.find(t => t.id === target)?.archived}
          onChange={e => { const file = e.target.files?.[0]; if (file) void act(() => importFile(file)); e.target.value = ''; }} /></label>
      </details>
      <div className="risk-toolbar"><label>Scan history<select value={requestedScan || ''} onChange={e => chooseScan(e.target.value)}>
        <option value="">Choose a scan</option>{scans.items.map(s => <option value={s.id} key={s.id}>Scan {s.id} · {s.outcome} · {new Date(s.report.finished_at).toLocaleString()}</option>)}
      </select></label><button className="button" disabled={scanOffset === 0} onClick={() => setScanOffset(v => Math.max(0, v - 25))}>Newer scans</button>
      <button className="button" disabled={scanOffset + 25 >= scans.total} onClick={() => setScanOffset(v => v + 25)}>Older scans</button></div>
    </>}
    {scan && <>
      <h3>Scan {scan.id}: {scan.outcome}</h3><p className="meta">User-supplied report · Snapshot {scan.report.snapshot_hash.slice(0, 12)} · {new Date(scan.report.finished_at).toLocaleString()}</p>
      <div className="risk-coverage">{scan.report.tools.map(t => <div key={t.name}><strong>{t.name} {t.version}: {t.outcome}</strong><p>{t.covered_files.length} files assessed</p>{t.errors.map((e, i) => <p key={i}>{e}</p>)}</div>)}</div>
      <p>{scan.report.exclusions.length} recorded exclusions. A scan with no findings is not a production-safety certification.</p>
      <button className="button" disabled={busy} onClick={() => void act(async () => { const artifact = await riskRequest<{ id: number }>(projectId, `/scans/${scan.id}/evidence-artifact`, {}); setNotice(`Evidence artifact ${artifact.id} is available in Artifacts. Link it through the readiness checklist.`); })}>Save evidence reference</button>
      <div className="risk-toolbar"><label>Compare with scan ID<input value={baseline} onChange={e => { setBaseline(e.target.value.replace(/\D/g, '')); setOffset(0); }} inputMode="numeric" placeholder="Optional baseline" /></label>
        {!baseline && <label>Severity<select value={severity} onChange={e => { setSeverity(e.target.value); setOffset(0); }}><option value="">All severities</option>{['critical', 'high', 'medium', 'low', 'info', 'unknown'].map(s => <option key={s}>{s}</option>)}</select></label>}
        {!baseline && <label>Review status<select value={reviewFilter} onChange={e => { setReviewFilter(e.target.value); setOffset(0); }}><option value="">All review states</option>{['unreviewed', 'acknowledged', 'accepted_risk', 'false_positive'].map(d => <option key={d} value={d}>{d.replaceAll('_', ' ')}</option>)}</select></label>}
      </div>
      {findingError && <p role="alert">{findingError}</p>}
      <p role="status">{findings.total} findings{baseline ? ' in comparison' : ''}</p>
      <div className="risk-layout"><div>{findings.items.map(item => <button className="risk-finding" key={item.id} onClick={() => inspect(item)} aria-pressed={selected?.id === item.id}>
        <strong>{item.evidence.severity.toUpperCase()} · {item.evidence.rule_id}</strong><span>{item.evidence.path}{item.evidence.line ? `:${item.evidence.line}` : ''}</span>
        <span>{item.change?.replaceAll('_', ' ') || item.disposition.replaceAll('_', ' ')}{item.needs_review ? ' · evidence changed: re-review' : ''}</span>
      </button>)}{findings.total === 0 && <p>No findings in this view. Check tool coverage above.</p>}</div>
      {selected && <aside className="risk-detail" aria-label="Finding detail"><h3>{selected.evidence.rule_id}</h3><p>{selected.evidence.message}</p>
        <p>{selected.evidence.path}{selected.evidence.line ? `:${selected.evidence.line}` : ''}</p>
        {selected.evidence.package && <p>{selected.evidence.package} {selected.evidence.versions?.join(', ') || selected.evidence.version}</p>}
        {selected.evidence.advisory_url && <a href={selected.evidence.advisory_url} target="_blank" rel="noreferrer">Read advisory</a>}
        {selected.evidence.snippet && <pre>{selected.evidence.snippet}</pre>}
        <p>Scanner finding; exploitability has not been established.</p>
        <form onSubmit={e => { e.preventDefault(); void act(async () => { await riskRequest(projectId, `/findings/${selected.finding_id}/review`, { version: selected.review_version, disposition, reason, occurrence_id: selected.id }, 'PATCH'); setNotice('Review decision saved.'); }); }}>
          <label>Review decision<select value={disposition} onChange={e => setDisposition(e.target.value)}>{['acknowledged', 'false_positive', 'accepted_risk', 'unreviewed'].map(d => <option key={d} value={d}>{d.replaceAll('_', ' ')}</option>)}</select></label>
          <label>Review reason<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} required={['false_positive', 'accepted_risk'].includes(disposition)} /></label>
          <button className="button" disabled={busy}>Save review</button>
        </form>
        <details><summary>Review history</summary>{selected.review_history.map((r, i) => <p key={i}>{r.disposition.replaceAll('_', ' ')} · {r.reason} · {new Date(r.at).toLocaleString()}</p>)}</details>
        <RiskExplanationPanel key={`${projectId}:${selected.id}`} projectId={projectId} occurrenceId={selected.id} onDraft={(draft, id) => { setTitle(draft.title); setRationale(draft.rationale); setChecks(draft.acceptance_checks.join("\n")); setPriority(draft.priority); setExplanationId(id); setNotice("AI suggestion copied into the editable work-item draft. Review before accepting."); }} />
        <form onSubmit={e => { e.preventDefault(); void act(async () => {
          await riskRequest(projectId, '/work-items', { title, rationale, affected_files: [selected.evidence.path], finding_ids: [selected.finding_id], acceptance_checks: checks.split('\n').filter(c => c.trim()), priority, explanation_id: explanationId });
          setNotice('Work item accepted and saved.');
        }); }}><h4>Create a work item</h4><label>Work item title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label>
          <label>Rationale<textarea value={rationale} onChange={e => setRationale(e.target.value)} maxLength={4000} required /></label>
          <label>Acceptance checks (one per line)<textarea value={checks} onChange={e => setChecks(e.target.value)} maxLength={10000} required /></label>
          <label>Work item priority<select value={priority} onChange={e => setPriority(e.target.value)}>{["critical", "high", "medium", "low"].map(p => <option key={p}>{p}</option>)}</select></label>
          <button className="button" disabled={busy}>Accept work item</button>
        </form>
      </aside>}</div>
      <div className="risk-toolbar"><button className="button" disabled={!offset} onClick={() => setOffset(v => Math.max(0, v - 25))}>Previous findings</button><button className="button" disabled={offset + 25 >= findings.total} onClick={() => setOffset(v => v + 25)}>Next findings</button></div>
    </>}
    <h3>Accepted work items</h3><p>Done is a human decision. Use a compatible rescan to check whether the finding is still detected.</p>
    {work.items.map(item => <article key={item.id} className="risk-work"><strong>{item.title}</strong><p>{item.rationale}</p><ul>{item.acceptance_checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <label>Status for {item.title}<select value={item.status} disabled={busy} onChange={e => void act(async () => { await riskRequest(projectId, `/work-items/${item.id}`, { version: item.version, status: e.target.value }, 'PATCH'); })}>{['todo', 'in_progress', 'done'].map(s => <option value={s} key={s}>{s.replaceAll('_', ' ')}</option>)}</select></label>
    </article>)}
    {work.total === 0 && <p>No work items accepted yet.</p>}
    <div className="risk-toolbar"><button className="button" disabled={!workOffset} onClick={() => setWorkOffset(v => Math.max(0, v - 25))}>Newer work items</button><button className="button" disabled={workOffset + 25 >= work.total} onClick={() => setWorkOffset(v => v + 25)}>Older work items</button></div>
  </section>;
}
