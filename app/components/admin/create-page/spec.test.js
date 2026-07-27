import { describe, expect, it } from 'vitest';

import {
  allFields,
  fieldDomId,
  initialValues,
  slugify,
} from '#/components/admin/create-page/spec';

/** @type {import('#/components/admin/create-page/spec').CreatePageSpec} */
const spec = {
  title: 'New category',
  breadcrumbs: [{ label: 'Categories', href: '/admin/categories' }],
  sections: [
    {
      id: 'details',
      title: 'Category details',
      fields: [
        { name: 'title', label: 'Name', required: true },
        { name: 'slug', label: 'Slug', defaultValue: 'apparel' },
      ],
    },
    {
      id: 'seo',
      title: 'SEO',
      fields: [{ name: 'metaTitle', label: 'Meta title' }],
    },
  ],
  cancelHref: '/admin/categories',
  submitLabel: 'Create category',
};

describe('create-page spec helpers', () => {
  it('namespaces control ids by section', () => {
    expect(fieldDomId('details', 'title')).toBe('cp-details-title');
  });

  it('flattens fields across sections in render order', () => {
    expect(allFields(spec).map((field) => field.name)).toEqual([
      'title',
      'slug',
      'metaTitle',
    ]);
  });

  it('seeds preview values from defaults', () => {
    expect(initialValues(spec)).toEqual({
      title: '',
      slug: 'apparel',
      metaTitle: '',
    });
  });

  it('slugifies free text for URL previews', () => {
    expect(slugify('  Winter Jackets & Coats! ')).toBe('winter-jackets-coats');
    expect(slugify('---')).toBe('');
  });
});
