/**
 * CMS pages and navigation menus.
 */

import { upsertSlug, upsertTranslation } from './helpers.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedContent(prisma) {
  const aboutPage = await prisma.page.upsert({
    where: { id: 'seed-page-about' },
    create: {
      id: 'seed-page-about',
      status: 'published',
      publishedAt: new Date(),
      position: 0,
    },
    update: { status: 'published', publishedAt: new Date() },
  });
  await upsertSlug(prisma, 'page', aboutPage.id, 'about');
  await upsertTranslation(prisma, 'page', aboutPage.id, 'title', 'About Us');
  await upsertTranslation(
    prisma,
    'page',
    aboutPage.id,
    'body',
    'Bermooda is a curated home and lifestyle shop. We source thoughtful goods for everyday living.'
  );

  const shippingPage = await prisma.page.upsert({
    where: { id: 'seed-page-shipping' },
    create: {
      id: 'seed-page-shipping',
      status: 'published',
      publishedAt: new Date(),
      position: 1,
    },
    update: { status: 'published', publishedAt: new Date() },
  });
  await upsertSlug(prisma, 'page', shippingPage.id, 'shipping-policy');
  await upsertTranslation(
    prisma,
    'page',
    shippingPage.id,
    'title',
    'Shipping Policy'
  );
  await upsertTranslation(
    prisma,
    'page',
    shippingPage.id,
    'body',
    'Orders ship within 2 business days. Free shipping on orders over $75.'
  );

  const returnsPage = await prisma.page.upsert({
    where: { id: 'seed-page-returns' },
    create: {
      id: 'seed-page-returns',
      status: 'published',
      publishedAt: new Date(),
      position: 2,
    },
    update: { status: 'published', publishedAt: new Date() },
  });
  await upsertSlug(prisma, 'page', returnsPage.id, 'returns');
  await upsertTranslation(
    prisma,
    'page',
    returnsPage.id,
    'title',
    'Returns & Exchanges'
  );
  await upsertTranslation(
    prisma,
    'page',
    returnsPage.id,
    'body',
    'Return unused items within 30 days for a full refund or store credit.'
  );

  const subHeaderMenu = await prisma.menu.upsert({
    where: { handle: 'sub-header' },
    create: { handle: 'sub-header', title: 'Sub header' },
    update: { title: 'Sub header' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: subHeaderMenu.id } });
  await prisma.menuItem.createMany({
    data: [
      {
        menuId: subHeaderMenu.id,
        label: 'Gift Guide',
        pageId: aboutPage.id,
        position: 0,
      },
      {
        menuId: subHeaderMenu.id,
        label: 'Trade Program',
        url: '/about',
        position: 1,
      },
      {
        menuId: subHeaderMenu.id,
        label: 'Stores',
        pageId: shippingPage.id,
        position: 2,
      },
    ],
  });

  const footerMenu = await prisma.menu.upsert({
    where: { handle: 'footer' },
    create: { handle: 'footer', title: 'Footer' },
    update: { title: 'Footer' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: footerMenu.id } });
  await prisma.menuItem.createMany({
    data: [
      {
        menuId: footerMenu.id,
        label: 'Shipping',
        pageId: shippingPage.id,
        position: 0,
      },
      {
        menuId: footerMenu.id,
        label: 'Returns',
        pageId: returnsPage.id,
        position: 1,
      },
      {
        menuId: footerMenu.id,
        label: 'About',
        pageId: aboutPage.id,
        position: 2,
      },
      {
        menuId: footerMenu.id,
        label: 'Account',
        url: '/account/login',
        position: 3,
      },
    ],
  });

  const mainMenu = await prisma.menu.upsert({
    where: { handle: 'main' },
    create: { handle: 'main', title: 'Main' },
    update: { title: 'Main' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: mainMenu.id } });
  await prisma.menuItem.createMany({
    data: [
      { menuId: mainMenu.id, label: 'Home', url: '/', position: 0 },
      {
        menuId: mainMenu.id,
        label: 'About',
        pageId: aboutPage.id,
        position: 1,
      },
      {
        menuId: mainMenu.id,
        label: 'Shipping',
        pageId: shippingPage.id,
        position: 2,
      },
    ],
  });

  console.log('Seeded CMS pages and menus.');
}
