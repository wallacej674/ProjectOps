import asyncio
import json
import httpx
import pytest
from test_risk_explanations import advice
from app.code_risk.openai_explanations import request_explanation


def test_responses_adapter_sends_structured_bounded_request_without_tools():
    seen = []
    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={'status': 'completed', 'model': 'test-model',
            'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(advice())}]}],
            'usage': {'input_tokens': 40, 'output_tokens': 90}})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await request_explanation(client, {'evidence': []}, 'test-model')
    result = asyncio.run(run())
    assert result['output']['citations'] == ['finding']
    body = seen[0]
    assert body['store'] is False
    assert body['tools'] == []
    assert body['max_output_tokens'] == 3000
    assert body['text']['format']['strict'] is True
    assert body['text']['format']['schema']['additionalProperties'] is False


@pytest.mark.parametrize('payload', [
    {'status': 'incomplete', 'output': []},
    {'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'Unavailable'}]}]},
])
def test_adapter_rejects_incomplete_and_refusal(payload):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=payload))) as client:
            return await request_explanation(client, {}, 'test-model')
    with pytest.raises(ValueError):
        asyncio.run(run())


@pytest.mark.parametrize('provider_status', [200, 401, 429])
def test_runtime_connects_owned_request_to_openai_using_only_backend_key(client, monkeypatch, provider_status):
    from app.code_risk import openai_explanations as provider
    from app.core.config import Settings
    from test_code_risk import setup_scan
    from uuid import uuid4
    settings = Settings(_env_file=None, OPENAI_API_KEY='test-only-runtime-key')
    monkeypatch.setattr(provider, 'get_settings', lambda: settings)
    captured = []
    real_client = httpx.AsyncClient
    def handler(request):
        assert str(request.url) == 'https://api.openai.com/v1/responses'
        assert request.headers['authorization'] == 'Bearer test-only-runtime-key'
        captured.append(json.loads(request.content))
        if provider_status != 200:
            return httpx.Response(provider_status, json={'error': 'test-only-runtime-key private provider details'})
        return httpx.Response(200, json={'status': 'completed', 'model': settings.code_risk_ai_model,
            'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(advice())}]}]})
    monkeypatch.setattr(provider.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))
    base, _, _, _, occurrence = setup_scan(client)
    path = f"{base}/occurrences/{occurrence['id']}"
    preview = client.post(path + '/explanation-preview', json={})
    assert preview.json()['available'] is True
    assert 'test-only-runtime-key' not in preview.text
    assert captured == []
    result = client.post(path + '/explanations', json={'request_key': str(uuid4()), 'context_digest': preview.json()['context_digest'], 'consent': True})
    assert result.json()['status'] == ('completed' if provider_status == 200 else 'failed'), result.text
    assert len(captured) == 1
    assert 'test-only-runtime-key' not in result.text
    assert 'private provider details' not in result.text


def test_missing_key_keeps_provider_unavailable(monkeypatch):
    from app.code_risk import openai_explanations as provider
    from app.core.config import Settings
    monkeypatch.setattr(provider, 'get_settings', lambda: Settings(_env_file=None, OPENAI_API_KEY='  '))
    assert provider.provider_available() is False
    with pytest.raises(RuntimeError, match='not configured'):
        provider.generate({}, 'test-model')
