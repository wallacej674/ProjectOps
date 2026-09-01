from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.repo_analysis import RepoAnalysisStatus


class RepoAnalysisRead(BaseModel):
    id: int
    project_id: int
    repo_integration_id: int
    status: RepoAnalysisStatus
    summary: str | None
    detected_stack: dict[str, Any]
    detected_files: list[str]
    detected_folders: list[str]
    signals: dict[str, bool]
    warnings: list[str]
    error_message: str | None
    total_files_scanned: int
    analysis_version: str = "codemap_lite_v1"
    insights: dict[str, Any] = Field(default_factory=dict)
    evidence_files: dict[str, list[str]] = Field(default_factory=dict)
    inspected_files: list[str] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
