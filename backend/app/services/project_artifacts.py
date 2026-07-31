from sqlalchemy.orm import Session

from app.models.project_artifact import ProjectArtifact
from app.repositories.project_artifacts import project_artifact_repository
from app.schemas.project_artifact import (
    ProjectArtifactCreate,
    ProjectArtifactSourceType,
    ProjectArtifactType,
    ProjectArtifactUpdate,
)
from app.services.projects import project_service


class ProjectArtifactNotFoundError(Exception):
    pass


class ProjectArtifactService:
    def create_project_artifact(
        self,
        db: Session,
        project_id: int,
        artifact_in: ProjectArtifactCreate,
    ) -> ProjectArtifact:
        project_service.get_project(db, project_id)
        artifact = project_artifact_repository.create(db, project_id, artifact_in)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=project_id,
            event_type="artifact_created",
            event_category="artifact",
            message="Artifact was created.",
            related_resource_type="project_artifact",
            related_resource_id=artifact.id,
            metadata={"title": artifact.title, "artifact_type": artifact.artifact_type},
        )
        return artifact

    def list_project_artifacts(
        self,
        db: Session,
        project_id: int,
        include_archived: bool = False,
        artifact_type: ProjectArtifactType | None = None,
        source_type: ProjectArtifactSourceType | None = None,
        search: str | None = None,
        tags: list[str] | None = None,
    ) -> list[ProjectArtifact]:
        project_service.get_project(db, project_id)
        return project_artifact_repository.list(
            db,
            project_id,
            include_archived=include_archived,
            artifact_type=artifact_type.value if artifact_type else None,
            source_type=source_type.value if source_type else None,
            search=search.strip() if search and search.strip() else None,
            tags=tags,
        )

    def get_project_artifact(self, db: Session, project_id: int, artifact_id: int) -> ProjectArtifact:
        project_service.get_project(db, project_id)
        artifact = project_artifact_repository.get(db, project_id, artifact_id)
        if artifact is None:
            raise ProjectArtifactNotFoundError(f"Artifact {artifact_id} was not found for Project {project_id}.")
        return artifact

    def update_project_artifact(
        self,
        db: Session,
        project_id: int,
        artifact_id: int,
        artifact_in: ProjectArtifactUpdate,
    ) -> ProjectArtifact:
        artifact = self.get_project_artifact(db, project_id, artifact_id)
        updated_artifact = project_artifact_repository.update(db, artifact, artifact_in)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=project_id,
            event_type="artifact_updated",
            event_category="artifact",
            message="Artifact was updated.",
            related_resource_type="project_artifact",
            related_resource_id=updated_artifact.id,
            metadata={"title": updated_artifact.title, "artifact_type": updated_artifact.artifact_type},
        )
        return updated_artifact

    def archive_project_artifact(self, db: Session, project_id: int, artifact_id: int) -> ProjectArtifact:
        artifact = self.get_project_artifact(db, project_id, artifact_id)
        archived_artifact = project_artifact_repository.archive(db, artifact)
        from app.services.activity import activity_service

        activity_service.record_event(
            db,
            project_id=project_id,
            event_type="artifact_archived",
            event_category="artifact",
            message="Artifact was archived.",
            related_resource_type="project_artifact",
            related_resource_id=archived_artifact.id,
            metadata={"title": archived_artifact.title, "artifact_type": archived_artifact.artifact_type},
        )
        return archived_artifact


project_artifact_service = ProjectArtifactService()
