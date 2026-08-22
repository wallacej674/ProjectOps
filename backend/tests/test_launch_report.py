from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.user import User


def create_project(client, production_url="https://launchbudget.example.com"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "LaunchBudget",
            "description": "A budgeting app for product launches.",
            "repo_url": "https://github.com/example/launch-budget",
            "production_url": production_url,
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_artifact(client, project_id):
    response = client.post(
        f"/api/v1/projects/{project_id}/artifacts",
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
            "summary": "Deployment steps.",
            "tags": "deployment,evidence",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_launch_report_summarizes_readiness_and_evidence_for_a_project(client):
    project = create_project(client, production_url=None)
    evaluate_response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    assert evaluate_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/launch-report")

    assert response.status_code == 200
    report = response.json()
    assert report["project"]["id"] == project["id"]
    assert report["decision"] == "not_ready"
    assert report["headline"] == "LaunchBudget is not ready for launch."
    assert report["readiness"]["score"] == 0
    assert report["readiness"]["status"] == "needs_work"
    assert report["evidence_summary"] == {
        "repository_connected": False,
        "codemap_completed": False,
        "health_check_healthy": False,
        "production_url_configured": False,
        "active_artifacts": 0,
        "linked_active_artifacts": 0,
        "unlinked_active_artifacts": 0,
        "readiness_items_with_linked_artifacts": 0,
        "readiness_items_without_linked_artifacts": 9,
        "total_evidence_links": 0,
        "activity_events": 2,
    }
    assert "Production URL Configured" in report["blockers"]
    assert report["recommended_actions"][:3] == [
        "Attach a GitHub repository to start repo intake.",
        "Run CodeMap Lite analysis for the attached repository.",
        "Add a production URL and run a manual health check.",
    ]


def test_launch_report_is_scoped_to_the_signed_in_user(client, db):
    project = create_project(client)
    other_user = User(
        email="other-user@example.com",
        password_hash="test-only-unused-password-hash",
        display_name="Other User",
        status="active",
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_user_token, _ = create_access_token(user_id=other_user.id, settings=get_settings())

    response = client.get(
        f"/api/v1/projects/{project['id']}/launch-report",
        headers={"Authorization": f"Bearer {other_user_token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Project {project['id']} was not found."


def test_launch_checklist_guides_project_launch_work(client):
    project = create_project(client, production_url=None)
    evaluate_response = client.post(f"/api/v1/projects/{project['id']}/readiness/evaluate")
    assert evaluate_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/launch-checklist")

    assert response.status_code == 200
    checklist = response.json()
    assert checklist["project"]["id"] == project["id"]
    assert checklist["summary"] == {
        "done": 2,
        "needs_attention": 1,
        "todo": 6,
        "total": 9,
    }
    assert checklist["items"][:4] == [
        {
            "key": "project_created",
            "label": "Project created",
            "status": "done",
            "description": "Project metadata exists in ProjectOps.",
            "action": "Review Project details.",
            "target": "#details",
        },
        {
            "key": "repository_connected",
            "label": "Repository connected",
            "status": "todo",
            "description": "A Repo Integration is required before CodeMap Lite can add repository evidence.",
            "action": "Attach a public GitHub repository.",
            "target": "#repository",
        },
        {
            "key": "codemap_completed",
            "label": "CodeMap Lite completed",
            "status": "todo",
            "description": "CodeMap Lite should complete successfully after a repository is attached.",
            "action": "Run CodeMap Lite analysis.",
            "target": "#codemap",
        },
        {
            "key": "production_url_configured",
            "label": "Production URL configured",
            "status": "todo",
            "description": "A production URL gives Manual Health Monitor a stable target.",
            "action": "Add a production URL.",
            "target": "#details",
        },
    ]
    assert checklist["items"][-1] == {
        "key": "human_launch_review",
        "label": "Human launch review completed",
        "status": "needs_attention",
        "description": "ProjectOps provides advisory evidence; a person still makes the go/no-go decision.",
        "action": "Review the Launch Report with the deployment owner.",
        "target": "#launch-report",
    }


def test_launch_checklist_tracks_supporting_evidence_coverage(client):
    project = create_project(client)
    artifact = create_artifact(client, project["id"])

    unlinked_response = client.get(f"/api/v1/projects/{project['id']}/launch-checklist")
    assert unlinked_response.status_code == 200
    unlinked_item = [
        item for item in unlinked_response.json()["items"] if item["key"] == "supporting_evidence_linked"
    ][0]
    assert unlinked_item["status"] == "needs_attention"
    assert unlinked_item["description"] == (
        "Linked artifacts are supporting references supplied by your team; ProjectOps does not verify their contents."
    )

    link_response = client.post(
        f"/api/v1/projects/{project['id']}/readiness/items/deployment_docs_reviewed/artifacts",
        json={"artifact_id": artifact["id"]},
    )
    assert link_response.status_code == 201

    linked_response = client.get(f"/api/v1/projects/{project['id']}/launch-checklist")
    assert linked_response.status_code == 200
    linked_item = [
        item for item in linked_response.json()["items"] if item["key"] == "supporting_evidence_linked"
    ][0]
    assert linked_item["status"] == "done"


def test_launch_checklist_is_scoped_to_the_signed_in_user(client, db):
    project = create_project(client)
    other_user = User(
        email="launch-checklist-other-user@example.com",
        password_hash="test-only-unused-password-hash",
        display_name="Checklist User",
        status="active",
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_user_token, _ = create_access_token(user_id=other_user.id, settings=get_settings())

    response = client.get(
        f"/api/v1/projects/{project['id']}/launch-checklist",
        headers={"Authorization": f"Bearer {other_user_token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Project {project['id']} was not found."
