"""add github app installations and private repository metadata

Revision ID: 0012_github_app
Revises: 0011_repo_insights
Create Date: 2026-08-30 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0012_github_app"
down_revision: Union[str, None] = "0011_repo_insights"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("repo_integrations", sa.Column("github_repository_id", sa.BigInteger(), nullable=True))
    op.add_column("repo_integrations", sa.Column("github_installation_id", sa.BigInteger(), nullable=True))
    op.add_column("repo_integrations", sa.Column("is_private", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("repo_integrations", sa.Column("connection_mode", sa.String(length=32), server_default="public_url", nullable=False))
    op.create_table(
        "github_installations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("installation_id", sa.BigInteger(), nullable=False),
        sa.Column("account_id", sa.BigInteger(), nullable=False),
        sa.Column("account_login", sa.String(length=255), nullable=False),
        sa.Column("account_type", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("owner_user_id", "installation_id", name="uq_github_installation_owner"),
    )
    op.create_index("ix_github_installations_owner_user_id", "github_installations", ["owner_user_id"])
    op.create_index("ix_github_installations_installation_id", "github_installations", ["installation_id"])


def downgrade() -> None:
    op.drop_table("github_installations")
    op.drop_column("repo_integrations", "connection_mode")
    op.drop_column("repo_integrations", "is_private")
    op.drop_column("repo_integrations", "github_installation_id")
    op.drop_column("repo_integrations", "github_repository_id")
