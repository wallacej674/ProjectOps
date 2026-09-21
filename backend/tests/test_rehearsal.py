"""Release Rehearsal behaviors through the authenticated HTTP interface."""
from uuid import uuid4

from test_releases import BRIEF, REQUIREMENT, create_release


def rehearsal(client):
    base, release = create_release(client)
    path = f"{base}/{release['id']}"
    client.post(path + '/brief/confirm', json={'version': 0})
    requirements = []
    for operation in ('download', 'search'):
        response = client.post(path + '/requirements', json={**REQUIREMENT,
            'title': f'{operation.title()} isolation',
            'criterion': f'Users can only {operation} their own documents.'})
        assert response.status_code == 201, response.text
        row = response.json()
        response = client.post(f"{path}/requirements/{row['id']}/confirm", json={'version': 0})
        assert response.status_code == 200, response.text
        requirements.append(response.json())
    return path + '/rehearsal', requirements


def scope_input(version=0, snapshot='a' * 64):
    return {'version': version, 'source': {'target': 'document-app', 'snapshot': snapshot,
        'files': {'app/documents.py': snapshot}, 'coverage': 'complete'}, 'environment': 'local synthetic test'}


def verification(requirement, outcome='passed'):
    return {'check_id': 'two-account-isolation', 'criterion': requirement['revision']['content']['criterion'],
        'expected': 'Account A sees none of account B documents.', 'command': 'pytest tests/test_isolation.py',
        'executed': outcome != 'not_run', 'outcome': outcome, 'output': 'One test passed.' if outcome == 'passed' else '',
        'not_run_reason': 'Runner unavailable' if outcome == 'not_run' else '', 'tool': 'pytest', 'tool_version': '8.0',
        'started_at': '2026-09-07T12:00:00Z' if outcome != 'not_run' else None,
        'finished_at': '2026-09-07T12:00:01Z' if outcome != 'not_run' else None}


def evidence_input(requirement, scope, outcome='passed'):
    return {'request_key': str(uuid4()), 'requirement_id': requirement['id'],
        'requirement_revision': requirement['revision']['revision'], 'scope_id': scope['id'],
        'kind': 'verification', 'source_id': None, 'verification': verification(requirement, outcome)}


def test_owner_imports_frozen_verification_without_automatically_verifying_requirement(client):
    path, requirements = rehearsal(client)
    assert client.get(path + '/scope').json() is None
    response = client.post(path + '/scope', json=scope_input())
    assert response.status_code == 201, response.text
    scope = response.json()
    assert scope['version'] == 1
    data = evidence_input(requirements[0], scope)
    preview = client.post(path + '/evidence/preview', json=data)
    assert preview.status_code == 200, preview.text
    assert client.get(path + '/evidence').json()['total'] == 0
    response = client.post(path + '/evidence', json=data)
    assert response.status_code == 201, response.text
    evidence = response.json()
    assert evidence['origin'] == 'user_imported'
    assert evidence['payload']['verification']['outcome'] == 'passed'
    assert evidence['digest'] == preview.json()['digest']
    duplicate = client.post(path + '/evidence', json=data)
    assert duplicate.json()['id'] == evidence['id']
    assert client.get(path + '/evidence').json()['total'] == 1
    summary = client.get(path + '/summary').json()
    assert [r['state'] for r in summary['requirements']] == ['not_verified', 'not_verified']
    assert client.post(path + '/scope', json=scope_input()).status_code == 409
    assert client.get(path + '/scope/history').json()['total'] == 1


def assessment_input(requirement, scope, evidence, outcome='supported'):
    return {'requirement_id': requirement['id'], 'requirement_revision': requirement['revision']['revision'],
        'scope_id': scope['id'], 'evidence_ids': [row['id'] for row in evidence], 'outcome': outcome,
        'rationale': 'Reviewed the two-account assertion against the selected requirement.',
        'limitations': ['Local imported report, not independently attested.']}


