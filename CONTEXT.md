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
The workflow that attaches, normalizes, retrieves, or removes a public GitHub repository connection for a Project. GitHub Repo Intake records connection metadata only; it does not analyze repository contents.
_Avoid_: Repo analysis, CodeMap, GitHub sync

**Repo Analysis**:
A stored snapshot of rule-based observations about an attached repository. A Repo Analysis records detected stack, files, folders, signals, warnings, status, and summary at a point in time.
_Avoid_: Readiness score, AI summary, live repo state

**CodeMap Lite**:
The rule-based workflow that fetches public GitHub repository paths and turns those paths into a Repo Analysis. CodeMap Lite uses file and folder paths only; it does not clone repositories or inspect file contents.
_Avoid_: Deep static analysis, AST analysis, production readiness scoring

**Health Check**:
A stored result of one manual reachability check against a Project URL. A Health Check records target URL, outcome status, HTTP status, response time, error message, and a short response preview.
_Avoid_: Uptime metric, incident, readiness score

**Manual Health Monitor**:
The workflow that runs and stores an on-demand Health Check for a Project. Manual Health Monitor is not scheduled monitoring.
_Avoid_: Scheduled uptime monitoring, alerting, status page

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
