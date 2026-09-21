# Live Release Rehearsal evaluation

Status: live semantic evaluation completed on 2026-09-08. Private beta deployment and human usability validation remain pending.

## Outcome

| Measure | Original prompt v1 | Corrected prompt v2 |
| --- | ---: | ---: |
| Completed live requests | 20 | 20 |
| Cases matching frozen expected outcomes | 15/20 | 20/20 |
| Unsupported support labels | 2 | 0 |
| Unknown evidence citations | 0 | 0 |
| Input tokens reported | 10,653 | 18,413 |
| Output tokens reported | 5,383 | 5,236 |
| Estimated usage cost | $0.03221325 | $0.03737175 |

Total estimated usage cost: **$0.069585**, within the user-approved **$1.00 total cap**. Standard uncached rates were applied to reported usage; this is not an invoice and does not apply potential cached-input discounts. Each pass conservatively reserved at most $0.63864 before dispatch; the second included the first pass's known usage in remaining-budget admission. Forty requests were made across two separately versioned twenty-case passes; there were no automatic provider retries.

Model: `gpt-5.4-mini-2026-03-17`, matching the application's code default. [Official model/pricing documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini) lists $0.75 input and $4.50 output per million tokens. Both passes used the actual production rehearsal prompt/schema and bounded Responses transport with tools disabled and store:false. Only synthetic case observations were sent; expected labels and next-action grading notes were withheld. No repository code or customer data was submitted. The configured credential was used only by the existing runtime and was never printed.

## Failure found and correction

The original prompt confused evidence supporting a defect finding with evidence satisfying a release requirement. Two descriptions of failed account isolation received supported labels, even though their rationales described failure. Two cases of missing verification became gap_found. A scoped passing result on B was also misclassified because A had failed historically.

The corrected prompt explicitly defines all four outcomes in terms of requirement satisfaction, distinguishes missing proof from observed failure, treats risk acceptance separately, and preserves scope-aware imported support. It also requests concrete, nonduplicative next steps and avoids mandatory retests when supplied verification is already adequate. The application prompt version is now rehearsal-v2, invalidating old preview/cache identity.

All five original case failures pass on the second run. The expected labels were not changed. The first run's failures remain preserved.

## Quality review and limits

An independent agent reviewed all responses. V2 action guidance improved: source/environment identity, recorded execution, actual scan coverage, and concrete behavioral assertions are clearer. Supported control cases appropriately produce no further tasks. The embedded-instruction case remained not_verified. No invented execution claim was found.

Remaining observations for human review:

- One search investigation task asks for a passing fix as its completion check. Reproduction and repair should be separate accepted tasks.
- Dependency-advisory reachability triage is still implicit in one recommendation.
- A search recommendation omits counts from its suggested observations.
- One download recommendation could state owner-success/non-owner-denial assertions more precisely.

This is **agent review, not human-rated actionability**. The plan's 90% human-rated usefulness target is not yet measured. The same small case set was reused after prompt tuning; 20/20 is regression evidence, not held-out accuracy or a guarantee of production safety. Compact synthetic descriptions exercised live provider semantics, not live worker/database proposal adoption. That application path remains covered by fake-provider integration tests. A full-manifest live smoke test, broader held-out cases and real-user validation would supply additional evidence.

## Reproducibility and checks

- [Original exact request preview](rehearsal-live-evaluation-preview.json), SHA-256 e48747d229714aaf9b9d59b701b7a841186613f036253cb3f1b68f8c19e05842.
- [Corrected exact request preview](rehearsal-live-evaluation-preview-v2.json), SHA-256 6dc2cd8734f1b1e380baf8f86dfa614ff1a0fac01aa4ffa2c2941bfb99a9f474.
- [Original response/usage journal](rehearsal-live-evaluation-results.json) and [original score](rehearsal-live-evaluation-score.json).
- [Corrected response/usage journal](rehearsal-live-evaluation-results-v2.json) and [corrected score](rehearsal-live-evaluation-score-v2.json).
- The journal records timestamps before/after every dispatch, bounded output and reported usage. An initial synced-folder journal update failed before any provider request; its empty attempt journal is retained as stopped_before_dispatch. The successful runs used a local nonsynced journal, copied here after completion.
- 26 affected automated tests passed after the prompt/cache-version correction: 22 workflow/transport cases and four evaluator/runner cases. Fake tests cover both interrupted dispatch and twenty-case completion, durable admission, and no automatic repetition of existing journals.

Per-request latency observed locally (includes journal persistence and network time):

| Prompt | Median | Maximum |
| --- | ---: | ---: |
| v1 | 2.70s | 4.55s |
| v2 | 2.84s | 4.12s |
