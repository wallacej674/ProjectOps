"""create repo analyses

Revision ID: 0003_create_repo_analyses
Revises: 0002_create_repo_integrations
Create Date: 2026-06-18 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_create_repo_analyses"
down_revision: Union[str, None] = "0002_create_repo_integrations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "repo_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("repo_integration_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("detected_stack", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("detected_files", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("detected_folders", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("signals", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("warnings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("total_files_scanned", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status in ('completed', 'failed')", name="ck_repo_analyses_status"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["repo_integration_id"], ["repo_integrations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_repo_analyses_project_id", "repo_analyses", ["project_id"], unique=False)
    op.create_index(
        "ix_repo_analyses_repo_integration_id",
        "repo_analyses",
        ["repo_integration_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_repo_analyses_repo_integration_id", table_name="repo_analyses")
    op.drop_index("ix_repo_analyses_project_id", table_name="repo_analyses")
    op.drop_table("repo_analyses")
