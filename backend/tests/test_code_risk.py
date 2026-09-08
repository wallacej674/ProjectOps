from uuid import uuid4


def test_owner_creates_target_and_imports_scan_without_repository(client):
    project = client.post('/api/v1/projects', json={'name': 'Local review'}).json()
    base = f"/api/v1/projects/{project['id']}/code-risk"
    response = client.post(base + '/targets', json={'name': 'Working tree'})
    assert response.status_code == 201
    target = response.json()
    report = sample_report(target['id'])
    imported = client.post(f"{base}/targets/{target['id']}/scans/import", json=report)
    assert imported.status_code == 201, imported.text
    scan = imported.json()
    assert scan['outcome'] == 'completed'
    repeated = client.post(f"{base}/targets/{target['id']}/scans/import", json=report)
    assert repeated.json()['id'] == scan['id']
    findings = client.get(f"{base}/scans/{scan['id']}/findings").json()
    assert findings['total'] == 1
    assert findings['items'][0]['evidence']['rule_id'] == 'python-eval'
    assert findings['items'][0]['disposition'] == 'unreviewed'


def sample_report(target_id, **updates):
    report = {
        'schema_version': 1, 'run_id': str(uuid4()), 'target_id': target_id,
        'snapshot_hash': 'a' * 64, 'started_at': '2026-09-07T00:00:00Z',
        'finished_at': '2026-09-07T00:01:00Z',
        'files': {'app.py': 'b' * 64}, 'exclusions': [],
        'tools': [{'name': 'semgrep', 'version': '1.0', 'profile': 'rules-v1',
                   'outcome': 'completed', 'covered_files': ['app.py'], 'errors': []}],
        'findings': [{'tool': 'semgrep', 'rule_id': 'python-eval', 'path': 'app.py',
                      'line': 3, 'severity': 'high', 'raw_severity': 'ERROR',
                      'message': 'Review use of eval.', 'anchor': 'eval(user_input)',
                      'snippet': ''}],
    }
    return report | updates

def setup_scan(client):
    project = client.post('/api/v1/projects', json={'name': 'Risk Project'}).json()
    base = f"/api/v1/projects/{project['id']}/code-risk"
    target = client.post(base + '/targets', json={'name': 'Source'}).json()
    report = sample_report(target['id'])
    scan = client.post(f"{base}/targets/{target['id']}/scans/import", json=report).json()
    occurrence = client.get(f"{base}/scans/{scan['id']}/findings").json()['items'][0]
    return base, target, report, scan, occurrence


def test_review_preserves_evidence_and_rejects_stale_edits(client):
    base, target, report, scan, occurrence = setup_scan(client)
    path = f"{base}/findings/{occurrence['finding_id']}/review"
    result = client.patch(path, json={'version': 0, 'disposition': 'false_positive', 'reason': 'Input is constant.', 'occurrence_id': occurrence['id']})
    assert result.status_code == 200
    assert result.json()['review_version'] == 1
    assert client.patch(path, json={'version': 0, 'disposition': 'acknowledged', 'reason': '', 'occurrence_id': occurrence['id']}).status_code == 409
    history = client.get(f"{base}/findings/{occurrence['finding_id']}").json()
    assert history['review_history'][0]['reason'] == 'Input is constant.'
    assert history['occurrences']['total'] == 1


def test_comparison_does_not_clear_failed_or_uncovered_findings(client):
    base, target, report, scan, occurrence = setup_scan(client)
    report['run_id'] = str(uuid4())
    report['findings'] = []
    report['tools'][0]['outcome'] = 'failed'
    newer = client.post(f"{base}/targets/{target['id']}/scans/import", json=report).json()
    compare = client.get(f"{base}/scans/{newer['id']}/comparison?baseline_id={scan['id']}")
    assert compare.status_code == 200
    assert compare.json()['items'][0]['change'] == 'not_assessed'
    report['run_id'] = str(uuid4())
    report['tools'][0]['outcome'] = 'completed'
    newer = client.post(f"{base}/targets/{target['id']}/scans/import", json=report).json()
    assert client.get(f"{base}/scans/{newer['id']}/comparison?baseline_id={scan['id']}").json()['items'][0]['change'] == 'not_detected'


