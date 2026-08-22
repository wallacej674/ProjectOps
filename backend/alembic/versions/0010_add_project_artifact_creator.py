"""add project artifact creator attribution

Revision ID: 0010_artifact_creator
Revises: 0009_auth_ownership
Create Date: 2026-08-22 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_artifact_creator"
down_revision: Union[str, None] = "0009_auth_ownership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("project_artifacts", sa.Column("created_by_user_id", sa.Integer(), nullable=True))
    op.create_index(
        "ix_project_artifacts_created_by_user_id",
        "project_artifacts",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_project_artifacts_created_by_user_id_users",
        "project_artifacts",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_project_artifacts_created_by_user_id_users", "project_artifacts", type_="foreignkey")
    op.drop_index("ix_project_artifacts_created_by_user_id", table_name="project_artifacts")
    op.drop_column("project_artifacts", "created_by_user_id")