def test_human_reviews_specific_support_and_changed_scope_preserves_history(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    evidence = client.post(path + '/evidence', json=evidence_input(requirements[0], scope)).json()
    response = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [evidence]))
    assert response.status_code == 201, response.text
    assessment = response.json()
    assert assessment['review_status'] == 'proposed'
    assert client.get(path + '/summary').json()['requirements'][0]['state'] == 'not_verified'
    response = client.post(f"{path}/assessments/{assessment['id']}/review",
        json={'version': 0, 'action': 'accept', 'reason': 'Checked the reported assertion and its local scope.'})
    assert response.status_code == 200, response.text
    summary = client.get(path + '/summary').json()
    assert [r['state'] for r in summary['requirements']] == ['supported', 'not_verified']
    assert client.post(f"{path}/requirements/{requirements[1]['id']}/disposition",
        json={'disposition': 'accepted_risk', 'reason': 'Search unavailable to beta users.'}).status_code == 200
    assert client.get(path + '/summary').json()['requirements'][1]['state'] == 'not_verified'
    changed = client.post(path + '/scope', json=scope_input(version=1, snapshot='b' * 64))
    assert changed.status_code == 201, changed.text
    summary = client.get(path + '/summary').json()
    assert summary['requirements'][0]['state'] == 'stale'
    assert summary['requirements'][0]['outcome'] == 'supported'
    historical = client.get(path + '/assessments').json()['items'][0]
    assert historical['outcome'] == 'supported'
    assert historical['freshness'] == 'stale'


def test_verification_task_requires_reviewed_evidence_to_close(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    response = client.post(path + '/next-steps', json={'requirement_ids': [requirements[1]['id']],
        'title': 'Verify search isolation', 'rationale': 'No search test evidence exists.',
        'acceptance_checks': ['Search as A for B-only text and see no results.'], 'dependencies': []})
    assert response.status_code == 201, response.text
    task = response.json()
    assert task['status'] == 'proposed'
    assert task['priority_rationale']
    task_path = f"{path}/next-steps/{task['id']}/transition"
    task = client.post(task_path, json={'version': 0, 'status': 'accepted', 'reason': 'Ready to verify.'}).json()
    assert task['version'] == 1
    assert client.post(task_path, json={'version': 0, 'status': 'in_progress', 'reason': 'Start.'}).status_code == 409
    assert client.post(task_path, json={'version': 1, 'status': 'closed', 'reason': 'Agent says done.'}).status_code == 422
    evidence = client.post(path + '/evidence', json=evidence_input(requirements[1], scope)).json()
    task = client.post(task_path, json={'version': 1, 'status': 'awaiting_verification', 'reason': 'Returned test report.'}).json()
    closed = client.post(task_path, json={'version': task['version'], 'status': 'closed',
        'reason': 'Reviewed the reported search assertion and result.', 'evidence_ids': [evidence['id']]})
    assert closed.status_code == 200, closed.text
    assert closed.json()['status'] == 'closed'
    assert closed.json()['history'][-1]['evidence_ids'] == [evidence['id']]
    assert client.get(path + '/summary').json()['requirements'][1]['state'] == 'not_verified'


def test_assessment_cannot_treat_unexecuted_irrelevant_or_conflicting_checks_as_support(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    missing = client.post(path + '/evidence', json=evidence_input(requirements[0], scope, 'not_run')).json()
    response = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [missing]))
    assert response.status_code == 422, response.text
    irrelevant = evidence_input(requirements[0], scope)
    irrelevant['verification']['criterion'] = 'The project builds.'
    irrelevant = client.post(path + '/evidence', json=irrelevant).json()
    assert client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [irrelevant])).status_code == 422
    passed = client.post(path + '/evidence', json=evidence_input(requirements[0], scope)).json()
    failed = client.post(path + '/evidence', json=evidence_input(requirements[0], scope, 'failed')).json()
    assert client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [passed])).status_code == 422
    response = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [passed, failed], 'conflicting'))
    assert response.status_code == 201, response.text
    row = response.json()
    assert client.post(f"{path}/assessments/{row['id']}/review", json={'version': 0, 'action': 'accept', 'reason': 'Both reports address the same selected scope.'}).status_code == 200
    assert client.get(path + '/summary').json()['requirements'][0]['state'] == 'conflicting'
    assert client.post(path + '/assessments', json=assessment_input(requirements[1], scope, [passed])).status_code == 422


