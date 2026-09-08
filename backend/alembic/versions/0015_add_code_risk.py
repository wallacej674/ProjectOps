"""Add local code-risk scan evidence and human review.

Revision ID: 0015_code_risk
Revises: 0014_health_alerts
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0015_code_risk'
down_revision = '0014_health_alerts'
branch_labels = None
depends_on = None

OLD_EVENT_TYPES = "'project_created', 'project_updated', 'project_archived', 'repository_attached', 'repository_replaced', 'repository_removed', 'codemap_analysis_completed', 'codemap_analysis_failed', 'health_alert_opened', 'health_alert_acknowledged', 'health_alert_recovered', 'health_alert_closed', 'health_check_healthy', 'health_check_unhealthy', 'health_check_timeout', 'health_check_error', 'readiness_evaluated', 'readiness_manual_item_updated', 'artifact_created', 'artifact_updated', 'artifact_archived', 'readiness_artifact_linked', 'readiness_artifact_unlinked'"


def upgrade():
    op.drop_constraint('ck_project_activity_events_type', 'project_activity_events', type_='check')
    op.create_check_constraint('ck_project_activity_events_type', 'project_activity_events',
        "event_type in (" + OLD_EVENT_TYPES + ", 'code_risk_scan_imported')")
    op.create_table('code_risk_targets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False))
    op.create_table('code_risk_scans',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('code_risk_targets.id'), nullable=False),
        sa.Column('run_id', sa.String(36), nullable=False),
        sa.Column('digest', sa.String(64), nullable=False),
        sa.Column('outcome', sa.String(20), nullable=False),
        sa.Column('report', JSONB(), nullable=False),
        sa.Column('imported_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('imported_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('artifact_id', sa.Integer(), sa.ForeignKey('project_artifacts.id')),
        sa.UniqueConstraint('target_id', 'run_id'))
    op.create_table('code_risk_findings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('code_risk_targets.id'), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('disposition', sa.String(30), nullable=False),
        sa.Column('review_version', sa.Integer(), nullable=False),
        sa.Column('review_history', JSONB(), nullable=False),
        sa.UniqueConstraint('target_id', 'fingerprint'))
    op.create_table('code_risk_occurrences',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('scan_id', sa.Integer(), sa.ForeignKey('code_risk_scans.id'), nullable=False),
        sa.Column('finding_id', sa.Integer(), sa.ForeignKey('code_risk_findings.id'), nullable=False),
        sa.Column('evidence', JSONB(), nullable=False),
        sa.UniqueConstraint('scan_id', 'finding_id'))
    op.create_table('code_risk_work_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', JSONB(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False))
    op.create_table('code_risk_work_item_findings',
        sa.Column('work_item_id', sa.Integer(), sa.ForeignKey('code_risk_work_items.id'), primary_key=True),
        sa.Column('finding_id', sa.Integer(), sa.ForeignKey('code_risk_findings.id'), primary_key=True))
    for table, columns in {
        'code_risk_targets': ['project_id'], 'code_risk_scans': ['target_id'],
        'code_risk_findings': ['target_id'], 'code_risk_occurrences': ['scan_id', 'finding_id'],
        'code_risk_work_items': ['project_id'],
    }.items():
        for column in columns:
            op.create_index(f'ix_{table}_{column}', table, [column])


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT count(*) FROM code_risk_scans')):
        raise RuntimeError('Scan history exists. Retain additive schema when rolling back application code.')
    op.drop_constraint('ck_project_activity_events_type', 'project_activity_events', type_='check')
    op.create_check_constraint('ck_project_activity_events_type', 'project_activity_events', 'event_type in (' + OLD_EVENT_TYPES + ')')
    for table in ('code_risk_work_item_findings', 'code_risk_work_items', 'code_risk_occurrences',
                  'code_risk_findings', 'code_risk_scans', 'code_risk_targets'):
        op.drop_table(table)
