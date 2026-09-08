"""Local-only scanner execution. Source is never executed or sent to ProjectOps."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.code_risk import ScanReport, FindingInput, ToolResult, MAX_REPORT_BYTES

IMAGES = {
    'semgrep': 'semgrep/semgrep@sha256:cda1b566fafbf6010a02a3ea1d265b1c8eba4380e489a13891a102243d81ca6f',
    'osv': 'ghcr.io/google/osv-scanner@sha256:fd62daecbaaed24442031574540e8af6dbaf0ab0a3e28c626bec0dd235a28346',
}
VERSIONS = {'semgrep': '1.136.0', 'osv': '2.2.2'}
RULES = Path(__file__).with_name('rules.yml')
SOURCE_SUFFIXES = {'.py', '.js', '.jsx', '.ts', '.tsx'}
INVENTORIES = {'package-lock.json', 'requirements.txt'}
EXCLUDED = {'.git', 'node_modules', '.venv', 'venv', 'dist', 'build', '__pycache__', '.next', '.codex', '.agents'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def unsafe_link(path):
    info = path.lstat()
    return path.is_symlink() or bool(getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400))


def snapshot_tree(root, destination):
    files, exclusions = {}, []
    total = 0
    for directory, dirs, names in os.walk(root, followlinks=False):
        parent = Path(directory)
        kept = []
        for name in sorted(dirs):
            child = parent / name
            if name in EXCLUDED or unsafe_link(child):
                if len(exclusions) < 5000:
                    exclusions.append(child.relative_to(root).as_posix() + ': directory excluded')
            else:
                kept.append(name)
        dirs[:] = kept
        for name in sorted(names):
            path = parent / name
            relative = path.relative_to(root).as_posix()
            if path.suffix not in SOURCE_SUFFIXES and name not in INVENTORIES and name != 'pyproject.toml':
                continue
            if unsafe_link(path) or not path.resolve().is_relative_to(root):
                exclusions.append(relative + ': unsafe path')
                continue
            with path.open('rb') as stream:
                data = stream.read(1024 * 1024 + 1)
            if len(data) > 1024 * 1024 or total + len(data) > 100 * 1024 * 1024 or len(files) >= 5000:
                exclusions.append(relative + ': size/count limit')
                continue
            if b'\x00' in data:
                exclusions.append(relative + ': binary data')
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            files[relative] = digest(data)
            total += len(data)
    return files, exclusions[:5000]


def docker_scan(tool, snapshot):
    name = 'projectops-scan-' + uuid4().hex
    command = ['docker', 'run', '--rm', '--name', name, '--memory', '2g', '--cpus', '2',
               '--pids-limit', '128', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
               '--mount', f'type=bind,src={snapshot},dst=/src,readonly']
    if tool == 'semgrep':
        command += ['--network', 'none', '--mount', f'type=bind,src={RULES.resolve()},dst=/rules.yml,readonly',
                    IMAGES[tool], 'semgrep', 'scan', '--config', '/rules.yml', '--json', '--metrics', 'off',
                    '--disable-version-check', '--disable-nosem', '--no-git-ignore', '--jobs', '2', '/src']
    else:
        command += [IMAGES[tool], 'scan', 'source', '--format', 'json', '--all-packages', '--no-resolve', '--no-call-analysis', '*']
        for relative in eligible_inventories(snapshot, {p.relative_to(snapshot).as_posix(): '' for p in snapshot.rglob('*') if p.is_file()})[0]:
            path = snapshot / relative
            if path.name in INVENTORIES:
                command += ['--lockfile', '/src/' + path.relative_to(snapshot).as_posix()]
    with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as error:
        process = subprocess.Popen(command, stdout=output, stderr=error, shell=False)
        deadline = time.monotonic() + 300
        try:
            while process.poll() is None:
                if time.monotonic() > deadline or os.fstat(output.fileno()).st_size > MAX_REPORT_BYTES or os.fstat(error.fileno()).st_size > MAX_REPORT_BYTES:
                    raise TimeoutError('Scanner exceeded execution/output limit.')
                time.sleep(0.05)
            output.seek(0)
            raw = output.read(MAX_REPORT_BYTES + 1)
            if len(raw) > MAX_REPORT_BYTES:
                raise ValueError('Scanner output exceeded limit.')
            return process.returncode, json.loads(raw)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
                subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)


def tool_path(value):
    value = value.replace('\\', '/')
    return value.removeprefix('/src/').removeprefix('src/')


def semgrep_result(output, code, snapshot, files):
    covered = [tool_path(p) for p in output.get('paths', {}).get('scanned', [])]
    covered = [p for p in covered if p in files]
    errors = ['Scanner reported a parsing or execution error.'] if output.get('errors') else []
    outcome = 'completed' if code == 0 and not errors else 'partial' if covered else 'failed'
    findings = []
    for item in output.get('results', []):
        path = tool_path(item['path'])
        if path not in files:
            continue
        if path not in covered:
            covered.append(path)
            outcome = 'partial'
        extra = item.get('extra', {})
        line = item['start']['line']
        lines = (snapshot / path).read_text(encoding='utf-8', errors='replace').splitlines()
        matched = lines[max(0, line - 1):item.get('end', {}).get('line', line)]
        anchor = digest(' '.join(' '.join(matched).split()).encode())
        identity = (path, item['check_id'], anchor)
        raw = extra.get('severity', 'UNKNOWN')
        findings.append(FindingInput(tool='semgrep', rule_id=item['check_id'], path=path, line=line,
            severity={'ERROR': 'high', 'WARNING': 'medium', 'INFO': 'info'}.get(raw, 'unknown'),
            raw_severity=raw, message=extra.get('message', 'Review source pattern.')[:2000], anchor=anchor))
    from collections import Counter
    counts = Counter((f.path, f.rule_id, f.anchor) for f in findings)
    for finding in findings:
        if counts[(finding.path, finding.rule_id, finding.anchor)] > 1:
            finding.anchor = digest(f'{finding.anchor}:{files[finding.path]}:{finding.line}'.encode())
            finding.confidence = 'ambiguous-location'
    return ToolResult(name='semgrep', version=VERSIONS['semgrep'], profile=digest(RULES.read_bytes()),
                      outcome=outcome, covered_files=covered, errors=errors), findings


def scan_repository(root: Path, target_id: int, *, execute=docker_scan):
    root = Path(root).absolute()
    if not root.is_dir() or unsafe_link(root):
        raise ValueError('Select a real repository directory, not a link.')
    root = root.resolve()
    started = datetime.now(timezone.utc)
    with tempfile.TemporaryDirectory(prefix='projectops-scan-') as directory:
        snapshot = Path(directory).resolve()
        files, exclusions = snapshot_tree(root, snapshot)
        tools, findings = [], []
        try:
            code, output = execute('semgrep', snapshot)
            result, detected = semgrep_result(output, code, snapshot, files)
            if any(not e.endswith('directory excluded') for e in exclusions) and result.outcome == 'completed':
                result.outcome = 'partial'
            tools.append(result)
            findings.extend(detected)
        except (OSError, ValueError, KeyError, TypeError, TimeoutError, subprocess.SubprocessError):
            tools.append(ToolResult(name='semgrep', version=VERSIONS['semgrep'], profile=digest(RULES.read_bytes()),
                outcome='failed', covered_files=[], errors=['Scanner failed or exceeded limits. Check local Docker availability.']))
        inventories, unresolved = eligible_inventories(snapshot, files)
        if inventories:
            try:
                code, output = execute('osv', snapshot)
                result, detected = osv_result(output, code, inventories)
                if unresolved or any(not e.endswith('directory excluded') for e in exclusions):
                    result.outcome = 'partial'
                    result.errors.append('Some dependency inputs were unresolved or excluded.')
                tools.append(result)
                findings.extend(detected)
            except (OSError, ValueError, KeyError, TypeError, TimeoutError, subprocess.SubprocessError):
                tools.append(ToolResult(name='osv', version=VERSIONS['osv'], profile='resolved-inventory-v1',
                    outcome='failed', covered_files=[], errors=['Dependency scanner failed. No clean result is available.']))
        else:
            tools.append(ToolResult(name='osv', version=VERSIONS['osv'], profile='resolved-inventory-v1',
                outcome='unavailable', covered_files=[], errors=['No supported resolved dependency inventory was assessed.']))
        if len(findings) > 10000:
            findings = findings[:10000]
            for result in tools:
                if result.outcome == 'completed':
                    result.outcome = 'partial'
                result.errors.append('Report finding limit reached; coverage is incomplete.')
        return ScanReport(schema_version=1, run_id=uuid4(), target_id=target_id, snapshot_hash=digest(json.dumps(files, sort_keys=True).encode()),
            started_at=started, finished_at=datetime.now(timezone.utc), files=files, exclusions=exclusions, tools=tools, findings=findings)


def osv_result(output, code, inventories):
    covered, findings = [], []
    for result in output.get('results', []):
        path = tool_path(result['source']['path'])
        if path not in inventories:
            continue
        covered.append(path)
        for item in result.get('packages', []):
            package = item['package']
            for vuln in item.get('vulnerabilities', []):
                raw = vuln.get('database_specific', {}).get('severity', 'UNKNOWN')
                severity = {'CRITICAL': 'critical', 'HIGH': 'high', 'MODERATE': 'medium', 'MEDIUM': 'medium', 'LOW': 'low'}.get(raw.upper(), 'unknown')
                findings.append(FindingInput(tool='osv', rule_id=vuln['id'], path=path,
                    severity=severity, raw_severity=raw, message=vuln.get('summary', 'Dependency advisory match.')[:2000],
                    anchor=vuln['id'], package=package['name'], version=package['version'], ecosystem=package['ecosystem'],
                    advisory_url='https://osv.dev/vulnerability/' + vuln['id']))
    grouped = {}
    for finding in findings:
        key = (finding.path, finding.ecosystem, finding.package, finding.rule_id)
        if key not in grouped:
            finding.versions = [finding.version] if finding.version else []
            grouped[key] = finding
        elif finding.version and finding.version not in grouped[key].versions:
            grouped[key].versions.append(finding.version)
    findings = list(grouped.values())
    for finding in findings:
        finding.versions.sort()
    # Empty inventories can legitimately return no result group, but need no coverage claim.
    complete = code in (0, 1) and set(covered) == set(inventories)
    return ToolResult(name='osv', version=VERSIONS['osv'], profile='resolved-inventory-v1',
        outcome='completed' if complete else 'partial' if covered else 'failed', covered_files=sorted(set(covered)),
        errors=[] if complete else ['One or more dependency inputs were not completely assessed.']), findings


def eligible_inventories(snapshot, files):
    import re
    accepted = []
    unresolved = []
    for path in files:
        name = Path(path).name
        if name == 'package-lock.json':
            accepted.append(path)
        elif name == 'requirements.txt':
            lines = (snapshot / path).read_text(encoding='utf-8', errors='replace').splitlines()
            entries = [line.strip() for line in lines if line.strip() and not line.lstrip().startswith('#')]
            if entries and all(re.fullmatch(r'[A-Za-z0-9_.-]+==[A-Za-z0-9_.+-]+', line) for line in entries):
                accepted.append(path)
            else:
                unresolved.append(path)
        elif name == 'pyproject.toml' and str(Path(path).with_name('requirements.txt')).replace('\\', '/') not in files:
            unresolved.append(path)
    return accepted, unresolved

