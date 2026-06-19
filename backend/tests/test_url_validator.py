"""
Pure unit tests for the SSRF URL validator.
No network calls, no database, no HTTP client.
"""
import pytest

from app.services.url_validator import HealthCheckUrlSafetyError, validate_health_check_url


def _blocked(url: str, resolver=None):
    """Assert that validate_health_check_url raises HealthCheckUrlSafetyError."""
    with pytest.raises(HealthCheckUrlSafetyError):
        validate_health_check_url(url, resolver=resolver)


def _allowed(url: str, resolver=None):
    """Assert that validate_health_check_url returns without raising."""
    validate_health_check_url(url, resolver=resolver)


# ---------------------------------------------------------------------------
# Scheme validation
# ---------------------------------------------------------------------------

def test_ftp_scheme_is_blocked():
    _blocked("ftp://example.com")


def test_http_scheme_is_allowed():
    _allowed("http://example.com", resolver=lambda h: ["93.184.216.34"])


def test_https_scheme_is_allowed():
    _allowed("https://example.com", resolver=lambda h: ["93.184.216.34"])


# ---------------------------------------------------------------------------
# Credential rejection
# ---------------------------------------------------------------------------

def test_url_with_username_password_is_blocked():
    _blocked("http://user:password@example.com")


def test_url_with_username_only_is_blocked():
    _blocked("http://user@example.com")


# ---------------------------------------------------------------------------
# localhost variants
# ---------------------------------------------------------------------------

def test_localhost_is_blocked():
    _blocked("http://localhost")


def test_localhost_subdomain_is_blocked():
    _blocked("http://foo.localhost")


# ---------------------------------------------------------------------------
# Loopback literal IPs
# ---------------------------------------------------------------------------

def test_ipv4_loopback_is_blocked():
    _blocked("http://127.0.0.1")


def test_ipv6_loopback_is_blocked():
    _blocked("http://[::1]")


# ---------------------------------------------------------------------------
# Private network ranges
# ---------------------------------------------------------------------------

def test_rfc1918_class_a_is_blocked():
    _blocked("http://10.0.0.1")


def test_rfc1918_class_b_is_blocked():
    _blocked("http://172.16.0.1")


def test_rfc1918_class_c_is_blocked():
    _blocked("http://192.168.1.1")


# ---------------------------------------------------------------------------
# Link-local / cloud metadata
# ---------------------------------------------------------------------------

def test_link_local_metadata_endpoint_is_blocked():
    _blocked("http://169.254.169.254")


# ---------------------------------------------------------------------------
# DNS resolution injection
# ---------------------------------------------------------------------------

def test_hostname_resolving_to_private_ip_is_blocked():
    # Fake resolver: maps hostname → private IP
    def private_resolver(hostname: str) -> list[str]:
        return ["10.0.0.1"]

    _blocked("http://internal.example.com", resolver=private_resolver)


def test_hostname_resolving_to_public_ip_is_allowed():
    # Fake resolver: maps hostname → public IP
    def public_resolver(hostname: str) -> list[str]:
        return ["93.184.216.34"]  # example.com

    _allowed("http://public.example.com", resolver=public_resolver)


def test_hostname_with_no_resolved_addresses_is_blocked():
    def empty_resolver(hostname: str) -> list[str]:
        return []

    _blocked("http://nonexistent.example.com", resolver=empty_resolver)


# ---------------------------------------------------------------------------
# IPv6 tunnelling bypass vectors
# ---------------------------------------------------------------------------

def test_ipv4_mapped_ipv6_loopback_is_blocked():
    # ::ffff:127.0.0.1 — IPv4-mapped loopback
    _blocked("http://[::ffff:127.0.0.1]")


def test_ipv4_mapped_ipv6_private_is_blocked():
    # ::ffff:192.168.1.1 — IPv4-mapped private address
    _blocked("http://[::ffff:c0a8:101]")


def test_6to4_tunnelled_private_is_blocked():
    # 2002:c0a8:0101:: — 6to4 tunnel for 192.168.1.1
    _blocked("http://[2002:c0a8:101::]")


def test_nat64_tunnelled_private_is_blocked():
    # 64:ff9b::192.168.1.1 — NAT64 well-known prefix wrapping private IPv4
    _blocked("http://[64:ff9b::c0a8:101]")


def test_hostname_resolving_to_6to4_address_is_blocked():
    # Resolver returns a 6to4 address embedding 10.0.0.1 (2002:0a00:0001::)
    def resolver(hostname: str) -> list[str]:
        return ["2002:a00:1::"]

    _blocked("http://evil.example.com", resolver=resolver)
