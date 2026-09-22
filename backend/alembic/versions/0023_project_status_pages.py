"""Add per-Project public status page settings."""
from alembic import op
import sqlalchemy as sa

revision = '0023_project_status_pages'
down_revision = '0022_ci_evidence'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('project_status_pages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('slug', sa.String(64), nullable=False),
        sa.Column('label', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('project_id', name='uq_project_status_pages_project_id'),
        sa.UniqueConstraint('slug', name='uq_project_status_pages_slug'))
    op.create_index('ix_project_status_pages_project_id', 'project_status_pages', ['project_id'])
    op.create_index('ix_project_status_pages_slug', 'project_status_pages', ['slug'])


def downgrade():
    op.drop_table('project_status_pages')
