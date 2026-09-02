from sqlalchemy import inspect, text

from app.core.database import engine


def create_project(client, name="Artifact Project"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "A software project command center.",
            "repo_url": "https://github.com/example/artifact-project",
            "production_url": "https://artifact-project.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_project_artifact(client):
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
            "summary": "Steps for production deploys.",
            "content": "Use the blue-green deploy checklist.",
            "tags": "deployment,runbook",
            "created_by_user_id": 999,
            "created_by_user": {"id": 999, "email": "attacker@example.com", "display_name": "Attacker"},
        },
    )

    assert response.status_code == 201
    artifact = response.json()
    assert artifact["id"] > 0
    assert artifact["project_id"] == project["id"]
    assert artifact["title"] == "Deployment runbook"
    assert artifact["artifact_type"] == "runbook"
    assert artifact["source_type"] == "external_url"
    assert artifact["url"] == "https://docs.example.com/runbook"
    assert artifact["summary"] == "Steps for production deploys."
    assert artifact["content"] == "Use the blue-green deploy checklist."
    assert artifact["tags"] == "deployment,runbook"
    assert artifact["status"] == "active"
    assert artifact["created_by_user_id"] == 1
    assert artifact["created_by_user"] == {
        "id": 1,
        "email": "test-user@example.com",
        "display_name": "Test User",
    }
    assert artifact["created_at"] is not None
    assert artifact["updated_at"] is not None


def test_list_project_artifacts_returns_active_artifacts(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Architecture note",
            "artifact_type": "note",
            "source_type": "manual",
            "summary": "Service boundaries and operational notes.",
        },
    )
    assert create_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/artifacts")

    assert response.status_code == 200
    artifacts = response.json()
    assert len(artifacts) == 1
    assert artifacts[0]["title"] == "Architecture note"


def test_project_artifact_table_exists_with_expected_columns(db):
    inspector = inspect(engine)

    columns = {column["name"] for column in inspector.get_columns("project_artifacts")}

    assert {
        "id",
        "project_id",
        "title",
        "artifact_type",
        "source_type",
        "url",
        "content",
        "summary",
        "tags",
        "status",
        "created_by_user_id",
        "created_at",
        "updated_at",
    }.issubset(columns)

    foreign_keys = inspector.get_foreign_keys("project_artifacts")
    assert any(
        foreign_key["referred_table"] == "users"
        and foreign_key["constrained_columns"] == ["created_by_user_id"]
        for foreign_key in foreign_keys
    )


def test_create_project_artifact_missing_project_returns_404(client):
    response = client.post(
        "/api/v1/projects/999/artifacts",
        json={
            "title": "Missing Project note",
            "artifact_type": "note",
            "source_type": "manual",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_create_project_artifact_validation_errors(client):
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": " ",
            "artifact_type": "unsupported",
            "source_type": "manual",
            "url": "not-a-url",
        },
    )

    assert response.status_code == 422
    detail_text = str(response.json()["detail"])
    assert "Artifact title is required" in detail_text
    assert "artifact_type" in detail_text
    assert "Enter a valid HTTP or HTTPS URL" in detail_text


def test_list_project_artifacts_filters_by_type_and_source(client):
    project = create_project(client)
    note_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Architecture note",
            "artifact_type": "note",
            "source_type": "manual",
        },
    )
    assert note_response.status_code == 201
    link_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Runbook URL",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/runbook",
        },
    )
    assert link_response.status_code == 201

    response = client.get(
        f"/api/v1/projects/{project['id']}/artifacts?artifact_type=runbook&source_type=external_url"
    )

    assert response.status_code == 200
    artifacts = response.json()
    assert [artifact["title"] for artifact in artifacts] == ["Runbook URL"]


def test_list_project_artifacts_searches_by_title_summary_content_url_and_tags(client):
    project = create_project(client)
    artifacts = [
        {
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/deployments",
            "summary": "Release procedure.",
            "content": "Blue-green deployment steps.",
            "tags": "ops,release",
        },
        {
            "title": "Architecture decision",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "Service boundary summary.",
            "content": "ADR for modular API boundaries.",
            "tags": "architecture,adr",
        },
        {
            "title": "Incident note",
            "artifact_type": "incident",
            "source_type": "manual",
            "summary": "Cache outage follow-up.",
            "content": "Rollback details.",
            "tags": "postmortem,reliability",
        },
    ]
    for artifact in artifacts:
        response = client.post(f"/api/v1/projects/{project['id']}/artifacts", json=artifact)
        assert response.status_code == 201

    searches = {
        "deployment": ["Deployment runbook"],
        "boundary": ["Architecture decision"],
        "rollback": ["Incident note"],
        "docs.example.com/deployments": ["Deployment runbook"],
        "postmortem": ["Incident note"],
    }

    for search, expected_titles in searches.items():
        response = client.get(f"/api/v1/projects/{project['id']}/artifacts?search={search}")

        assert response.status_code == 200
        assert [artifact["title"] for artifact in response.json()] == expected_titles


