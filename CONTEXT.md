# ProjectOps

ProjectOps is a command center for managing software project workspaces and preparing them for production.

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
