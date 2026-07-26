import {
  Form,
  Link,
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
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Quotes', href: '/admin/quotes' },
              { label: 'New quote' },
            ]}
          />
        }
        title="New quote"
        subtitle="Draft a price quote for a company buyer."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Quote details"
            description="Select a company and an initial line item."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company *" htmlFor="quote-company">
              <Select id="quote-company" name="companyId" required>
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Line item *" htmlFor="quote-variant">
              <Select id="quote-variant" name="variantId" required>
                <option value="">Select variant…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku ?? v.id} — {v.product?.title ?? 'Product'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="quote-qty">
              <Input
                id="quote-qty"
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
              />
            </Field>
            <Field label="Price (¢)" htmlFor="quote-price">
              <Input
                id="quote-price"
                name="priceCents"
                type="number"
                min="0"
                defaultValue="0"
              />
            </Field>
            <Field label="Currency" htmlFor="quote-currency">
              <Input id="quote-currency" name="currency" defaultValue="USD" />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/quotes"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Creating…' : 'Create quote'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
