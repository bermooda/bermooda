// app/core/collections/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    translation: {
      findMany: vi.fn(),
    },
    collection: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters/index.server';
import {
  buildCollectionSearchWhere,
  parseCreateCollectionInput,
  parseUpdateCollectionInput,
} from '#/core/collections/index.server';

describe('collections helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCreateCollectionInput', () => {
    it('parses manual collection form values', () => {
      expect(
        parseCreateCollectionInput({
          handle: ' summer ',
          title: ' Summer ',
          description: ' Hot picks ',
          collectionType: 'manual',
          productIds: 'prod-1, prod-2',
        })
      ).toEqual({
        handle: 'summer',
        title: 'Summer',
        description: 'Hot picks',
        collectionType: 'manual',
        productIds: ['prod-1', 'prod-2'],
        rules: null,
      });
    });

    it('parses smart collection rules from API payloads', () => {
      expect(
        parseCreateCollectionInput({
          handle: 'sale',
          title: 'Sale',
          collectionType: 'smart',
          rules: {
            match: 'any',
            conditions: [
              { type: 'tag', value: 'sale' },
              { type: 'in_stock', value: 'true' },
            ],
          },
        })
      ).toEqual({
        handle: 'sale',
        title: 'Sale',
        description: '',
        collectionType: 'smart',
        productIds: [],
        rules: {
          match: 'any',
          conditions: [
            { type: 'tag', value: 'sale' },
            { type: 'in_stock', value: true },
          ],
        },
      });
    });
  });

  describe('parseUpdateCollectionInput', () => {
    it('normalizes published and productIds fields', () => {
      expect(
        parseUpdateCollectionInput({
          published: 'true',
          productIds: ['prod-1'],
          rules: {
            match: 'all',
            conditions: [{ type: 'price_max', value: '1000' }],
          },
        })
      ).toEqual({
        published: true,
        productIds: ['prod-1'],
        rules: {
          match: 'all',
          conditions: [{ type: 'price_max', value: 1000 }],
        },
      });
    });
  });

  describe('buildCollectionSearchWhere', () => {
    it('returns empty where without query', async () => {
      expect(await buildCollectionSearchWhere()).toEqual({});
      expect(prisma.translation.findMany).not.toHaveBeenCalled();
    });

    it('searches handle and translated titles', async () => {
      prisma.translation.findMany.mockResolvedValue([{ entityId: 'col-1' }]);

      expect(await buildCollectionSearchWhere('summer')).toEqual({
        OR: [{ handle: containsFilter('summer') }, { id: { in: ['col-1'] } }],
      });

      expect(prisma.translation.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'collection',
          field: 'title',
          value: containsFilter('summer'),
        },
        select: { entityId: true },
      });
    });
  });
});
