# Release Rehearsal: feature and differentiation proposal

Date: 2026-09-07. Status: proposal based on repository inspection and primary-source market research. This deepens the existing Release Readiness direction; it does not replace the approved implementation plan or claim new capabilities are implemented.

## Recommendation

Make Release Readiness a Release Rehearsal: a developer chooses a critical customer journey, ProjectOps assembles the relevant implementation and verification evidence, identifies consequential failure scenarios, and helps the developer close the gaps before recording a release decision. Preserve the assessment across releases and identify what must be checked again.

Product promise: **Understand what could fail in your next release, see the evidence, and know what to verify before shipping.**

Initial customer hypothesis: solo developers and small teams using coding agents to build web applications with account-owned data, preparing a private beta. Their recurring job is to decide whether a specific change is safe enough for their intended users. Readiness always has a release, environment, intended workload, and explicit scope.

## What the repository actually contains

This was source and documentation inspection, not an executed readiness audit. The working tree included existing edits to the scanner, risk service, risk UI/tests, and risk plan; those were left intact. Findings describe the inspected checkout and may differ from committed HEAD.

| Foundation | Observed behavior | Implication |
| --- | --- | --- |
| [Release models](../backend/app/models/releases.py) and [workspace](../frontend/src/features/projects/components/ReleaseReadinessPanel.tsx) | Versioned briefs, confirmed requirement revisions, frozen supporting material; requirements remain not verified | Good foundation for release-specific evidence; assessment is still missing |
| [CodeMap](../backend/app/services/codemap_medium_analyzer.py) | Paths and selected manifests/configuration identify stack, commands, and structural hints | Does not establish application behavior or a complete dependency/call graph |
| [Readiness catalog](../backend/app/readiness_catalog.py) and [service](../backend/app/services/readiness.py) | Nine baseline checks, including test-directory and CI presence, plus manual reviews; score counts passed applicable items | A score summarizes this catalog, not the chance a release will succeed |
| [Scanner](../backend/app/code_risk/runner.py), [rules](../backend/app/code_risk/rules.yml), and [report contract](../backend/app/schemas/code_risk.py) | Local Semgrep/OSV execution and imports; six authored Semgrep rules; file digests, tool versions, exclusions, and coverage; OSV execution disables call analysis | Reuse provenance and scan comparison, but do not present this as comprehensive security or exploitability analysis |
| [Risk explanation contract](../backend/app/schemas/risk_explanations.py) | Structured finding explanations, uncertainty, proposed work, and verification steps with finding/coverage citations | AI foundation exists; cross-requirement and journey reasoning is additional work |
| [Health checks](../backend/app/services/health_checks.py) | HTTP response observations and timing | Reachability evidence, not a business-journey test or load-capacity measurement |
| [Landing copy](../frontend/src/features/landing/copy.ts) | Leads with structural signals and a readiness score; some copy still describes path-only analysis | Product positioning should be updated when the deeper workflow actually ships |

The [approved plan](release-readiness-main-feature-plan.md), [workflow catalog](release-readiness-workflows.md), and [handoff contract](release-readiness-agent-context.md) already contain much of the intended evidence loop. The recommendation makes that loop the product experience and prioritizes a concrete rehearsal over a broad catalog of AI roles.

## The first compelling experience

A developer selects a document application's upload -> process -> search -> download journey and confirms that cross-account disclosure and unrecoverable data loss are unacceptable.

ProjectOps organizes the journey into failure scenarios: another account searches for private text; processing is retried; upload succeeds but processing fails; a document is deleted while a job is running. These are proposed scenarios until matched to confirmed requirements and actual architecture.

Each scenario shows the requirement, relevant code/configuration references where available, tests and results, scanner findings, runtime observations, evidence age and source version, and remaining uncertainty. The initial UI should use a journey list with inspectable evidence cards. A graph is an optional explanation view, not a prerequisite for understanding the result.

Illustrative finding, not a claim about ProjectOps: "Download isolation has a passing two-account test. Search isolation has no relevant supplied result. Verify results, snippets, and counts using a phrase present only in the other account's document."

ProjectOps prepares the assignment for a coding agent. The developer imports the resulting test evidence, reviews its origin and scope, and reassesses the requirement. An agent's completion statement cannot establish that the test ran or passed. A later relevant change makes the previous supporting evidence stale until reviewed or rerun.

The release view answers four questions: what has relevant support, what demonstrated a gap, what remains unknown, and what action should come next. Operational requirements remain visible when only local evidence exists.

## How AI, analysis tools, and ML contribute

| Layer | Contribution | Boundary |
| --- | --- | --- |
| Deterministic evidence engine | Validates IDs, versions, provenance, freshness, report scope, and priority rules | Owns stored states; model confidence cannot override missing evidence |
| Existing scanners | Reuse Semgrep/OSV results and accepted risk dispositions; add other report adapters when pilots need them | A clean report supports only the declared rules, languages, and scanned files |
| Code structure analysis, later | Use language-aware parsing and framework adapters for routes, imports, handlers, and candidate test links | Parsing alone does not resolve runtime dispatch, authorization behavior, or all data flows |
| AI reasoning | Proposes failure scenarios, associates supplied evidence with criteria, explains contradictions, and drafts missing checks | Every factual assertion needs resolvable evidence; proposed relationships remain labeled and reviewable |
| Test evidence | Initially import bounded results from existing test suites; later integrate selected browser/API checks | A generated test is a proposal; assess its assertions and fixtures as well as its result |
| Runtime evidence, later | Relate observed errors, latency, and traces to the journey and deployment | Sampling and missing instrumentation limit conclusions; a staging observation does not establish production behavior |
| Learned prioritization, later | Evaluate whether historical accepted findings and verification outcomes improve ordering of investigations | Begin with explainable rules; no credible release-failure predictor exists without representative labeled outcomes |

