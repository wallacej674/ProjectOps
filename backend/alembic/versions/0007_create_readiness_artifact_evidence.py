"""create readiness artifact evidence

Revision ID: 0007_readiness_artifacts
Revises: 0006_create_project_artifacts
Create Date: 2026-07-27 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_readiness_artifacts"
down_revision: Union[str, None] = "0006_create_project_artifacts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_readiness_artifact_evidence",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("readiness_item_id", sa.Integer(), nullable=False),
        sa.Column("artifact_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["artifact_id"], ["project_artifacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["readiness_item_id"], ["readiness_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "project_id",
            "readiness_item_id",
            "artifact_id",
            name="uq_project_readiness_artifact_evidence",
        ),
    )
    op.create_index(
        "ix_project_readiness_artifact_evidence_project_id",
        "project_readiness_artifact_evidence",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_readiness_artifact_evidence_readiness_item_id",
        "project_readiness_artifact_evidence",
        ["readiness_item_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_readiness_artifact_evidence_artifact_id",
        "project_readiness_artifact_evidence",
        ["artifact_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_readiness_artifact_evidence_artifact_id", table_name="project_readiness_artifact_evidence")
    op.drop_index(
        "ix_project_readiness_artifact_evidence_readiness_item_id",
        table_name="project_readiness_artifact_evidence",
    )
    op.drop_index("ix_project_readiness_artifact_evidence_project_id", table_name="project_readiness_artifact_evidence")
    op.drop_table("project_readiness_artifact_evidence")
