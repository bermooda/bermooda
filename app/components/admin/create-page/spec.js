/**
 * Shared contract for admin "create" pages.
 *
 * A create page is described as data (`CreatePageSpec`) rather than markup so
 * that a single spec can be rendered by any of the candidate designs in
 * `#/components/admin/create-page/designs`. Once a design is chosen, the same
 * spec keeps working — only the renderer changes.
 */

/**
 * @typedef {Object} CreateFieldSpec
 * @property {string} name Form field name submitted to the action
 * @property {string} label Human label
 * @property {'text'|'email'|'url'|'number'|'password'|'select'|'textarea'} [type='text']
 * @property {boolean} [required]
 * @property {string} [placeholder]
 * @property {string} [hint] Helper text rendered near the control
 * @property {string} [defaultValue]
 * @property {Array<{ value: string, label: string }>} [options] Required for `select`
 * @property {number} [rows] Row count for `textarea`
 * @property {boolean} [full] Span the full width of the section grid
 */

/**
 * @typedef {Object} CreateSectionSpec
 * @property {string} id Stable id, also used to namespace control ids
 * @property {string} title
 * @property {string} [description]
 * @property {CreateFieldSpec[]} fields
 */

/**
 * @typedef {Object} CreatePreviewSpec
 * @property {string} [pathPrefix] Storefront path the slug is appended to
 * @property {string} slugField Field name holding the slug
 * @property {string[]} [summaryFields] Field names shown in the summary rail
 */

/**
 * @typedef {Object} CreatePageSpec
 * @property {string} title
 * @property {string} [eyebrow] Short context label above the title
 * @property {string} [subtitle]
 * @property {{ label: string, href?: string }[]} breadcrumbs
 * @property {CreateSectionSpec[]} sections
 * @property {string} cancelHref
 * @property {string} submitLabel
 * @property {string} [submittingLabel]
 * @property {string} [error] Server-side error message
 * @property {CreatePreviewSpec} [preview] Opt-in data for designs with a preview rail
 */

/**
 * Build a deterministic DOM id for a field so labels can point at controls
 * without `useId` (which would differ between designs).
 *
 * @param {string} sectionId
 * @param {string} name
 * @returns {string}
 */
export function fieldDomId(sectionId, name) {
  return `cp-${sectionId}-${name}`;
}

/**
 * Every field across every section, in render order.
 *
 * @param {CreatePageSpec} spec
 * @returns {CreateFieldSpec[]}
 */
export function allFields(spec) {
  return spec.sections.flatMap((section) => section.fields);
}

/**
 * Initial `{ [fieldName]: value }` map used by designs that mirror input into
 * a live preview.
 *
 * @param {CreatePageSpec} spec
 * @returns {Record<string, string>}
 */
export function initialValues(spec) {
  return Object.fromEntries(
    allFields(spec).map((field) => [field.name, field.defaultValue ?? ''])
  );
}

/**
 * Lowercase, hyphenated slug used for URL previews.
 *
 * @param {string} value
 * @returns {string}
 */
export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
