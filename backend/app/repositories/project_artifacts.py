from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.project_artifact import ProjectArtifact, ProjectArtifactStatus
from app.schemas.project_artifact import ProjectArtifactCreate, ProjectArtifactUpdate


class ProjectArtifactRepository:
    def create(
        self,
        db: Session,
        project_id: int,
        artifact_in: ProjectArtifactCreate,
        *,
        created_by_user_id: int | None = None,
    ) -> ProjectArtifact:
        artifact = ProjectArtifact(
            project_id=project_id,
            created_by_user_id=created_by_user_id,
            title=artifact_in.title,
            artifact_type=artifact_in.artifact_type.value,
            source_type=artifact_in.source_type.value,
            url=artifact_in.url,
            content=artifact_in.content,
            summary=artifact_in.summary,
            tags=artifact_in.tags,
            status=ProjectArtifactStatus.active.value,
        )
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    def list(
        self,
        db: Session,
        project_id: int,
        include_archived: bool = False,
        artifact_type: str | None = None,
        source_type: str | None = None,
        search: str | None = None,
        tags: list[str] | None = None,
    ) -> list[ProjectArtifact]:
        statement = select(ProjectArtifact).where(ProjectArtifact.project_id == project_id)
        if not include_archived:
            statement = statement.where(ProjectArtifact.status != ProjectArtifactStatus.archived.value)
        if artifact_type:
            statement = statement.where(ProjectArtifact.artifact_type == artifact_type)
        if source_type:
            statement = statement.where(ProjectArtifact.source_type == source_type)
        if search:
            search_pattern = f"%{search.lower()}%"
            statement = statement.where(
                or_(
                    func.lower(ProjectArtifact.title).like(search_pattern),
                    func.lower(func.coalesce(ProjectArtifact.summary, "")).like(search_pattern),
                    func.lower(func.coalesce(ProjectArtifact.content, "")).like(search_pattern),
                    func.lower(func.coalesce(ProjectArtifact.url, "")).like(search_pattern),
                    func.lower(func.coalesce(ProjectArtifact.tags, "")).like(search_pattern),
                )
            )
        if tags:
            normalized_tags = [
                tag.strip().lower().replace(" ", "")
                for tag in tags
                if tag.strip()
            ]
            if normalized_tags:
                stored_tags = func.concat(
                    ",",
                    func.replace(func.lower(func.coalesce(ProjectArtifact.tags, "")), " ", ""),
                    ",",
                )
                statement = statement.where(
                    or_(*[stored_tags.like(f"%,{tag},%") for tag in normalized_tags])
                )
        statement = statement.order_by(ProjectArtifact.updated_at.desc(), ProjectArtifact.id.desc())
        return list(db.scalars(statement).all())

    def get(self, db: Session, project_id: int, artifact_id: int) -> ProjectArtifact | None:
        statement = select(ProjectArtifact).where(
            ProjectArtifact.id == artifact_id,
            ProjectArtifact.project_id == project_id,
        )
        return db.scalars(statement).first()

    def update(
        self,
        db: Session,
        artifact: ProjectArtifact,
        artifact_in: ProjectArtifactUpdate,
    ) -> ProjectArtifact:
        update_data = artifact_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if hasattr(value, "value"):
                value = value.value
            setattr(artifact, field, value)
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    def archive(self, db: Session, artifact: ProjectArtifact) -> ProjectArtifact:
        artifact.status = ProjectArtifactStatus.archived.value
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact


project_artifact_repository = ProjectArtifactRepository()
