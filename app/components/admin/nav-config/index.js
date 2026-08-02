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
  HeartIcon,
} from '@heroicons/react/24/outline';

/**
 * Admin sidebar navigation groups.
 * `label` and item `name` are i18n message keys (e.g. `admin.nav.products`).
 *
 * @type {Array<{ label: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent, items: Array<{ name: string, href: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent }> }>}
 */
export const NAV_GROUPS = [
  {
    label: 'admin.nav.overview',
    Icon: ChartBarIcon,
    items: [
      {
        name: 'admin.nav.dashboard',
        href: '/admin/dashboard',
        Icon: ChartBarIcon,
      },
      {
        name: 'admin.nav.reports',
        href: '/admin/reports',
        Icon: DocumentChartBarIcon,
      },
      {
        name: 'admin.nav.auditLog',
        href: '/admin/audit-log',
        Icon: ClipboardDocumentListIcon,
      },
    ],
  },
  {
    label: 'admin.nav.catalog',
    Icon: CubeIcon,
    items: [
      { name: 'admin.nav.products', href: '/admin/products', Icon: CubeIcon },
      {
        name: 'admin.nav.categories',
        href: '/admin/categories',
        Icon: RectangleStackIcon,
      },
      {
        name: 'admin.nav.priceLists',
        href: '/admin/price-lists',
        Icon: ListBulletIcon,
      },
      {
        name: 'admin.nav.collections',
        href: '/admin/collections',
        Icon: Square3Stack3DIcon,
      },
      {
        name: 'admin.nav.inventory',
        href: '/admin/inventory',
        Icon: BuildingStorefrontIcon,
      },
      {
        name: 'admin.nav.backInStock',
        href: '/admin/back-in-stock',
        Icon: BellAlertIcon,
      },
      {
        name: 'admin.nav.wishlists',
        href: '/admin/wishlists',
        Icon: HeartIcon,
      },
      {
        name: 'admin.nav.import',
        href: '/admin/import',
        Icon: ArrowDownOnSquareIcon,
      },
    ],
  },
  {
    label: 'admin.nav.content',
    Icon: DocumentTextIcon,
    items: [
      {
        name: 'admin.nav.pages',
        href: '/admin/pages',
        Icon: DocumentTextIcon,
      },
      { name: 'admin.nav.menus', href: '/admin/menus', Icon: Bars3Icon },
      { name: 'admin.nav.reviews', href: '/admin/reviews', Icon: StarIcon },
    ],
  },
  {
    label: 'admin.nav.sales',
    Icon: ShoppingBagIcon,
    items: [
      {
        name: 'admin.nav.orders',
        href: '/admin/orders',
        Icon: ShoppingBagIcon,
      },
      {
        name: 'admin.nav.returns',
        href: '/admin/returns',
        Icon: ArrowUturnLeftIcon,
      },
      {
        name: 'admin.nav.discounts',
        href: '/admin/discounts',
        Icon: ReceiptPercentIcon,
      },
      {
        name: 'admin.nav.giftCards',
        href: '/admin/gift-cards',
        Icon: GiftIcon,
      },
      {
        name: 'admin.nav.subscriptions',
        href: '/admin/subscriptions',
        Icon: ArrowPathIcon,
      },
      { name: 'admin.nav.pos', href: '/admin/pos', Icon: DeviceTabletIcon },
      {
        name: 'admin.nav.quotes',
        href: '/admin/quotes',
        Icon: DocumentDuplicateIcon,
      },
    ],
  },
  {
    label: 'admin.nav.customers',
    Icon: UserGroupIcon,
    items: [
      {
        name: 'admin.nav.customers',
        href: '/admin/customers',
        Icon: UserIcon,
      },
      {
        name: 'admin.nav.customerGroups',
        href: '/admin/customer-groups',
        Icon: UserGroupIcon,
      },
      {
        name: 'admin.nav.companies',
        href: '/admin/companies',
        Icon: BuildingOffice2Icon,
      },
      { name: 'admin.nav.loyalty', href: '/admin/loyalty', Icon: StarIcon },
    ],
  },
  {
    label: 'admin.nav.growth',
    Icon: ArrowTrendingUpIcon,
    items: [
      {
        name: 'admin.nav.marketing',
        href: '/admin/marketing',
        Icon: ArrowTrendingUpIcon,
      },
      {
        name: 'admin.nav.channels',
        href: '/admin/channels',
        Icon: GlobeAltIcon,
      },
    ],
  },
  {
    label: 'admin.nav.configuration',
    Icon: Cog6ToothIcon,
    items: [
      {
        name: 'admin.nav.themes',
        href: '/admin/themes',
        Icon: PaintBrushIcon,
      },
      {
        name: 'admin.nav.plugins',
        href: '/admin/plugins',
        Icon: PuzzlePieceIcon,
      },
      {
        name: 'admin.nav.api',
        href: '/admin/api-settings',
        Icon: CodeBracketIcon,
      },
      {
        name: 'admin.nav.settings',
        href: '/admin/settings',
        Icon: Cog6ToothIcon,
      },
    ],
  },
];

/**
 * Quick actions surfaced at the top of the command palette.
 * `name` and `group` are i18n message keys (e.g. `admin.command.newProduct`).
 *
 * @type {Array<{ name: string, href: string, Icon: import('@heroicons/react/24/outline').ForwardRefExoticComponent, group: string, external?: boolean }>}
 */
export const QUICK_ACTIONS = [
  {
    name: 'admin.command.newProduct',
    href: '/admin/products/new',
    Icon: PlusIcon,
    group: 'admin.command.quickActions',
  },
  {
    name: 'admin.command.newPage',
    href: '/admin/pages/new',
    Icon: DocumentPlusIcon,
    group: 'admin.command.quickActions',
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
    name: 'admin.command.viewStorefront',
    href: '/',
    Icon: ComputerDesktopIcon,
    group: 'admin.command.quickActions',
    external: true,
  },
];

/**
 * Flat list of all command palette destinations.
 * Item `name` and `group` are i18n message keys until callers translate for display.
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
 * Matches against message key segments (e.g. `catalog` → `admin.nav.catalog`).
 * Callers that translate for display should filter pre-translated items instead.
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
 * Group filtered items by their section message key, preserving order.
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
