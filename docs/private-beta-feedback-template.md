# Private-beta feedback record

Copy this template per session into the operator's approved restricted research location. Do not commit participant names/contact details, raw private-project content, recordings, credentials or customer data. This blank template contains no observations. Use the [pilot protocol](private-beta-user-testing.md) for rating definitions and gates.

## Session and consent

- Participant ID: P__
- Date/time and moderator:
- Deployed revision / frontend and API versions:
- Session type: synthetic / optional real-project follow-up
- Prior ProjectOps familiarity and developer/team context:
- Existing release tools/process and current unanswered release question:
- Setup time outside timed session:
- Notes consent: yes / no; timestamp:
- Separate recording consent: yes / no; timestamp; approved storage reference if yes:
- Optional AI preview consent: yes / declined / not offered; workflow reference:
- Data-handling statement and actual deletion date explained:
- Follow-up permission: yes / no; agreed timing/channel stored outside repo:

## Tasks

Outcome codes: U = unassisted, A = assisted, F = failed/abandoned, D = declined, N = not attempted. Record first attempt separately from retries. A moderator-prepared state is assistance. Record elapsed time, excluding a clearly noted interruption.

| Task | Outcome | Seconds | Errors / request IDs | Help given | Participant interpretation or confusion |
| --- | --- | ---: | --- | --- | --- |
| Brief, independent criteria and scope | | | | | |
| Evidence preview/import | | | | | |
| Assessment and next check review | | | | | |
| Assignment export and inspection | | | | | |
| Result preview/import and reassessment | | | | | |
| Decision preview/save | | | | | |
| Source change and prior-decision comparison | | | | | |

- Worker/provider wait time, failure and recovery:
- Manual fallback used? Which tasks and why?
- Most confusing term/interaction (quote only with permission):
- Unexpected or wasted work; concrete example and participant-estimated minutes:
- Did the participant distinguish an agent claim from execution evidence?
- Did the participant distinguish accepted risk from support?
- Did the participant understand source change requires review and does not rewrite history?
- Did the participant assume export granted execution/repository permissions?

## Original AI Next Step ratings

Participant scores every suggestion shown before edits/coaching: 0 = incorrect/unsafe/unrelated; 1 = related but requires substantial rewriting; 2 = relevant/actionable with small clarification; 3 = directly actionable and appropriately scoped. Include rejected suggestions. Preserve original content only in approved restricted storage; use redacted descriptions here. Model/prompt versions belong to the actual run, not an assumed default.

| Workflow/task ID | Model/prompt version | Synthetic or real | Redacted proposed action | Rating 0-3 or unrated | Participant's reason | Accepted/edited/rejected | Moderator scope/citation/trust error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

- Shown suggestion count:
- Rated suggestion count:
- Count rated 2 or 3:
- Relevant/actionable rate (2-or-3 count / rated count):
- Unrated count and reason:
- No-proposal runs and whether appropriate:
- Manual tasks (separate; not in AI denominator):
- Did any proposal imply unsupported readiness or invent evidence? Exact redacted evidence and triage reference:

## Real-work outcomes (do not count synthetic role-play)

- Authorized real-project work performed: yes / no
- Real verification loop completed: yes / assisted / no / not attempted
- Evidence references: accepted task __; packet __; executed check __; result __; reassessment __; decision __
- Actual source/environment known? Unknowns:
- What check actually ran, and what did it establish? No inference from an imported `passed` label alone:
- Material issue/investigation newly discovered versus the participant's baseline: yes / no / unknown
- Classification: defect / missing verification / other investigation
- Participant's corroboration, impact and deduplication note:
- Did the release decision change? What changed and why?
- Existing-tool comparison: what was already known, duplicated, newly useful or slower?

## Follow-up and value

Ask without steering toward praise: “What would you use next time? What would you skip? What would stop you from returning?”

- Participant's most valuable part:
- Biggest reason not to use it:
- Alternative they would otherwise use:
- Willingness to repeat: agreed actual next release / hypothetical interest / declined / unknown
- Agreed follow-up date (only after permission):
- Later actual repeat use: pending / observed / participant-reported / no / unknown; date and evidence:
- Paid continuation: not discussed / hypothetical / explicit commitment / declined
- If explicit, agreed price/terms and permission to retain the statement (no payment details):
- Export/deletion request and operational owner/status:

## Findings and next decision

Severity: blocker = safety/trust/data-access/data-loss or prevents the core loop; high = repeated task failure or major wasted work; normal = recoverable friction; research = unanswered assumption. Separate system defects from misunderstandings, while treating recurrent misleading UX as a product defect.

| Finding | Severity | Observed evidence | Owner | Fix or research action | Verification / retest status |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

- Any unsupported readiness claim, foreign data access or destructive behavior? Stop path and escalate; reference:
- Moderator coaching that may have biased the result:
- Session limitations (time, sample, synthetic data, AI skipped, provider unavailable):
- Decision: continue / fix before next session / pause pilot
- Reason and decision owner:

## Aggregate worksheet (complete after five participants)

Do not pre-fill results. Include participants who declined, failed or did not return; report unknowns separately.

| Measure | Target | Observed numerator / denominator | Unknown / not attempted | Interpretation |
| --- | --- | --- | --- | --- |
| Human-rated relevant/actionable AI suggestions | >=90%; >=20 rated, >=4 participants | Pending | Pending | |
| Real verification loop completion | >=4/5 | Pending | Pending | |
| Material previously missed issue/investigation | >=3/5 | Pending | Pending | |
| Unresolved critical trust/security defects | 0 | Pending | Pending | |
| Repeat use on a later real release | Observed before paid-continuation decision | Pending | Pending | |
| Explicit paid-continuation commitments | >=2 proposed threshold | Pending | Pending | |

- Per-participant relevance rates (avoid one prolific participant hiding failures):
- Median and range: account setup, complete loop time, help count, wasted-work minutes:
- Unassisted vs assisted completion counts:
- Synthetic vs real-work evidence; live AI vs manual-only sessions:
- Negative feedback and nonresponse:
- Selection bias, small-sample limits and unresolved questions:
- Expand / hold / stop decision, owner/date and next evidence needed:
