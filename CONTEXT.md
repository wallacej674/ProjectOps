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
