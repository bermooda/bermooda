// Client address and public origin for a request. Proxy headers are trusted
// only as far as TRUST_PROXY says, since anyone can send them.

const DEFAULT_TRUSTED_PROXIES = 1;
const MAX_CLIENT_IP_LENGTH = 64;

/**
 * Number of reverse proxies in front of the app (`TRUST_PROXY`). Defaults to
 * 1, the usual TLS-terminating proxy or load balancer. Invalid values fall
 * back to the default.
 *
 * @param {string | undefined} [raw]
 * @returns {number}
 */
export function parseTrustedProxies(raw = process.env.TRUST_PROXY) {
  if (raw === undefined || raw.trim() === '') return DEFAULT_TRUSTED_PROXIES;
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0
    ? count
    : DEFAULT_TRUSTED_PROXIES;
}

/**
 * Client IP as reported by the trusted proxies, or null when there is none.
 *
 * Each proxy appends the address it received the request from to
 * `X-Forwarded-For`, so with N trusted proxies the N-th entry from the right is
 * the client. Entries further left are whatever the client sent.
 *
 * @param {Request} request
 * @param {number} [trustedProxies]
 * @returns {string | null}
 */
export function getClientIp(request, trustedProxies = parseTrustedProxies()) {
  if (trustedProxies <= 0) return null;

  const hops = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  const ip = hops.length
    ? hops[Math.max(0, hops.length - trustedProxies)]
    : request.headers.get('x-real-ip')?.trim();

  return ip ? ip.slice(0, MAX_CLIENT_IP_LENGTH) : null;
}

/**
 * Origin for absolute links (canonical, hreflang, sitemap, JSON-LD): the
 * request's `Host`, which is also what sales-channel resolution matches, with
 * the scheme of `baseUrl`. `X-Forwarded-Host` / `X-Forwarded-Proto` are
 * ignored: shared caches don't key on them, so a forged value would be served
 * to everyone from cache.
 *
 * @param {Request} request
 * @param {string} baseUrl
 * @returns {string}
 */
export function getRequestOrigin(request, baseUrl) {
  const { protocol } = new URL(baseUrl);
  const { host } = new URL(request.url);
  return `${protocol}//${host}`;
}
