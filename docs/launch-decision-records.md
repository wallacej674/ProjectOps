# Launch Decision Records

Launch Decision records capture the human go/no-go/defer decision for a Project
launch review.

They are intentionally lightweight. ProjectOps provides advisory Launch Report
and Guided Launch Checklist signals, but the final decision is human-recorded.
ProjectOps does not certify production safety, approve security, guarantee
readiness, or provide compliance sign-off.

## Storage

Launch Decisions are stored as normal Project Artifacts:

- `artifact_type=decision`
- `source_type=manual`
- Tags include `launch-decision`, `go-no-go`, and one decision tag: `go`,
  `no-go`, or `defer`
- `title` stores a generated title such as `Launch decision: No-go`
- `summary` stores the operator notes or a generated Go summary
- `content` stores the decision value and notes in text form
- `created_at` is treated as the recorded timestamp
- `created_by_user_id` stores the authenticated recorder for newly created
  artifacts when available
- `status` controls whether the decision is active or archived

Project detail reads Project Artifacts through the existing artifacts API,
filters active launch-decision records, and derives the latest decision plus
newest-first decision history. Archived decisions are not shown in the active
Launch Decision history.

The backend treats artifacts with both `launch-decision` and `go-no-go` tags as
Launch Decisions and validates the full contract. A generic `decision` artifact
without those marker tags remains a normal artifact.

## Notes

No-go and Defer decisions require notes. Go decisions allow optional notes, but
notes are recommended because they explain the evidence and context behind the
human record.

Decision notes are Project Artifact text. Users should avoid pasting secrets,
credentials, tokens, customer data, or private incident details that do not
belong in ProjectOps.

The backend validates No-go and Defer notes on create and on the effective state
after PATCH. A Launch Decision cannot be patched into the wrong artifact type,
wrong source type, missing marker tags, missing decision tag, multiple decision
tags, or missing required notes.

## Ownership

Launch Decision artifacts remain Project-owned. Existing Project ownership
checks protect the artifacts API, so one account cannot list or mutate another
account's Project decision records through normal project routes.

New Project Artifact records store the authenticated creator when available.
Launch Decision UI displays `Recorded by` using the creator display name or
email. Historical artifacts without attribution remain valid and display
`Recorder unavailable for this historical record.`

## Limitations

- Records are not immutable.
- Records are not digitally signed.
- Records are not audit-locked.
- Records do not require a separate approver.
- Records do not enforce roles.
- Records are not compliance approval.
- Creator attribution is recorder attribution, not approval authority.
- Launch Report and Guided Launch Checklist remain advisory inputs.

## Future Hardening

Possible later milestones:

- Add immutable launch records.
- Add role-based approval workflows.
- Add exportable launch packet evidence.
- Add a dedicated launch-decision API if artifact filtering becomes too fragile.
