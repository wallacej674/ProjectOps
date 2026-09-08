# ProjectOps

ProjectOps is a command center for managing software project workspaces and preparing them for production.

## Current Planning Reference

Use `docs/projectops-remaining-work-handoff.md` as the current source of truth for remaining ProjectOps work, milestone order, private-beta readiness, ship criteria, scope boundaries, and Codex working process.

Do not begin a milestone automatically from that handoff. Use it as guidance when planning future approved work.

## Language

**Project**:
A top-level workspace record for one software project inside ProjectOps. A Project may store URLs such as a repository URL or production URL, but those URLs are metadata until a later integration connects to them.
_Avoid_: App, repo, workspace

**Project Status**:
The lifecycle label for a Project in ProjectOps.
_Avoid_: State, phase

**Archived Project**:
A Project that is kept for history but hidden from normal active project lists.
_Avoid_: Deleted project, removed project

**Project Dashboard**:
A command-center view for one Project that brings project identity and production-preparation signals together.
_Avoid_: Project detail, report

**Repo Integration**:
A connection record between one Project and an external code repository. A Repo Integration is the source of truth for whether a Project has an attached repository.
_Avoid_: Repo metadata, Project repo URL, GitHub link

**GitHub Repo Intake**:
The workflow that attaches, normalizes, retrieves, or removes a GitHub repository connection for a Project. Public URLs and user-authorized, read-only GitHub App installations are supported. GitHub Repo Intake records connection metadata; repository analysis remains a separate action.
_Avoid_: Repo analysis, CodeMap, GitHub sync

**GitHub App Connection**:
A user-authorized binding between a ProjectOps account and a GitHub App installation. ProjectOps stores installation identity and repository metadata, discards the temporary GitHub user token after ownership verification, and requests short-lived installation tokens when repository access is required.
_Avoid_: Stored personal access token, GitHub write access, automatic sync

**Repo Analysis**:
A stored snapshot of rule-based observations about an attached repository. A Repo Analysis records detected stack, files, folders, signals, warnings, status, and summary at a point in time.
_Avoid_: Readiness score, AI summary, live repo state

**CodeMap Lite**:
The rule-based workflow that fetches public GitHub repository paths and turns those paths into a Repo Analysis. CodeMap Lite uses file and folder paths only; it does not clone repositories or inspect file contents.
_Avoid_: Deep static analysis, AST analysis, production readiness scoring

**Repository Insights**:
The deterministic CodeMap Medium capability that inspects a bounded allowlist of public repository manifests and configuration files. Repository Insights records declared runtimes, frameworks, commands, dependency counts, operational signals, and the files supporting those observations. It does not clone repositories, execute code, inspect arbitrary source files, or use AI.
_Avoid_: Code review, verified architecture, vulnerability scan, AI analysis

**Health Check**:
A stored result of one manual or scheduled reachability check against a Project URL. A Health Check records its execution source, target URL, outcome status, HTTP status, response time, error message, and a short response preview.
_Avoid_: Uptime metric, incident, readiness score

**Manual Health Monitor**:
The workflow that runs and stores an on-demand Health Check for a Project. Manual Health Monitor is not scheduled monitoring.
_Avoid_: Scheduled uptime monitoring, alerting, status page

**Scheduled Health Monitor**:
An opt-in Project schedule that periodically runs the same safe URL check against the saved production URL. It records individual observations and schedule state; it is not an uptime guarantee, alerting system, or incident manager.
_Avoid_: Guaranteed uptime, active incident, paging

**Project Artifact**:
A Project-scoped metadata record for an important note, link, runbook, decision, requirement, risk, incident note, or evidence reference. Project Artifacts store registry metadata and optional text/URL references; they do not upload, parse, preview, or analyze document files yet.
_Avoid_: Uploaded file, AI document analysis, vector document, evidence proof

**DataForge Lite**:
The Project Artifact registry foundation. DataForge Lite helps teams record what project knowledge exists and where supporting references live, without file storage, OCR, embeddings, semantic search, or LLM extraction.
_Avoid_: Full DataForge, document intelligence, AI extraction

**Project Activity Event**:
A Project-scoped product history record for something meaningful that happened inside ProjectOps, such as repository changes, CodeMap results, health-check outcomes, readiness work, artifact changes, or evidence links. Activity events are stored for the Recent Activity timeline; they are not realtime notifications or audit-grade compliance logs.
_Avoid_: Notification, alert, audit log, security event

**Cross-Project Activity**:
A newest-first product history feed that lists Project Activity Events across local Projects for app-level Overview surfacing. It includes Project context for navigation, but it is still recent activity history rather than unread notifications, realtime monitoring, or an audit log.
_Avoid_: Inbox, unread feed, notification center, realtime feed

**Scan Target**:
A Project-scoped identity for one local source tree whose code-risk findings are reviewed together. It is distinct from a GitHub Repo Integration.
_Avoid_: Hosted service, deployment target

**Code Risk Scan**:
A saved, user-imported observation of source and dependency risks for a Scan Target, including what was assessed and what could not be assessed. It is evidence for review, not proof of production safety.
_Avoid_: Security certification, CodeMap snapshot

**Risk Finding**:
A recurring, identifiable source-code pattern or dependency advisory match that warrants human review. A finding's presence and its human disposition are separate facts.
_Avoid_: Confirmed exploit, verified vulnerability

**Finding Occurrence**:
The evidence for a Risk Finding in a particular Code Risk Scan.
_Avoid_: New issue, review decision

**Finding Review**:
A person's recorded disposition and reasoning about a Risk Finding based on particular evidence. Changed evidence can require another review.
_Avoid_: Automatic clearance, scanner result

**Risk Work Item**:
A human-accepted proposed change associated with Risk Findings and explicit acceptance checks. Marking it done records human intent; rescan evidence remains separate.
_Avoid_: Applied fix, verified remediation

## Release Readiness Vocabulary (Planned)

**Release Readiness**:
An evidence-backed assessment of a particular Release's confirmed requirements, unresolved gaps, and remaining verification work. It supports a human decision and does not guarantee production safety.
_Avoid_: Security certification, universal readiness score

**Release**:
A defined increment of a Project intended for a particular audience and stage of use.
_Avoid_: Deployment, Git tag

**Release Brief**:
The agreed description of a Release's intended users, important journeys, data, constraints, and excluded scope.
_Avoid_: Repository summary, generated task list

**Release Requirement**:
An explicit criterion that matters to a Release, with a defined scope and a way to assess supporting evidence.
_Avoid_: Scanner rule, task

**Readiness Evidence**:
An attributed observation or supplied record relevant to a Release Requirement, with known scope, freshness, and limitations.
_Avoid_: Proof by attachment, agent consensus

**Requirement Assessment**:
An interpretation of selected Readiness Evidence against a particular Release Requirement, separate from the human decision to accept a risk.
_Avoid_: Test result, release approval

**Next Step**:
A proposed or human-accepted action intended to resolve a release gap or unanswered question, with observable completion criteria.
_Avoid_: Automatically applied fix, confirmed remediation

**Agent Context Packet**:
A human-selected assignment containing one accepted Next Step, relevant release context, evidence, constraints, and return expectations for a coding agent.
_Avoid_: Permission grant, whole-project memory

**Agent Result**:
An attributed report of work and verification returned for an Agent Context Packet. Its completion claim remains separate from a Requirement Assessment.
_Avoid_: Independently verified fix, automatic readiness pass

**Release Decision**:
A person's recorded go, no-go, or defer decision for a particular Release and supporting assessment scope.
_Avoid_: Automated certification, deployment action
