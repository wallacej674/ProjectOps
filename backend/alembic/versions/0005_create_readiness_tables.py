"""create readiness tables

Revision ID: 0005_create_readiness_tables
Revises: 0004_create_health_checks
Create Date: 2026-06-19 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0005_create_readiness_tables"
down_revision: Union[str, None] = "0004_create_health_checks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEFAULT_READINESS_ITEMS = [
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


def upgrade() -> None:
    readiness_items_table = op.create_table(
        "readiness_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("evaluation_type", sa.String(length=32), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "evaluation_type in ('automatic', 'manual')",
            name="ck_readiness_items_evaluation_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_readiness_items_key"),
    )

    op.create_table(
        "project_readiness_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("readiness_item_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("evidence", JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status in ('passed', 'failed', 'unknown', 'not_applicable')",
            name="ck_project_readiness_items_status",
        ),
        sa.CheckConstraint(
            "source in ('codemap', 'health_check', 'project', 'manual')",
            name="ck_project_readiness_items_source",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["readiness_item_id"], ["readiness_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "readiness_item_id", name="uq_project_readiness_items"),
    )
    op.create_index("ix_project_readiness_items_project_id", "project_readiness_items", ["project_id"], unique=False)
    op.create_index("ix_project_readiness_items_readiness_item_id", "project_readiness_items", ["readiness_item_id"], unique=False)

    op.bulk_insert(readiness_items_table, _DEFAULT_READINESS_ITEMS)


def downgrade() -> None:
    op.drop_index("ix_project_readiness_items_readiness_item_id", table_name="project_readiness_items")
    op.drop_index("ix_project_readiness_items_project_id", table_name="project_readiness_items")
    op.drop_table("project_readiness_items")
    op.drop_table("readiness_items")
