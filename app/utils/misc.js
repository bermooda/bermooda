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
