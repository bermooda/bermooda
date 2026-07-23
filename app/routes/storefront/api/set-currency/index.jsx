import { redirect } from 'react-router';

import { parseReturnTo } from '#/libs/api/storefront/index.server';
import { setCurrencyCookie } from '#/core/currency/index.server';
import {
  getEnabledCurrencies,
  isValidCurrencyCode,
} from '#/core/settings/index.server';

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

  const response = redirect(returnTo);
  setCurrencyCookie(response, currency);
  return response;
}

export async function loader() {
  return redirect('/');
}
