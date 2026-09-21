"""The offline evaluation command reports grounding failures without model calls."""
import json
from pathlib import Path
import subprocess
import sys


def test_evaluation_reports_unsupported_support_and_keeps_human_rating_separate(tmp_path):
    cases = tmp_path / 'cases.json'
    responses = tmp_path / 'responses.json'
    cases.write_text(json.dumps([{
        'id': 'missing-search',
        'requirements': [{'id': 1, 'criterion': 'Search cannot expose other accounts'}],
        'evidence': [],
        'expected': {'1': ['not_verified']},
        'next_action': 'Run a two-account search isolation test',
    }]), encoding='utf-8')
    responses.write_text(json.dumps({'missing-search': {
        'assessments': [{'requirement_id': 1, 'outcome': 'supported', 'evidence_ids': []}],
        'next_steps': [],
    }}), encoding='utf-8')
    result = subprocess.run([sys.executable, str(Path(__file__).parents[1] / 'scripts' / 'evaluate_rehearsal.py'),
                             str(cases), str(responses)], capture_output=True, text=True)
    assert result.returncode == 1, result.stderr
    report = json.loads(result.stdout)
    assert report['cases'][0]['passed'] is False
    assert report['unsupported_support_count'] == 1
    assert report['human_actionability'] == 'not_rated'
    assert report['live_provider_evaluated'] is False


def test_evaluation_rejects_cases_without_expected_requirement_labels(tmp_path):
    cases = tmp_path / 'cases.json'
    responses = tmp_path / 'responses.json'
    cases.write_text(json.dumps([{'id': 'unlabeled', 'requirements': [{'id': 1}],
                                 'evidence': [], 'expected': {}}]), encoding='utf-8')
    responses.write_text(json.dumps({'unlabeled': {'assessments': []}}), encoding='utf-8')
    result = subprocess.run([sys.executable, str(Path(__file__).parents[1] / 'scripts' / 'evaluate_rehearsal.py'),
                             str(cases), str(responses)], capture_output=True, text=True)
    assert result.returncode == 2
    assert not result.stdout

def test_live_evaluation_journals_before_dispatch_and_never_repeats_uncertain_call(tmp_path):
    import importlib.util
    module_path = Path(__file__).parents[1] / 'scripts' / 'run_rehearsal_evaluation.py'
    spec = importlib.util.spec_from_file_location('live_evaluation', module_path)
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    preview = json.loads((Path(__file__).parents[2] / 'docs' / 'rehearsal-live-evaluation-preview-v2.json').read_text())
    journal = tmp_path / 'attempts.json'
    calls = []
    def interrupted(packet, model):
        assert json.loads(journal.read_text())['attempts'][0]['status'] == 'dispatching'
        calls.append(packet)
        raise TimeoutError('Do not leak provider error details')
    report = runner.run(preview, journal, interrupted)
    assert report['attempts'][0]['status'] == 'unknown_outcome'
    assert report['reserved_usd'] <= 1
    assert len(calls) == 1
    runner.run(preview, journal, interrupted)
    assert len(calls) == 1
    assert 'Do not leak' not in journal.read_text()

def test_live_evaluation_uses_exact_preview_and_records_all_twenty_results(tmp_path):
    import importlib.util
    module_path = Path(__file__).parents[1] / 'scripts' / 'run_rehearsal_evaluation.py'
    spec = importlib.util.spec_from_file_location('live_evaluation_success', module_path)
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    preview = json.loads((Path(__file__).parents[2] / 'docs' / 'rehearsal-live-evaluation-preview-v2.json').read_text())
    calls = []
    def provider(packet, model):
        assert 'expected' not in packet and 'next_action' not in packet
        calls.append(packet['evaluation_case_id'])
        return {'output': {'assessments': [{'requirement_id': 1, 'outcome': 'not_verified',
            'evidence_ids': [], 'rationale': 'Synthetic response.', 'limitations': []}],
            'next_steps': [], 'limitations': []}, 'usage': {'input_tokens': 100, 'output_tokens': 20}}
    journal = tmp_path / 'completed.json'
    report = runner.run(preview, journal, provider)
    assert report['status'] == 'completed'
    assert len(calls) == 20 and len(set(calls)) == 20
    assert report['reserved_usd'] == 0.67085325
    assert all(a['usage']['output_tokens'] == 20 for a in report['attempts'])
    assert report['live_provider_evaluated'] is False
    runner.run(preview, journal, provider)
    assert len(calls) == 20
