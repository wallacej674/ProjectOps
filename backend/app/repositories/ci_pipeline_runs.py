from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.ci_pipeline_run import CiPipelineRun

UPSERT_COLUMNS = (
    "github_workflow_id", "workflow_name", "run_number", "status", "conclusion",
    "branch", "commit_sha", "commit_message", "event", "html_url",
    "run_started_at", "run_completed_at", "duration_seconds", "observed_at",
)


class CiPipelineRunRepository:
    def upsert(self, db: Session, run: CiPipelineRun) -> tuple[CiPipelineRun, bool, bool]:
        """Insert a new run, or update an existing one keyed on
        (repo_integration_id, github_run_id). Returns (row, is_new, conclusion_changed)."""
        existing = db.scalar(
            select(CiPipelineRun).where(
                CiPipelineRun.repo_integration_id == run.repo_integration_id,
                CiPipelineRun.github_run_id == run.github_run_id,
            )
        )
        is_new = existing is None
        previous_conclusion = existing.conclusion if existing is not None else None
        # Only a real transition on an already-known run counts — a brand-new row's conclusion
        # going from "didn't exist" to (possibly) None is not a change the caller should log.
        conclusion_changed = not is_new and previous_conclusion != run.conclusion and run.conclusion is not None

        values = {column: getattr(run, column) for column in UPSERT_COLUMNS}
        statement = insert(CiPipelineRun).values(
            project_id=run.project_id,
            repo_integration_id=run.repo_integration_id,
            github_run_id=run.github_run_id,
            **values,
        )
        statement = statement.on_conflict_do_update(
            index_elements=["repo_integration_id", "github_run_id"],
            set_=values,
        ).returning(CiPipelineRun)
        row = db.scalar(statement)
        db.commit()
        db.refresh(row)
        return row, is_new, conclusion_changed

    def get_latest_by_project_id(self, db: Session, project_id: int) -> CiPipelineRun | None:
        statement = (
            select(CiPipelineRun)
            .where(CiPipelineRun.project_id == project_id)
            .order_by(CiPipelineRun.run_started_at.desc().nullslast(), CiPipelineRun.id.desc())
            .limit(1)
        )
        return db.scalar(statement)

    def list_by_project_id(self, db: Session, project_id: int, limit: int = 25) -> list[CiPipelineRun]:
        statement = (
            select(CiPipelineRun)
            .where(CiPipelineRun.project_id == project_id)
            .order_by(CiPipelineRun.run_started_at.desc().nullslast(), CiPipelineRun.id.desc())
            .limit(limit)
        )
        return list(db.scalars(statement).all())

    def get_latest_by_project_ids(self, db: Session, project_ids: list[int]) -> dict[int, CiPipelineRun]:
        if not project_ids:
            return {}
        statement = (
            select(CiPipelineRun)
            .where(CiPipelineRun.project_id.in_(project_ids))
            .distinct(CiPipelineRun.project_id)
            .order_by(
                CiPipelineRun.project_id,
                CiPipelineRun.run_started_at.desc().nullslast(),
                CiPipelineRun.id.desc(),
            )
        )
        return {run.project_id: run for run in db.scalars(statement).all()}

    def success_rate(self, db: Session, repo_integration_id: int, window: int = 10) -> float | None:
        statement = (
            select(CiPipelineRun)
            .where(
                CiPipelineRun.repo_integration_id == repo_integration_id,
                CiPipelineRun.conclusion.is_not(None),
            )
            .order_by(CiPipelineRun.run_started_at.desc().nullslast(), CiPipelineRun.id.desc())
            .limit(window)
        )
        runs = list(db.scalars(statement).all())
        if not runs:
            return None
        successes = sum(1 for run in runs if run.conclusion == "success")
        return successes / len(runs)


ci_pipeline_run_repository = CiPipelineRunRepository()
