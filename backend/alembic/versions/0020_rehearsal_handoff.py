"""Immutable rehearsal assignments, returned evidence and human decisions."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0020_rehearsal_handoff'
down_revision = '0019_rehearsal_workflows'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('rehearsal_packets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('next_step_id', sa.Integer(), sa.ForeignKey('rehearsal_next_steps.id'), nullable=False),
        sa.Column('digest', sa.String(64), nullable=False),
        sa.Column('manifest', JSONB(), nullable=False),
        sa.Column('markdown', sa.String(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index('ix_rehearsal_packets_release_id', 'rehearsal_packets', ['release_id'])
    op.create_table('rehearsal_results',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('packet_id', sa.Integer(), sa.ForeignKey('rehearsal_packets.id'), nullable=False),
        sa.Column('scope_id', sa.Integer(), sa.ForeignKey('rehearsal_scopes.id'), nullable=False),
        sa.Column('request_key', sa.String(36), nullable=False),
        sa.Column('input_digest', sa.String(64), nullable=False),
        sa.Column('preview_digest', sa.String(64), nullable=False),
        sa.Column('payload', JSONB(), nullable=False),
        sa.Column('evidence_ids', JSONB(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('release_id', 'request_key'))
    op.create_index('ix_rehearsal_results_release_id', 'rehearsal_results', ['release_id'])
    op.create_table('rehearsal_result_evidence',
        sa.Column('result_id', sa.Integer(), sa.ForeignKey('rehearsal_results.id'), primary_key=True),
        sa.Column('evidence_id', sa.Integer(), sa.ForeignKey('rehearsal_evidence.id'), primary_key=True))
    op.create_table('rehearsal_decisions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('request_key', sa.String(36), nullable=False),
        sa.Column('input_digest', sa.String(64), nullable=False),
        sa.Column('digest', sa.String(64), nullable=False),
        sa.Column('decision', sa.String(20), nullable=False),
        sa.Column('reason', sa.String(2000), nullable=False),
        sa.Column('manifest', JSONB(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('release_id', 'request_key'))
    op.create_index('ix_rehearsal_decisions_release_id', 'rehearsal_decisions', ['release_id'])


def downgrade():
    for table in ('rehearsal_decisions', 'rehearsal_result_evidence', 'rehearsal_results', 'rehearsal_packets'):
        op.drop_table(table)

