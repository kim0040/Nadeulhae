/**
 * Proxy-aware client IP resolution.
 *
 * A reverse proxy must overwrite one explicitly configured header before this
 * helper is enabled. Falling back to other client-supplied headers would let a
 * caller choose its own rate-limit bucket, so an unconfigured deployment uses
 * the conservative shared "anonymous" bucket instead.
 */

const TRUST_PROXY_HEADERS = /^(1|true|yes)$/i.test(
  process.env.TRUST_PROXY_HEADERS ?? ""
)
const DEFAULT_TRUSTED_IP_HEADER = "x-real-ip"
const SAFE_HEADER_NAME = /^[a-z0-9-]+$/

type HeaderReader = Pick<Headers, "get">

function normalizeIpHeader(value: string | null) {
  if (!value) return ""

  // X-Forwarded-For can carry a chain; the trusted proxy owns the header and
  // the left-most address represents the original client by nginx convention.
  return (value.split(",")[0] ?? "").trim().slice(0, 64)
}

function getTrustedHeaderName() {
  const configured = (process.env.TRUSTED_IP_HEADER ?? DEFAULT_TRUSTED_IP_HEADER)
    .trim()
    .toLowerCase()

  return SAFE_HEADER_NAME.test(configured)
    ? configured
    : DEFAULT_TRUSTED_IP_HEADER
}

/**
 * Resolves the client IP only from the configured, proxy-overwritten header.
 * Returns "anonymous" when proxy headers are not explicitly trusted or the
 * configured header is absent, keeping rate limits conservative by default.
 */
export function getTrustedClientIp(headers: HeaderReader) {
  if (!TRUST_PROXY_HEADERS) return "anonymous"

  return normalizeIpHeader(headers.get(getTrustedHeaderName())) || "anonymous"
}

/** Exported for deterministic regression tests without mutating process env. */
export function resolveTrustedClientIp(
  headers: HeaderReader,
  options: { trustProxyHeaders: boolean; headerName?: string }
) {
  if (!options.trustProxyHeaders) return "anonymous"

  const headerName = (options.headerName ?? DEFAULT_TRUSTED_IP_HEADER).trim().toLowerCase()
  if (!SAFE_HEADER_NAME.test(headerName)) return "anonymous"

  return normalizeIpHeader(headers.get(headerName)) || "anonymous"
}
