"""add versioned repository analysis insights

Revision ID: 0011_repo_insights
Revises: 0010_artifact_creator
Create Date: 2026-08-30 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011_repo_insights"
down_revision: Union[str, None] = "0010_artifact_creator"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "repo_analyses",
        sa.Column("analysis_version", sa.String(length=32), server_default="codemap_lite_v1", nullable=False),
    )
    op.add_column(
        "repo_analyses",
        sa.Column("insights", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    )
    op.add_column(
        "repo_analyses",
        sa.Column("evidence_files", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    )
    op.add_column(
        "repo_analyses",
        sa.Column("inspected_files", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("repo_analyses", "inspected_files")
    op.drop_column("repo_analyses", "evidence_files")
    op.drop_column("repo_analyses", "insights")
    op.drop_column("repo_analyses", "analysis_version")
