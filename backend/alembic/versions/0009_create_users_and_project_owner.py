"""create users and project owner

Revision ID: 0009_auth_ownership
Revises: 0008_activity_events
Create Date: 2026-07-31 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_auth_ownership"
down_revision: Union[str, None] = "0008_activity_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status in ('active', 'disabled')", name="ck_users_status"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_status", "users", ["status"], unique=False)
    op.add_column("projects", sa.Column("owner_user_id", sa.Integer(), nullable=True))
    op.create_index("ix_projects_owner_user_id", "projects", ["owner_user_id"], unique=False)
    op.create_foreign_key(
        "fk_projects_owner_user_id_users",
        "projects",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_projects_owner_user_id_users", "projects", type_="foreignkey")
    op.drop_index("ix_projects_owner_user_id", table_name="projects")
    op.drop_column("projects", "owner_user_id")
    op.drop_index("ix_users_status", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
