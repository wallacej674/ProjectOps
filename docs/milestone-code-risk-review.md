# Code Risk Review: Local Scanner and Review Workflow

Status: local scanning, report import, human review, comparison, work items, and evidence references implemented. OpenAI was selected and the [explanation workflow checkpoint](openai-risk-explanations.md) is implemented, but generation becomes available after the backend receives `OPENAI_API_KEY`. The full AI-assisted MVP is not yet complete.

## Use locally

1. Start the existing local PostgreSQL, backend, and frontend.
2. Apply the additive migration from `backend/`: `.\.venv\Scripts\python.exe -m alembic upgrade head`.
3. Open a Project, choose **Repository → Code Risk Review**, and create a scan target.
4. Run the command shown for that target from the repository root. For example:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/scan_code_risks.py C:/path/to/source --target-id 1 --output C:/path/to/scan-report.json
```

5. Import the generated JSON using **Import scan report**. Review tool coverage before interpreting the finding count.
6. Select a finding, record a review decision, or write and accept a work item with acceptance checks.
7. After changing code externally, run the scanner again and import the new report. Select it and enter the earlier scan ID as the comparison baseline.
8. **Save evidence reference** creates an artifact that can be linked through the existing readiness checklist. It does not change readiness scores or certify production safety.

The scanner requires local Docker and downloads pinned images if unavailable. Semgrep runs offline against six ProjectOps-authored rules for Python and JavaScript/TypeScript. OSV uses the network to query vulnerability data using dependency identities. The scanner never installs the scanned project, executes its code, or applies a fix.

Pinned images: Semgrep 1.136.0 and OSV-Scanner 2.2.2, referenced by immutable digest in `backend/app/code_risk/runner.py`. These versions were exercised locally; no claim is made that they are the latest releases. No third-party rule bundles are redistributed.

## Coverage and data behavior

- Supported source files: `.py`, `.js`, `.jsx`, `.ts`, `.tsx`.
- Supported dependency inputs in this release: `package-lock.json` and simple pinned `requirements.txt` entries (`name==version`). Complex requirements, ranges, and standalone `pyproject.toml` are explicitly not complete resolved dependency evidence.
- Excluded directories include Git internals, installed dependencies, virtual environments, generated output, and agent configuration. Links/junctions are not followed. Scanners inspect a temporary snapshot whose copied bytes are hashed.
- Limits: 5,000 eligible files, 1 MiB per file, 100 MiB snapshot, five minutes per tool, 10,000 findings, and 10 MiB report. Partial coverage and failed scanners remain visible.
- No source snippets are exported; imports reject nonempty snippets until a reviewed context/sanitation workflow exists. Locations, metadata, and evidence hashes are retained.
- Re-importing identical bytes/run UUID is idempotent. A changed report using the same UUID is rejected.
- Multiple affected dependency versions are grouped under the advisory finding. Repeated identical source patterns use conservative ambiguous identities, so they cannot silently inherit another occurrence's dismissal.
- Review updates and work-item status updates use version preconditions. Conflicts retain the browser draft.
- Comparison distinguishes recurring, new, not detected, and not assessed. A failed, incompatible, or insufficiently covered scan does not clear previous findings. Deleting/excluding a file is not proof of remediation.
- Imported reports are user-supplied evidence, not independently attested scanner output. The source snapshot, scan history, and readiness artifact have different meanings.

## Verification

- Full backend suite: 330 tests passed at the scanner/review checkpoint.
- Full frontend suite: 324 tests passed at the initial checkpoint; both new panel tests passed after adding the finding-to-work-item scenario.
- Final focused backend regression: 34 tests passed, including activity events and the full migration chain.
- Dependency audits: npm reported zero vulnerabilities; pip-audit found no known vulnerabilities (the local application package is not published and was skipped).
- Frontend TypeScript/build passed; ESLint passed with five existing Fast Refresh warnings. The existing main-bundle size warning remains.
- Both real scanner images ran against synthetic Python/TypeScript and npm fixtures, producing a valid report with source findings and dependency advisories without installing fixture dependencies.
- Browser inspection verified the scan view and finding-detail form using synthetic data. PostgreSQL API tests separately verify real persistence, ownership, idempotency, review conflicts, and comparison semantics.
- The new migration was exercised with the entire migration chain in an isolated schema that was rolled back, then applied to the verified local development database, which now reports `0015_code_risk (head)`.

## Remaining work

The accepted plan is `code-risk-review-mvp-plan.md`. Its AI slice now has the OpenAI protocol adapter, preview, validated output, request lifecycle, and editable work proposals. Live evaluation and source excerpt handling remain pending; see the explanation checkpoint. No AI-generated output is claimed by this release. Work items currently contain user-entered proposed changes and checks.

Additional limits: no hosted scanner worker, GitHub/CI report ingestion, offline OSV database management, secret scanning, cross-file exploitability analysis, automatic remediation, or complete security assessment. Scan findings should be investigated; known scanner limitations and missing runtime evidence remain part of readiness review.

Rollback: retain additive scan tables when rolling application code back. Migration downgrade refuses to remove scan history. Archiving a target preserves prior records.
