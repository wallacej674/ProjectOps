"""Add CI pipeline run as a Release Rehearsal evidence source."""
from alembic import op
import sqlalchemy as sa

revision = '0022_ci_evidence'
down_revision = '0021_ci_pipeline_status'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('rehearsal_evidence',
        sa.Column('ci_run_id', sa.Integer(), sa.ForeignKey('ci_pipeline_runs.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_rehearsal_evidence_ci_run_id', 'rehearsal_evidence', ['ci_run_id'])


def downgrade():
    op.drop_index('ix_rehearsal_evidence_ci_run_id', table_name='rehearsal_evidence')
    op.drop_column('rehearsal_evidence', 'ci_run_id')
