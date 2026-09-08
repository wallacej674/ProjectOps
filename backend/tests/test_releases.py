"""Release brief and requirement journey, independent of AI and deployment."""
BRIEF = {
    'goal': 'Invite ten testers to share documents.', 'stage': 'private_beta',
    'audience': 'Ten invited testers', 'critical_journey': 'Upload a document and find it again.',
    'data_handled': 'User-owned documents', 'failure_outcomes': 'Another user sees a private document.',
    'constraints': 'Local preparation only', 'exclusions': 'Payments and public sign-up',
}
REQUIREMENT = {'brief_revision': 1, 'title': 'Isolate document access',
    'criterion': 'Users can only download and search their own documents.',
    'verification_method': 'Run negative download and search tests using two synthetic accounts.',
    'consequence': 'high', 'applicability': 'applicable', 'applicability_reason': ''}


def create_release(client):
    project = client.post('/api/v1/projects', json={'name': 'Document beta'}).json()
    base = f"/api/v1/projects/{project['id']}/releases"
    response = client.post(base, json={'name': 'Private beta', 'brief': BRIEF})
    assert response.status_code == 201, response.text
    return base, response.json()


def test_owner_defines_and_confirms_release_brief_without_ai(client):
    base, release = create_release(client)
    assert release['brief']['content']['goal'] == BRIEF['goal']
    assert release['brief']['confirmed_at'] is None
    assert client.get(base + '/active').json()['id'] == release['id']
    confirmed = client.post(f"{base}/{release['id']}/brief/confirm", json={'version': release['version']})
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()['brief']['confirmed_at'] is not None
    assert confirmed.json()['brief']['confirmed_by'] is not None
    assert client.get(f"{base}/{release['id']}/brief/history").json()['total'] == 1


def test_requirements_need_confirmed_brief_and_scope_changes_require_review(client):
    base, release = create_release(client)
    path = f"{base}/{release['id']}"
    assert client.post(path + '/requirements', json=REQUIREMENT).status_code == 409
    release = client.post(path + '/brief/confirm', json={'version': release['version']}).json()
    requirement = client.post(path + '/requirements', json=REQUIREMENT)
    assert requirement.status_code == 201, requirement.text
    requirement = requirement.json()
    assert requirement['state'] == 'proposed'
    assert requirement['evidence_state'] == 'not_verified'
    confirmed = client.post(f"{path}/requirements/{requirement['id']}/confirm", json={'version': requirement['version']})
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()['state'] == 'confirmed'
    assert confirmed.json()['evidence_state'] == 'not_verified'
    assert confirmed.json()['needs_review'] is False
    updated = client.post(path + '/brief', json={'version': release['version'], 'brief': {**BRIEF, 'audience': 'Public users'}})
    assert updated.status_code == 200
    requirements = client.get(path + '/requirements').json()
    assert requirements['items'][0]['needs_review'] is True
    history = client.get(path + '/brief/history').json()
    assert history['items'][1]['content']['audience'] == 'Ten invited testers'
    assert history['items'][1]['confirmed_at'] is not None


def test_release_selection_archive_and_stale_writes_preserve_history(client):
    base, first = create_release(client)
    second = client.post(base, json={'name': 'Later release', 'brief': BRIEF}).json()
    assert client.get(base + '/active').json()['id'] == second['id']
    assert client.post(f"{base}/{first['id']}/activate", json={'version': first['version']}).status_code == 409
    first = client.get(f"{base}/{first['id']}").json()
    activated = client.post(f"{base}/{first['id']}/activate", json={'version': first['version']})
    assert activated.status_code == 200, activated.text
    first = activated.json()
    archived = client.post(f"{base}/{first['id']}/archive", json={'version': first['version']})
    assert archived.status_code == 200
    assert client.get(base + '/active').json() is None
    assert client.post(f"{base}/{first['id']}/brief", json={'version': archived.json()['version'], 'brief': BRIEF}).status_code == 409
    assert client.get(f"{base}/{first['id']}/brief/history").json()['total'] == 1


def test_supporting_artifact_is_frozen_and_never_verifies_requirement(client):
    base, release = create_release(client)
    path = f"{base}/{release['id']}"
    client.post(path + '/brief/confirm', json={'version': 0})
    requirement = client.post(path + '/requirements', json=REQUIREMENT).json()
    project_path = base.removesuffix('/releases')
    artifact = client.post(project_path + '/artifacts', json={'title': 'Isolation test notes', 'artifact_type': 'evidence',
        'source_type': 'manual', 'url': 'https://example.com/original', 'summary': 'Local test notes', 'content': 'Search isolation is not yet tested.'}).json()
    link_path = f"{path}/requirements/{requirement['id']}/materials"
    linked = client.post(link_path, json={'version': requirement['version'], 'artifact_id': artifact['id']})
    assert linked.status_code == 201, linked.text
    client.patch(f"{project_path}/artifacts/{artifact['id']}", json={'content': 'Search isolation was tested.', 'url': 'https://example.com/revised'})
    material = client.get(link_path).json()['items'][0]
    assert material['snapshot']['url'] == 'https://example.com/original'
    assert material['snapshot']['content'] == 'Search isolation is not yet tested.'
    assert material['source_changed'] is True
    assert client.get(path + '/requirements').json()['items'][0]['evidence_state'] == 'not_verified'


def test_requirement_revisions_and_foreign_resource_guards(client):
    base, release = create_release(client)
    path = f"{base}/{release['id']}"
    client.post(path + '/brief/confirm', json={'version': 0})
    req = client.post(path + '/requirements', json=REQUIREMENT).json()
    confirmed = client.post(f"{path}/requirements/{req['id']}/confirm", json={'version': 0}).json()
    changed = {**REQUIREMENT, 'version': confirmed['version'], 'criterion': 'Restrict download, search, and deletion to owners.'}
    updated = client.patch(f"{path}/requirements/{req['id']}", json=changed)
    assert updated.status_code == 200
    assert updated.json()['state'] == 'proposed'
    assert client.patch(f"{path}/requirements/{req['id']}", json=changed).status_code == 409
    history = client.get(f"{path}/requirements/{req['id']}/history").json()['items']
    assert history[1]['content']['criterion'] == REQUIREMENT['criterion']
    assert history[1]['confirmed_at'] is not None
    other_base, other = create_release(client)
    assert client.get(f"{other_base}/{release['id']}").status_code == 404
    assert client.post(f"{other_base}/{other['id']}/requirements/{req['id']}/confirm", json={'version': 1}).status_code == 404


def test_foreign_owner_and_archived_project_cannot_mutate_release(client):
    from types import SimpleNamespace
    from app.main import app
    from app.dependencies import get_current_user
    base, release = create_release(client)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=99999)
    try:
        assert client.get(base).status_code == 404
        assert client.get(f"{base}/{release['id']}").status_code == 404
        assert client.post(base, json={'name': 'No', 'brief': BRIEF}).status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user)
    project_path = base.removesuffix('/releases')
    assert client.delete(project_path).status_code in (200, 204)
    assert client.post(f"{base}/{release['id']}/brief/confirm", json={'version': 0}).status_code == 409
    assert client.get(f"{base}/{release['id']}").status_code == 200
