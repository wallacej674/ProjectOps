from pathlib import Path


def test_local_scan_uses_frozen_relative_files_and_reports_missing_inventory(tmp_path):
    from app.code_risk.runner import scan_repository
    source = tmp_path / 'source with spaces'
    source.mkdir()
    (source / 'app.py').write_text('eval(user_input)\n')
    (source / '.env').write_text('PRIVATE_VALUE=do-not-export')
    (source / 'pyproject.toml').write_text('[project]\ndependencies=["httpx>=0.27"]')
    visited = []

    def scanner(tool, snapshot):
        visited.append(tool)
        assert (snapshot / 'app.py').read_text() == 'eval(user_input)\n'
        assert not (snapshot / '.env').exists()
        return 0, {'results': [{'check_id': 'python-eval', 'path': '/src/app.py', 'start': {'line': 1},
                               'extra': {'severity': 'ERROR', 'message': 'Review eval.'}}],
                   'paths': {'scanned': ['/src/app.py']}, 'errors': []}

    report = scan_repository(source, 4, execute=scanner)
    assert visited == ['semgrep']
    assert report.target_id == 4
    assert report.findings[0].path == 'app.py'
    assert report.findings[0].snippet == ''
    assert report.tools[1].outcome == 'unavailable'
    assert report.findings[0].severity == 'high'
    assert 'do-not-export' not in report.model_dump_json()


def test_osv_normalizes_advisory_and_keeps_installed_version(tmp_path):
    import json
    from app.code_risk.runner import osv_result
    output = json.loads((Path(__file__).parent / 'fixtures/code_risk/osv-output.json').read_text())
    tool, findings = osv_result(output, 1, ['package-lock.json'])
    assert tool.outcome == 'completed'
    found = next(f for f in findings if f.rule_id == 'GHSA-29mw-wpgm-hmr9')
    assert found.package == 'lodash'
    assert found.version == '4.17.20'
    assert found.path == 'package-lock.json'
    assert found.advisory_url == 'https://osv.dev/vulnerability/GHSA-29mw-wpgm-hmr9'


def test_repeated_dependency_versions_remain_one_reviewable_finding():
    from app.code_risk.runner import osv_result
    package = lambda version: {'package': {'name': 'example', 'version': version, 'ecosystem': 'npm'},
                               'vulnerabilities': [{'id': 'GHSA-example', 'summary': 'Known issue'}]}
    output = {'results': [{'source': {'path': '/src/package-lock.json'}, 'packages': [package('1.0.0'), package('1.1.0')]}]}
    tool, findings = osv_result(output, 1, ['package-lock.json'])
    assert len(findings) == 1
    assert findings[0].versions == ['1.0.0', '1.1.0']


def test_identical_patterns_do_not_transfer_identity_after_one_is_removed(tmp_path):
    from app.code_risk.runner import semgrep_result
    path = tmp_path / 'app.py'
    def output(lines):
        return {'results': [{'path': '/src/app.py', 'check_id': 'python-eval', 'start': {'line': n}, 'extra': {'severity': 'ERROR', 'message': 'Review eval.'}} for n in lines], 'paths': {'scanned': ['/src/app.py']}}
    path.write_text('eval(payload)\neval(payload)\n')
    _, before = semgrep_result(output([1, 2]), 0, tmp_path, {'app.py': 'old'})
    path.write_text('eval(payload)\n')
    _, after = semgrep_result(output([1]), 0, tmp_path, {'app.py': 'new'})
    assert after[0].anchor not in {item.anchor for item in before}
