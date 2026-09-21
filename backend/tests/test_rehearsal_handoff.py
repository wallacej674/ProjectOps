"""The portable assignment and returned evidence loop uses owned release interfaces."""
from uuid import uuid4

from test_rehearsal import rehearsal, scope_input, verification


def prepared_task(client):
    path, requirements = rehearsal(client)
    response = client.post(path + '/scope', json=scope_input())
    assert response.status_code == 201, response.text
    scope = response.json()
    response = client.post(path + '/next-steps', json={
        'requirement_ids': [requirements[1]['id']], 'title': 'Verify search isolation',
        'rationale': 'No search test is supplied.',
        'acceptance_checks': ['Account A cannot find Account B documents.'], 'dependencies': [],
    })
    assert response.status_code == 201, response.text
    task = response.json()
    response = client.post(f"{path}/next-steps/{task['id']}/transition",
                           json={'version': task['version'], 'status': 'accepted', 'reason': 'Investigate before beta.'})
    assert response.status_code == 200, response.text
    return path, requirements, scope, response.json()


def test_accepted_task_exports_matching_json_and_markdown_without_verifying_it(client):
    path, requirements, scope, task = prepared_task(client)
    response = client.post(path + '/packets', json={
        'next_step_id': task['id'], 'version': task['version'], 'evidence_ids': [],
    })
    assert response.status_code == 201, response.text
    packet = response.json()
    assert packet['manifest']['next_step']['title'] == 'Verify search isolation'
    assert packet['manifest']['scope']['id'] == scope['id']
    assert packet['manifest']['requirements'][0]['id'] == requirements[1]['id']
    assert 'Account A cannot find Account B documents.' in packet['markdown']
    assert packet['manifest']['return_schema']['properties']['schema_version']['const'] == 1
    assert packet['digest'] in packet['markdown']
    assert client.get(f"{path}/packets/{packet['id']}").json()['digest'] == packet['digest']
    assert client.get(path + '/summary').json()['requirements'][1]['state'] == 'not_verified'


def test_release_decision_freezes_unknowns_and_rejects_an_outdated_preview(client):
    path, _ = rehearsal(client)
    client.post(path + '/scope', json=scope_input())
    response = client.get(path + '/decisions/preview')
    assert response.status_code == 200, response.text
    preview = response.json()
    data = {'request_key': str(uuid4()), 'digest': preview['digest'], 'decision': 'defer',
            'reason': 'Isolation evidence is still missing.'}
    saved = client.post(path + '/decisions', json=data)
    assert saved.status_code == 201, saved.text
    frozen = saved.json()
    assert [row['state'] for row in frozen['manifest']['summary']['requirements']] == ['not_verified', 'not_verified']
    client.post(path + '/scope', json=scope_input(version=1, snapshot='b' * 64))
    retry = client.post(path + '/decisions', json=data)
    assert retry.json()['id'] == frozen['id']
    assert client.post(path + '/decisions', json={**data, 'request_key': str(uuid4())}).status_code == 409
    history = client.get(path + '/decisions').json()['items']
    assert history[0]['manifest'] == frozen['manifest']
    comparison = client.get(path + '/comparison', params={'baseline_decision_id': frozen['id']}).json()
    assert comparison['scope_changed'] is True


def test_returned_checks_require_preview_and_do_not_automatically_support_requirement(client):
    path, requirements, scope, task = prepared_task(client)
    packet = client.post(path + '/packets', json={'next_step_id': task['id'], 'version': task['version'], 'evidence_ids': []}).json()
    data = {'request_key': str(uuid4()), 'packet_id': packet['id'], 'packet_digest': packet['digest'],
            'outcome': 'completed', 'summary': 'Agent reports search verification completed.', 'scope_id': scope['id'],
            'checks': [{'requirement_id': requirements[1]['id'], 'requirement_revision': 1,
                        'verification': verification(requirements[1])}], 'limitations': ['Imported report.']}
    response = client.post(path + '/results/preview', json=data)
    assert response.status_code == 200, response.text
    preview = response.json()
    assert preview['can_import'] is True
    assert client.get(path + '/evidence').json()['total'] == 0
    assert client.post(path + '/results', json=data).status_code == 409
    response = client.post(path + '/results', json={**data, 'preview_digest': preview['digest']})
    assert response.status_code == 201, response.text
    result = response.json()
    assert result['evidence_ids']
    assert client.get(path + '/next-steps').json()['items'][0]['status'] == 'awaiting_verification'
    assert client.get(path + '/summary').json()['requirements'][1]['state'] == 'not_verified'
    repeated = client.post(path + '/results', json={**data, 'preview_digest': preview['digest']})
    assert repeated.json()['id'] == result['id']
    assert client.get(path + '/evidence').json()['total'] == 1


