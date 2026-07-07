// app/core/seo/input.js
// Shared SEO settings parsing for admin forms and APIs.

import { SETTING_KEYS } from '#/core/settings/keys';

export const DEFAULT_TITLE_TEMPLATE = '{pageTitle} | {shopName}';

/** Static storefront paths included in sitemap.xml. */
export const STATIC_SITEMAP_ROUTES = [
  'account/login',
  'account/register',
  'sitemap.xml',
];

/**
 * Strip a leading @ from a Twitter/X handle.
 *
 * @param {string|null|undefined} handle
 * @returns {string}
 */
export function normalizeTwitterHandle(handle) {
  const trimmed = String(handle ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^@+/, '');
}

/**
 * Truncate long text for meta descriptions.
 *
 * @param {string|null|undefined} text
 * @param {number} [maxLength=160]
 * @returns {string}
 */
export function truncateMetaDescription(text, maxLength = 160) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

import { resolveCatalogMediaUrl } from '#/core/storage/media';

/**
 * Resolve the first media URL from catalog entities.
 *
 * @param {{ media?: Array<{ media?: { url?: string }, url?: string }> }|null|undefined} entity
 * @param {number} [targetWidth]
 * @returns {string|null}
 */
export function resolveEntityMediaUrl(entity, targetWidth = 1280) {
  return resolveCatalogMediaUrl(entity, targetWidth);
}

/**
 * Escape JSON-LD for safe inline script embedding.
 *
 * @param {unknown} data
 * @returns {string}
 */
export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
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
 * Parse SEO settings from an admin settings form submission.
 *
 * @param {FormData} formData
 * @returns {ReturnType<typeof parseSeoSettingsInput>}
 */
export function parseSeoSettingsFormData(formData) {
  return parseSeoSettingsInput({
    metaTitle: formData.get('metaTitle'),
    metaDescription: formData.get('metaDescription'),
    titleTemplate: formData.get('titleTemplate'),
    allowIndexing: formData.get('allowIndexing') === 'on',
    googleSiteVerification: formData.get('googleSiteVerification'),
    bingSiteVerification: formData.get('bingSiteVerification'),
    twitterHandle: formData.get('twitterHandle'),
  });
}

/**
 * Map parsed SEO fields to Setting.key writes.
 *
 * @param {ReturnType<typeof parseSeoSettingsInput>} parsed
 * @returns {Record<string, unknown>}
 */
export function seoSettingsToKeyValues(parsed) {
  const values = {};

  if ('metaTitle' in parsed)
    values[SETTING_KEYS.SEO_META_TITLE] = parsed.metaTitle;
  if ('metaDescription' in parsed) {
    values[SETTING_KEYS.SEO_META_DESCRIPTION] = parsed.metaDescription;
  }
  if ('titleTemplate' in parsed) {
    values[SETTING_KEYS.SEO_TITLE_TEMPLATE] = parsed.titleTemplate;
  }
  if ('allowIndexing' in parsed) {
    values[SETTING_KEYS.SEO_ALLOW_INDEXING] = parsed.allowIndexing;
  }
  if ('googleSiteVerification' in parsed) {
    values[SETTING_KEYS.SEO_GOOGLE_SITE_VERIFICATION] =
      parsed.googleSiteVerification;
  }
  if ('bingSiteVerification' in parsed) {
    values[SETTING_KEYS.SEO_BING_SITE_VERIFICATION] =
      parsed.bingSiteVerification;
  }
  if ('twitterHandle' in parsed) {
    values[SETTING_KEYS.SEO_TWITTER_HANDLE] = parsed.twitterHandle;
  }
  if ('ogImageUrl' in parsed) {
    values[SETTING_KEYS.SEO_OG_IMAGE_URL] = parsed.ogImageUrl;
  }

  return values;
}

/**
 * Serialize raw setting values for the admin settings page.
 *
 * @param {Record<string, unknown>} values
 * @returns {object}
 */
export function serializeSeoSettings(values = {}) {
  return {
    seoMetaTitle: values[SETTING_KEYS.SEO_META_TITLE] ?? '',
    seoMetaDescription: values[SETTING_KEYS.SEO_META_DESCRIPTION] ?? '',
    seoOgImageUrl: values[SETTING_KEYS.SEO_OG_IMAGE_URL] ?? '',
    seoTitleTemplate:
      values[SETTING_KEYS.SEO_TITLE_TEMPLATE] ?? DEFAULT_TITLE_TEMPLATE,
    seoAllowIndexing: values[SETTING_KEYS.SEO_ALLOW_INDEXING] !== false,
    seoGoogleSiteVerification:
      values[SETTING_KEYS.SEO_GOOGLE_SITE_VERIFICATION] ?? '',
    seoBingSiteVerification:
      values[SETTING_KEYS.SEO_BING_SITE_VERIFICATION] ?? '',
    seoTwitterHandle: values[SETTING_KEYS.SEO_TWITTER_HANDLE] ?? '',
  };
}
