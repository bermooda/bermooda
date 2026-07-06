import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';

import {
  issueGiftCard,
  parseIssueGiftCardInput,
} from '#/core/gift-cards/index.server';
import ActionBar from '#/components/admin/action-bar';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import Card, { CardHeader } from '#/components/admin/card';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export async function action({ request }) {
  const formData = await request.formData();
  const input = parseIssueGiftCardInput({
    code: formData.get('code'),
    balanceCents: formData.get('balanceCents'),
    currency: formData.get('currency'),
  });

  if (!input.balanceCents || input.balanceCents <= 0) {
    return { error: 'Balance must be greater than zero.' };
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
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Gift cards', href: '/admin/gift-cards' },
              { label: 'Issue gift card' },
            ]}
          />
        }
        title="Issue gift card"
        subtitle="Create a gift card redeemable at checkout."
      />

      <ErrorAlert message={actionData?.error} />

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader
            title="Gift card details"
            description="Leave code blank to auto-generate a unique code."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code (optional)" htmlFor="gift-card-code">
              <Input
                id="gift-card-code"
                name="code"
                placeholder="Auto-generated if empty"
                className="font-mono"
              />
            </Field>
            <Field label="Balance (cents) *" htmlFor="gift-card-balance">
              <Input
                id="gift-card-balance"
                name="balanceCents"
                type="number"
                min="1"
                required
                placeholder="5000"
              />
            </Field>
            <Field label="Currency" htmlFor="gift-card-currency">
              <Input
                id="gift-card-currency"
                name="currency"
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
              />
            </Field>
          </div>
        </Card>

        <ActionBar>
          <span />
          <div className="flex items-center gap-3">
            <Link
              to="/admin/gift-cards"
              className="text-text-muted hover:text-text text-sm transition-colors"
            >
              Cancel
            </Link>
            <ButtonSubmit disabled={isSaving}>
              {isSaving ? 'Issuing…' : 'Issue gift card'}
            </ButtonSubmit>
          </div>
        </ActionBar>
      </Form>
    </div>
  );
}
