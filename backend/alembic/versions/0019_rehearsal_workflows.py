"""Durable rehearsal review reservations and fenced execution."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0019_rehearsal_workflows'
down_revision = '0018_rehearsal_evidence'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('rehearsal_workflows',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('request_key', sa.String(36), nullable=False),
        sa.Column('digest', sa.String(64), nullable=False),
        sa.Column('manifest', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('fence', sa.Integer(), nullable=False),
        sa.Column('reserved_tokens', sa.Integer(), nullable=False),
        sa.Column('output', postgresql.JSONB(), nullable=True),
        sa.Column('usage', postgresql.JSONB(), nullable=True),
        sa.Column('failure', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('dispatched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lease_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('created_by', 'request_key'))
    for column in ('project_id', 'release_id', 'created_by', 'status'):
        op.create_index('ix_rehearsal_workflows_' + column, 'rehearsal_workflows', [column])

    op.create_table('rehearsal_workflow_requests',
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('request_key', sa.String(36), primary_key=True),
        sa.Column('workflow_id', sa.Integer(), sa.ForeignKey('rehearsal_workflows.id'), nullable=False))
    op.create_index('ix_rehearsal_workflow_requests_workflow_id', 'rehearsal_workflow_requests', ['workflow_id'])


def downgrade():
    op.drop_table('rehearsal_workflow_requests')
    op.drop_table('rehearsal_workflows')