def test_list_project_artifacts_search_is_case_insensitive(client):
    project = create_project(client)
    response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "manual",
            "summary": "Production release notes.",
        },
    )
    assert response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/artifacts?search=PRODUCTION")

    assert response.status_code == 200
    assert [artifact["title"] for artifact in response.json()] == ["Deployment runbook"]


def test_list_project_artifacts_filters_by_any_tag(client):
    project = create_project(client)
    for artifact in [
        {
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "manual",
            "tags": "deployment, runbook",
        },
        {
            "title": "Incident note",
            "artifact_type": "incident",
            "source_type": "manual",
            "tags": "incident, reliability",
        },
        {
            "title": "Architecture decision",
            "artifact_type": "decision",
            "source_type": "manual",
            "tags": "architecture, adr",
        },
    ]:
        response = client.post(f"/api/v1/projects/{project['id']}/artifacts", json=artifact)
        assert response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/artifacts?tags=RUNBOOK,reliability")

    assert response.status_code == 200
    assert {artifact["title"] for artifact in response.json()} == {"Deployment runbook", "Incident note"}


def test_list_project_artifacts_search_composes_with_existing_filters(client):
    project = create_project(client)
    active_runbook = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "url": "https://docs.example.com/deploy",
            "summary": "Deployment checklist.",
            "tags": "deployment,release",
        },
    ).json()
    client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Deployment note",
            "artifact_type": "note",
            "source_type": "manual",
            "summary": "Deployment note.",
            "tags": "deployment",
        },
    )
    archived_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Archived deployment runbook",
            "artifact_type": "runbook",
            "source_type": "external_url",
            "summary": "Deployment archive.",
            "tags": "deployment,archive",
        },
    )
    archived = archived_response.json()
    client.delete(f"/api/v1/projects/{project['id']}/artifacts/{archived['id']}")

    response = client.get(
        f"/api/v1/projects/{project['id']}/artifacts"
        "?search=deployment&tags=release&artifact_type=runbook&source_type=external_url"
    )

    assert response.status_code == 200
    assert [artifact["id"] for artifact in response.json()] == [active_runbook["id"]]

    include_archived_response = client.get(
        f"/api/v1/projects/{project['id']}/artifacts"
        "?search=deployment&artifact_type=runbook&source_type=external_url&include_archived=true"
    )

    assert include_archived_response.status_code == 200
    assert {artifact["title"] for artifact in include_archived_response.json()} == {
        "Deployment runbook",
        "Archived deployment runbook",
    }


def test_list_project_artifacts_no_results_returns_empty_list(client):
    project = create_project(client)
    response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Architecture note",
            "artifact_type": "note",
            "source_type": "manual",
        },
    )
    assert response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/artifacts?search=not-present&tags=missing")

    assert response.status_code == 200
    assert response.json() == []


def test_get_project_artifact_success(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Decision record",
            "artifact_type": "decision",
            "source_type": "manual",
            "content": "Use managed Postgres for the first production release.",
        },
    )
    artifact = create_response.json()

    response = client.get(f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}")

    assert response.status_code == 200
    assert response.json()["title"] == "Decision record"
    assert response.json()["created_by_user"]["email"] == "test-user@example.com"


def test_historical_project_artifact_without_creator_remains_readable(client, db):
    project = create_project(client)
    db.execute(
        text(
            """
            insert into project_artifacts
            (project_id, title, artifact_type, source_type, status)
            values (:project_id, 'Historical note', 'note', 'manual', 'active')
            """
        ),
        {"project_id": project["id"]},
    )
    db.commit()

    response = client.get(f"/api/v1/projects/{project['id']}/artifacts")

    assert response.status_code == 200
    artifact = response.json()[0]
    assert artifact["title"] == "Historical note"
    assert artifact["created_by_user_id"] is None
    assert artifact["created_by_user"] is None


