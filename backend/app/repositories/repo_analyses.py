from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.repo_analysis import RepoAnalysis


class RepoAnalysisRepository:
    def create(self, db: Session, repo_analysis: RepoAnalysis) -> RepoAnalysis:
        db.add(repo_analysis)
        db.commit()
        db.refresh(repo_analysis)
        return repo_analysis

    def get_latest_by_project_id(self, db: Session, project_id: int) -> RepoAnalysis | None:
        statement = (
            select(RepoAnalysis)
            .where(RepoAnalysis.project_id == project_id)
            .order_by(RepoAnalysis.created_at.desc(), RepoAnalysis.id.desc())
        )
        return db.scalar(statement)

    def list_by_project_id(self, db: Session, project_id: int) -> list[RepoAnalysis]:
        statement = (
            select(RepoAnalysis)
            .where(RepoAnalysis.project_id == project_id)
            .order_by(RepoAnalysis.created_at.desc(), RepoAnalysis.id.desc())
        )
        return list(db.scalars(statement).all())


repo_analysis_repository = RepoAnalysisRepository()
