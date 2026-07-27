import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CREATE_PAGE_DESIGNS } from '#/components/admin/create-page/designs';
import { fieldDomId } from '#/components/admin/create-page/spec';

/** @type {import('#/components/admin/create-page/spec').CreatePageSpec} */
const spec = {
  eyebrow: 'Catalog',
  title: 'New category',
  subtitle: 'Add a category to organize your product catalog.',
  breadcrumbs: [
    { label: 'Categories', href: '/admin/categories' },
    { label: 'New category' },
  ],
  sections: [
    {
      id: 'details',
      title: 'Category details',
      description: 'English name and slug.',
      fields: [
        { name: 'title', label: 'Name (EN)', required: true },
        { name: 'slug', label: 'Slug (EN)', hint: 'Optional.' },
        {
          name: 'parentId',
          label: 'Parent category',
          type: 'select',
          options: [{ value: '', label: '— None (root) —' }],
        },
      ],
    },
  ],
  cancelHref: '/admin/categories',
  submitLabel: 'Create category',
  preview: { pathPrefix: '/categories/', slugField: 'slug' },
};

/**
 * @param {React.ElementType} Design
 * @param {Partial<import('#/components/admin/create-page/spec').CreatePageSpec>} [overrides]
 * @returns {HTMLElement}
 */
function renderDesign(Design, overrides = {}) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <Design spec={{ ...spec, ...overrides }} isSaving={false} />
      ),
    },
  ]);

  return render(<Stub initialEntries={['/']} />).container;
}

describe.each(CREATE_PAGE_DESIGNS.map((design) => [design.id, design]))(
  'create-page design: %s',
  (_id, design) => {
    it('renders a labelled, correctly named control for every field', () => {
      const container = renderDesign(design.Component);

      for (const field of spec.sections[0].fields) {
        const id = fieldDomId('details', field.name);
        const control = container.querySelector(`#${id}`);

        expect(control, `${field.name} control`).not.toBeNull();
        expect(control?.getAttribute('name')).toBe(field.name);
        expect(
          container.querySelector(`label[for="${id}"]`),
          `${field.name} label`
        ).not.toBeNull();
      }
    });

    it('posts the form and offers a way out', () => {
      const container = renderDesign(design.Component);

      expect(container.querySelector('form')?.getAttribute('method')).toBe(
        'post'
      );
      expect(
        screen.getByRole('button', { name: /create category/i })
      ).toHaveAttribute('type', 'submit');
      expect(
        screen.getByRole('link', { name: /cancel|discard/i })
      ).toHaveAttribute('href', '/admin/categories');
    });

    it('surfaces the server error', () => {
      renderDesign(design.Component, { error: 'Name is required.' });

      expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    });
  }
);
