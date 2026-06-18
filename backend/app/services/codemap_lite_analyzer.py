from dataclasses import dataclass


SIGNAL_NAMES = [
    "has_readme",
    "has_backend",
    "has_frontend",
    "has_tests",
    "has_ci",
    "has_docker",
    "has_env_example",
    "has_migrations",
    "has_python",
    "has_fastapi",
    "has_sqlalchemy",
    "has_alembic",
    "has_react",
    "has_typescript",
    "has_vite",
]


@dataclass(frozen=True)
class CodeMapLiteResult:
    summary: str
    detected_stack: dict[str, list[str]]
    detected_files: list[str]
    detected_folders: list[str]
    signals: dict[str, bool]
    warnings: list[str]
    total_files_scanned: int


def analyze_repo_paths(paths: list[str]) -> CodeMapLiteResult:
    normalized_paths = [_normalize_path(path) for path in paths]
    signals = {name: False for name in SIGNAL_NAMES}

    signals["has_readme"] = any(path == "readme.md" for path in normalized_paths)
    signals["has_env_example"] = any(path == ".env.example" for path in normalized_paths)
    signals["has_docker"] = any(path == "docker-compose.yml" or path.endswith("/dockerfile") for path in normalized_paths)
    signals["has_ci"] = any(path.startswith(".github/workflows/") for path in normalized_paths)
    signals["has_tests"] = any(path.startswith("tests/") or "/tests/" in path for path in normalized_paths)
    signals["has_backend"] = any(path.startswith("backend/") for path in normalized_paths)
    signals["has_frontend"] = any(path.startswith("frontend/") or path.startswith("src/") for path in normalized_paths)
    signals["has_migrations"] = any("alembic/" in path or path.startswith("alembic/") for path in normalized_paths)
    signals["has_python"] = any(
        path.endswith(".py")
        or path.endswith("pyproject.toml")
        or path.endswith("requirements.txt")
        or path.endswith("setup.py")
        for path in normalized_paths
    )
    signals["has_fastapi"] = any(path.endswith("app/main.py") or "fastapi" in path for path in normalized_paths)
    signals["has_sqlalchemy"] = any("sqlalchemy" in path or "/repositories/" in path for path in normalized_paths)
    signals["has_alembic"] = any("alembic/" in path or path.startswith("alembic/") for path in normalized_paths)
    signals["has_react"] = any(path.endswith(".tsx") or "react" in path for path in normalized_paths)
    signals["has_typescript"] = any(path.endswith(".ts") or path.endswith(".tsx") for path in normalized_paths)
    signals["has_vite"] = any(path.endswith("vite.config.ts") or path.endswith("vite.config.js") for path in normalized_paths)

    return CodeMapLiteResult(
        summary=_build_summary(signals),
        detected_stack=_build_detected_stack(signals),
        detected_files=paths,
        detected_folders=_detect_folders(paths),
        signals=signals,
        warnings=[],
        total_files_scanned=len(paths),
    )


def _normalize_path(path: str) -> str:
    return path.replace("\\", "/").strip("/").lower()


def _detect_folders(paths: list[str]) -> list[str]:
    folders: set[str] = set()
    for path in paths:
        parts = path.replace("\\", "/").strip("/").split("/")
        for index in range(1, len(parts)):
            folders.add("/".join(parts[:index]))
    return sorted(folders)


def _build_summary(signals: dict[str, bool]) -> str:
    detected_parts: list[str] = []
    if signals["has_backend"] and signals["has_python"]:
        detected_parts.append("a Python backend")
    elif signals["has_backend"]:
        detected_parts.append("a backend")
    elif signals["has_python"]:
        detected_parts.append("Python files")
    if signals["has_frontend"] and signals["has_react"] and signals["has_vite"]:
        detected_parts.append("a React/Vite frontend")
    elif signals["has_frontend"]:
        detected_parts.append("a frontend")
    if signals["has_migrations"]:
        detected_parts.append("database migration support")
    if signals["has_tests"]:
        detected_parts.append("tests")
    if signals["has_docker"]:
        detected_parts.append("Docker support")
    if signals["has_ci"]:
        detected_parts.append("GitHub Actions CI")

    if not detected_parts:
        return "This repository has limited detectable project structure from its file paths."

    return "This repository appears to include " + ", ".join(detected_parts) + "."


def _build_detected_stack(signals: dict[str, bool]) -> dict[str, list[str]]:
    languages: list[str] = []
    frameworks: list[str] = []
    tools: list[str] = []

    if signals["has_python"]:
        languages.append("python")
    if signals["has_typescript"]:
        languages.append("typescript")
    if signals["has_fastapi"]:
        frameworks.append("fastapi")
    if signals["has_react"]:
        frameworks.append("react")
    if signals["has_vite"]:
        frameworks.append("vite")
    if signals["has_alembic"]:
        tools.append("alembic")
    if signals["has_sqlalchemy"]:
        tools.append("sqlalchemy")
    if signals["has_docker"]:
        tools.append("docker")
    if signals["has_ci"]:
        tools.append("github_actions")

    return {
        "languages": languages,
        "frameworks": frameworks,
        "tools": tools,
    }
