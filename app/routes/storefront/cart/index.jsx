import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import {
  appendCartTokenCookie,
  getCartTokenFromRequest,
} from '#/utils/cart-cookie.server';
import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { handleError } from '#/libs/error/index.server';
import {
  addLine,
  createCart,
  getCart,
  removeLine,
  setCartCurrency,
  updateQuantity,
} from '#/core/cart/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const { themeId, locale, currency } =
    await loadStorefrontPageContext(request);
  const token = getCartTokenFromRequest(request);
  const cart = token ? await getCart(token) : null;
  const slotBlocks = await getSlotBlocksMap(['cart.summary']);

  return {
    themeId,
    cart,
    locale,
    // Line prices are snapshots in the cart's currency; label them with it.
    currency: cart?.currency ?? currency,
    slotBlocks,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const { locale, currency } = await loadStorefrontPageContext(request);
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
      const channel = await resolveChannelFromRequest(request);
      cart = await createCart({
        currency,
        customerId,
        salesChannelId: channel?.id,
      });
      token = cart.token;
      appendCartTokenCookie(headers, token);
    } else if (cart.currency !== currency) {
      // The shopper switched currency (or it was disabled) after adding items.
      try {
        cart = await setCartCurrency(cart.id, currency);
      } catch (err) {
        if (err.message === 'PRICE_NOT_FOUND') {
          return {
            error: `Some items in your cart aren't available in ${currency}. Switch back to ${cart.currency} to keep shopping.`,
          };
        }
        return handleError(err, {
          source: 'storefront.cart.currency',
          userMessage: 'Could not update cart.',
        });
      }
    }

    try {
      await addLine(cart.id, variantId, quantity, {
        currency,
        locale,
        customerId,
      });
    } catch (err) {
      if (err.message === 'CURRENCY_MISMATCH') {
        return { error: 'Your cart changed currency. Please try again.' };
      }
      if (err.message === 'PRICE_NOT_FOUND') {
        return { error: 'Price not available in this currency' };
      }
      return handleError(err, {
        source: 'storefront.cart.add',
        userMessage: 'Could not add item to cart.',
      });
    }

    return redirect('/cart', { headers });
  }

  if (!token || !cart) {
    return { error: 'No cart' };
  }

  try {
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
  } catch (err) {
    return handleError(err, {
      source: 'storefront.cart',
      userMessage: 'Could not update cart.',
    });
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
