import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import { parseDecimalToCents } from '#/core/currency/format';
import {
  getIssueGiftCardInputError,
  issueGiftCard,
  parseIssueGiftCardInput,
} from '#/core/gift-cards/index.server';
import {
  DEFAULT_CURRENCY,
  SETTING_KEYS,
  get as getSetting,
  getEnabledCurrencies,
} from '#/core/settings/index.server';
import GiftCardEditor from '#/components/admin/gift-card-editor';

export async function loader() {
  const [currencies, defaultCurrency] = await Promise.all([
    getEnabledCurrencies(),
    getSetting(SETTING_KEYS.DEFAULT_CURRENCY),
  ]);
  return {
    currencies,
    defaultCurrency: defaultCurrency ?? DEFAULT_CURRENCY,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  // The form takes a decimal amount in the major unit ("50.00"); the admin
  // API keeps accepting `balanceCents`.
  const input = parseIssueGiftCardInput({
    code: formData.get('code'),
    balanceCents: parseDecimalToCents(formData.get('balance')) ?? 0,
    currency: formData.get('currency'),
  });

  const inputError = getIssueGiftCardInputError(input);
  if (inputError) {
    return { error: inputError };
  }

  try {
    await issueGiftCard(input);
    return redirect('/admin/gift-cards');
  } catch (err) {
    if (err.code === 'GIFT_CARD_CODE_EXISTS') {
      return { error: err.message };
    }
    throw err;
  }
}

export default function AdminNewGiftCardRoute() {
  const { currencies, defaultCurrency } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <GiftCardEditor
      actionData={actionData}
      isSaving={isSaving}
      currencies={currencies}
      defaultCurrency={defaultCurrency}
    />
  );
}
