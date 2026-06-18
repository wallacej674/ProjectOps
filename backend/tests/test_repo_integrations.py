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


def test_attach_github_repo_to_project(client):
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex.git"},
    )

    assert response.status_code == 201
    repo = response.json()
    assert repo["id"] > 0
    assert repo["project_id"] == project["id"]
    assert repo["provider"] == "github"
    assert repo["repo_owner"] == "openai"
    assert repo["repo_name"] == "codex"
    assert repo["repo_url"] == "https://github.com/openai/codex"
    assert repo["default_branch"] is None
    assert repo["is_connected"] is True
    assert repo["last_verified_at"] is None
    assert repo["created_at"] is not None
    assert repo["updated_at"] is not None


def test_attach_github_repo_replaces_existing_repo_connection(client):
    project = create_project(client)
    first_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert first_response.status_code == 201

    second_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "git@github.com:python/cpython.git"},
    )

    assert second_response.status_code == 201
    repo = second_response.json()
    assert repo["id"] == first_response.json()["id"]
    assert repo["repo_owner"] == "python"
    assert repo["repo_name"] == "cpython"
    assert repo["repo_url"] == "https://github.com/python/cpython"


def test_get_project_repo_returns_attached_repo(client):
    project = create_project(client)
    attach_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert attach_response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/repo")

    assert response.status_code == 200
    assert response.json() == attach_response.json()


def test_delete_project_repo_removes_attached_repo(client):
    project = create_project(client)
    attach_response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )
    assert attach_response.status_code == 201

    delete_response = client.delete(f"/api/v1/projects/{project['id']}/repo")
    get_response = client.get(f"/api/v1/projects/{project['id']}/repo")

    assert delete_response.status_code == 204
    assert get_response.status_code == 404
    assert get_response.json()["detail"] == f"Project {project['id']} does not have an attached repo."


def test_attach_repo_to_missing_project_returns_404(client):
    response = client.post(
        "/api/v1/projects/999/repo",
        json={"repo_url": "https://github.com/openai/codex"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."


def test_attach_invalid_github_repo_url_returns_422(client):
    project = create_project(client)

    response = client.post(
        f"/api/v1/projects/{project['id']}/repo",
        json={"repo_url": "https://gitlab.com/openai/codex"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Enter a valid GitHub repository URL."
