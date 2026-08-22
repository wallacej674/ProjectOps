from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.user import User


def create_project(client, name="Evidence Project"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "Evidence mapping test project.",
            "repo_url": None,
            "production_url": "https://example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_artifact(client, project_id, title="Deployment runbook", artifact_type="runbook"):
    response = client.post(
        f"/api/v1/projects/{project_id}/artifacts",
        json={
            "title": title,
            "artifact_type": artifact_type,
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
            "summary": "Deployment evidence.",
            "tags": "deployment,evidence",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_link_artifact_to_readiness_item_success(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])

    response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )

    assert response.status_code == 201
    evidence = response.json()
    assert evidence["project_id"] == project["id"]
    assert evidence["item_key"] == "deployment_docs_reviewed"
    assert evidence["artifact"]["id"] == artifact["id"]
    assert evidence["artifact"]["title"] == "Deployment runbook"


def test_link_artifact_to_readiness_item_missing_project_returns_404(client):
    response = client.post(
        "/api/v1/projects/999/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": 1},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_link_missing_artifact_returns_404(client):
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": 999},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Artifact 999 was not found for Project {project['id']}."


def test_link_artifact_from_wrong_project_returns_404(client):
    first_project = create_project(client, name="First Project")
    second_project = create_project(client, name="Second Project")
    artifact = create_artifact(client, first_project["id"])

    response = client.post(
        f"/api/v1/projects/{second_project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Artifact {artifact['id']} was not found for Project {second_project['id']}."


def test_link_invalid_readiness_item_key_returns_404(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])

    response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/does_not_exist/artifacts",
        json={"artifact_id": artifact["id"]},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Readiness item 'does_not_exist' was not found."


def test_duplicate_artifact_evidence_link_returns_409(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])
    url = f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts"
    first_response = client.post(url, json={"artifact_id": artifact["id"]})
    assert first_response.status_code == 201

    response = client.post(url, json={"artifact_id": artifact["id"]})

    assert response.status_code == 409
    assert response.json()["detail"] == "Artifact is already linked to this readiness item."


def test_list_linked_artifacts_success(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])
    link_response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )
    assert link_response.status_code == 201

    response = client.get(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts"
    )

    assert response.status_code == 200
    evidence = response.json()
    assert len(evidence) == 1
    assert evidence[0]["artifact"]["title"] == "Deployment runbook"


def test_unlink_artifact_evidence_success_does_not_delete_artifact(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])
    link_response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )
    assert link_response.status_code == 201

    response = client.delete(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts/{artifact['id']}"
    )

    assert response.status_code == 204
    list_response = client.get(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts"
    )
    assert list_response.status_code == 200
    assert list_response.json() == []
    artifact_response = client.get(f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}")
    assert artifact_response.status_code == 200
    assert artifact_response.json()["title"] == "Deployment runbook"


def test_list_linked_artifacts_includes_archived_artifact_status(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])
    link_response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )
    assert link_response.status_code == 201
    archive_response = client.delete(f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}")
    assert archive_response.status_code == 200

    response = client.get(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts"
    )

    assert response.status_code == 200
    evidence = response.json()
    assert len(evidence) == 1
    assert evidence[0]["artifact"]["status"] == "archived"


def test_existing_readiness_evaluation_and_manual_updates_still_work_with_artifact_evidence(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])
    link_response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )
    assert link_response.status_code == 201

    evaluate_response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    assert evaluate_response.status_code == 201
    patch_response = client.patch(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed",
        json={"status": "passed", "notes": "Reviewed with linked runbook."},
    )
    assert patch_response.status_code == 200

    list_response = client.get(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts"
    )
    assert list_response.status_code == 200
    assert list_response.json()[0]["artifact"]["id"] == artifact["id"]


def test_evidence_coverage_requires_authentication(unauthenticated_client):
    response = unauthenticated_client.get("/api/v1/projects/1/readiness/evidence-coverage")

    assert response.status_code == 401


def test_evidence_coverage_is_scoped_to_the_signed_in_user(client, db):
    project = create_project(client)
    other_user = User(
        email="evidence-other-user@example.com",
        password_hash="test-only-unused-password-hash",
        display_name="Evidence User",
        status="active",
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_user_token, _ = create_access_token(user_id=other_user.id, settings=get_settings())

    response = client.get(
        f"/api/v1/projects/{project['id']}/readiness/evidence-coverage",
        headers={"Authorization": f"Bearer {other_user_token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Project {project['id']} was not found."


def test_evidence_coverage_empty_project_returns_zero_counts(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/readiness/evidence-coverage")

    assert response.status_code == 200
    assert response.json() == {
        "active_artifacts": 0,
        "linked_active_artifacts": 0,
        "unlinked_active_artifacts": 0,
        "readiness_items_with_linked_artifacts": 0,
        "readiness_items_without_linked_artifacts": 0,
        "total_evidence_links": 0,
        "artifact_usage": [],
        "readiness_items": [],
    }


def test_evidence_coverage_counts_active_unlinked_and_archived_links(client):
    project = create_project(client)
    evaluate_response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    assert evaluate_response.status_code == 201
    readiness_item_count = len(evaluate_response.json()["items"])
    linked_artifact = create_artifact(client, project["id"], title="Deployment runbook")
    unlinked_artifact = create_artifact(client, project["id"], title="Rollback note", artifact_type="risk")
    archived_artifact = create_artifact(client, project["id"], title="Archived checklist", artifact_type="evidence")
    deployment_link = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": linked_artifact["id"]},
    )
    assert deployment_link.status_code == 201
    secrets_link = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/secrets_management_reviewed/artifacts",
        json={"artifact_id": archived_artifact["id"]},
    )
    assert secrets_link.status_code == 201
    archive_response = client.delete(f"/api/v1/projects/{project['id']}/artifacts/{archived_artifact['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/readiness/evidence-coverage")

    assert response.status_code == 200
    coverage = response.json()
    assert coverage["active_artifacts"] == 2
    assert coverage["linked_active_artifacts"] == 1
    assert coverage["unlinked_active_artifacts"] == 1
    assert coverage["readiness_items_with_linked_artifacts"] == 2
    assert coverage["readiness_items_without_linked_artifacts"] == readiness_item_count - 2
    assert coverage["total_evidence_links"] == 2
    usage_by_title = {row["artifact"]["title"]: row for row in coverage["artifact_usage"]}
    assert usage_by_title["Deployment runbook"]["linked_item_count"] == 1
    assert usage_by_title["Deployment runbook"]["readiness_items"][0]["item_key"] == "deployment_docs_reviewed"
    assert usage_by_title["Rollback note"]["linked_item_count"] == 0
    assert usage_by_title["Rollback note"]["readiness_items"] == []
    readiness_by_key = {row["item_key"]: row for row in coverage["readiness_items"]}
    assert readiness_by_key["deployment_docs_reviewed"]["linked_artifact_count"] == 1
    assert readiness_by_key["deployment_docs_reviewed"]["artifacts"][0]["title"] == "Deployment runbook"
    assert readiness_by_key["secrets_management_reviewed"]["linked_artifact_count"] == 1
    assert readiness_by_key["secrets_management_reviewed"]["artifacts"][0]["status"] == "archived"
