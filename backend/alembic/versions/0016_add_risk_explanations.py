"""Retain generated code-risk advice and request lifecycle."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0016_risk_explanations'
down_revision = '0015_code_risk'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('code_risk_explanations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('occurrence_id', sa.Integer(), sa.ForeignKey('code_risk_occurrences.id'), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('request_key', sa.String(36), nullable=False),
        sa.Column('context_digest', sa.String(64), nullable=False),
        sa.Column('model', sa.String(200), nullable=False),
        sa.Column('prompt_version', sa.String(80), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('packet', JSONB, nullable=False),
        sa.Column('output', JSONB, nullable=True),
        sa.Column('usage', JSONB, nullable=True),
        sa.Column('failure', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('created_by', 'request_key'))
    for column in ('project_id', 'occurrence_id', 'created_by', 'context_digest'):
        op.create_index(f'ix_code_risk_explanations_{column}', 'code_risk_explanations', [column])

    op.create_table('code_risk_explanation_requests',
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('request_key', sa.String(36), primary_key=True),
        sa.Column('explanation_id', sa.Integer(), sa.ForeignKey('code_risk_explanations.id'), nullable=False))
    op.create_index('ix_code_risk_explanation_requests_explanation_id', 'code_risk_explanation_requests', ['explanation_id'])


def downgrade():
    raise RuntimeError('Explanation history is retained. Restore an application backup for destructive rollback.')