[Tree-sitter](https://github.com/tree-sitter/tree-sitter) supplies incremental parsing; additional semantic and framework analysis would be ProjectOps work. [Playwright traces](https://playwright.dev/docs/trace-viewer) expose executed browser actions, source locations, network activity, and errors, making them useful future supporting evidence. [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/) provide a basis for later runtime evidence integration. These are candidate integrations, not installed or implemented capabilities.

Keep a report-adapter interface so customers can bring existing tool output. Normalize each observation with tool/profile version, observed time, code identity, environment, scope, exclusions, origin, and limitations. Keep raw evidence accessible through bounded references. Two summaries of the same scan do not count as independent corroboration.

Use relational records and explicit links in the existing PostgreSQL backend initially. A dedicated graph database and custom trained model are not prerequisites. Semantic retrieval may help locate candidate evidence later, but similarity is not proof that a requirement is met.

For ML evaluation, retain human corrections and actual verification outcomes with permission. Compare learned rankings to the deterministic baseline on held-out projects and later releases; avoid leaking results of the target release into training inputs. Measure precision of top recommendations, missed important gaps, calibration if probabilities are shown, and wasted verification effort. Do not train across private repositories by default.

## Where differentiation could emerge

See [competitive research](production-readiness-market-research.md). Existing vendors overlap substantially in code review, repository context, readiness scorecards, requirements checks, and agent handoffs. Neither a graph nor multiple AI agents establishes uniqueness.

The positioning hypothesis is a tightly integrated, release-specific workflow that preserves **why a customer behavior is believed ready, which observations support that belief, and exactly what changed to require new verification**. Win through low setup effort and useful verification, rather than the number of connected tools.

Potential accumulated advantage: a customer's confirmed requirements, corrected code/test associations, reusable scenario checks, and history of which investigations found meaningful gaps. This advantage must be earned through accuracy and repeated use; competitors can reproduce interface features. Exportable evidence and portable handoffs support trust.

## Delivery sequence

1. **Complete the evidence foundation already planned.** Introduce immutable, attributed evidence scoped to requirement revision, source snapshot, and environment. Handle not verified, supported, gap found, conflicting, and stale states separately from accepted risk and human decisions. Accept bounded test-result imports and existing scan references. Exit: missing, stale, contradictory, and imported evidence cannot silently produce a pass.
2. **Deliver one AI-assisted rehearsal.** Use the document-isolation example, confirmed criteria, bounded inputs, cited assessments, deterministic priority, and at most three proposed next actions. Export the existing planned context contract and import results with review. Exit: a pilot completes the gap -> assignment -> evidence -> reassessment journey.
3. **Reduce setup effort with a narrow code map.** Start with a documented supported stack, such as React/TypeScript plus FastAPI, and explicitly expose unsupported files and unresolved edges. Add source intake only with the approved preview/access policy. Exit: mappings improve recommendations over the manually supplied baseline without inventing paths or behavior.
4. **Add execution and change awareness.** A separately scoped local or CI verifier runs user-selected checks in disposable environments with synthetic data, resource limits, and controlled network access. This expands the current no-repository-execution boundary and needs its own design. Compare evidence dependencies between releases; incomplete mappings require conservative warnings. Exit: a relevant change invalidates the expected evidence and a new run resolves it.
5. **Expand based on recurring demand.** Add recovery, dependency context, performance, and deployment/operations evidence one domain at a time. Integrate runtime signals and test learned ranking only after sufficient history exists.

The first coherent product remains the existing plan's evidence/AI/handoff loop. Automatic test execution, broad source analysis, and runtime integrations are later increments. Do not expand to every stack, connector, or specialist before the narrow journey proves useful.

## Validation before a large build

Recruit five developers with a real upcoming beta and an existing CI or review tool. Record what each intended to check before showing ProjectOps. Measure new consequential gaps found, false alarms, time to reviewed verification, completion of the handoff loop, and return for the next release.

Proposed learning thresholds: three of five discover a material missed issue or investigation; four complete a verification loop; at least two agree to a paid continuation at an explicitly offered price. Record refusals and compare with their current tool workflow. These are pilot decision rules, not statistical evidence of market fit.

Evaluate AI against labeled cases including correct behavior, missing tests, weak assertions, stale results, conflicting reports, ignored files, changed environments, malicious source instructions, and unknown runtime behavior. Track unsupported readiness claims separately from helpful prose. A recommendation that creates busywork is a failure even if its output is well formed.

Charge hypothesis: recurring value comes from reassessing successive releases and preserving verification history. Include bounded usage and visible cost controls; validate pricing with customers before selecting a business model. The decisive question is whether ProjectOps changes a release decision or materially reduces the work needed to make it.
