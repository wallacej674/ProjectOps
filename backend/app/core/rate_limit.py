from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from threading import Lock
from time import monotonic


@dataclass
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int


@dataclass
class _Bucket:
    count: int
    reset_at: float


class FixedWindowRateLimiter:
    """Small in-process fixed-window limiter for first production hardening."""

    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = Lock()

    def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        now = monotonic()
        with self._lock:
            self._cleanup(now)
            bucket = self._buckets.get(key)
            if bucket is None or bucket.reset_at <= now:
                self._buckets[key] = _Bucket(count=1, reset_at=now + window_seconds)
                return RateLimitResult(allowed=True, retry_after_seconds=0)

            if bucket.count >= limit:
                return RateLimitResult(
                    allowed=False,
                    retry_after_seconds=max(1, ceil(bucket.reset_at - now)),
                )

            bucket.count += 1
            return RateLimitResult(allowed=True, retry_after_seconds=0)

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()

    def _cleanup(self, now: float) -> None:
        expired_keys = [key for key, bucket in self._buckets.items() if bucket.reset_at <= now]
        for key in expired_keys:
            del self._buckets[key]


rate_limiter = FixedWindowRateLimiter()
