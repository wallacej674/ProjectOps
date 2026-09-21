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
    assert "storageAutoscalingEnabled: false" in contents
    assert "ipAllowList: []" in contents


def test_render_blueprint_runs_the_health_monitor_scheduler_every_five_minutes():
    import yaml
    blueprint = yaml.safe_load(RENDER_BLUEPRINT.read_text(encoding='utf-8'))
    cron = next(service for service in blueprint['services'] if service['type'] == 'cron')
    assert cron['schedule'] == '*/5 * * * *'
    assert cron['dockerCommand'] == 'sh -c "python -m app.jobs.rehearsal_worker_preflight --schema-only && python -m app.jobs.run_due_health_checks"'


def test_render_beta_worker_shares_api_runtime_and_signup_is_invitation_only():
    import yaml
    blueprint = yaml.safe_load(RENDER_BLUEPRINT.read_text(encoding='utf-8'))
    services = {service['name']: service for service in blueprint['services']}
    api = services['projectops-api']
    worker = services['projectops-rehearsal-worker']
    api_env = {entry['key']: entry for entry in api['envVars']}
    worker_env = {entry['key']: entry for entry in worker['envVars']}
    assert api_env['PROJECTOPS_REGISTRATION_MODE']['value'] == 'invite_only'
    assert api_env['PROJECTOPS_REGISTRATION_INVITE_CODE']['generateValue'] is True
    assert worker['type'] == 'worker'
    assert worker['dockerCommand'] == 'python -m app.jobs.run_readiness_workflows'
    assert 'preDeployCommand' not in worker
    assert worker_env['PROJECTOPS_DATABASE_URL']['fromDatabase'] == api_env['PROJECTOPS_DATABASE_URL']['fromDatabase']
    for key in ('OPENAI_API_KEY', 'PROJECTOPS_CODE_RISK_AI_MODEL', 'PROJECTOPS_AUTH_SECRET_KEY', 'PROJECTOPS_CORS_ALLOWED_ORIGINS'):
        assert worker_env[key]['fromService'] == {'type': 'web', 'name': 'projectops-api', 'envVarKey': key}
