def test_cors_allows_configured_local_vite_origin(client):
    response = client.options(
        "/api/v1/projects",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_allows_authorization_header_for_configured_origin(client):
    response = client.options(
        "/api/v1/projects",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_cors_allows_and_exposes_request_id_header_for_configured_origin(client):
    preflight_response = client.options(
        "/api/v1/projects",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-Request-ID",
        },
    )
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert preflight_response.status_code == 200
    assert "x-request-id" in preflight_response.headers["access-control-allow-headers"].lower()
    assert "x-request-id" in response.headers["access-control-expose-headers"].lower()


def test_cors_does_not_allow_an_unconfigured_origin(client):
    response = client.options(
        "/api/v1/projects",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
