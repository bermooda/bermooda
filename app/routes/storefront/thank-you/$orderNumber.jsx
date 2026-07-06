import { useLoaderData } from 'react-router';

import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { listOrders } from '#/core/orders/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request, params }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const { orderNumber } = params;

  const { orders } = await listOrders({ orderNumber, limit: 1 });
  const order = orders[0] ?? null;

  if (!order) {
    throw new Response('Order not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    'Set-Cookie',
    'checkout_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );

  return Response.json({ order, locale, currency, themeId }, { headers });
}

export function meta({ loaderData }) {
  return [
    { title: `Order ${loaderData?.order?.orderNumber ?? ''} – Thank you!` },
  ];
}

export default function ThankYouRoute() {
  const { themeId, ...data } = useLoaderData();
  const CheckoutThankYouPage = getStorefrontComponent(
    'CheckoutThankYouPage',
    themeId
  );
  if (!CheckoutThankYouPage)
    throw new Error('CheckoutThankYouPage theme component not found');
  return <CheckoutThankYouPage {...data} />;
}