def test_existing_material_is_selected_by_owned_frozen_revision_and_changes_require_review(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    project_path = path.split('/releases/')[0]
    artifact = client.post(project_path + '/artifacts', json={'title': 'Isolation notes', 'artifact_type': 'evidence',
        'source_type': 'manual', 'summary': 'Verification notes', 'content': 'Search not tested.'}).json()
    release_path = path.removesuffix('/rehearsal')
    linked = client.post(f"{release_path}/requirements/{requirements[0]['id']}/materials",
        json={'version': requirements[0]['version'], 'artifact_id': artifact['id']}).json()
    sources = client.get(path + '/evidence/sources', params={'kind': 'material', 'requirement_id': requirements[0]['id']})
    assert sources.status_code == 200, sources.text
    assert sources.json()['items'] == [{'id': linked['id'], 'title': 'Isolation notes'}]
    data = {**evidence_input(requirements[0], scope), 'kind': 'material', 'source_id': linked['id'], 'verification': None}
    response = client.post(path + '/evidence', json=data)
    assert response.status_code == 201, response.text
    row = response.json()
    assert row['payload']['snapshot']['content'] == 'Search not tested.'
    assert row['origin'] == 'manual_assertion'
    client.patch(f"{project_path}/artifacts/{artifact['id']}", json={'content': 'Changed notes.'})
    assert client.get(path + '/evidence').json()['items'][0]['payload']['snapshot']['content'] == 'Search not tested.'
    assessment = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [row], 'not_verified')).json()
    assert assessment['freshness'] == 'stale'


def test_existing_observations_keep_their_limits_when_selected_as_release_evidence(client, monkeypatch):
    from test_code_risk import sample_report
    from test_health_checks import FakeHttpClient, FakeResponse
    from test_repo_analyses import FakeTreeFetcher
    from app.services.health_checks import health_check_service
    from app.services.repo_analyses import repo_analysis_service
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    project_path = path.split('/releases/')[0]
    target = client.post(project_path + '/code-risk/targets', json={'name': 'Synthetic code'}).json()
    report = sample_report(target['id'])
    report['tools'][0]['outcome'] = 'partial'
    scan = client.post(f"{project_path}/code-risk/targets/{target['id']}/scans/import", json=report).json()
    occurrence = client.get(f"{project_path}/code-risk/scans/{scan['id']}/findings").json()['items'][0]
    monkeypatch.setattr(health_check_service, 'http_client', FakeHttpClient(FakeResponse(200, 'ok')))
    health = client.post(project_path + '/health-checks/run', json={'url': 'https://example.com'}).json()
    readiness = client.post(project_path + '/readiness/evaluate').json()['items'][0]
    client.post(project_path + '/repo', json={'repo_url': 'https://github.com/openai/codex'})
    monkeypatch.setattr(repo_analysis_service, 'tree_fetcher', FakeTreeFetcher())
    analysis = client.post(project_path + '/analyses/run').json()
    for kind, identity, origin in [('scan', occurrence['id'], 'user_imported'), ('health', health['id'], 'projectops_observation'),
                                   ('readiness', readiness['id'], 'projectops_observation'), ('analysis', analysis['id'], 'projectops_observation')]:
        sources = client.get(path + '/evidence/sources', params={'kind': kind, 'requirement_id': requirements[0]['id']})
        assert sources.status_code == 200, sources.text
        assert identity in [row['id'] for row in sources.json()['items']]
        data = {**evidence_input(requirements[0], scope), 'kind': kind, 'source_id': identity, 'verification': None}
        imported = client.post(path + '/evidence', json=data)
        assert imported.status_code == 201, imported.text
        evidence = imported.json()
        assert evidence['origin'] == origin
        assert evidence['limitations']
        assert client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [evidence])).status_code == 422
        if kind == 'scan':
            assert evidence['payload']['tool']['outcome'] == 'partial'
        else:
            assert evidence['payload']['source_snapshot'] is None
            assessed = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [evidence], 'not_verified'))
            assert assessed.status_code == 201, assessed.text
            assert assessed.json()['freshness'] == 'unknown'
    assert client.get(path + '/summary').json()['requirements'][0]['state'] == 'not_verified'
    assert client.delete(project_path + '/repo').status_code == 204
    assert client.get(path + '/evidence').json()['total'] == 4


