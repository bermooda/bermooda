import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  createQuote,
  listCompanies,
  listVariantsForQuoteForm,
  parseCreateQuoteForm,
} from '#/core/b2b/index.server';
import QuoteEditor from '#/components/admin/quote-editor';

export async function loader() {
  const [{ companies }, variants] = await Promise.all([
    listCompanies({ limit: 100 }),
    listVariantsForQuoteForm(),
  ]);
  return { companies, variants };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const quote = await createQuote(parseCreateQuoteForm(formData));
    return redirect(`/admin/quotes/${quote.id}`);
  } catch (err) {
    return { error: err.message ?? 'Could not create quote.' };
  }
}

export function meta() {
  return [{ title: 'New quote — Quotes' }];
}

export default function AdminNewQuoteRoute() {
  const { companies, variants } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <QuoteEditor
      companies={companies}
      variants={variants}
      actionData={actionData}
      isSaving={isSaving}
    />
  );
}
