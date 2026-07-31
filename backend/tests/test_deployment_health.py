def test_database_health_endpoint_verifies_database_connection(client):
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "reachable"}
