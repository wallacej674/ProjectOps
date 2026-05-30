def create_project(client):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": "LaunchBudget",
            "description": "A budgeting app for product launches.",
            "repo_url": "https://github.com/example/launch-budget",
            "production_url": "https://launchbudget.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_project_dashboard_returns_project_metadata_and_placeholders(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["project"]["id"] == project["id"]
    assert dashboard["project"]["name"] == "LaunchBudget"
    assert dashboard["project"]["repo_url"] == "https://github.com/example/launch-budget"
    assert dashboard["project"]["production_url"] == "https://launchbudget.example.com"
    assert dashboard["project"]["status"] == "development"
    assert dashboard["repo"] == {
        "repo_url": "https://github.com/example/launch-budget",
        "connected": False,
        "message": "GitHub repo intake has not been implemented yet.",
    }
    assert dashboard["latest_repo_analysis"] is None
    assert dashboard["latest_health_check"] is None
    assert dashboard["readiness"] == {
        "score": None,
        "status": "not_started",
        "message": "Production readiness scoring has not been implemented yet.",
    }
    assert dashboard["next_steps"] == [
        "Connect a GitHub repository in a future milestone.",
        "Run CodeMap Lite analysis in a future milestone.",
        "Add a health endpoint check in a future milestone.",
        "Complete the production readiness checklist in a future milestone.",
    ]


def test_project_dashboard_returns_404_for_missing_project(client):
    response = client.get("/api/v1/projects/999/dashboard")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_project_dashboard_can_be_read_for_archived_project(client):
    project = create_project(client)
    archive_response = client.delete(f"/api/v1/projects/{project['id']}")
    assert archive_response.status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard")

    assert response.status_code == 200
    assert response.json()["project"]["status"] == "archived"