def test_get_project_artifact_wrong_project_returns_404(client):
    first_project = create_project(client, name="First Project")
    second_project = create_project(client, name="Second Project")
    create_response = client.post(
        f"/api/v1/projects/{first_project['id']}/artifacts",
        json={
            "title": "Incident note",
            "artifact_type": "incident",
            "source_type": "manual",
        },
    )
    artifact = create_response.json()

    response = client.get(f"/api/v1/projects/{second_project['id']}/artifacts/{artifact['id']}")

    assert response.status_code == 404
    assert response.json()["detail"] == f"Artifact {artifact['id']} was not found for Project {second_project['id']}."


def test_patch_project_artifact_success(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Risk note",
            "artifact_type": "risk",
            "source_type": "manual",
        },
    )
    artifact = create_response.json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={
            "title": "Updated risk note",
            "summary": "Payment provider migration risk.",
            "tags": "risk,payments",
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Updated risk note"
    assert updated["artifact_type"] == "risk"
    assert updated["summary"] == "Payment provider migration risk."
    assert updated["tags"] == "risk,payments"
    assert updated["created_by_user_id"] == artifact["created_by_user_id"]


def test_patch_project_artifact_cannot_change_creator(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Risk note",
            "artifact_type": "risk",
            "source_type": "manual",
        },
    )
    artifact = create_response.json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={
            "title": "Updated risk note",
            "created_by_user_id": 999,
            "created_by_user": {"id": 999, "email": "attacker@example.com", "display_name": "Attacker"},
        },
    )

    assert response.status_code == 200
    assert response.json()["created_by_user_id"] == artifact["created_by_user_id"]
    assert response.json()["created_by_user"]["email"] == "test-user@example.com"


def test_generic_decision_artifact_without_launch_markers_remains_valid(client):
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Architecture decision",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "Use managed Postgres.",
            "tags": "architecture,adr",
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Architecture decision"


def test_valid_launch_decisions_are_accepted(client):
    project = create_project(client)

    for decision_tag, summary in [
        ("go", ""),
        ("no-go", "CI and ownership checks must pass before launch."),
        ("defer", "Wait for hosted smoke evidence."),
    ]:
        response = client.post(
            f"/api/v1/projects/{project['id']}/artifacts",
            json={
                "title": f"Launch decision: {decision_tag}",
                "artifact_type": "decision",
                "source_type": "manual",
                "summary": summary,
                "tags": f"launch-decision,go-no-go,{decision_tag}",
            },
        )

        assert response.status_code == 201


def test_launch_decision_requires_manual_decision_contract(client):
    project = create_project(client)

    cases = [
        {
            "title": "Wrong type",
            "artifact_type": "note",
            "source_type": "manual",
            "summary": "Launch context.",
            "tags": "launch-decision,go-no-go,go",
        },
        {
            "title": "Wrong source",
            "artifact_type": "decision",
            "source_type": "system",
            "summary": "Launch context.",
            "tags": "launch-decision,go-no-go,go",
        },
        {
            "title": "Missing decision value",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "Launch context.",
            "tags": "launch-decision,go-no-go",
        },
        {
            "title": "Multiple decision values",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "Launch context.",
            "tags": "launch-decision,go-no-go,go,defer",
        },
        {
            "title": "No-go without notes",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": " ",
            "tags": "launch-decision,go-no-go,no-go",
        },
        {
            "title": "Defer without notes",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "",
            "tags": "launch-decision,go-no-go,defer",
        },
    ]

    for payload in cases:
        response = client.post(f"/api/v1/projects/{project['id']}/artifacts", json=payload)

        assert response.status_code == 422
        assert "Launch Decision" in response.json()["detail"]


def test_patch_validates_effective_launch_decision_state(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Launch decision: No-go",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "CI is still failing.",
            "tags": "launch-decision,go-no-go,no-go",
        },
    )
    artifact = create_response.json()

    invalid_response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={"summary": " ", "tags": "launch-decision,go-no-go,no-go"},
    )

    assert invalid_response.status_code == 422
    assert "No-go Launch Decision records require notes." in invalid_response.json()["detail"]

    remove_marker_response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={"summary": "CI is still failing.", "tags": "go-no-go,no-go"},
    )

    assert remove_marker_response.status_code == 422
    assert "launch-decision" in remove_marker_response.json()["detail"]

    valid_response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={"summary": "Hosted smoke proof is still missing.", "tags": "launch-decision,go-no-go,defer"},
    )

    assert valid_response.status_code == 200
    assert valid_response.json()["tags"] == "launch-decision,go-no-go,defer"


