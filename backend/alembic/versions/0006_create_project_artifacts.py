"""create project artifacts

Revision ID: 0006_create_project_artifacts
Revises: 0005_create_readiness_tables
Create Date: 2026-07-27 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_create_project_artifacts"
down_revision: Union[str, None] = "0005_create_readiness_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_artifacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("artifact_type", sa.String(length=32), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("tags", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "artifact_type in ('note', 'document', 'link', 'runbook', 'decision', 'incident', 'requirement', 'risk', 'evidence', 'other')",
            name="ck_project_artifacts_artifact_type",
        ),
        sa.CheckConstraint(
            "source_type in ('manual', 'external_url', 'imported', 'system')",
            name="ck_project_artifacts_source_type",
        ),
        sa.CheckConstraint(
            "status in ('active', 'archived')",
            name="ck_project_artifacts_status",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_artifacts_project_id", "project_artifacts", ["project_id"], unique=False)
    op.create_index("ix_project_artifacts_artifact_type", "project_artifacts", ["artifact_type"], unique=False)
    op.create_index("ix_project_artifacts_source_type", "project_artifacts", ["source_type"], unique=False)
    op.create_index("ix_project_artifacts_status", "project_artifacts", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_project_artifacts_status", table_name="project_artifacts")
    op.drop_index("ix_project_artifacts_source_type", table_name="project_artifacts")
    op.drop_index("ix_project_artifacts_artifact_type", table_name="project_artifacts")
    op.drop_index("ix_project_artifacts_project_id", table_name="project_artifacts")
    op.drop_table("project_artifacts")
