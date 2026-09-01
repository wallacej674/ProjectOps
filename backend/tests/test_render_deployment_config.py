from pathlib import Path


RENDER_BLUEPRINT = Path(__file__).resolve().parents[2] / "render.yaml"


def test_render_blueprint_defines_safe_production_lifecycle():
    contents = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    required_configuration = [
        "name: projectops-api",
        "runtime: docker",
        "rootDir: backend",
        "healthCheckPath: /health",
        "preDeployCommand: python -m alembic upgrade head",
        "autoDeployTrigger: checksPass",
        "numInstances: 1",
        "key: PROJECTOPS_ENVIRONMENT",
        "value: production",
        "key: PROJECTOPS_AUTH_SECRET_KEY",
        "generateValue: true",
        "key: PROJECTOPS_CORS_ALLOWED_ORIGINS",
        "sync: false",
    ]

    for setting in required_configuration:
        assert setting in contents


def test_render_blueprint_uses_private_managed_postgres():
    contents = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    assert "name: projectops-db" in contents
    assert "property: connectionString" in contents
    assert 'postgresMajorVersion: "16"' in contents
    assert "storageAutoscalingEnabled: true" in contents
    assert "ipAllowList: []" in contents


def test_render_blueprint_runs_the_health_monitor_scheduler_every_five_minutes():
    contents = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    assert "type: cron" in contents
    assert "name: projectops-health-monitor" in contents
    assert 'schedule: "*/5 * * * *"' in contents
    assert "dockerCommand: python -m app.jobs.run_due_health_checks" in contents


def test_render_blueprint_runs_the_health_monitor_scheduler_every_five_minutes():
    contents = RENDER_BLUEPRINT.read_text(encoding="utf-8")

    assert "type: cron" in contents
    assert "name: projectops-health-monitor" in contents
    assert 'schedule: "*/5 * * * *"' in contents
    assert "dockerCommand: python -m app.jobs.run_due_health_checks" in contents
