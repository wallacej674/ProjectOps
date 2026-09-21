# Private-beta user testing

Status: prepared on 2026-09-08. No participants recruited, invitations sent, sessions conducted, or human ratings collected. Hosted pilot entry remains subject to the [deployment drill](private-beta-deployment-drill.md). Use one [feedback record](private-beta-feedback-template.md) per participant.

## What this pilot must answer

Can a solo developer or small web-app team identify an important unanswered release question, choose a useful check, return its result, and make a better informed decision with ProjectOps? Test Release Rehearsal against the participant's existing checklist, CI and code-review process. Do not present a readiness certificate or universal score.

The [live evaluation](rehearsal-live-evaluation-report.md) passed 20/20 synthetic cases after prompt correction, with zero unsupported support labels. The same cases were reused during tuning. This supports regression confidence; it does not establish human usefulness, held-out accuracy, or deployed reliability. The planned **90% human-rated relevant/actionable next-action target has not been measured**.

## Recruit five participants

Recruit through the owner's existing contacts, after the owner chooses recipients and authorizes sending. The draft below is ready to personalize; this document does not authorize outreach.

| Participant | Desired experience | Status |
| --- | --- | --- |
| P01 | Solo developer approaching their first web-app private beta | Not recruited |
| P02 | Solo developer with an established CI/review checklist | Not recruited |
| P03 | Member of a 2-5 person team with an upcoming release | Not recruited |
| P04 | Developer using an AI coding agent who reviews its returned work | Not recruited |
| P05 | Developer who recently investigated a release regression | Not recruited |

These categories may overlap; recruit five distinct people. Each should be able to describe a current release decision and understand basic test results. Include at least two people who have not seen ProjectOps. Avoid filling the pilot only with close collaborators who know the interface. Record prior familiarity and relevant stack; do not interpret five participants as a representative market sample.

## Entry gate and session preparation

Before inviting hosted participants, the operator records these checks for the exact deployed revision:

- Hosted API, frontend, database migration and dedicated rehearsal worker pass the deployment drill; the full rehearsal can be completed on the deployed app.
- Intended private access and account ownership are verified with two disposable accounts. Access is revoked through the chosen operational process when participation ends.
- Recovery, support contact, data handling, retention/deletion process and AI budget are specified. A frontend banner alone is not access control.
- A consented synthetic full-manifest live workflow has been reviewed through proposal adoption on the hosted stack, or AI use is explicitly disabled for the first manual usability session. Manual-only sessions do not satisfy the AI usefulness gate.
- Provider spending for hosted pilot workflows has its own operator-approved limit. The earlier $1 offline evaluation approval is not a recurring pilot allowance.
- A moderator rehearses this script and tests downloads/imports in the participant's browser. The five-minute account setup is completed before the timed session when possible, and its actual duration is still recorded.

Use the synthetic scenario below first. Do not automatically import a repository or run commands. Confirm a support channel and owner before the first invitation; do not promise response hours until staffed.

Suggested participation statement to read aloud:

> This is an early product test, not a test of your skills. We are studying whether evidence and next steps help you make release decisions. You can skip any task or stop at any time. Please use the supplied synthetic example and avoid customer data, credentials, private source code and production logs. AI review is optional: you can inspect exactly what will be sent before consenting, and use manual review instead. May I take notes? Screen/audio recording is separate and optional; declining it will not affect participation.

Ask separately for notes and recording, record the answers, and start recording only after an explicit yes. Keep identifying contact details outside the repository; use P01-P05 here. Proposed research retention: delete identifiable notes and recordings within 30 days of the last session; publish only de-identified aggregates with permission. The operator must confirm the actual storage location, deletion ability and hosting retention before promising this. Beta account/project data and provider backups have their own disclosed retention; do not imply deleting research notes deletes those records. Pause recording or screen sharing whenever sensitive data appears.

## Synthetic scenario: document sharing beta

Create a separate Project named `Pilot P01 - synthetic document app` (replace participant ID) and Release `Document sharing beta`. Use only made-up users, documents and source identities. No working document application is required for the initial usability exercise.

Brief: Alice and Bob can upload, search and download their own documents. This rehearsal asks whether account isolation is established for the beta. Billing, load testing and backup recovery are excluded from this exercise; these exclusions are not evidence of readiness.

Confirm two independent requirements:

| Requirement | Criterion | Verification method | Consequence |
| --- | --- | --- | --- |
| Download isolation | An authenticated account cannot download another account's document; its owner can download it | Check owner success and cross-account denial against the same synthetic document | Cross-account document disclosure |
| Search isolation | An authenticated account's search results, snippets and counts reveal no other account's documents | Search as each account with overlapping terms and compare document IDs, snippets and counts | Cross-account metadata/content disclosure |

