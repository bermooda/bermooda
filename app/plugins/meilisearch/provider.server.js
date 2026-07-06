// app/plugins/meilisearch/provider.server.js
// Meilisearch search provider — uses REST API (no SDK required).

import logger from '#/utils/logger.server';
import { dbProvider } from '#/core/search/index.server';

const INDEX_NAME = 'products';
const log = logger.child({ provider: 'meilisearch' });

function getConfig() {
  const host = process.env.MEILISEARCH_HOST?.replace(/\/$/, '');
  const apiKey = process.env.MEILISEARCH_API_KEY;
  if (!host || !apiKey) return null;
  return { host, apiKey };
}

async function meiliFetch(path, { method = 'GET', body } = {}) {
  const config = getConfig();
  if (!config) throw new Error('Meilisearch is not configured');

  const response = await fetch(`${config.host}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meilisearch ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function buildFilterString(filters = {}) {
  const parts = [];
  if (filters.categoryId) {
    parts.push(`categoryIds = "${filters.categoryId}"`);
  }
  if (filters.inStock === true) {
    parts.push('inStock = true');
  }
  if (filters.priceMin != null) {
    parts.push(`priceCents >= ${filters.priceMin}`);
  }
  if (filters.priceMax != null) {
    parts.push(`priceCents <= ${filters.priceMax}`);
  }
  return parts.length ? parts.join(' AND ') : undefined;
}

/**
 * Meilisearch-backed search provider. Falls back to DB provider when not configured.
 */
export const meilisearchProvider = {
  name: 'Meilisearch',

  async search(params) {
    const config = getConfig();
    if (!config) {
      log.warn('Meilisearch not configured — falling back to database search');
      return dbProvider.search(params);
    }

    const {
      query = '',
      filters = {},
      sort = 'relevance',
      page = 1,
      limit = 24,
    } = params;

    const sortMap = {
      relevance: undefined,
      newest: ['createdAt:desc'],
      price_asc: ['priceCents:asc'],
      price_desc: ['priceCents:desc'],
    };

    try {
      const result = await meiliFetch(`/indexes/${INDEX_NAME}/search`, {
        method: 'POST',
        body: {
          q: query,
          filter: buildFilterString(filters),
          sort: sortMap[sort],
          hitsPerPage: limit,
          page,
          facets: ['categoryIds', 'inStock'],
        },
      });

      const products = (result.hits ?? []).map((hit) => ({
        id: hit.id,
        slug: hit.slug ?? null,
        title: hit.title ?? hit.id,
        variants: hit.variants ?? [],
        media: hit.media ?? [],
      }));

      log.debug(
        { query, total: result.totalHits ?? products.length, page },
        'search:meilisearch'
      );

      return {
        products,
        total: result.totalHits ?? products.length,
        facets: {
          categories: [],
          price: { min: 0, max: 0 },
          attributes: [],
          availability: {
            inStock: result.facetDistribution?.inStock?.true ?? 0,
            total: result.totalHits ?? products.length,
          },
        },
      };
    } catch (err) {
      log.error(
        { err },
        'Meilisearch search failed — falling back to database'
      );
      return dbProvider.search(params);
    }
  },
};

/**
 * Index a product document in Meilisearch (call from sync jobs or hooks).
 *
 * @param {object} document
 */
export async function indexProduct(document) {
  const config = getConfig();
  if (!config) return;

  await meiliFetch(`/indexes/${INDEX_NAME}/documents`, {
    method: 'POST',
    body: [document],
  });
}
