/**
 * Convert arbitrary text into a URL-safe slug.
 *
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
