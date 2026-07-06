// app/core/seo/input.js
// Shared SEO settings parsing for admin forms and APIs.

export const DEFAULT_TITLE_TEMPLATE = '{pageTitle} | {shopName}';

function normalizeTwitterHandle(handle) {
  const trimmed = String(handle ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^@+/, '');
}

/**
 * Parse admin/API SEO settings payload.
 *
 * @param {object} input
 * @returns {object}
 */
export function parseSeoSettingsInput(input = {}) {
  const parsed = {};

  if ('metaTitle' in input) {
    parsed.metaTitle = String(input.metaTitle ?? '').trim();
  }

  if ('metaDescription' in input) {
    parsed.metaDescription = String(input.metaDescription ?? '').trim();
  }

  if ('titleTemplate' in input) {
    parsed.titleTemplate =
      String(input.titleTemplate ?? '').trim() || DEFAULT_TITLE_TEMPLATE;
  }

  if ('allowIndexing' in input) {
    parsed.allowIndexing =
      input.allowIndexing === true ||
      input.allowIndexing === 'on' ||
      input.allowIndexing === 'true';
  }

  if ('googleSiteVerification' in input) {
    parsed.googleSiteVerification = String(
      input.googleSiteVerification ?? ''
    ).trim();
  }

  if ('bingSiteVerification' in input) {
    parsed.bingSiteVerification = String(
      input.bingSiteVerification ?? ''
    ).trim();
  }

  if ('twitterHandle' in input) {
    parsed.twitterHandle = normalizeTwitterHandle(input.twitterHandle);
  }

  if ('ogImageUrl' in input) {
    parsed.ogImageUrl = String(input.ogImageUrl ?? '').trim();
  }

  return parsed;
}

/**
 * Map parsed SEO fields to Setting.key writes.
 *
 * @param {ReturnType<typeof parseSeoSettingsInput>} parsed
 * @returns {Record<string, unknown>}
 */
export function seoSettingsToKeyValues(parsed) {
  const values = {};

  if ('metaTitle' in parsed) values['seo.metaTitle'] = parsed.metaTitle;
  if ('metaDescription' in parsed) {
    values['seo.metaDescription'] = parsed.metaDescription;
  }
  if ('titleTemplate' in parsed) {
    values['seo.titleTemplate'] = parsed.titleTemplate;
  }
  if ('allowIndexing' in parsed) {
    values['seo.allowIndexing'] = parsed.allowIndexing;
  }
  if ('googleSiteVerification' in parsed) {
    values['seo.googleSiteVerification'] = parsed.googleSiteVerification;
  }
  if ('bingSiteVerification' in parsed) {
    values['seo.bingSiteVerification'] = parsed.bingSiteVerification;
  }
  if ('twitterHandle' in parsed) {
    values['seo.twitterHandle'] = parsed.twitterHandle;
  }
  if ('ogImageUrl' in parsed) values['seo.ogImageUrl'] = parsed.ogImageUrl;

  return values;
}
