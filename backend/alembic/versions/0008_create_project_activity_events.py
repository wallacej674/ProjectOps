"""create project activity events

Revision ID: 0008_activity_events
Revises: 0007_readiness_artifacts
Create Date: 2026-07-28 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0008_activity_events"
down_revision: Union[str, None] = "0007_readiness_artifacts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_activity_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("event_category", sa.String(length=32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("related_resource_type", sa.String(length=64), nullable=True),
        sa.Column("related_resource_id", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "event_category in ('project', 'repository', 'codemap', 'health', 'readiness', 'artifact', 'evidence')",
            name="ck_project_activity_events_category",
        ),
        sa.CheckConstraint(
            "event_type in ("
            "'project_created', 'project_updated', 'project_archived', "
            "'repository_attached', 'repository_replaced', 'repository_removed', "
            "'codemap_analysis_completed', 'codemap_analysis_failed', "
            "'health_check_healthy', 'health_check_unhealthy', 'health_check_timeout', 'health_check_error', "
            "'readiness_evaluated', 'readiness_manual_item_updated', "
            "'artifact_created', 'artifact_updated', 'artifact_archived', "
            "'readiness_artifact_linked', 'readiness_artifact_unlinked'"
            ")",
            name="ck_project_activity_events_type",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_activity_events_project_id", "project_activity_events", ["project_id"], unique=False)
    op.create_index("ix_project_activity_events_event_type", "project_activity_events", ["event_type"], unique=False)
    op.create_index(
        "ix_project_activity_events_event_category",
        "project_activity_events",
        ["event_category"],
        unique=False,
    )
    op.create_index("ix_project_activity_events_created_at", "project_activity_events", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_project_activity_events_created_at", table_name="project_activity_events")
    op.drop_index("ix_project_activity_events_event_category", table_name="project_activity_events")
    op.drop_index("ix_project_activity_events_event_type", table_name="project_activity_events")
    op.drop_index("ix_project_activity_events_project_id", table_name="project_activity_events")
    op.drop_table("project_activity_events")
