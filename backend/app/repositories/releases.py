from sqlalchemy import select, update, func
from app.models.project import Project
from app.models.releases import Release, ReleaseBriefRevision
from app.models.releases import ReleaseRequirement, RequirementRevision
from app.models.releases import RequirementMaterial
from app.models.project_artifact import ProjectArtifact


def owned_project(db, project_id, user_id, write=False):
    query = select(Project).where(Project.id == project_id, Project.owner_user_id == user_id)
    return db.scalar(query.with_for_update() if write else query)


def release_for(db, project_id, release_id):
    return db.scalar(select(Release).where(Release.id == release_id, Release.project_id == project_id))


def active(db, project_id):
    return db.scalar(select(Release).where(Release.project_id == project_id, Release.is_active.is_(True), Release.archived.is_(False)))


def deactivate(db, project_id):
    db.execute(update(Release).where(Release.project_id == project_id, Release.is_active.is_(True))
        .values(is_active=False, version=Release.version + 1))


def page(db, query, offset, limit):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return db.scalars(query.offset(offset).limit(limit)).all(), total


def list_releases(db, project_id, offset, limit):
    return page(db, select(Release).where(Release.project_id == project_id).order_by(Release.id.desc()), offset, limit)


def brief(db, release):
    return db.scalar(select(ReleaseBriefRevision).where(ReleaseBriefRevision.release_id == release.id,
        ReleaseBriefRevision.revision == release.current_brief_revision))


def brief_history(db, release_id, offset, limit):
    return page(db, select(ReleaseBriefRevision).where(ReleaseBriefRevision.release_id == release_id)
        .order_by(ReleaseBriefRevision.revision.desc()), offset, limit)



def requirement_for(db, release_id, requirement_id):
    return db.scalar(select(ReleaseRequirement).where(ReleaseRequirement.id == requirement_id,
        ReleaseRequirement.release_id == release_id))


def requirement_revision(db, requirement):
    return db.scalar(select(RequirementRevision).where(RequirementRevision.requirement_id == requirement.id,
        RequirementRevision.revision == requirement.current_revision))


def list_requirements(db, release_id, offset, limit):
    return page(db, select(ReleaseRequirement).where(ReleaseRequirement.release_id == release_id)
        .order_by(ReleaseRequirement.retired, ReleaseRequirement.id), offset, limit)


def requirement_history(db, requirement_id, offset, limit):
    return page(db, select(RequirementRevision).where(RequirementRevision.requirement_id == requirement_id)
        .order_by(RequirementRevision.revision.desc()), offset, limit)



def artifact_for(db, project_id, artifact_id):
    return db.scalar(select(ProjectArtifact).where(ProjectArtifact.id == artifact_id, ProjectArtifact.project_id == project_id))


def materials(db, requirement_id, offset, limit):
    return page(db, select(RequirementMaterial).join(RequirementRevision)
        .where(RequirementRevision.requirement_id == requirement_id).order_by(RequirementMaterial.id.desc()), offset, limit)
