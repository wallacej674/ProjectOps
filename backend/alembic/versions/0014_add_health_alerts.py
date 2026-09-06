"""Persist health alert episodes and leased scheduled observations.

Revision ID: 0014_health_alerts
Revises: 0013_health_monitor
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_health_alerts"
down_revision = "0013_health_monitor"
branch_labels = None
depends_on = None

OLD_EVENTS = "'project_created', 'project_updated', 'project_archived', 'repository_attached', 'repository_replaced', 'repository_removed', 'codemap_analysis_completed', 'codemap_analysis_failed', 'health_check_healthy', 'health_check_unhealthy', 'health_check_timeout', 'health_check_error', 'readiness_evaluated', 'readiness_manual_item_updated', 'artifact_created', 'artifact_updated', 'artifact_archived', 'readiness_artifact_linked', 'readiness_artifact_unlinked'"
NEW_EVENTS = "'health_alert_opened', 'health_alert_acknowledged', 'health_alert_recovered', 'health_alert_closed'"


def upgrade():
    op.create_table("health_alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("target_url", sa.String(2048), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        *[sa.Column(name, sa.DateTime(timezone=True), nullable=False) for name in ("first_failure_at", "opened_at", "last_observed_at")],
        *[sa.Column(name, sa.DateTime(timezone=True)) for name in ("recovered_at", "closed_at", "acknowledged_at")],
        *[sa.Column(name, sa.Integer(), sa.ForeignKey("health_checks.id"), nullable=False) for name in ("first_check_id", "opening_check_id", "latest_check_id")],
        sa.Column("recovery_check_id", sa.Integer(), sa.ForeignKey("health_checks.id")),
        sa.Column("failure_count", sa.Integer(), nullable=False),
        sa.Column("acknowledged_by_user_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("closure_reason", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status in ('active', 'recovered', 'closed')", name="ck_health_alert_status"),
        sa.CheckConstraint("failure_count >= 2", name="ck_health_alert_failure_count"),
        sa.CheckConstraint("closure_reason is null or closure_reason in ('target_changed', 'target_removed', 'project_archived')", name="ck_health_alert_closure_reason"),
    )
    op.create_index("ix_health_alerts_project_id", "health_alerts", ["project_id"])
    op.create_index("uq_health_alert_active_project", "health_alerts", ["project_id"], unique=True, postgresql_where=sa.text("status = 'active'"))
    op.create_table("health_alert_evidence",
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("health_alerts.id"), primary_key=True),
        sa.Column("health_check_id", sa.Integer(), sa.ForeignKey("health_checks.id"), primary_key=True),
    )
    for name in ("consecutive_healthy", "generation"):
        op.add_column("health_monitor_schedules", sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
    op.add_column("health_monitor_schedules", sa.Column("first_failure_check_id", sa.Integer()))
    op.create_foreign_key("fk_monitor_first_failure", "health_monitor_schedules", "health_checks", ["first_failure_check_id"], ["id"])
    for name in ("sequence_started_at", "sequence_completed_at", "claim_expires_at"):
        op.add_column("health_monitor_schedules", sa.Column(name, sa.DateTime(timezone=True)))
    op.add_column("health_monitor_schedules", sa.Column("claim_id", sa.String(36)))
    op.execute("UPDATE health_monitor_schedules SET consecutive_failures = 0, sequence_started_at = CURRENT_TIMESTAMP, next_run_at = CASE WHEN enabled THEN CURRENT_TIMESTAMP + cadence_minutes * INTERVAL '1 minute' ELSE NULL END")
    op.drop_constraint("ck_project_activity_events_type", "project_activity_events", type_="check")
    op.create_check_constraint("ck_project_activity_events_type", "project_activity_events", f"event_type in ({OLD_EVENTS}, {NEW_EVENTS})")


def downgrade():
    # Preserve evidence: require an explicit operator data-retention decision first.
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT count(*) FROM health_alerts")) or connection.scalar(sa.text(f"SELECT count(*) FROM project_activity_events WHERE event_type in ({NEW_EVENTS})")):
        raise RuntimeError("Health alert history exists. Retain the additive migration when rolling back application code.")
    op.drop_constraint("ck_project_activity_events_type", "project_activity_events", type_="check")
    op.create_check_constraint("ck_project_activity_events_type", "project_activity_events", f"event_type in ({OLD_EVENTS})")
    op.drop_constraint("fk_monitor_first_failure", "health_monitor_schedules", type_="foreignkey")
    for name in ("claim_id", "claim_expires_at", "sequence_completed_at", "sequence_started_at", "first_failure_check_id", "generation", "consecutive_healthy"):
        op.drop_column("health_monitor_schedules", name)
    op.drop_table("health_alert_evidence")
    op.drop_table("health_alerts")
