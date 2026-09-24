"""Add per-Project Health Alert webhook delivery settings."""
from alembic import op
import sqlalchemy as sa

revision = '0024_project_alert_webhooks'
down_revision = '0023_project_status_pages'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('project_alert_webhooks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('url', sa.String(2048), server_default='', nullable=False),
        sa.Column('last_delivery_attempted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_delivery_transition', sa.String(16), nullable=True),
        sa.Column('last_delivery_outcome', sa.String(16), nullable=True),
        sa.Column('last_delivery_http_status', sa.Integer(), nullable=True),
        sa.Column('last_delivery_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('project_id', name='uq_project_alert_webhooks_project_id'),
        sa.CheckConstraint(
            "last_delivery_outcome is null or last_delivery_outcome in ('delivered', 'failed')",
            name='ck_project_alert_webhooks_last_delivery_outcome'))
    op.create_index('ix_project_alert_webhooks_project_id', 'project_alert_webhooks', ['project_id'])


def downgrade():
    op.drop_table('project_alert_webhooks')