def test_new_contradictory_evidence_invalidates_old_support_and_unknown_scope_cannot_support(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    evidence = client.post(path + '/evidence', json=evidence_input(requirements[0], scope)).json()
    assessment = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [evidence])).json()
    client.post(f"{path}/assessments/{assessment['id']}/review", json={'version': 0, 'action': 'accept', 'reason': 'Reviewed scoped test.'})
    client.post(path + '/evidence', json=evidence_input(requirements[0], scope, 'failed'))
    summary = client.get(path + '/summary').json()
    assert summary['requirements'][0]['state'] == 'stale'
    assert 'evidence' in ' '.join(summary['requirements'][0]['reasons']).lower()
    assert client.get(path + '/assessments').json()['items'][0]['outcome'] == 'supported'
    unknown = scope_input(version=1)
    unknown['environment'] = None
    unknown_scope = client.post(path + '/scope', json=unknown).json()
    unscoped = client.post(path + '/evidence', json=evidence_input(requirements[1], unknown_scope)).json()
    assert client.post(path + '/assessments', json=assessment_input(requirements[1], unknown_scope, [unscoped])).status_code == 422


def test_revising_next_step_preserves_history_requires_acceptance_and_rejects_cycles(client):
    path, requirements = rehearsal(client)
    data = {'requirement_ids': [requirements[0]['id']], 'title': 'Verify download', 'rationale': 'Missing evidence.',
            'acceptance_checks': ['Two-account test.'], 'dependencies': []}
    first = client.post(path + '/next-steps', json=data).json()
    client.post(f"{path}/next-steps/{first['id']}/transition", json={'version': 0, 'status': 'accepted', 'reason': 'Do this.'})
    changed = {**data, 'version': 1, 'title': 'Verify private document download'}
    response = client.patch(f"{path}/next-steps/{first['id']}", json=changed)
    assert response.status_code == 200, response.text
    revised = response.json()
    assert revised['status'] == 'proposed'
    assert revised['version'] == 2
    assert revised['history'][-1]['content_snapshot']['title'] == 'Verify download'
    assert client.patch(f"{path}/next-steps/{first['id']}", json=changed).status_code == 409
    second = client.post(path + '/next-steps', json={**data, 'dependencies': [first['id']]}).json()
    cyclic = client.patch(f"{path}/next-steps/{first['id']}", json={**changed, 'version': 2, 'dependencies': [second['id']]})
    assert cyclic.status_code == 422, cyclic.text
    assert client.get(path + '/next-steps').json()['total'] == 2


