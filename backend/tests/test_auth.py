from app.models.user import User


def register_user(client, email="engineer@example.com", password="correct horse battery staple", display_name="Engineer"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": display_name},
    )


def login_user(client, email="engineer@example.com", password="correct horse battery staple"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_user_hashes_password_and_returns_token(client, db):
    response = register_user(client)

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "engineer@example.com"
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]

    stored_user = db.query(User).filter(User.email == "engineer@example.com").one()
    assert stored_user.password_hash != "correct horse battery staple"
    assert stored_user.password_hash


def test_register_duplicate_email_fails(client):
    assert register_user(client).status_code == 201

    response = register_user(client, email="ENGINEER@example.com")

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with that email already exists."


def test_register_invalid_email_fails(client):
    response = register_user(client, email="not-an-email")

    assert response.status_code == 422


def test_register_blank_password_fails(client):
    response = register_user(client, password="   ")

    assert response.status_code == 422


def test_login_success_returns_bearer_token(client):
    assert register_user(client).status_code == 201

    response = login_user(client)

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "engineer@example.com"


def test_login_wrong_password_fails_with_generic_message(client):
    assert register_user(client).status_code == 201

    response = login_user(client, password="wrong-password")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_unknown_email_fails_with_generic_message(client):
    response = login_user(client, email="missing@example.com")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_me_returns_current_user(client):
    token = register_user(client).json()["access_token"]

    response = client.get("/api/v1/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == "engineer@example.com"


def test_me_without_token_returns_401(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_logout_returns_success_for_authenticated_user(client):
    token = register_user(client).json()["access_token"]

    response = client.post("/api/v1/auth/logout", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {"message": "You have been signed out."}


def test_update_profile_changes_display_name(client):
    token = register_user(client).json()["access_token"]

    response = client.patch(
        "/api/v1/auth/me",
        json={"display_name": "New Name"},
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["display_name"] == "New Name"
    assert client.get("/api/v1/auth/me", headers=auth_header(token)).json()["display_name"] == "New Name"


def test_update_profile_blank_display_name_clears_it(client):
    token = register_user(client).json()["access_token"]

    response = client.patch(
        "/api/v1/auth/me",
        json={"display_name": "   "},
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["display_name"] is None


def test_update_profile_without_token_returns_401(client):
    response = client.patch("/api/v1/auth/me", json={"display_name": "New Name"})

    assert response.status_code == 401


def test_change_password_with_correct_current_password_succeeds(client):
    token = register_user(client).json()["access_token"]

    response = client.post(
        "/api/v1/auth/me/password",
        json={"current_password": "correct horse battery staple", "new_password": "a new stronger password"},
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert login_user(client, password="a new stronger password").status_code == 200
    assert login_user(client, password="correct horse battery staple").status_code == 401


def test_change_password_with_wrong_current_password_fails(client):
    token = register_user(client).json()["access_token"]

    response = client.post(
        "/api/v1/auth/me/password",
        json={"current_password": "wrong-password", "new_password": "a new stronger password"},
        headers=auth_header(token),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Current password is incorrect."
    assert login_user(client, password="correct horse battery staple").status_code == 200


def test_change_password_too_short_fails(client):
    token = register_user(client).json()["access_token"]

    response = client.post(
        "/api/v1/auth/me/password",
        json={"current_password": "correct horse battery staple", "new_password": "short"},
        headers=auth_header(token),
    )

    assert response.status_code == 422


def test_change_password_without_token_returns_401(client):
    response = client.post(
        "/api/v1/auth/me/password",
        json={"current_password": "correct horse battery staple", "new_password": "a new stronger password"},
    )

    assert response.status_code == 401


def test_invite_only_registration_rejects_missing_and_wrong_code_before_account_creation(client, monkeypatch):
    from pydantic import SecretStr
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "registration_mode", "invite_only", raising=False)
    monkeypatch.setattr(settings, "registration_invite_code", SecretStr("synthetic-beta-invitation"), raising=False)
    payload = {"email": "beta@example.com", "password": "synthetic-password"}
    missing = client.post("/api/v1/auth/register", json=payload)
    wrong = client.post("/api/v1/auth/register", json={**payload, "invitation_code": "wrong"})
    assert missing.status_code == wrong.status_code == 403
    assert missing.json() == wrong.json()
    assert login_user(client, email=payload["email"], password=payload["password"]).status_code == 401
    accepted = client.post("/api/v1/auth/register", json={**payload, "invitation_code": "synthetic-beta-invitation"})
    assert accepted.status_code == 201


def test_closed_registration_preserves_existing_login(client, monkeypatch):
    from app.core.config import get_settings

    assert register_user(client).status_code == 201
    monkeypatch.setattr(get_settings(), "registration_mode", "closed")
    assert register_user(client, email="new@example.com").status_code == 403
    assert login_user(client).status_code == 200


def test_invite_only_registration_with_no_configured_code_fails_closed(client, monkeypatch):
    from pydantic import SecretStr
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "registration_mode", "invite_only")
    monkeypatch.setattr(get_settings(), "registration_invite_code", SecretStr(""))
    payload = {"email": "uninvited@example.com", "password": "synthetic-password", "invitation_code": ""}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Registration is unavailable or the invitation code is invalid."
    assert login_user(client, email=payload["email"], password=payload["password"]).status_code == 401
