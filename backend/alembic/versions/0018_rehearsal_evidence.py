"""Immutable release scope, evidence, assessments and verification work."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0018_rehearsal_evidence'
down_revision = '0017_release_workspace'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('rehearsal_next_steps',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('content', JSONB, nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('provenance', JSONB, nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_rehearsal_next_steps_release_id', 'rehearsal_next_steps', ['release_id'], unique=False)
    op.create_table('rehearsal_scopes',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('brief_revision', sa.Integer(), nullable=False),
        sa.Column('source', JSONB, nullable=False),
        sa.Column('environment', sa.String(length=500), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('release_id', 'version'))
    op.create_index('ix_rehearsal_scopes_release_id', 'rehearsal_scopes', ['release_id'], unique=False)
    op.create_table('rehearsal_dispositions',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('requirement_id', sa.Integer(), sa.ForeignKey('release_requirements.id'), nullable=False),
        sa.Column('requirement_revision', sa.Integer(), nullable=False),
        sa.Column('disposition', sa.String(length=30), nullable=False),
        sa.Column('reason', sa.String(length=2000), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_rehearsal_dispositions_requirement_id', 'rehearsal_dispositions', ['requirement_id'], unique=False)
    op.create_index('ix_rehearsal_dispositions_release_id', 'rehearsal_dispositions', ['release_id'], unique=False)
    op.create_table('rehearsal_next_step_dependencies',
        sa.Column('next_step_id', sa.Integer(), sa.ForeignKey('rehearsal_next_steps.id'), primary_key=True, nullable=False),
        sa.Column('dependency_id', sa.Integer(), sa.ForeignKey('rehearsal_next_steps.id'), primary_key=True, nullable=False))
    op.create_table('rehearsal_next_step_requirements',
        sa.Column('next_step_id', sa.Integer(), sa.ForeignKey('rehearsal_next_steps.id'), primary_key=True, nullable=False),
        sa.Column('requirement_id', sa.Integer(), sa.ForeignKey('release_requirements.id'), primary_key=True, nullable=False))
    op.create_table('rehearsal_next_step_reviews',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('next_step_id', sa.Integer(), sa.ForeignKey('rehearsal_next_steps.id'), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('reason', sa.String(length=2000), nullable=False),
        sa.Column('evidence_ids', JSONB, nullable=False),
        sa.Column('content_snapshot', JSONB, nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_rehearsal_next_step_reviews_next_step_id', 'rehearsal_next_step_reviews', ['next_step_id'], unique=False)
    op.create_table('rehearsal_assessments',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('requirement_id', sa.Integer(), sa.ForeignKey('release_requirements.id'), nullable=False),
        sa.Column('requirement_revision', sa.Integer(), nullable=False),
        sa.Column('requirement_revision_id', sa.Integer(), sa.ForeignKey('release_requirement_revisions.id'), nullable=False),
        sa.Column('scope_id', sa.Integer(), sa.ForeignKey('rehearsal_scopes.id'), nullable=False),
        sa.Column('outcome', sa.String(length=30), nullable=False),
        sa.Column('rationale', sa.String(length=2000), nullable=False),
        sa.Column('limitations', JSONB, nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('review_status', sa.String(length=30), nullable=False),
        sa.Column('provenance', JSONB, nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_rehearsal_assessments_requirement_id', 'rehearsal_assessments', ['requirement_id'], unique=False)
    op.create_index('ix_rehearsal_assessments_release_id', 'rehearsal_assessments', ['release_id'], unique=False)
    op.create_table('rehearsal_assessment_reviews',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('rehearsal_assessments.id'), nullable=False),
        sa.Column('action', sa.String(length=30), nullable=False),
        sa.Column('reason', sa.String(length=2000), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_rehearsal_assessment_reviews_assessment_id', 'rehearsal_assessment_reviews', ['assessment_id'], unique=False)
    op.create_table('rehearsal_evidence',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('requirement_id', sa.Integer(), sa.ForeignKey('release_requirements.id'), nullable=False),
        sa.Column('requirement_revision', sa.Integer(), nullable=False),
        sa.Column('requirement_revision_id', sa.Integer(), sa.ForeignKey('release_requirement_revisions.id'), nullable=False),
        sa.Column('scope_id', sa.Integer(), sa.ForeignKey('rehearsal_scopes.id'), nullable=False),
        sa.Column('request_key', sa.String(length=36), nullable=False),
        sa.Column('input_digest', sa.String(length=64), nullable=False),
        sa.Column('kind', sa.String(length=30), nullable=False),
        sa.Column('origin', sa.String(length=30), nullable=False),
        sa.Column('digest', sa.String(length=64), nullable=False),
        sa.Column('payload', JSONB, nullable=False),
        sa.Column('limitations', JSONB, nullable=False),
        sa.Column('material_id', sa.Integer(), sa.ForeignKey('release_requirement_materials.id'), nullable=True),
        sa.Column('occurrence_id', sa.Integer(), sa.ForeignKey('code_risk_occurrences.id'), nullable=True),
        sa.Column('health_check_id', sa.Integer(), sa.ForeignKey('health_checks.id'), nullable=True),
        sa.Column('readiness_id', sa.Integer(), sa.ForeignKey('project_readiness_items.id'), nullable=True),
        sa.Column('analysis_id', sa.Integer(), sa.ForeignKey('repo_analyses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('release_id', 'request_key'))
    op.create_index('ix_rehearsal_evidence_requirement_id', 'rehearsal_evidence', ['requirement_id'], unique=False)
    op.create_index('ix_rehearsal_evidence_release_id', 'rehearsal_evidence', ['release_id'], unique=False)
    op.create_table('rehearsal_assessment_evidence',
        sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('rehearsal_assessments.id'), primary_key=True, nullable=False),
        sa.Column('evidence_id', sa.Integer(), sa.ForeignKey('rehearsal_evidence.id'), primary_key=True, nullable=False))


def downgrade():
    raise RuntimeError('Rehearsal evidence history is retained; restore a reviewed backup for destructive rollback.')
