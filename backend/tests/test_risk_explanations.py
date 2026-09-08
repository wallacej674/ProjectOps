from test_code_risk import setup_scan


def test_preview_is_owned_bounded_and_does_not_call_ai(client):
    base, _, _, _, occurrence = setup_scan(client)
    response = client.post(f"{base}/occurrences/{occurrence['id']}/explanation-preview", json={})
    assert response.status_code == 200, response.text
    preview = response.json()
    assert preview['destination'] == 'OpenAI API (external)'
    assert preview['packet']['evidence'][0]['id'] == 'finding'
    assert preview['packet']['evidence'][0]['rule_id'] == 'python-eval'
    assert 'anchor' not in preview['packet']['evidence'][0]
    assert len(preview['context_digest']) == 64
    assert client.post(f"{base}/occurrences/999999/explanation-preview", json={}).status_code == 404

from uuid import uuid4
from app.services import risk_explanations


def advice():
    return {'explanation': 'Dynamic evaluation can execute input.',
            'impact_prerequisites': ['Attacker-controlled input reaches eval.'],
            'uncertainty': ['Source and reachability were not supplied.'],
            'proposed_change': 'Inspect the call and replace evaluation with a constrained parser.',
            'verification_steps': ['Test that hostile input is handled as data.'],
            'citations': ['finding'],
            'work_item': {'title': 'Review dynamic evaluation', 'rationale': 'Reduce unsafe input execution.',
                          'affected_files': ['app.py'], 'acceptance_checks': ['Hostile input cannot execute.'], 'priority': 'high'}}


