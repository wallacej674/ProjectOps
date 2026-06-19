"""
SSRF URL validator for outbound health-check requests.

MVP mitigation: validates scheme, credentials, hostname, and resolved IP addresses.

Known limitation — DNS rebinding: A hostname that resolves to a public IP at
validation time may be made to resolve to a private IP at request time by an
attacker who controls the DNS TTL. Preventing DNS rebinding fully requires
network-level egress controls (firewall/allowlist) outside this application.
This validator is a best-effort defence, not a guarantee.

Known limitation — response body buffering: httpx buffers the full response body
before `response.text` is available. The `MAX_RESPONSE_BODY_BYTES` limit in
`health_checks.py` truncates the *stored preview* but does not bound how much
the HTTP client reads from the wire. A malicious server that streams a very large
body could exhaust worker memory. Mitigating this requires streaming reads
(response.stream / response.read(N)), which is deferred to a future milestone.
"""
import ipaddress
import socket
from collections.abc import Callable
from urllib.parse import urlparse

# IPv6 tunnelling prefixes that embed private IPv4 space.
# `ip.is_global` returns True for some of these on certain Python versions,
# so we block them explicitly before the is_global check.
_BLOCKED_V6_PREFIXES = (
    ipaddress.ip_network("::ffff:0:0/96"),    # IPv4-mapped (RFC 4291)
    ipaddress.ip_network("64:ff9b::/96"),      # NAT64 well-known (RFC 6052)
    ipaddress.ip_network("64:ff9b:1::/48"),    # NAT64 local-use (RFC 8215)
    ipaddress.ip_network("2002::/16"),         # 6to4 (RFC 3056)
)


class HealthCheckUrlSafetyError(Exception):
    pass


def validate_health_check_url(
    url: str,
    resolver: Callable[[str], list[str]] | None = None,
) -> None:
    """Raise HealthCheckUrlSafetyError if *url* must not be fetched.

    Args:
        url: The target URL supplied by the caller.
        resolver: Optional injectable DNS resolver for testing.
                  Signature: (hostname: str) -> list[str] of IP address strings.
                  Defaults to socket.getaddrinfo when None.
    """
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HealthCheckUrlSafetyError(
            f"Only http and https schemes are allowed; got {parsed.scheme!r}."
        )

    if parsed.username or parsed.password:
        raise HealthCheckUrlSafetyError("URLs with embedded credentials are not allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise HealthCheckUrlSafetyError("A hostname is required.")

    if hostname.lower() == "localhost" or hostname.lower().endswith(".localhost"):
        raise HealthCheckUrlSafetyError(f"Hostname {hostname!r} is not allowed.")

    # Literal IP address — check directly without DNS resolution.
    try:
        ip = ipaddress.ip_address(hostname)
        _reject_if_not_global(ip, hostname)
        return
    except ValueError:
        pass

    # DNS hostname — resolve and check every returned address.
    resolved = _resolve(hostname, resolver)
    if not resolved:
        raise HealthCheckUrlSafetyError(
            f"Hostname {hostname!r} could not be resolved to any address."
        )
    for addr_str in dict.fromkeys(resolved):  # deduplicate while preserving order
        try:
            ip = ipaddress.ip_address(addr_str)
        except ValueError:
            raise HealthCheckUrlSafetyError(f"Resolved address {addr_str!r} is not a valid IP.")
        _reject_if_not_global(ip, hostname)


def _reject_if_not_global(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, hostname: str) -> None:
    if isinstance(ip, ipaddress.IPv6Address):
        for prefix in _BLOCKED_V6_PREFIXES:
            if ip in prefix:
                raise HealthCheckUrlSafetyError(
                    f"Target {hostname!r} uses a tunnelled/mapped address ({ip}) and is not allowed."
                )
    if not ip.is_global:
        raise HealthCheckUrlSafetyError(
            f"Target {hostname!r} resolves to a non-public address ({ip}) and is not allowed."
        )


def _resolve(hostname: str, resolver: Callable[[str], list[str]] | None) -> list[str]:
    if resolver is not None:
        return resolver(hostname)
    try:
        results = socket.getaddrinfo(hostname, None)
        return [r[4][0] for r in results]
    except socket.gaierror:
        return []
