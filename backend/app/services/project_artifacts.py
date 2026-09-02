from sqlalchemy.orm import Session

from app.models.project import Project
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


class ProjectArtifactValidationError(Exception):
    pass


LAUNCH_DECISION_MARKER_TAGS = {"launch-decision", "go-no-go"}
LAUNCH_DECISION_TAGS = {"go", "no-go", "defer"}


def _value(value: object) -> object:
    return value.value if hasattr(value, "value") else value


def _normalized_tags(tags: str | None) -> set[str]:
    return {
        tag.strip().lower()
        for tag in (tags or "").split(",")
        if tag.strip()
    }


def _is_launch_decision_shape(values: dict[str, object]) -> bool:
    return LAUNCH_DECISION_MARKER_TAGS.issubset(_normalized_tags(values.get("tags")))  # type: ignore[arg-type]


def _validate_launch_decision(values: dict[str, object]) -> None:
    tags = _normalized_tags(values.get("tags"))  # type: ignore[arg-type]
    missing_markers = sorted(LAUNCH_DECISION_MARKER_TAGS - tags)
    if missing_markers:
        raise ProjectArtifactValidationError(
            f"Launch Decision records require the {', '.join(missing_markers)} tag."
        )

    if _value(values.get("artifact_type")) != ProjectArtifactType.decision.value:
        raise ProjectArtifactValidationError("Launch Decision records must use artifact_type=decision.")
    if _value(values.get("source_type")) != ProjectArtifactSourceType.manual.value:
        raise ProjectArtifactValidationError("Launch Decision records must use source_type=manual.")

    decision_tags = sorted(tags & LAUNCH_DECISION_TAGS)
    if len(decision_tags) != 1:
        raise ProjectArtifactValidationError(
            "Launch Decision records require exactly one decision tag: go, no-go, or defer."
        )

    decision_tag = decision_tags[0]
    summary = values.get("summary")
    notes = summary if isinstance(summary, str) else ""
    if decision_tag == "no-go" and not notes.strip():
        raise ProjectArtifactValidationError("No-go Launch Decision records require notes.")
    if decision_tag == "defer" and not notes.strip():
        raise ProjectArtifactValidationError("Defer Launch Decision records require notes.")


def _artifact_values(artifact: ProjectArtifact) -> dict[str, object]:
    return {
        "title": artifact.title,
        "artifact_type": artifact.artifact_type,
        "source_type": artifact.source_type,
        "url": artifact.url,
        "content": artifact.content,
        "summary": artifact.summary,
        "tags": artifact.tags,
        "status": artifact.status,
    }


class ProjectArtifactService:
    def create_project_artifact(
        self,
        db: Session,
        project_id: int,
        artifact_in: ProjectArtifactCreate,
        *,
        created_by_user_id: int | None = None,
    ) -> ProjectArtifact:
        project_service.get_project(db, project_id)
        create_values = artifact_in.model_dump()
        if _is_launch_decision_shape(create_values):
            _validate_launch_decision(create_values)
        artifact = project_artifact_repository.create(
            db,
            project_id,
            artifact_in,
            created_by_user_id=created_by_user_id,
        )
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

    def list_artifact_overview_for_owner(self, db: Session, owner_user_id: int) -> list[tuple[Project, list[ProjectArtifact]]]:
        projects = project_service.list_projects(db, owner_user_id=owner_user_id)
        projects_sorted = sorted(projects, key=lambda project: project.name.lower())
        return [(project, self.list_project_artifacts(db, project.id)) for project in projects_sorted]

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
        current_values = _artifact_values(artifact)
        update_values = {
            field: _value(value)
            for field, value in artifact_in.model_dump(exclude_unset=True).items()
        }
        effective_values = {**current_values, **update_values}
        if _is_launch_decision_shape(current_values) or _is_launch_decision_shape(effective_values):
            _validate_launch_decision(effective_values)
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
