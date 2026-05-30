def create_project(client, name="ProjectOps"):
    response = client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": "A software project command center.",
            "repo_url": "https://github.com/example/projectops",
            "production_url": "https://projectops.example.com",
            "status": "development",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_project(client):
    project = create_project(client)

    assert project["id"] > 0
    assert project["name"] == "ProjectOps"
    assert project["status"] == "development"
    assert project["created_at"] is not None
    assert project["updated_at"] is not None


def test_list_projects_excludes_archived_projects_by_default(client):
    active_project = create_project(client, name="Active Project")
    archived_project = create_project(client, name="Archived Project")

    archive_response = client.delete(f"/api/v1/projects/{archived_project['id']}")
    assert archive_response.status_code == 200

    response = client.get("/api/v1/projects")

    assert response.status_code == 200
    project_ids = {project["id"] for project in response.json()}
    assert active_project["id"] in project_ids
    assert archived_project["id"] not in project_ids


def test_list_projects_can_include_archived_projects(client):
    archived_project = create_project(client, name="Archived Project")
    client.delete(f"/api/v1/projects/{archived_project['id']}")

    response = client.get("/api/v1/projects?include_archived=true")

    assert response.status_code == 200
    project_ids = {project["id"] for project in response.json()}
    assert archived_project["id"] in project_ids


def test_get_project(client):
    project = create_project(client)

    response = client.get(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == project["id"]


def test_update_project(client):
    project = create_project(client)

    response = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "ProjectOps Backend", "status": "staging"},
    )

    assert response.status_code == 200
    updated_project = response.json()
    assert updated_project["name"] == "ProjectOps Backend"
    assert updated_project["status"] == "staging"


def test_delete_archives_project_instead_of_removing_it(client):
    project = create_project(client)

    delete_response = client.delete(f"/api/v1/projects/{project['id']}")

    assert delete_response.status_code == 200
    archived_project = delete_response.json()
    assert archived_project["id"] == project["id"]
    assert archived_project["status"] == "archived"

    get_response = client.get(f"/api/v1/projects/{project['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["status"] == "archived"


def test_missing_project_returns_404(client):
    response = client.get("/api/v1/projects/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project 999 was not found."