def test_rehearsal_rejects_foreign_archived_conflicting_and_unbounded_mutations(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    data = evidence_input(requirements[0], scope)
    assert client.post(path + '/evidence', json=data).status_code == 201
    changed = {**data, 'verification': {**data['verification'], 'output': 'Different report content.'}}
    assert client.post(path + '/evidence', json=changed).status_code == 409
    other, foreign_requirements = rehearsal(client)
    assert client.post(other + '/evidence', json=data).status_code == 404
    foreign = {**data, 'request_key': str(uuid4()), 'requirement_id': foreign_requirements[0]['id']}
    assert client.post(path + '/evidence', json=foreign).status_code == 404
    assert client.get(path + '/summary', headers={'Authorization': ''}).status_code == 401
    oversized = client.post(path + '/evidence', content=' ' * (256 * 1024 + 1), headers={'Content-Type': 'application/json'})
    assert oversized.status_code == 413
    assert client.post(path + '/scope', content=' ' * (256 * 1024 + 1), headers={'Content-Type': 'application/json'}).status_code == 413
    bad_time = {**data, 'request_key': str(uuid4()), 'verification': {**data['verification'], 'started_at': '2026-09-07T12:00:00'}}
    assert client.post(path + '/evidence', json=bad_time).status_code == 422
    bad_scope = {**scope_input(version=1), 'source': {**scope_input()['source'], 'files': {'../private': 'a' * 64}}}
    assert client.post(path + '/scope', json=bad_scope).status_code == 422
    unknown_scope = scope_input(version=1)
    unknown_scope['environment'] = '   '
    unknown_scope['source']['target'] = '   '
    saved = client.post(path + '/scope', json=unknown_scope).json()
    assert saved['environment'] is None
    assert saved['source']['target'] is None
    project_path = path.split('/releases/')[0]
    assert client.delete(project_path).status_code == 200
    assert client.get(path + '/summary').status_code == 200
    assert client.post(path + '/evidence', json={**data, 'request_key': str(uuid4())}).status_code == 409
    assert client.post(path + '/scope', json=scope_input(version=1)).status_code == 409


def test_task_priority_uses_confirmed_consequences_and_stale_support_remains_unresolved(client):
    path, requirements = rehearsal(client)
    scope = client.post(path + '/scope', json=scope_input()).json()
    evidence = client.post(path + '/evidence', json=evidence_input(requirements[0], scope)).json()
    assessment = client.post(path + '/assessments', json=assessment_input(requirements[0], scope, [evidence])).json()
    client.post(f"{path}/assessments/{assessment['id']}/review", json={'version': 0, 'action': 'accept', 'reason': 'Reviewed check.'})
    task = client.post(path + '/next-steps', json={'requirement_ids': [requirements[0]['id']], 'title': 'Review isolation evidence',
        'rationale': 'Keep release evidence current.', 'acceptance_checks': ['Review scoped test result.'], 'dependencies': []}).json()
    assert task['priority'] == 'high'
    changed = {**REQUIREMENT, 'title': 'Download isolation', 'criterion': requirements[0]['revision']['content']['criterion'],
               'consequence': 'low', 'version': requirements[0]['version']}
    response = client.patch(path.removesuffix('/rehearsal') + f"/requirements/{requirements[0]['id']}", json=changed)
    assert response.status_code == 200, response.text
    current = client.get(path + '/next-steps').json()['items'][0]
    assert current['priority'] == 'high'
    assert 'review' in current['priority_rationale'].lower()
    assert current['priority_rank'] > task['priority_rank']


def test_resaving_identical_scope_cannot_hide_comparable_failed_verification(client):
    path, requirements = rehearsal(client)
    original = client.post(path + '/scope', json=scope_input()).json()
    failed = client.post(path + '/evidence', json=evidence_input(requirements[0], original, 'failed')).json()
    repeated = client.post(path + '/scope', json=scope_input(version=1)).json()
    passed = client.post(path + '/evidence', json=evidence_input(requirements[0], repeated)).json()
    hidden = client.post(path + '/assessments', json=assessment_input(requirements[0], repeated, [passed]))
    assert hidden.status_code == 422, hidden.text
    conflict = client.post(path + '/assessments', json=assessment_input(requirements[0], repeated, [failed, passed], 'conflicting'))
    assert conflict.status_code == 201, conflict.text
