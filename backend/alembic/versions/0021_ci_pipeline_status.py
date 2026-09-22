"""Add GitHub Actions CI pipeline run tracking and scheduled status polling."""
from alembic import op
import sqlalchemy as sa

revision = '0021_ci_pipeline_status'
down_revision = '0020_rehearsal_handoff'
branch_labels = None
depends_on = None

OLD_CATEGORIES = "'project', 'repository', 'codemap', 'health', 'readiness', 'artifact', 'evidence'"
NEW_CATEGORIES = f"{OLD_CATEGORIES}, 'ci'"

OLD_EVENT_TYPES = (
    "'project_created', 'project_updated', 'project_archived', "
    "'repository_attached', 'repository_replaced', 'repository_removed', "
    "'codemap_analysis_completed', 'codemap_analysis_failed', 'code_risk_scan_imported', "
    "'health_alert_opened', 'health_alert_acknowledged', 'health_alert_recovered', 'health_alert_closed', "
    "'health_check_healthy', 'health_check_unhealthy', 'health_check_timeout', 'health_check_error', "
    "'readiness_evaluated', 'readiness_manual_item_updated', "
    "'artifact_created', 'artifact_updated', 'artifact_archived', "
    "'readiness_artifact_linked', 'readiness_artifact_unlinked'"
)
NEW_EVENT_TYPES = (
    f"{OLD_EVENT_TYPES}, "
    "'ci_run_succeeded', 'ci_run_failed', 'ci_run_other_conclusion', 'ci_sync_failed'"
)


def upgrade():
    op.create_table('ci_pipeline_runs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('repo_integration_id', sa.Integer(), sa.ForeignKey('repo_integrations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('github_run_id', sa.BigInteger(), nullable=False),
        sa.Column('github_workflow_id', sa.BigInteger(), nullable=True),
        sa.Column('workflow_name', sa.String(255), nullable=False),
        sa.Column('run_number', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('conclusion', sa.String(32), nullable=True),
        sa.Column('branch', sa.String(255), nullable=True),
        sa.Column('commit_sha', sa.String(40), nullable=True),
        sa.Column('commit_message', sa.String(500), nullable=True),
        sa.Column('event', sa.String(64), nullable=True),
        sa.Column('html_url', sa.String(2048), nullable=True),
        sa.Column('run_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('run_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('repo_integration_id', 'github_run_id', name='uq_ci_pipeline_runs_repo_run'))
    for column in ('project_id', 'repo_integration_id'):
        op.create_index(f'ix_ci_pipeline_runs_{column}', 'ci_pipeline_runs', [column])
    op.create_index('ix_ci_pipeline_runs_project_started', 'ci_pipeline_runs', ['project_id', 'run_started_at'])

    op.create_table('ci_status_monitor_schedules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('cadence_minutes', sa.Integer(), server_default='60', nullable=False),
        sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_outcome', sa.String(32), nullable=True),
        sa.Column('consecutive_sync_failures', sa.Integer(), server_default='0', nullable=False),
        sa.Column('generation', sa.Integer(), server_default='0', nullable=False),
        sa.Column('claim_id', sa.String(36), nullable=True),
        sa.Column('claim_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('project_id', name='uq_ci_status_monitor_schedules_project_id'),
        sa.CheckConstraint('cadence_minutes in (15, 60, 360, 1440)', name='ck_ci_status_monitor_schedules_cadence'),
        sa.CheckConstraint(
            "last_outcome is null or last_outcome in "
            "('synced', 'no_runs_found', 'permission_missing', 'repo_not_found', 'sync_error')",
            name='ck_ci_status_monitor_schedules_last_outcome'),
        sa.CheckConstraint('consecutive_sync_failures >= 0', name='ck_ci_status_monitor_schedules_consecutive_failures'))
    op.create_index('ix_ci_status_monitor_schedules_project_id', 'ci_status_monitor_schedules', ['project_id'])
    op.create_index('ix_ci_status_monitor_schedules_next_run_at', 'ci_status_monitor_schedules', ['next_run_at'])

    op.drop_constraint('ck_project_activity_events_category', 'project_activity_events', type_='check')
    op.create_check_constraint('ck_project_activity_events_category', 'project_activity_events',
        f"event_category in ({NEW_CATEGORIES})")
    op.drop_constraint('ck_project_activity_events_type', 'project_activity_events', type_='check')
    op.create_check_constraint('ck_project_activity_events_type', 'project_activity_events',
        f"event_type in ({NEW_EVENT_TYPES})")


def downgrade():
    op.drop_constraint('ck_project_activity_events_type', 'project_activity_events', type_='check')
    op.create_check_constraint('ck_project_activity_events_type', 'project_activity_events',
        f"event_type in ({OLD_EVENT_TYPES})")
    op.drop_constraint('ck_project_activity_events_category', 'project_activity_events', type_='check')
    op.create_check_constraint('ck_project_activity_events_category', 'project_activity_events',
        f"event_category in ({OLD_CATEGORIES})")

    op.drop_table('ci_status_monitor_schedules')
    op.drop_table('ci_pipeline_runs')
