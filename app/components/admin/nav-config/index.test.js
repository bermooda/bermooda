import { describe, expect, it } from 'vitest';

import {
  filterCommandItems,
  getAllCommandItems,
  groupCommandItems,
  NAV_GROUPS,
  QUICK_ACTIONS,
} from '#/components/admin/nav-config';

describe('admin nav-config', () => {
  it('uses i18n message keys for nav labels and names', () => {
    expect(NAV_GROUPS[0].label).toBe('admin.nav.overview');
    expect(NAV_GROUPS[0].items[0].name).toBe('admin.nav.dashboard');
    expect(
      NAV_GROUPS.some((group) =>
        group.items.some((item) => item.name === 'admin.nav.products')
      )
    ).toBe(true);
  });

  it('uses i18n message keys for quick actions', () => {
    expect(QUICK_ACTIONS[0].name).toBe('admin.command.newProduct');
    expect(QUICK_ACTIONS[0].group).toBe('admin.command.quickActions');
    expect(
      QUICK_ACTIONS.some((item) => item.name === 'admin.command.viewStorefront')
    ).toBe(true);
  });

  it('includes quick actions and sidebar destinations', () => {
    const items = getAllCommandItems();

    expect(items.some((item) => item.href === '/admin/products/new')).toBe(
      true
    );
    expect(items.some((item) => item.href === '/admin/dashboard')).toBe(true);
    expect(items.length).toBeGreaterThan(20);
  });

  it('filters items by message key segments', () => {
    const items = getAllCommandItems();
    const filtered = filterCommandItems(items, 'catalog');

    expect(filtered.every((item) => item.group === 'admin.nav.catalog')).toBe(
      true
    );
    expect(filtered.some((item) => item.name === 'admin.nav.products')).toBe(
      true
    );
  });

  it('groups filtered items while preserving section key labels', () => {
    const items = getAllCommandItems();
    const grouped = groupCommandItems(filterCommandItems(items, 'new'));

    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped[0].items.length).toBeGreaterThan(0);
    expect(grouped[0].label).toMatch(/^admin\.(nav|command)\./);
  });
});
