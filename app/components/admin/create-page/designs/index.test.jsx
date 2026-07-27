import { fireEvent, render, screen } from '@testing-library/react';
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
 * @param {import('#/components/admin/create-page/designs').CreatePageDesign} design
 * @param {Partial<import('#/components/admin/create-page/spec').CreatePageSpec>} [overrides]
 * @returns {HTMLElement}
 */
function renderDesign(design, overrides = {}) {
  const Design = design.Component;
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

/**
 * Stepped designs hide the submit control behind a review gate, so answer the
 * required fields and walk the flow to the end before asserting on it.
 *
 * @param {import('#/components/admin/create-page/designs').CreatePageDesign} design
 * @param {HTMLElement} container
 */
function advanceToSubmit(design, container) {
  if (design.flow !== 'stepped') return;

  for (const field of spec.sections[0].fields) {
    if (!field.required) continue;
    const control = /** @type {HTMLElement} */ (
      container.querySelector(`#${fieldDomId('details', field.name)}`)
    );
    fireEvent.change(control, { target: { value: 'Shoes' } });
  }

  for (let guard = 0; guard < 20; guard += 1) {
    const next = screen.queryByRole('button', { name: /continue/i });
    if (!next) return;
    fireEvent.click(next);
  }
  throw new Error('stepped design never reached its final step');
}

describe.each(CREATE_PAGE_DESIGNS.map((design) => [design.id, design]))(
  'create-page design: %s',
  (_id, design) => {
    it('renders a labelled, correctly named control for every field', () => {
      const container = renderDesign(design);

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
      const container = renderDesign(design);

      expect(container.querySelector('form')?.getAttribute('method')).toBe(
        'post'
      );

      // An escape hatch that is not just the breadcrumb trail.
      const exits = [
        ...container.querySelectorAll('a[href="/admin/categories"]'),
      ].filter((link) => !link.closest('nav[aria-label="Breadcrumb"]'));
      expect(exits.length, 'a dedicated cancel affordance').toBeGreaterThan(0);

      advanceToSubmit(design, container);
      expect(
        screen.getByRole('button', { name: /create category/i })
      ).toHaveAttribute('type', 'submit');
    });

    it('surfaces the server error', () => {
      renderDesign(design, { error: 'Name is required.' });

      expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    });

    it.skipIf(design.flow !== 'stepped')(
      'keeps submitting impossible until the review step',
      () => {
        const container = renderDesign(design);

        for (const field of spec.sections[0].fields) {
          expect(
            container.querySelector('button[type="submit"]'),
            'no submit control before the review step'
          ).toBeNull();

          const control = /** @type {HTMLElement} */ (
            container.querySelector(`#${fieldDomId('details', field.name)}`)
          );
          fireEvent.change(control, { target: { value: 'Shoes' } });
          fireEvent.click(screen.getByRole('button', { name: /continue/i }));
        }

        expect(container.querySelector('button[type="submit"]')).not.toBeNull();
      }
    );

    it('theme its palette through tokens rather than fixed colours', () => {
      const container = renderDesign(design);

      expect(
        container.querySelector(`.cpd-${design.id}`),
        'design root carries its token class'
      ).not.toBeNull();
    });
  }
);

describe('create-page design registry', () => {
  it('gives every candidate a light and a dark swatch', () => {
    for (const design of CREATE_PAGE_DESIGNS) {
      expect(design.swatchLight).toHaveLength(3);
      expect(design.swatchDark).toHaveLength(3);
      expect(design.swatchLight).not.toEqual(design.swatchDark);
    }
  });

  it('keeps candidates structurally distinct', () => {
    const placements = CREATE_PAGE_DESIGNS.map((design) => design.actions);
    expect(new Set(placements).size).toBe(CREATE_PAGE_DESIGNS.length);
  });
});
