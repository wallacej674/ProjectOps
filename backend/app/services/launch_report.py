from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.schemas.dashboard import ProjectDashboardRead
from app.schemas.launch_report import (
    LaunchChecklistItemRead,
    LaunchChecklistStatus,
    LaunchChecklistSummary,
    LaunchDecision,
    LaunchEvidenceSummary,
    ProjectLaunchChecklistRead,
    ProjectLaunchReportRead,
)
from app.schemas.readiness import ProjectReadinessEvidenceCoverage
from app.services.dashboard import dashboard_service
from app.services.readiness import readiness_service


class LaunchReportService:
    def get_launch_report(self, db: Session, project_id: int) -> ProjectLaunchReportRead:
        dashboard = dashboard_service.get_project_dashboard(db, project_id)
        coverage = readiness_service.get_evidence_coverage(db, project_id)
        return self.build_launch_report(dashboard, coverage)

    def get_launch_checklist(self, db: Session, project_id: int) -> ProjectLaunchChecklistRead:
        dashboard = dashboard_service.get_project_dashboard(db, project_id)
        coverage = readiness_service.get_evidence_coverage(db, project_id)
        return self.build_launch_checklist(dashboard, coverage)

    def build_launch_report(
        self,
        dashboard: ProjectDashboardRead,
        coverage: ProjectReadinessEvidenceCoverage,
    ) -> ProjectLaunchReportRead:
        evidence = self._evidence_summary(dashboard, coverage)
        decision = self._decision_for_report(dashboard, evidence)
        return ProjectLaunchReportRead(
            project=dashboard.project,
            generated_at=datetime.now(timezone.utc),
            decision=decision,
            headline=self._headline(dashboard.project.name, decision),
            readiness=dashboard.readiness,
            evidence_summary=evidence,
            blockers=self._blockers(dashboard, evidence),
            recommended_actions=self._recommended_actions(dashboard, evidence),
        )

    def build_launch_checklist(
        self,
        dashboard: ProjectDashboardRead,
        coverage: ProjectReadinessEvidenceCoverage,
    ) -> ProjectLaunchChecklistRead:
        evidence = self._evidence_summary(dashboard, coverage)
        items = [
            LaunchChecklistItemRead(
                key="project_created",
                label="Project created",
                status="done",
                description="Project metadata exists in ProjectOps.",
                action="Review Project details.",
                target="#details",
            ),
            LaunchChecklistItemRead(
                key="repository_connected",
                label="Repository connected",
                status=self._status(evidence.repository_connected),
                description="A Repo Integration is required before CodeMap Lite can add repository evidence.",
                action="Attach a public GitHub repository.",
                target="#repository",
            ),
            LaunchChecklistItemRead(
                key="codemap_completed",
                label="CodeMap Lite completed",
                status=self._codemap_status(dashboard),
                description="CodeMap Lite should complete successfully after a repository is attached.",
                action="Run CodeMap Lite analysis.",
                target="#codemap",
            ),
            LaunchChecklistItemRead(
                key="production_url_configured",
                label="Production URL configured",
                status=self._status(evidence.production_url_configured),
                description="A production URL gives Manual Health Monitor a stable target.",
                action="Add a production URL.",
                target="#details",
            ),
            LaunchChecklistItemRead(
                key="health_check_healthy",
                label="Latest health check healthy",
                status=self._health_status(dashboard, evidence),
                description="A healthy manual Health Check provides basic hosted reachability evidence.",
                action="Run or review the manual health check.",
                target="#health",
            ),
            LaunchChecklistItemRead(
                key="readiness_evaluated",
                label="Readiness evaluated",
                status=self._status(dashboard.readiness.status != "not_started"),
                description="The advisory readiness checklist should be evaluated before launch review.",
                action="Evaluate production readiness.",
                target="#readiness",
            ),
            LaunchChecklistItemRead(
                key="launch_evidence_registered",
                label="Launch evidence registered",
                status=self._status(evidence.active_artifacts > 0),
                description="Artifacts keep runbooks, rollback notes, decisions, and evidence references visible.",
                action="Add a launch evidence artifact.",
                target="#artifacts",
            ),
            LaunchChecklistItemRead(
                key="supporting_evidence_linked",
                label="Supporting evidence linked",
                status=self._supporting_evidence_status(evidence),
                description="Linked artifacts are supporting references supplied by your team; ProjectOps does not verify their contents.",
                action="Link artifacts to readiness items.",
                target="#readiness",
            ),
            LaunchChecklistItemRead(
                key="human_launch_review",
                label="Human launch review completed",
                status=self._human_review_status(dashboard, evidence),
                description="ProjectOps provides advisory evidence; a person still makes the go/no-go decision.",
                action="Review the Launch Report with the deployment owner.",
                target="#launch-report",
            ),
        ]
        return ProjectLaunchChecklistRead(
            project=dashboard.project,
            generated_at=datetime.now(timezone.utc),
            summary=self._checklist_summary(items),
            items=items,
        )

    def _evidence_summary(
        self,
        dashboard: ProjectDashboardRead,
        coverage: ProjectReadinessEvidenceCoverage,
    ) -> LaunchEvidenceSummary:
        return LaunchEvidenceSummary(
            repository_connected=dashboard.repo.connected,
            codemap_completed=dashboard.latest_repo_analysis is not None
            and dashboard.latest_repo_analysis.status == "completed",
            health_check_healthy=dashboard.latest_health_check is not None
            and dashboard.latest_health_check.status == "healthy",
            production_url_configured=bool(dashboard.project.production_url),
            active_artifacts=coverage.active_artifacts,
            linked_active_artifacts=coverage.linked_active_artifacts,
            unlinked_active_artifacts=coverage.unlinked_active_artifacts,
            readiness_items_with_linked_artifacts=coverage.readiness_items_with_linked_artifacts,
            readiness_items_without_linked_artifacts=coverage.readiness_items_without_linked_artifacts,
            total_evidence_links=coverage.total_evidence_links,
            activity_events=dashboard.activity.recent_count,
        )

    def _decision_for_report(
        self,
        dashboard: ProjectDashboardRead,
        evidence: LaunchEvidenceSummary,
    ) -> LaunchDecision:
        score = dashboard.readiness.score
        if (
            score is not None
            and score >= 80
            and evidence.repository_connected
            and evidence.codemap_completed
            and evidence.production_url_configured
            and evidence.health_check_healthy
        ):
            return "ready"
        if score is not None and score >= 50:
            return "review"
        return "not_ready"

    def _headline(self, project_name: str, decision: LaunchDecision) -> str:
        if decision == "ready":
            return f"{project_name} has enough evidence for a launch review."
        if decision == "review":
            return f"{project_name} needs operator review before launch."
        return f"{project_name} is not ready for launch."

    def _status(self, is_done: bool) -> LaunchChecklistStatus:
        return "done" if is_done else "todo"

    def _codemap_status(self, dashboard: ProjectDashboardRead) -> LaunchChecklistStatus:
        if dashboard.latest_repo_analysis is None:
            return "todo"
        if dashboard.latest_repo_analysis.status == "completed":
            return "done"
        return "needs_attention"

    def _health_status(
        self,
        dashboard: ProjectDashboardRead,
        evidence: LaunchEvidenceSummary,
    ) -> LaunchChecklistStatus:
        if not dashboard.project.production_url or dashboard.latest_health_check is None:
            return "todo"
        if evidence.health_check_healthy:
            return "done"
        return "needs_attention"

    def _supporting_evidence_status(self, evidence: LaunchEvidenceSummary) -> LaunchChecklistStatus:
        if evidence.total_evidence_links > 0:
            return "done"
        if evidence.active_artifacts > 0:
            return "needs_attention"
        return "todo"

    def _human_review_status(
        self,
        dashboard: ProjectDashboardRead,
        evidence: LaunchEvidenceSummary,
    ) -> LaunchChecklistStatus:
        decision = self._decision_for_report(dashboard, evidence)
        return "done" if decision == "ready" else "needs_attention"

    def _checklist_summary(self, items: list[LaunchChecklistItemRead]) -> LaunchChecklistSummary:
        statuses = [item.status for item in items]
        return LaunchChecklistSummary(
            done=statuses.count("done"),
            needs_attention=statuses.count("needs_attention"),
            todo=statuses.count("todo"),
            total=len(items),
        )

    def _blockers(
        self,
        dashboard: ProjectDashboardRead,
        evidence: LaunchEvidenceSummary,
    ) -> list[str]:
        blockers = list(dashboard.readiness.top_gaps)
        if not evidence.repository_connected:
            blockers.append("Repository not connected")
        if not evidence.codemap_completed:
            blockers.append("CodeMap Lite has not completed")
        if not evidence.production_url_configured:
            blockers.append("Production URL not configured")
        if not evidence.health_check_healthy:
            blockers.append("Latest health check is not healthy")
        return list(dict.fromkeys(blockers))

    def _recommended_actions(
        self,
        dashboard: ProjectDashboardRead,
        evidence: LaunchEvidenceSummary,
    ) -> list[str]:
        actions: list[str] = []
        if not evidence.repository_connected:
            actions.append("Attach a GitHub repository to start repo intake.")
        if not evidence.codemap_completed:
            actions.append("Run CodeMap Lite analysis for the attached repository.")
        if not evidence.production_url_configured or not evidence.health_check_healthy:
            actions.append("Add a production URL and run a manual health check.")
        for gap in dashboard.readiness.top_gaps:
            actions.append(f"Review readiness gap: {gap}.")
        if evidence.active_artifacts == 0:
            actions.append("Add launch evidence artifacts such as a runbook, rollback note, or deployment checklist.")
        if not actions:
            actions.append("Review the launch report with the deployment owner before inviting users.")
        return actions


launch_report_service = LaunchReportService()