Select source target `synthetic-document-app`, snapshot `demo-A`, environment `synthetic-pilot`, and partial file inventory coverage. If file digests are entered, use generated fixture digests and label them synthetic; do not imply a real repository was inspected.

The initial report truthfully states that no check ran. Select Download isolation in Collect evidence, keep the built-in `executed: false`, `outcome: not_run`, null timestamps and empty output, set `not_run_reason` to `Synthetic usability exercise; no application was executed`, then use **Use selected requirement criterion**, preview and import. Search has no evidence. Both remain not verified.

The handoff exercise also uses an honest partial report. Export the accepted search task and click **Start result template for this packet**. Retain the generated packet ID, digest, request key and scope ID. Change summary to `Synthetic handoff exercise: reviewed the planned check; no code changed and no checks executed`, keep `checks: []`, `outcome: partial`, and limitation `No execution evidence; search isolation remains unverified`. Preview and import. This tests correlation and review without fabricating a passed test.

For a subsequent real verification loop, use an authorized disposable application and actual recorded checks, or participant-owned redacted evidence under the optional protocol below. A synthetic empty result must never be counted as a completed verification loop or a material issue discovered. Do not execute a command merely because it appears in an imported report or exported packet.

## Moderated session: 40 minutes, maximum 45

Read the task prompt first without teaching the navigation. Ask the participant to think aloud. Allow 60 seconds of unassisted exploration, then offer a neutral hint if requested or stuck; record the hint and time. Stop a task at its time box and continue from a moderator-prepared state if needed, marked assisted. Do not coach the expected state before asking for the participant's interpretation.

| Time | Prompt and observed action | What to record |
| --- | --- | --- |
| 0-4 min | Consent and baseline: “How do you decide a release is ready today? What is still uncertain about your next release?” | Existing tools, time burden, baseline missed questions and stated release decision |
| 4-9 min | “Set up the document beta so another person can understand exactly what you want to verify.” Confirm brief/requirements, exclusions and scope. | Time, independent completion, confusing terms, accidental bundled criteria |
| 9-13 min | “Add this not-run report. What can you now conclude about downloads and search?” Preview/import evidence. | Whether attachment is mistaken for proof; visible source, environment and limitations |
| 13-19 min | “Find the most useful next check.” Preview selected AI input, optionally consent, inspect proposed citations/assessments, review and accept one task. Manual path remains available. | AI wait/failure, proposal usefulness ratings, acceptance edits, whether proposal is mistaken for accepted fact |
| 19-24 min | “Prepare enough context for a coding assistant to do this task. What permission does this export give it?” Export both formats and inspect scope/checks. | Missing context, JSON burden, unsupported execution/permission assumptions |
| 24-29 min | “The assistant returned this partial report. Review and import it; tell me what changed.” Use the generated template above. | Whether the participant checks packet/scope, distinguishes completion claims from tests, and notices unverified requirements |
| 29-33 min | “Record your decision and the reasons.” Preview a defer/no-go/go record; ask which unresolved questions remain. | Independent rationale, risks/exclusions visibility, whether human disposition masks missing proof |
| 33-36 min | “The selected source is now demo-B. Update the scope and compare with your prior decision.” | Recognition of changed scope/review need; prior decision remains frozen; no expectation of automatic source monitoring |
| 36-40 min | Debrief and follow-up choice | Value vs existing tools, wasted work, trust, willingness to repeat/pay, optional follow-up permission |

With only unexecuted evidence, the source-change task tests comparison and historical preservation, not loss of previously supported status. In the follow-up with a real accepted passing check, change the relevant digest and observe whether the participant understands the stale state. Record these as separate observations.

AI is advisory. If it suggests unsupported support, a fabricated citation, or executing a risky command, stop that path, retain only redacted evidence, and route it as a release-blocking finding. Do not silently repair the output and count the task as successful. If the worker/provider fails, record the failure and continue manually; measure manual completion separately.

## Human rating and outcome measures

Rate every AI Next Step shown to participants before moderator coaching or edits, including rejected proposals. Freeze the original text/IDs and model/prompt version in restricted research notes; keep customer text out of committed feedback. The participant gives the usefulness score and explains it. The moderator records scope/citation/safety errors separately; do not substitute an agent rating for the participant's rating.