def test_patch_normal_artifact_into_valid_launch_decision(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Launch note",
            "artifact_type": "note",
            "source_type": "manual",
        },
    )
    artifact = create_response.json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={
            "title": "Launch decision: Defer",
            "artifact_type": "decision",
            "source_type": "manual",
            "summary": "Wait for hosted smoke evidence.",
            "tags": "launch-decision,go-no-go,defer",
        },
    )

    assert response.status_code == 200
    assert response.json()["artifact_type"] == "decision"
    assert response.json()["tags"] == "launch-decision,go-no-go,defer"


def test_patch_project_artifact_validation_error(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "API docs",
            "artifact_type": "document",
            "source_type": "external_url",
            "url": "https://docs.example.com/api",
        },
    )
    artifact = create_response.json()

    response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={"url": "ftp://docs.example.com/api"},
    )

    assert response.status_code == 422
    assert "Enter a valid HTTP or HTTPS URL" in str(response.json()["detail"])


def test_project_artifact_source_and_status_constraints_return_422(client):
    project = create_project(client)

    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Invalid source note",
            "artifact_type": "note",
            "source_type": "spreadsheet",
        },
    )

    assert create_response.status_code == 422
    assert "source_type" in str(create_response.json()["detail"])

    valid_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Status check note",
            "artifact_type": "note",
            "source_type": "manual",
        },
    )
    artifact = valid_response.json()

    patch_response = client.patch(
        f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}",
        json={"status": "deleted"},
    )

    assert patch_response.status_code == 422
    assert "status" in str(patch_response.json()["detail"])


def test_delete_archives_artifact_and_default_list_hides_it(client):
    project = create_project(client)
    create_response = client.post(
        f"/api/v1/projects/{project['id']}/artifacts",
        json={
            "title": "Old evidence note",
            "artifact_type": "evidence",
            "source_type": "manual",
        },
    )
    artifact = create_response.json()

    delete_response = client.delete(f"/api/v1/projects/{project['id']}/artifacts/{artifact['id']}")

    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "archived"

    list_response = client.get(f"/api/v1/projects/{project['id']}/artifacts")
    assert list_response.status_code == 200
    assert list_response.json() == []

    include_response = client.get(f"/api/v1/projects/{project['id']}/artifacts?include_archived=true")
    assert include_response.status_code == 200
    assert include_response.json()[0]["status"] == "archived"


def test_delete_project_artifact_wrong_project_returns_404(client):
    first_project = create_project(client, name="First Project")
    second_project = create_project(client, name="Second Project")
    create_response = client.post(
        f"/api/v1/projects/{first_project['id']}/artifacts",
        json={
            "title": "Other Project artifact",
            "artifact_type": "other",
            "source_type": "manual",
        },
    )
    artifact = create_response.json()

    response = client.delete(f"/api/v1/projects/{second_project['id']}/artifacts/{artifact['id']}")

    assert response.status_code == 404


def test_cross_project_artifacts_returns_count_and_most_recent_per_project(client):
    populated_project = create_project(client, name="Populated Project")
    client.post(
        f"/api/v1/projects/{populated_project['id']}/artifacts",
        json={"title": "First note", "artifact_type": "note", "source_type": "manual"},
    )
    client.post(
        f"/api/v1/projects/{populated_project['id']}/artifacts",
        json={"title": "Most recent note", "artifact_type": "note", "source_type": "manual"},
    )
    empty_project = create_project(client, name="Empty Project")

    response = client.get("/api/v1/artifacts-overview")

    assert response.status_code == 200
    by_project_id = {item["project_id"]: item for item in response.json()}
    populated = by_project_id[populated_project["id"]]
    assert populated["project_name"] == "Populated Project"
    assert populated["active_artifact_count"] == 2
    assert populated["most_recent_title"] == "Most recent note"

    empty = by_project_id[empty_project["id"]]
    assert empty["active_artifact_count"] == 0
    assert empty["most_recent_title"] is None


def test_cross_project_artifacts_returns_empty_list_with_no_projects(client):
    response = client.get("/api/v1/artifacts-overview")

    assert response.status_code == 200
    assert response.json() == []