def test_handoff_migration_creates_frozen_records_without_rewriting_existing_release(db):
    import importlib.util
    from pathlib import Path
    from sqlalchemy import inspect, text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from app.core.database import engine
    schema = 'rehearsal_migration_' + uuid4().hex
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            with Operations.context(MigrationContext.configure(connection)):
                for path in sorted((Path(__file__).parents[1] / 'alembic' / 'versions').glob('*.py')):
                    spec = importlib.util.spec_from_file_location(path.stem, path)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    module.upgrade()
                    if path.name.startswith('0017_'):
                        from app.models import User, Project
                        from app.models.releases import Release, ReleaseBriefRevision
                        connection.execute(User.__table__.insert().values(id=501, email='migration@example.test', password_hash='unused-fixture', status='active'))
                        connection.execute(Project.__table__.insert().values(id=501, owner_user_id=501, name='Existing project', status='development'))
                        connection.execute(Release.__table__.insert().values(id=501, project_id=501, name='Existing beta', created_by=501))
                        connection.execute(ReleaseBriefRevision.__table__.insert().values(release_id=501, revision=1, content={'purpose': 'Keep existing intent'}, created_by=501))
            assert connection.scalar(text("SELECT name FROM releases WHERE id=501")) == 'Existing beta'
            assert connection.scalar(text("SELECT content->>'purpose' FROM release_brief_revisions WHERE release_id=501")) == 'Keep existing intent'
            from app.core.database import Base
            for table in Base.metadata.sorted_tables:
                if table.name.startswith('rehearsal_'):
                    assert {c['name'] for c in inspect(connection).get_columns(table.name, schema=schema)} == set(table.columns.keys())
            names = inspect(connection).get_table_names(schema=schema)
            assert {'rehearsal_packets', 'rehearsal_results', 'rehearsal_result_evidence', 'rehearsal_decisions'} <= set(names)
            assert 'release_requirement_materials' in names
        finally:
            transaction.rollback()


def test_fix_can_return_against_new_reviewed_scope_but_old_scope_cannot_be_imported(client):
    path, requirements, scope, task = prepared_task(client)
    packet = client.post(path + '/packets', json={'next_step_id': task['id'], 'version': task['version'], 'evidence_ids': []}).json()
    data = {'schema_version': 1, 'request_key': str(uuid4()), 'packet_id': packet['id'], 'packet_digest': packet['digest'],
            'outcome': 'completed', 'summary': 'New source was checked.', 'scope_id': scope['id'],
            'checks': [{'requirement_id': requirements[1]['id'], 'requirement_revision': 1,
                        'verification': verification(requirements[1])}], 'limitations': ['Imported result.']}
    original = client.post(path + '/results/preview', json=data).json()
    changed = client.post(path + '/scope', json=scope_input(version=1, snapshot='b' * 64)).json()
    assert client.post(path + '/results', json={**data, 'preview_digest': original['digest']}).status_code == 409
    current_data = {**data, 'scope_id': changed['id']}
    preview = client.post(path + '/results/preview', json=current_data).json()
    assert preview['source_changed'] is True
    assert preview['can_import'] is True
    saved = client.post(path + '/results', json={**current_data, 'preview_digest': preview['digest']})
    assert saved.status_code == 201, saved.text
    assert client.get(path + '/evidence').json()['items'][0]['scope_id'] == changed['id']
    assert client.get(path + '/summary').json()['requirements'][1]['state'] == 'not_verified'


