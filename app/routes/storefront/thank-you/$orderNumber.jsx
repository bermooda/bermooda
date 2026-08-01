import { useLoaderData } from 'react-router';

import { clearCheckoutSessionCookie } from '#/utils/checkout-cookie.server';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getOrderByOrderNumber } from '#/core/orders/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request, params }) {
  const { themeId, locale, currency } =
    await loadStorefrontPageContext(request);
  const order = await getOrderByOrderNumber(params.orderNumber);

  if (!order) {
    throw new Response('Order not found', { status: 404 });
  }

  const headers = new Headers();
  clearCheckoutSessionCookie(headers);

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
