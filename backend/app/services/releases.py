from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.releases import Release, ReleaseBriefRevision
from app.repositories import releases as repository
from app.models.releases import ReleaseRequirement, RequirementRevision
import hashlib
import json
from app.models.releases import RequirementMaterial


def project(db, project_id, user_id, write=False):
    record = repository.owned_project(db, project_id, user_id, write)
    if record is None:
        raise HTTPException(404, 'Project not found.')
    if write and record.status == 'archived':
        raise HTTPException(409, 'Project is archived.')
    return record


def release_for(db, project_id, release_id, write=False):
    record = repository.release_for(db, project_id, release_id)
    if record is None:
        raise HTTPException(404, 'Release not found.')
    if write and record.archived:
        raise HTTPException(409, 'Release is archived.')
    return record


def check_version(record, version):
    if record.version != version:
        raise HTTPException(409, 'This record changed. Reload before saving; your draft has not been saved.')


def brief_read(row):
    return {key: getattr(row, key) for key in ('revision', 'content', 'created_by', 'created_at', 'confirmed_by', 'confirmed_at')}


def read(db, row):
    return {**{key: getattr(row, key) for key in ('id', 'project_id', 'name', 'version', 'is_active', 'archived', 'created_at')},
            'brief': brief_read(repository.brief(db, row))}


def create(db, project_id, user_id, data):
    project(db, project_id, user_id, True)
    repository.deactivate(db, project_id)
    row = Release(project_id=project_id, name=data.name, created_by=user_id)
    db.add(row)
    db.flush()
    db.add(ReleaseBriefRevision(release_id=row.id, revision=1, content=data.brief.model_dump(), created_by=user_id))
    db.commit()
    return read(db, row)


def update_brief(db, project_id, release_id, user_id, data):
    project(db, project_id, user_id, True)
    row = release_for(db, project_id, release_id, True)
    check_version(row, data.version)
    row.current_brief_revision += 1
    row.version += 1
    db.add(ReleaseBriefRevision(release_id=row.id, revision=row.current_brief_revision,
        content=data.brief.model_dump(), created_by=user_id))
    db.commit()
    return read(db, row)


def confirm_brief(db, project_id, release_id, user_id, data):
    project(db, project_id, user_id, True)
    row = release_for(db, project_id, release_id, True)
    check_version(row, data.version)
    revision = repository.brief(db, row)
    if revision.confirmed_at is None:
        revision.confirmed_by, revision.confirmed_at = user_id, datetime.now(timezone.utc)
        row.version += 1
    db.commit()
    return read(db, row)



def confirmed_brief(db, release, expected_revision):
    brief = repository.brief(db, release)
    if brief.confirmed_at is None:
        raise HTTPException(409, 'Confirm the current release brief before changing requirements.')
    if brief.revision != expected_revision:
        raise HTTPException(409, 'Release scope changed. Reload and review the current brief.')
    return brief


def requirement_for(db, release_id, requirement_id):
    row = repository.requirement_for(db, release_id, requirement_id)
    if row is None:
        raise HTTPException(404, 'Requirement not found.')
    return row


def requirement_revision_read(row):
    return {key: getattr(row, key) for key in ('revision', 'brief_revision_id', 'content', 'created_by', 'created_at', 'confirmed_by', 'confirmed_at')}


def requirement_read(db, release, row):
    revision = repository.requirement_revision(db, row)
    brief = repository.brief(db, release)
    return {'id': row.id, 'version': row.version, 'revision': requirement_revision_read(revision),
            'state': 'retired' if row.retired else 'confirmed' if revision.confirmed_at else 'proposed',
            'needs_review': revision.brief_revision_id != brief.id or brief.confirmed_at is None,
            'evidence_state': 'not_verified'}


def create_requirement(db, project_id, release_id, user_id, data):
    project(db, project_id, user_id, True)
    release = release_for(db, project_id, release_id, True)
    brief = confirmed_brief(db, release, data.brief_revision)
    row = ReleaseRequirement(release_id=release.id)
    db.add(row)
    db.flush()
    db.add(RequirementRevision(requirement_id=row.id, revision=1, brief_revision_id=brief.id,
        content=data.model_dump(exclude={'brief_revision'}), created_by=user_id))
    db.commit()
    return requirement_read(db, release, row)


