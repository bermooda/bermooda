// Client-safe cookie parsing shared by storefront helpers.

/**
 * Read one cookie from a `Cookie` header with an exact name match.
 * Returns null when absent or when the value is not valid URI encoding, so a
 * malformed cookie can never throw out of a loader.
 *
 * @param {string|null|undefined} cookieHeader
 * @param {string} name
 * @returns {string|null}
 */
export function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;

    let value = part.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {Request} request
 * @param {string} name
 * @returns {string|null}
 */
export function readCookie(request, name) {
  return getCookie(request.headers.get('cookie'), name);
}
