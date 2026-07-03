import {
  Bars3Icon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CubeIcon,
  DocumentChartBarIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  StarIcon,
  TagIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

/**
 * Admin sidebar navigation groups.
 *
 * @type {Array<{ label: string, items: Array<{ name: string, href: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent }> }>}
 */
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/admin/dashboard', Icon: ChartBarIcon },
      { name: 'Reports', href: '/admin/reports', Icon: DocumentChartBarIcon },
      {
        name: 'Audit Log',
        href: '/admin/audit-log',
        Icon: ClipboardDocumentListIcon,
      },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { name: 'Products', href: '/admin/products', Icon: CubeIcon },
      { name: 'Categories', href: '/admin/categories', Icon: TagIcon },
      { name: 'Collections', href: '/admin/collections', Icon: TagIcon },
      { name: 'Import', href: '/admin/import', Icon: DocumentChartBarIcon },
      { name: 'Inventory', href: '/admin/inventory', Icon: CubeIcon },
      { name: 'Price Lists', href: '/admin/price-lists', Icon: TagIcon },
    ],
  },
  {
    label: 'Content',
    items: [
      { name: 'Pages', href: '/admin/pages', Icon: DocumentTextIcon },
      { name: 'Menus', href: '/admin/menus', Icon: Bars3Icon },
      { name: 'Reviews', href: '/admin/reviews', Icon: StarIcon },
    ],
  },
  {
    label: 'Sales',
    items: [
      { name: 'Orders', href: '/admin/orders', Icon: ShoppingBagIcon },
      { name: 'Discounts', href: '/admin/discounts', Icon: ReceiptPercentIcon },
      {
        name: 'Gift Cards',
        href: '/admin/gift-cards',
        Icon: ReceiptPercentIcon,
      },
    ],
  },
  {
    label: 'Customers',
    items: [
      { name: 'Customers', href: '/admin/customers', Icon: UserGroupIcon },
      {
        name: 'Customer Groups',
        href: '/admin/customer-groups',
        Icon: UserGroupIcon,
      },
      { name: 'Loyalty', href: '/admin/loyalty', Icon: StarIcon },
    ],
  },
  {
    label: 'Growth',
    items: [
      { name: 'Marketing', href: '/admin/marketing', Icon: ChartBarIcon },
      { name: 'Channels', href: '/admin/channels', Icon: GlobeAltIcon },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { name: 'Themes', href: '/admin/themes', Icon: PaintBrushIcon },
      { name: 'Plugins', href: '/admin/plugins', Icon: PuzzlePieceIcon },
      { name: 'API', href: '/admin/api-settings', Icon: CodeBracketIcon },
      { name: 'Settings', href: '/admin/settings', Icon: Cog6ToothIcon },
    ],
  },
];

/**
 * Quick actions surfaced at the top of the command palette.
 *
 * @type {Array<{ name: string, href: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent, group: string, external?: boolean }>}
 */
export const QUICK_ACTIONS = [
  {
    name: 'New product',
    href: '/admin/products/new',
    Icon: PlusIcon,
    group: 'Quick actions',
  },
  {
    name: 'New page',
    href: '/admin/pages/new',
    Icon: DocumentPlusIcon,
    group: 'Quick actions',
  },
  // {
  //   name: 'New customer',
  //   href: '/admin/customers/new',
  //   Icon: PlusIcon,
  //   group: 'Quick actions',
  // },
  // {
  //   name: 'New category',
  //   href: '/admin/categories/new',
  //   Icon: PlusIcon,
  //   group: 'Quick actions',
  // },
  // {
  //   name: 'New discount',
  //   href: '/admin/discounts/new',
  //   Icon: PlusIcon,
  //   group: 'Quick actions',
  // },
  {
    name: 'View storefront',
    href: '/',
    Icon: GlobeAltIcon,
    group: 'Quick actions',
    external: true,
  },
];

/**
 * Flat list of all command palette destinations.
 *
 * @returns {Array<{ name: string, href: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent, group: string, external?: boolean }>}
 */
export function getAllCommandItems() {
  const navItems = NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      group: group.label,
    }))
  );

  return [...QUICK_ACTIONS, ...navItems];
}

/**
 * Filter command palette items by search query.
 *
 * @param {ReturnType<typeof getAllCommandItems>} items
 * @param {string} query
 * @returns {ReturnType<typeof getAllCommandItems>}
 */
export function filterCommandItems(items, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.group.toLowerCase().includes(normalized)
  );
}

/**
 * Group filtered items by their section label, preserving order.
 *
 * @param {ReturnType<typeof getAllCommandItems>} items
 * @returns {Array<{ label: string, items: ReturnType<typeof getAllCommandItems> }>}
 */
export function groupCommandItems(items) {
  /** @type {Map<string, ReturnType<typeof getAllCommandItems>>} */
  const groups = new Map();

  for (const item of items) {
    const existing = groups.get(item.group);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.group, [item]);
    }
  }

  return Array.from(groups.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems,
  }));
}