def update_requirement(db, project_id, release_id, requirement_id, user_id, data):
    project(db, project_id, user_id, True)
    release = release_for(db, project_id, release_id, True)
    row = requirement_for(db, release.id, requirement_id)
    brief = confirmed_brief(db, release, data.brief_revision)
    check_version(row, data.version)
    row.current_revision += 1
    row.version += 1
    row.retired = False
    db.add(RequirementRevision(requirement_id=row.id, revision=row.current_revision, brief_revision_id=brief.id,
        content=data.model_dump(exclude={'brief_revision', 'version'}), created_by=user_id))
    db.commit()
    return requirement_read(db, release, row)


def confirm_requirement(db, project_id, release_id, requirement_id, user_id, data):
    project(db, project_id, user_id, True)
    release = release_for(db, project_id, release_id, True)
    row = requirement_for(db, release.id, requirement_id)
    brief = confirmed_brief(db, release, release.current_brief_revision)
    check_version(row, data.version)
    revision = repository.requirement_revision(db, row)
    if row.retired or revision.brief_revision_id != brief.id:
        raise HTTPException(409, 'Save a new requirement revision against the current brief before confirming.')
    if revision.confirmed_at is None:
        revision.confirmed_by, revision.confirmed_at = user_id, datetime.now(timezone.utc)
        row.version += 1
    db.commit()
    return requirement_read(db, release, row)


def change_state(db, project_id, release_id, user_id, data, action):
    project(db, project_id, user_id, True)
    row = release_for(db, project_id, release_id, action == 'activate')
    check_version(row, data.version)
    if action == 'activate':
        repository.deactivate(db, project_id)
        row.is_active = True
    else:
        row.archived, row.is_active = True, False
    row.version += 1
    db.commit()
    return read(db, row)



def artifact_snapshot(artifact):
    return {**{key: getattr(artifact, key) for key in ('title', 'summary', 'content', 'url', 'source_type', 'artifact_type', 'status')},
            'updated_at': artifact.updated_at.isoformat()}


def material_read(db, project_id, row):
    current = repository.artifact_for(db, project_id, row.artifact_id)
    return {'id': row.id, 'requirement_revision_id': row.requirement_revision_id, 'artifact_id': row.artifact_id,
            'snapshot': row.snapshot, 'digest': row.digest, 'linked_by': row.linked_by, 'linked_at': row.linked_at,
            'source_changed': current is None or artifact_snapshot(current) != row.snapshot}


def link_material(db, project_id, release_id, requirement_id, user_id, data):
    project(db, project_id, user_id, True)
    release = release_for(db, project_id, release_id, True)
    row = requirement_for(db, release.id, requirement_id)
    check_version(row, data.version)
    revision = repository.requirement_revision(db, row)
    brief = confirmed_brief(db, release, release.current_brief_revision)
    if revision.brief_revision_id != brief.id:
        raise HTTPException(409, 'Revise the requirement against the current brief before linking material.')
    artifact = repository.artifact_for(db, project_id, data.artifact_id)
    if artifact is None:
        raise HTTPException(404, 'Artifact not found.')
    if artifact.status == 'archived':
        raise HTTPException(409, 'Artifact is archived.')
    snapshot = artifact_snapshot(artifact)
    encoded = json.dumps(snapshot, sort_keys=True).encode()
    if len(encoded) > 32 * 1024:
        raise HTTPException(422, 'Selected artifact exceeds the 32 KiB supporting-material limit.')
    existing, total = repository.materials(db, requirement_id, 0, 100)
    digest = hashlib.sha256(encoded).hexdigest()
    duplicate = next((m for m in existing if m.requirement_revision_id == revision.id and m.artifact_id == artifact.id and m.digest == digest), None)
    if duplicate:
        return material_read(db, project_id, duplicate)
    if total >= 100:
        raise HTTPException(422, 'This requirement has reached its supporting-material limit.')
    material = RequirementMaterial(requirement_revision_id=revision.id, artifact_id=artifact.id,
        snapshot=snapshot, digest=digest, linked_by=user_id)
    db.add(material)
    row.version += 1
    db.commit()
    return material_read(db, project_id, material)
