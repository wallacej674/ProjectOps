# Canonical source of truth for the default readiness item catalog.
#
# Rules for future additions:
#   1. Add the new item dict to DEFAULT_READINESS_CATALOG below.
#   2. Write a new Alembic migration that inserts the item via op.bulk_insert.
#   3. The parity test in test_readiness_service.py will catch any drift between
#      this list and migration 0005's frozen snapshot.
#
# Do NOT modify migration 0005. It is a frozen point-in-time data snapshot.

DEFAULT_READINESS_CATALOG: list[dict] = [
    {
        "key": "readme_present",
        "label": "README Present",
        "description": "The repository has a README.md at its root.",
        "category": "documentation",
        "evaluation_type": "automatic",
        "sort_order": 10,
        "is_active": True,
    },
    {
        "key": "tests_present",
        "label": "Tests Present",
        "description": "The repository contains a tests directory.",
        "category": "testing",
        "evaluation_type": "automatic",
        "sort_order": 20,
        "is_active": True,
    },
    {
        "key": "ci_configured",
        "label": "CI Configured",
        "description": "The repository has GitHub Actions workflows configured.",
        "category": "testing",
        "evaluation_type": "automatic",
        "sort_order": 30,
        "is_active": True,
    },
    {
        "key": "env_example_present",
        "label": "Environment Example Present",
        "description": "The repository has a .env.example file documenting required environment variables.",
        "category": "documentation",
        "evaluation_type": "automatic",
        "sort_order": 40,
        "is_active": True,
    },
    {
        "key": "production_url_configured",
        "label": "Production URL Configured",
        "description": "The project has a production_url set.",
        "category": "observability",
        "evaluation_type": "automatic",
        "sort_order": 50,
        "is_active": True,
    },
    {
        "key": "latest_health_check_healthy",
        "label": "Latest Health Check Healthy",
        "description": "The most recent health check returned a healthy status.",
        "category": "observability",
        "evaluation_type": "automatic",
        "sort_order": 60,
        "is_active": True,
    },
    {
        "key": "deployment_docs_reviewed",
        "label": "Deployment Docs Reviewed",
        "description": "An engineer has reviewed and confirmed the deployment documentation.",
        "category": "engineering_review",
        "evaluation_type": "manual",
        "sort_order": 70,
        "is_active": True,
    },
    {
        "key": "logging_error_handling_reviewed",
        "label": "Logging and Error Handling Reviewed",
        "description": "An engineer has reviewed logging and error handling for production suitability.",
        "category": "engineering_review",
        "evaluation_type": "manual",
        "sort_order": 80,
        "is_active": True,
    },
    {
        "key": "secrets_management_reviewed",
        "label": "Secrets Management Reviewed",
        "description": "An engineer has reviewed how secrets and credentials are managed.",
        "category": "engineering_review",
        "evaluation_type": "manual",
        "sort_order": 90,
        "is_active": True,
    },
]
