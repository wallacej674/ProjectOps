import json
import re
import tomllib
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CodeMapMediumResult:
    insights: dict[str, Any]
    evidence_files: dict[str, list[str]]
    warnings: list[str]


def analyze_manifest_contents(contents: dict[str, str], skipped_files: list[str] | None = None) -> CodeMapMediumResult:
    runtimes: set[str] = set()
    package_managers: set[str] = set()
    frameworks: set[str] = set()
    commands: dict[str, list[str]] = {key: [] for key in ("development", "test", "lint", "build", "audit", "other")}
    evidence: dict[str, list[str]] = {}
    dependency_counts = {"runtime": 0, "development": 0}
    warnings: list[str] = []
    lower_paths = {path.lower(): path for path in contents}

    def record(kind: str, value: str, path: str) -> None:
        evidence.setdefault(f"{kind}:{value}", []).append(path)

    javascript_manager = None
    for suffix, manager in (("pnpm-lock.yaml", "pnpm"), ("yarn.lock", "yarn"), ("package-lock.json", "npm")):
        matching_path = next((path for path in contents if path.lower().endswith(suffix)), None)
        if matching_path:
            javascript_manager = manager
            package_managers.add(manager)
            record("package_manager", manager, matching_path)
            break

    for path, text in contents.items():
        name = path.replace("\\", "/").rsplit("/", 1)[-1].lower()
        try:
            if name == "package.json":
                payload = json.loads(text)
                if not isinstance(payload, dict):
                    raise ValueError("root must be an object")
                declared_manager = str(payload.get("packageManager", "")).split("@", 1)[0].lower()
                manager = declared_manager if declared_manager in {"npm", "pnpm", "yarn"} else javascript_manager or "npm"
                package_managers.add(manager)
                record("package_manager", manager, path)
                engines = payload.get("engines", {})
                if isinstance(engines, dict) and engines.get("node"):
                    runtimes.add(f"node {engines['node']}")
                    record("runtime", f"node {engines['node']}", path)
                dependencies = payload.get("dependencies", {})
                dev_dependencies = payload.get("devDependencies", {})
                if isinstance(dependencies, dict):
                    dependency_counts["runtime"] += len(dependencies)
                if isinstance(dev_dependencies, dict):
                    dependency_counts["development"] += len(dev_dependencies)
                all_dependencies = set(dependencies if isinstance(dependencies, dict) else {}) | set(dev_dependencies if isinstance(dev_dependencies, dict) else {})
                for dependency, label in (("react", "react"), ("vite", "vite"), ("next", "next.js"), ("typescript", "typescript")):
                    if dependency in all_dependencies:
                        frameworks.add(label)
                        record("framework", label, path)
                scripts = payload.get("scripts", {})
                if isinstance(scripts, dict):
                    for script in scripts:
                        category = _script_category(script)
                        commands[category].append(f"npm run {script}")
                        record("command", f"npm run {script}", path)
            elif name == "pyproject.toml":
                payload = tomllib.loads(text)
                manager = "poetry" if isinstance(payload.get("tool", {}).get("poetry") if isinstance(payload.get("tool"), dict) else None, dict) else "pip"
                package_managers.add(manager)
                record("package_manager", manager, path)
                requires_python = payload.get("project", {}).get("requires-python") if isinstance(payload.get("project"), dict) else None
                if requires_python:
                    runtimes.add(f"python {requires_python}")
                    record("runtime", f"python {requires_python}", path)
                project_dependencies = payload.get("project", {}).get("dependencies", []) if isinstance(payload.get("project"), dict) else []
                if isinstance(project_dependencies, list):
                    dependency_counts["runtime"] += len(project_dependencies)
                    joined = " ".join(str(item).lower() for item in project_dependencies)
                    for token, label in (("fastapi", "fastapi"), ("django", "django"), ("flask", "flask"), ("sqlalchemy", "sqlalchemy"), ("alembic", "alembic")):
                        if token in joined:
                            frameworks.add(label)
                            record("framework", label, path)
            elif name == "requirements.txt":
                package_managers.add("pip")
                record("package_manager", "pip", path)
                dependencies = [line for line in text.splitlines() if line.strip() and not line.lstrip().startswith(("#", "-"))]
                dependency_counts["runtime"] += len(dependencies)
            elif name in {"dockerfile", "docker-compose.yml", "compose.yml"}:
                record("operational", "containers", path)
            elif path.lower().startswith(".github/workflows/"):
                record("operational", "github_actions", path)
        except (json.JSONDecodeError, tomllib.TOMLDecodeError, ValueError, TypeError):
            warnings.append(f"{path} could not be parsed safely.")

    if any(path.endswith("package.json") for path in lower_paths) and not any(
        path.endswith(("package-lock.json", "pnpm-lock.yaml", "yarn.lock")) for path in lower_paths
    ):
        warnings.append("A package.json was inspected without a recognized JavaScript lockfile.")
    if skipped_files:
        warnings.append(f"{len(skipped_files)} supported file(s) were skipped because they were invalid or exceeded inspection limits.")

    return CodeMapMediumResult(
        insights={
            "runtimes": sorted(runtimes),
            "package_managers": sorted(package_managers),
            "frameworks": sorted(frameworks),
            "commands": {key: sorted(values) for key, values in commands.items() if values},
            "dependency_counts": dependency_counts,
            "operational_signals": sorted({key.split(":", 1)[1] for key in evidence if key.startswith("operational:")}),
        },
        evidence_files={key: sorted(set(paths)) for key, paths in evidence.items()},
        warnings=warnings,
    )


def _script_category(script: str) -> str:
    normalized = re.sub(r"[^a-z]", " ", script.lower())
    for category in ("test", "lint", "build", "audit"):
        if category in normalized.split():
            return category
    if script.lower() in {"dev", "start", "serve", "preview"}:
        return "development"
    return "other"
