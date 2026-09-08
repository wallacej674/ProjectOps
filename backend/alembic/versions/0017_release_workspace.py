"""Versioned release briefs, requirements, and supporting material."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0017_release_workspace'
down_revision = '0016_risk_explanations'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('releases',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('current_brief_revision', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.create_index('ix_releases_project_id', 'releases', ['project_id'])
    op.create_index('uq_releases_active_project', 'releases', ['project_id'], unique=True, postgresql_where=sa.text('is_active = true'))
    op.create_table('release_brief_revisions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('content', JSONB, nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('confirmed_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('confirmed_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('release_id', 'revision'))
    op.create_index('ix_release_brief_revisions_release_id', 'release_brief_revisions', ['release_id'])
    op.create_table('release_requirements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('release_id', sa.Integer(), sa.ForeignKey('releases.id'), nullable=False),
        sa.Column('current_revision', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('retired', sa.Boolean(), nullable=False))
    op.create_index('ix_release_requirements_release_id', 'release_requirements', ['release_id'])
    op.create_table('release_requirement_revisions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('requirement_id', sa.Integer(), sa.ForeignKey('release_requirements.id'), nullable=False),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('brief_revision_id', sa.Integer(), sa.ForeignKey('release_brief_revisions.id'), nullable=False),
        sa.Column('content', JSONB, nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('confirmed_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('confirmed_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('requirement_id', 'revision'))
    op.create_index('ix_release_requirement_revisions_requirement_id', 'release_requirement_revisions', ['requirement_id'])
    op.create_table('release_requirement_materials',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('requirement_revision_id', sa.Integer(), sa.ForeignKey('release_requirement_revisions.id'), nullable=False),
        sa.Column('artifact_id', sa.Integer(), sa.ForeignKey('project_artifacts.id'), nullable=False),
        sa.Column('snapshot', JSONB, nullable=False),
        sa.Column('digest', sa.String(64), nullable=False),
        sa.Column('linked_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('linked_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('requirement_revision_id', 'artifact_id', 'digest'))
    op.create_index('ix_release_requirement_materials_requirement_revision_id', 'release_requirement_materials', ['requirement_revision_id'])


def downgrade():
    raise RuntimeError('Release and requirement history is retained; use an explicitly reviewed backup restoration for destructive rollback.')
