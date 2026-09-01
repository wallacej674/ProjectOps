"""add scheduled health monitoring

Revision ID: 0013_health_monitor
Revises: 0012_github_app
Create Date: 2026-08-31 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013_health_monitor"
down_revision: Union[str, None] = "0012_github_app"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "health_checks",
        sa.Column("execution_source", sa.String(length=32), server_default="manual", nullable=False),
    )
    op.create_check_constraint(
        "ck_health_checks_execution_source",
        "health_checks",
        "execution_source in ('manual', 'scheduled')",
    )
    op.create_table(
        "health_monitor_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("cadence_minutes", sa.Integer(), server_default="60", nullable=False),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_outcome", sa.String(length=32), nullable=True),
        sa.Column("consecutive_failures", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("project_id", name="uq_health_monitor_schedules_project_id"),
        sa.CheckConstraint("cadence_minutes in (15, 60, 360, 1440)", name="ck_health_monitor_schedules_cadence"),
        sa.CheckConstraint(
            "last_outcome is null or last_outcome in ('healthy', 'unhealthy', 'timeout', 'error')",
            name="ck_health_monitor_schedules_last_outcome",
        ),
        sa.CheckConstraint("consecutive_failures >= 0", name="ck_health_monitor_schedules_consecutive_failures"),
    )
    op.create_index("ix_health_monitor_schedules_project_id", "health_monitor_schedules", ["project_id"])
    op.create_index("ix_health_monitor_schedules_next_run_at", "health_monitor_schedules", ["next_run_at"])


def downgrade() -> None:
    op.drop_table("health_monitor_schedules")
    op.drop_constraint("ck_health_checks_execution_source", "health_checks", type_="check")
    op.drop_column("health_checks", "execution_source")