def test_work_item_and_evidence_are_human_actions_not_scan_success(client):
    base, target, report, scan, occurrence = setup_scan(client)
    data = {'title': 'Replace dynamic evaluation', 'rationale': 'Avoid execution of input.',
            'finding_ids': [occurrence['finding_id']], 'affected_files': ['app.py'],
            'acceptance_checks': ['Untrusted input is rejected without evaluation.'], 'priority': 'high'}
    result = client.post(base + '/work-items', json=data)
    assert result.status_code == 201, result.text
    item = result.json()
    assert item['status'] == 'todo'
    assert client.patch(f"{base}/work-items/{item['id']}", json={'version': 0, 'status': 'done'}).status_code == 200
    assert client.patch(f"{base}/work-items/{item['id']}", json={'version': 0, 'status': 'todo'}).status_code == 409
    artifact = client.post(f"{base}/scans/{scan['id']}/evidence-artifact")
    assert artifact.status_code == 200
    assert client.post(f"{base}/scans/{scan['id']}/evidence-artifact").json()['id'] == artifact.json()['id']
    assert client.get(base + '/work-items').json()['items'][0]['status'] == 'done'

import pytest

@pytest.mark.parametrize('corruption', ['path', 'target', 'duplicate', 'run_id', 'coverage'])
def test_import_rejects_invalid_reports_without_partial_history(client, corruption):
    base, target, report, scan, occurrence = setup_scan(client)
    report['run_id'] = str(uuid4())
    if corruption == 'path': report['findings'][0]['path'] = '../app.py'
    if corruption == 'target': report['target_id'] += 9
    if corruption == 'duplicate': report['findings'] *= 2
    if corruption == 'run_id': report['run_id'] = scan['report']['run_id']; report['snapshot_hash'] = 'c' * 64
    if corruption == 'coverage': report['tools'][0]['covered_files'] = []
    result = client.post(f"{base}/targets/{target['id']}/scans/import", json=report)
    assert result.status_code in (409, 422)
    assert client.get(f"{base}/targets/{target['id']}/scans").json()['total'] == 1


def test_new_evidence_requires_rereview_and_severity_filter_works(client):
    base, target, report, scan, occurrence = setup_scan(client)
    client.patch(f"{base}/findings/{occurrence['finding_id']}/review", json={'version': 0, 'disposition': 'false_positive', 'reason': 'Reviewed input.', 'occurrence_id': occurrence['id']})
    report['run_id'] = str(uuid4())
    report['findings'][0]['message'] = 'New contextual evidence requires another review.'
    changed = client.post(f"{base}/targets/{target['id']}/scans/import", json=report).json()
    result = client.get(f"{base}/scans/{changed['id']}/findings").json()
    assert result['items'][0]['needs_review'] is True
    assert client.get(f"{base}/scans/{changed['id']}/findings?severity=low").json()['total'] == 0


def test_foreign_account_cannot_read_or_mutate_risk_evidence(client):
    from app.main import app
    from app.dependencies import get_current_user
    from app.models.user import User
    base, target, report, scan, occurrence = setup_scan(client)
    app.dependency_overrides[get_current_user] = lambda: User(id=999999, email='other@example.com', status='active')
    try:
        for path in ['/targets', f"/scans/{scan['id']}", f"/scans/{scan['id']}/findings", f"/findings/{occurrence['finding_id']}", '/work-items']:
            assert client.get(base + path).status_code == 404
        assert client.post(f"{base}/targets/{target['id']}/scans/import", json=report).status_code == 404
        assert client.patch(f"{base}/findings/{occurrence['finding_id']}/review", json={'version': 0, 'disposition': 'acknowledged', 'reason': '', 'occurrence_id': occurrence['id']}).status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_archived_target_preserves_history_but_rejects_imports(client):
    base, target, report, scan, occurrence = setup_scan(client)
    assert client.patch(f"{base}/targets/{target['id']}", json={'name': 'Source', 'archived': True}).status_code == 200
    report['run_id'] = str(uuid4())
    assert client.post(f"{base}/targets/{target['id']}/scans/import", json=report).status_code == 409
    assert client.get(f"{base}/scans/{scan['id']}").status_code == 200


def test_scan_import_records_activity_once(client):
    base, target, report, scan, occurrence = setup_scan(client)
    client.post(f"{base}/targets/{target['id']}/scans/import", json=report)
    project_base = base.removesuffix('/code-risk')
    events = client.get(project_base + '/activity?event_type=code_risk_scan_imported').json()
    assert len(events) == 1
    assert events[0]['related_resource_id'] == scan['id']
