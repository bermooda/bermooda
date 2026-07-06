import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import {
  appendCartTokenCookie,
  getCartTokenFromRequest,
} from '#/utils/cart-cookie.server';
import { getCustomerSession } from '#/libs/auth/customer.server';
import {
  addLine,
  createCart,
  getCart,
  removeLine,
  updateQuantity,
} from '#/core/cart/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const token = getCartTokenFromRequest(request);
  const cart = token ? await getCart(token) : null;
  const slotBlocks = await getSlotBlocksMap(['cart.summary']);

  return {
    themeId,
    cart,
    locale,
    currency,
    slotBlocks,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const session = await getCustomerSession(request);
  const customerId = session?.user?.id ?? undefined;

  let token = getCartTokenFromRequest(request);
  let cart = token ? await getCart(token) : null;
  const headers = new Headers();

  if (intent === 'add') {
    const variantId = formData.get('variantId');
    const quantity = Math.max(1, Number(formData.get('quantity')) || 1);

    if (!variantId) {
      return { error: 'Missing variant' };
    }

    if (!cart) {
      cart = await createCart({ currency, customerId });
      token = cart.token;
      appendCartTokenCookie(headers, token);
    }

    try {
      await addLine(cart.id, variantId, quantity, {
        currency,
        locale,
        customerId,
      });
    } catch (err) {
      if (err.message === 'CURRENCY_MISMATCH') {
        return { error: 'Currency mismatch' };
      }
      if (err.message === 'PRICE_NOT_FOUND') {
        return { error: 'Price not available in this currency' };
      }
      throw err;
    }

    const redirectTo = formData.get('redirectTo');
    if (redirectTo === 'cart') {
      return redirect('/cart', { headers });
    }

    return redirect('/cart', { headers });
  }

  if (!token || !cart) {
    return { error: 'No cart' };
  }

  if (intent === 'remove') {
    const lineId = formData.get('lineId');
    await removeLine(cart.id, lineId);
  } else if (intent === 'update') {
    const lineId = formData.get('lineId');
    const quantity = Number(formData.get('quantity'));
    await updateQuantity(cart.id, lineId, quantity);
  } else if (intent === 'checkout') {
    return redirect('/checkout');
  }

  return null;
}

export function meta() {
  return [{ title: 'Cart' }];
}

export default function CartRoute() {
  const { themeId, ...data } = useLoaderData();
  const CartPage = getStorefrontComponent('CartPage', themeId);
  if (!CartPage) {
    throw new Error('CartPage theme component not found');
  }
  return <CartPage {...data} />;
}
