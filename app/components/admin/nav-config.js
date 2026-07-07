import {
  ArrowDownOnSquareIcon,
  ArrowTrendingUpIcon,
  Bars3Icon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  CubeIcon,
  DocumentChartBarIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  GiftIcon,
  GlobeAltIcon,
  ListBulletIcon,
  PaintBrushIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ReceiptPercentIcon,
  RectangleStackIcon,
  ShoppingBagIcon,
  Square3Stack3DIcon,
  StarIcon,
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
  DocumentDuplicateIcon,
  DeviceTabletIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

/**
 * Admin sidebar navigation groups.
 *
 * @type {Array<{ label: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent, items: Array<{ name: string, href: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent }> }>}
 */
export const NAV_GROUPS = [
  {
    label: 'Overview',
    Icon: ChartBarIcon,
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
    Icon: CubeIcon,
    items: [
      { name: 'Products', href: '/admin/products', Icon: CubeIcon },
      {
        name: 'Categories',
        href: '/admin/categories',
        Icon: RectangleStackIcon,
      },
      { name: 'Price Lists', href: '/admin/price-lists', Icon: ListBulletIcon },
      {
        name: 'Collections',
        href: '/admin/collections',
        Icon: Square3Stack3DIcon,
      },
      {
        name: 'Inventory',
        href: '/admin/inventory',
        Icon: BuildingStorefrontIcon,
      },
      {
        name: 'Back in stock',
        href: '/admin/back-in-stock',
        Icon: BellAlertIcon,
      },
      { name: 'Import', href: '/admin/import', Icon: ArrowDownOnSquareIcon },
    ],
  },
  {
    label: 'Content',
    Icon: DocumentTextIcon,
    items: [
      { name: 'Pages', href: '/admin/pages', Icon: DocumentTextIcon },
      { name: 'Menus', href: '/admin/menus', Icon: Bars3Icon },
      { name: 'Reviews', href: '/admin/reviews', Icon: StarIcon },
    ],
  },
  {
    label: 'Sales',
    Icon: ShoppingBagIcon,
    items: [
      { name: 'Orders', href: '/admin/orders', Icon: ShoppingBagIcon },
      { name: 'Returns', href: '/admin/returns', Icon: ArrowUturnLeftIcon },
      { name: 'Discounts', href: '/admin/discounts', Icon: ReceiptPercentIcon },
      {
        name: 'Gift Cards',
        href: '/admin/gift-cards',
        Icon: GiftIcon,
      },
      {
        name: 'Subscriptions',
        href: '/admin/subscriptions',
        Icon: ArrowPathIcon,
      },
      { name: 'POS', href: '/admin/pos', Icon: DeviceTabletIcon },
      { name: 'Quotes', href: '/admin/quotes', Icon: DocumentDuplicateIcon },
    ],
  },
  {
    label: 'Customers',
    Icon: UserGroupIcon,
    items: [
      { name: 'Customers', href: '/admin/customers', Icon: UserIcon },
      {
        name: 'Customer Groups',
        href: '/admin/customer-groups',
        Icon: UserGroupIcon,
      },
      {
        name: 'Companies',
        href: '/admin/companies',
        Icon: BuildingOffice2Icon,
      },
      { name: 'Loyalty', href: '/admin/loyalty', Icon: StarIcon },
    ],
  },
  {
    label: 'Growth',
    Icon: ArrowTrendingUpIcon,
    items: [
      {
        name: 'Marketing',
        href: '/admin/marketing',
        Icon: ArrowTrendingUpIcon,
      },
      { name: 'Channels', href: '/admin/channels', Icon: GlobeAltIcon },
    ],
  },
  {
    label: 'Configuration',
    Icon: Cog6ToothIcon,
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
    Icon: ComputerDesktopIcon,
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
