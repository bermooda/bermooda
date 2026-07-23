import { describe, expect, it } from 'vitest';

import {
  filterCommandItems,
  getAllCommandItems,
  groupCommandItems,
} from '#/components/admin/nav-config/index';

describe('admin nav-config', () => {
  it('includes quick actions and sidebar destinations', () => {
    const items = getAllCommandItems();

    expect(items.some((item) => item.href === '/admin/products/new')).toBe(
      true
    );
    expect(items.some((item) => item.href === '/admin/dashboard')).toBe(true);
    expect(items.length).toBeGreaterThan(20);
  });

  it('filters items by name and group', () => {
    const items = getAllCommandItems();
    const filtered = filterCommandItems(items, 'catalog');

    expect(filtered.every((item) => item.group === 'Catalog')).toBe(true);
    expect(filtered.some((item) => item.name === 'Products')).toBe(true);
  });

  it('groups filtered items while preserving section labels', () => {
    const items = getAllCommandItems();
    const grouped = groupCommandItems(filterCommandItems(items, 'new'));

    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped[0].items.length).toBeGreaterThan(0);
  });
});