def test_handoff_rejects_foreign_packets_wrong_digests_and_archived_mutations(client):
    path, requirements, scope, task = prepared_task(client)
    packet = client.post(path + '/packets', json={'next_step_id': task['id'], 'version': task['version'], 'evidence_ids': []}).json()
    other_path, _ = rehearsal(client)
    assert client.get(f"{other_path}/packets/{packet['id']}").status_code == 404
    data = {'request_key': str(uuid4()), 'packet_id': packet['id'], 'packet_digest': '0' * 64,
            'outcome': 'blocked', 'summary': 'Could not run checks.', 'scope_id': scope['id'], 'checks': [], 'limitations': []}
    assert client.post(path + '/results/preview', json=data).status_code == 409
    assert client.post(other_path + '/results/preview', json={**data, 'packet_digest': packet['digest']}).status_code == 404
    release_path = path.removesuffix('/rehearsal')
    release = client.get(release_path).json()
    assert client.post(release_path + '/archive', json={'version': release['version']}).status_code == 200
    assert client.post(path + '/packets', json={'next_step_id': task['id'], 'version': task['version'], 'evidence_ids': []}).status_code == 409
    assert client.post(path + '/results', json={**data, 'packet_digest': packet['digest']}).status_code == 409
    assert client.get(f"{path}/packets/{packet['id']}").status_code == 200


def test_return_schema_and_size_guards_precede_evidence_mutation(client):
    path, _, _, _ = prepared_task(client)
    bad = client.post(path + '/results/preview', content='x' * (256 * 1024 + 1), headers={'Content-Type': 'application/json'})
    assert bad.status_code == 413
    assert client.get(path + '/evidence').json()['total'] == 0
    assert client.post(path + '/results/preview', json={'schema_version': 999}).status_code == 422

def test_exports_preserve_evidence_scope_freshness_and_disposition_attribution(client):
    path, requirements, scope, task = prepared_task(client)
    evidence = client.post(path + '/evidence', json={
        'request_key': str(uuid4()), 'requirement_id': requirements[1]['id'], 'requirement_revision': 1,
        'scope_id': scope['id'], 'kind': 'verification', 'verification': verification(requirements[1]),
    }).json()
    assessment = client.post(path + '/assessments', json={
        'requirement_id': requirements[1]['id'], 'requirement_revision': 1, 'scope_id': scope['id'],
        'evidence_ids': [evidence['id']], 'outcome': 'supported', 'rationale': 'Reported isolation check passed.',
        'limitations': ['User supplied report.'],
    }).json()
    reviewed = client.post(f"{path}/assessments/{assessment['id']}/review", json={
        'version': assessment['version'], 'action': 'accept', 'reason': 'Reviewed assertion and scope.',
    })
    assert reviewed.status_code == 200, reviewed.text
    client.post(path + '/scope', json=scope_input(version=1, snapshot='b' * 64))
    packet = client.post(path + '/packets', json={'next_step_id': task['id'], 'version': task['version'], 'evidence_ids': [evidence['id']]}).json()
    frozen = packet['manifest']['evidence'][0]
    assert frozen['scope']['id'] == scope['id']
    assert frozen['freshness'] == 'stale'
    assert frozen['reasons']
    disposition = client.post(f"{path}/requirements/{requirements[1]['id']}/disposition", json={
        'disposition': 'accepted_risk', 'reason': 'Beta exception reviewed.',
    })
    assert disposition.status_code == 200, disposition.text
    preview = client.get(path + '/decisions/preview').json()['manifest']
    assert preview['historical_evidence_count'] == 0
    assert preview['unreviewed_evidence'] == []
    assert preview['evidence'][0]['digest'] == evidence['digest']
    assert preview['evidence'][0]['payload'] == evidence['payload']
    assert preview['evidence'][0]['scope']['id'] == scope['id']
    assert preview['dispositions'][0]['created_by']
    assert preview['dispositions'][0]['created_at']
    assert preview['dispositions'][0]['reason'] == 'Beta exception reviewed.'
