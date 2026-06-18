"""create repo integrations

Revision ID: 0002_create_repo_integrations
Revises: 0001_create_projects
Create Date: 2026-06-17 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_create_repo_integrations"
down_revision: Union[str, None] = "0001_create_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "repo_integrations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("repo_owner", sa.String(length=200), nullable=False),
        sa.Column("repo_name", sa.String(length=200), nullable=False),
        sa.Column("repo_url", sa.String(length=2048), nullable=False),
        sa.Column("default_branch", sa.String(length=255), nullable=True),
        sa.Column("is_connected", sa.Boolean(), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("provider in ('github')", name="ck_repo_integrations_provider"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", name="uq_repo_integrations_project_id"),
    )
    op.create_index("ix_repo_integrations_project_id", "repo_integrations", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_repo_integrations_project_id", table_name="repo_integrations")
    op.drop_table("repo_integrations")
