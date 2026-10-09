import { redirect } from 'react-router';

import { getCartTokenFromRequest } from '#/utils/cart-cookie.server';
import { handleError } from '#/libs/error/index.server';
import { getCart, setCartCurrency } from '#/core/cart/index.server';
import { setCurrencyCookie } from '#/core/currency/index.server';
import {
  getEnabledCurrencies,
  isValidCurrencyCode,
} from '#/core/settings/index.server';
import { parseReturnTo } from '#/core/storefront/page-context.server';

export async function action({ request }) {
  const formData = await request.formData();
  const currency = formData.get('currency')?.toString().trim().toUpperCase();
  const returnTo = parseReturnTo(formData);

  const enabled = await getEnabledCurrencies();
  if (
    !currency ||
    !isValidCurrencyCode(currency) ||
    !enabled.includes(currency)
  ) {
    return redirect(returnTo);
  }

  await moveCartToCurrency(request, currency);

  const response = redirect(returnTo);
  setCurrencyCookie(response, currency);
  return response;
}

/**
 * Reprice the shopper's cart into the chosen currency. When an item has no
 * price there the cart keeps its currency, and the next add-to-cart explains
 * why. Failures never block saving the currency preference.
 *
 * @param {Request} request
 * @param {string} currency
 */
async function moveCartToCurrency(request, currency) {
  const token = getCartTokenFromRequest(request);
  if (!token) return;

  try {
    const cart = await getCart(token);
    if (cart && cart.currency !== currency) {
      await setCartCurrency(cart.id, currency);
    }
  } catch (err) {
    if (err.message === 'PRICE_NOT_FOUND') return;
    // Logs and alerts; the redirect below still saves the preference.
    handleError(err, { source: 'storefront.set-currency.cart' });
  }
}

export async function loader() {
  return redirect('/');
}