def test_explanation_is_cached_and_work_is_not_automatically_created(client, monkeypatch):
    base, _, _, _, occurrence = setup_scan(client)
    calls = []
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    def generate(packet, model):
        calls.append(packet)
        return {'output': advice(), 'model': model, 'usage': {'input_tokens': 120, 'output_tokens': 80}}
    monkeypatch.setattr(risk_explanations, 'generate', generate)
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    body = {'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True}
    result = client.post(path + '/explanations', json=body)
    assert result.status_code == 200, result.text
    record = result.json()
    assert record['status'] == 'completed'
    assert record['output']['citations'] == ['finding']
    assert client.post(path + '/explanations', json=body).json()['id'] == record['id']
    body['request_key'] = str(uuid4())
    assert client.post(path + '/explanations', json=body).json()['id'] == record['id']
    assert len(calls) == 1
    assert calls[0] == preview['packet']
    assert client.get(f"{base}/explanations/{record['id']}").json()['usage']['input_tokens'] == 120
    assert client.get(base + '/work-items').json()['total'] == 0

import pytest


@pytest.mark.parametrize('fault', ['citation', 'file', 'refusal', 'timeout'])
def test_invalid_ai_output_is_safe_failure_and_retry_is_explicit(client, monkeypatch, fault):
    base, _, _, _, occurrence = setup_scan(client)
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    calls = []
    def generate(packet, model):
        calls.append(1)
        result = advice()
        if fault == 'citation': result['citations'] = ['invented']
        if fault == 'file': result['work_item']['affected_files'] = ['invented.py']
        if fault == 'refusal': return {'output': None}
        if fault == 'timeout': raise TimeoutError('private provider details')
        return {'output': result}
    monkeypatch.setattr(risk_explanations, 'generate', generate)
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    body = {'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True}
    response = client.post(path + '/explanations', json=body)
    assert response.json()['status'] == 'failed'
    assert response.json()['output'] is None
    assert 'private' not in response.text
    client.post(path + '/explanations', json=body)
    assert len(calls) == 1


def test_consent_changed_packet_and_archived_target_prevent_generation(client, monkeypatch):
    base, target, _, _, occurrence = setup_scan(client)
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    monkeypatch.setattr(risk_explanations, 'generate', lambda *_: pytest.fail('Must not send'))
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    body = {'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': False}
    assert client.post(path + '/explanations', json=body).status_code == 422
    body.update(consent=True, context_digest='0' * 64)
    assert client.post(path + '/explanations', json=body).status_code == 409
    body['context_digest'] = preview['context_digest']
    client.patch(f"{base}/targets/{target['id']}", json={'name': 'Source', 'archived': True})
    assert client.post(path + '/explanations', json=body).status_code == 409


def test_accepted_work_item_retains_valid_explanation_reference(client, monkeypatch):
    base, _, _, _, occurrence = setup_scan(client)
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    monkeypatch.setattr(risk_explanations, 'generate', lambda packet, model: {'output': advice()})
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    record = client.post(path + '/explanations', json={'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True}).json()
    body = {**advice()['work_item'], 'finding_ids': [occurrence['finding_id']], 'explanation_id': record['id']}
    response = client.post(base + '/work-items', json=body)
    assert response.status_code == 201, response.text
    assert response.json()['explanation_id'] == record['id']
    body['explanation_id'] = 9999
    assert client.post(base + '/work-items', json=body).status_code == 404


def test_cache_hit_request_key_remains_idempotent_when_regenerate_changes(client, monkeypatch):
    base, _, _, _, occurrence = setup_scan(client)
    calls = []
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    monkeypatch.setattr(risk_explanations, 'generate', lambda packet, model: (calls.append(1) or {'output': advice()}))
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    body = {'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True}
    first = client.post(path + '/explanations', json=body).json()
    body['request_key'] = str(uuid4())
    client.post(path + '/explanations', json=body)
    body['regenerate'] = True
    assert client.post(path + '/explanations', json=body).json()['id'] == first['id']
    assert len(calls) == 1


def test_active_request_deduplicates_and_blocks_other_paid_requests(client, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    base, _, _, _, occurrence = setup_scan(client)
    other_base, _, _, _, other = setup_scan(client)
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    entered, release = Event(), Event()
    def generate(packet, model):
        entered.set()
        assert release.wait(5)
        return {'output': advice()}
    monkeypatch.setattr(risk_explanations, 'generate', generate)
    path = f"{base}/occurrences/{occurrence['id']}"
    other_path = f"{other_base}/occurrences/{other['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    other_preview = client.post(other_path + '/explanation-preview', json={}).json()
    body = {'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True}
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(client.post, path + '/explanations', json=body)
        try:
            assert entered.wait(3)
            duplicate = client.post(path + '/explanations', json=body)
            assert duplicate.json()['status'] == 'pending'
            denied = client.post(other_path + '/explanations', json={**body, 'request_key': str(uuid4()), 'context_digest': other_preview['context_digest']})
            assert denied.status_code == 429, denied.text
        finally:
            release.set()
        assert future.result().json()['id'] == duplicate.json()['id']


def test_daily_quota_applies_to_explicit_regeneration(client, monkeypatch):
    base, _, _, _, occurrence = setup_scan(client)
    calls = []
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    monkeypatch.setattr(risk_explanations, 'generate', lambda packet, model: (calls.append(1) or {'output': advice()}))
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={}).json()
    for _ in range(20):
        response = client.post(path + '/explanations', json={'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True, 'regenerate': True})
        assert response.status_code == 200
    denied = client.post(path + '/explanations', json={'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True, 'regenerate': True})
    assert denied.status_code == 429
    assert len(calls) == 20


def test_ai_acceptance_checks_fit_the_work_item_contract():
    from pydantic import ValidationError
    from app.schemas.risk_explanations import ExplanationOutput
    from app.schemas.code_risk import WorkCreate
    result = advice()
    result['work_item']['acceptance_checks'] = ['x' * 1000]
    parsed = ExplanationOutput.model_validate(result)
    WorkCreate.model_validate({**parsed.work_item.model_dump(), 'finding_ids': [1]})
    result['work_item']['acceptance_checks'] = ['x' * 1001]
    with pytest.raises(ValidationError):
        ExplanationOutput.model_validate(result)


def test_expired_request_is_visible_and_late_result_cannot_overwrite_failure(client, monkeypatch):
    from datetime import datetime, timedelta
    from app.repositories import risk_explanations as repository
    base, _, _, _, occurrence = setup_scan(client)
    path = f"{base}/occurrences/{occurrence['id']}"
    monkeypatch.setattr(risk_explanations, 'provider_available', lambda: True)
    class Later(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime.now(tz) + timedelta(minutes=2)
    def generate(packet, model):
        monkeypatch.setattr(repository, 'datetime', Later)
        history = client.get(path + '/explanations').json()
        assert history['items'][0]['status'] == 'failed'
        return {'output': advice()}
    monkeypatch.setattr(risk_explanations, 'generate', generate)
    preview = client.post(path + '/explanation-preview', json={}).json()
    result = client.post(path + '/explanations', json={'request_key': str(uuid4()), 'context_digest': preview['context_digest'], 'consent': True}).json()
    assert result['status'] == 'failed'
    assert result['output'] is None
    other_base, _, _, _, _ = setup_scan(client)
    assert client.get(f"{other_base}/explanations/{result['id']}").status_code == 404