| Rating | Meaning |
| --- | --- |
| 0 | Incorrect, unsupported, unsafe or unrelated; would send me in the wrong direction |
| 1 | Related but vague, duplicate or requiring substantial rewriting to act on |
| 2 | Relevant and actionable with only small clarification; addresses a real release question |
| 3 | Clear, appropriately scoped and directly actionable with useful acceptance checks |

Relevant/actionable rate = number rated 2 or 3 / all rated AI Next Steps. Target **at least 90%** across at least 20 original suggestions, at least four participants, and both synthetic and optional real-project work. Report counts and per-participant rates, not just the pooled percentage. Unrated items and no-proposal runs are reported separately; they are never assumed useful. A supported requirement with no suggested work may be appropriate and is not automatically a failure. If fewer than 20 suggestions are naturally encountered, extend observation rather than generate unnecessary work to meet a denominator. Manual authored tasks are a separate metric.

Also record:

- Unassisted/assisted/failed/declined task outcomes; setup and per-task time; errors, recovery attempts, hints and abandoned work.
- Unnecessary work: repeated existing tests without a reason, irrelevant investigation, needless context preparation; participant-estimated minutes and concrete explanation.
- Evidence comprehension: distinguish not verified, gap found, supported and stale; separate accepted risk, AI proposal and actual executed check.
- Trust failure count: unsupported readiness claim, invented evidence, wrong-scope adoption or mistaken permission grant. Record both system behavior and user misunderstanding.
- Value: a material previously missed issue or investigation, confirmed by participant against their baseline. Deduplicate the same issue and distinguish new defect, missing check and synthetic exercise insight.
- A real verification loop: accepted task -> exported assignment -> actual executed check with scope -> reviewed result -> reassessment -> recorded decision. Log completion even if the check fails; a successful loop need not produce a go decision.
- Repeat use on a later real release and concrete paid-continuation commitments. Record price/terms and explicit words only if the participant volunteers or consents to discussion. A high satisfaction score or hypothetical “maybe” is not a commitment.

## Optional real-project follow-up

After the synthetic session, offer a separate 20-30 minute follow-up on a release the participant owns or is authorized to assess. Participation is optional. Start with criteria and summaries of their existing tools; do not request private repository access, customer data, raw logs or secrets. Have the participant review/redact evidence locally. For optional AI, show the exact preview again and get consent before transmission. They choose and execute any checks in their own suitable test environment; the moderator does not run imports as commands. Use newly recorded results with real timestamps and source/environment identity. ProjectOps accepts reports but does not independently prove execution.

Ask permission to check back after 7-14 days or their next release. Schedule or send only after that explicit agreement and owner authorization. Ask whether they reused the workflow, what they skipped, whether a question was newly discovered, and whether the decision changed. Offer export and explain the actual deletion process. Record no response as unknown, not failure or retention.

## Gates and next action

| Decision | Gate |
| --- | --- |
| Start moderated private beta | Hosted entry checks complete; participant understands limits; synthetic live regression passed; support/data handling and spending controls set. Human actionability is still under evaluation. |
| Continue after first two sessions | No unresolved ownership, data-loss or unsupported-readiness defect; both can explain evidence vs decision after reviewing UI. Fix recurrent confusion before recruiting the remaining three. |
| Expand beta | Zero unresolved critical trust/security defects; at least 90% human next-action relevance with reported denominator; at least 4/5 complete a real verification loop; at least 3/5 identify a material previously missed issue/investigation on authorized real work. All are targets, currently unmeasured. |
| Test paid continuation | Above gates plus observed repeat use on a later release and at least two explicit paid-continuation commitments with recorded terms. This is a proposed product decision threshold, not a forecast. |
| Hold and improve | Any trust blocker, repeated abandonment, <90% relevance, or insufficient real-work evidence. Fix the specific problem and retest affected flows with new cases; do not count coached retries as first-attempt success. |

After each session, triage feedback as blocker, next-session fix, later improvement or unresolved research question, with owner and verification evidence. After five sessions, publish a de-identified count-based summary including negative findings, selection bias and unknowns. Deployment readiness, live-model quality and user value are separate decisions; passing one does not satisfy the others.

## Invitation draft (not sent)

> Hi [name], I'm testing ProjectOps with a small group of developers preparing web-app releases. It helps connect release criteria, evidence, AI suggestions and a reviewed next check. Would you be interested in a 40-minute session using a made-up document app? No repository access or customer data is needed. You can skip AI use and decline recording. I'd like candid feedback on what helps, confuses you or wastes time. This is an early beta, not a production-readiness guarantee. If interested, I can share the access, data-handling details and a time that works for you. [Owner name and support contact]
