/**
 * Get the domain URL from the request
 *
 * @param {Request} request - The request object
 * @returns {string} The domain URL
 */
export function getDomainUrl(request) {
  const host =
    request.headers.get('X-Forwarded-Host') ??
    request.headers.get('host') ??
    new URL(request.url).host;
  const protocol = request.headers.get('X-Forwarded-Proto') ?? 'http';

  return `${protocol}://${host}`;
}

/**
 * Get a value from a request cookie
 *
 * @param {Request} request - The request object
 * @param {string} key - The key to get the value from
 * @returns {string|null} The value from the cookie
 */
export function getCookieValue(request, key) {
  const cookieHeader = request.headers.get('Cookie');
  const cookieMatch = cookieHeader?.match(`${key}=([^;]+)`)?.[1];
  return cookieMatch;
}
