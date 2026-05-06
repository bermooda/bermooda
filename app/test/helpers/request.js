// app/test/helpers/request.js
// Helpers for building Request objects in server tests.

/**
 * Build a minimal Web Request for route loader/action tests.
 *
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} opts
 * @returns {Request}
 */
export function makeRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Request(url, { method, headers, body });
}

/**
 * Build a request with a session cookie header.
 */
export function makeAuthRequest(url, cookieValue, opts = {}) {
  return makeRequest(url, {
    ...opts,
    headers: { cookie: cookieValue, ...(opts.headers ?? {}) },
  });
}
