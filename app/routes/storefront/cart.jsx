import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCart, removeLine, updateQuantity } from '#/core/cart/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import CartPage from '#/themes/default/components/CartPage';

function getCartToken(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)cart_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export async function loader({ request }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const token = getCartToken(request);
  const cart = token ? await getCart(token) : null;

  return { cart, locale, currency };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const token = getCartToken(request);

  if (!token) return { error: 'No cart' };

  const cart = await getCart(token);
  if (!cart) return { error: 'Cart not found' };

  if (intent === 'remove') {
    const lineId = formData.get('lineId');
    await removeLine(cart.id, lineId);
  } else if (intent === 'update') {
    const lineId = formData.get('lineId');
    const quantity = Number(formData.get('quantity'));
    await updateQuantity(cart.id, lineId, quantity);
  } else if (intent === 'checkout') {
    return redirect('/checkout/address');
  }

  return null;
}

export function meta() {
  return [{ title: 'Cart' }];
}

export default function CartRoute() {
  const data = useLoaderData();
  return <CartPage {...data} />;
}
