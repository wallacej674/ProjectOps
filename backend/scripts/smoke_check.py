import argparse
import os
import sys
from dataclasses import dataclass
from typing import Protocol

import httpx


class HealthClient(Protocol):
    def get(self, path: str):
        ...


@dataclass(frozen=True)
class SmokeCheckResult:
    name: str
    passed: bool
    detail: str


def normalize_base_url(value: str) -> str:
    cleaned = value.strip().rstrip("/")
    if not cleaned:
        raise ValueError("A backend base URL is required.")
    if not cleaned.startswith(("http://", "https://")):
        raise ValueError("Backend base URL must start with http:// or https://.")
    return cleaned


def check_deployment(client: HealthClient) -> list[SmokeCheckResult]:
    return [_check_endpoint(client, "/health"), _check_endpoint(client, "/health/db")]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run safe unauthenticated ProjectOps deployment smoke checks.")
    parser.add_argument("base_url", nargs="?", default=os.getenv("PROJECTOPS_SMOKE_BASE_URL", ""))
    args = parser.parse_args(argv)

    try:
        base_url = normalize_base_url(args.base_url)
    except ValueError as error:
        print(f"ProjectOps smoke check error: {error}", file=sys.stderr)
        return 2

    with httpx.Client(base_url=base_url, timeout=10.0, follow_redirects=False) as client:
        results = check_deployment(client)

    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"{status} {result.name}: {result.detail}")

    return 0 if all(result.passed for result in results) else 1


def _check_endpoint(client: HealthClient, path: str) -> SmokeCheckResult:
    try:
        response = client.get(path)
    except httpx.HTTPError as error:
        return SmokeCheckResult(name=path, passed=False, detail=error.__class__.__name__)

    if response.status_code != 200:
        return SmokeCheckResult(name=path, passed=False, detail=f"status_code={response.status_code}")

    try:
        payload = response.json()
    except ValueError:
        return SmokeCheckResult(name=path, passed=False, detail="invalid_json")

    status = payload.get("status")
    if status != "ok":
        return SmokeCheckResult(name=path, passed=False, detail=f"status={status or 'missing'}")

    environment = payload.get("environment")
    detail = f"status=ok environment={environment}" if path == "/health" and environment else "status=ok"
    return SmokeCheckResult(name=path, passed=True, detail=detail)


if __name__ == "__main__":
    raise SystemExit(main())
