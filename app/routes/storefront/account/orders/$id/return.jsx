// Customer return request for an order.

import { Form, redirect, useActionData, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { buildLoginRedirectUrl } from '#/libs/auth/shared/index.server';
import { handleError } from '#/libs/error/index.server';
import { getOrder } from '#/core/customers/index.server';
import {
  parseReturnLinesFromForm,
  requestReturn,
} from '#/core/returns/index.server';

export async function loader({ request, params }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  if (!customer) {
    throw redirect(buildLoginRedirectUrl('/account/login', request), 302);
  }

  const order = await getOrder(params.id, customer.id);
  if (!order) {
    throw redirect('/account/orders');
  }

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      lines: order.lines.map((l) => ({
        id: l.id,
        title: l.title,
        quantity: l.quantity,
        returnedQuantity: l.returnedQuantity ?? 0,
        available: l.quantity - (l.returnedQuantity ?? 0),
      })),
    },
  };
}

export async function action({ request, params }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  if (!customer) {
    throw redirect(buildLoginRedirectUrl('/account/login', request), 302);
  }

  const formData = await request.formData();
  const reason = formData.get('reason')?.toString().trim() || undefined;
  const lines = parseReturnLinesFromForm(formData);

  try {
    const returnRecord = await requestReturn(params.id, {
      customerId: customer.id,
      reason,
      lines,
    });
    return redirect(`/account/orders/${params.id}?return=${returnRecord.id}`);
  } catch (err) {
    if (err.code && err.message) {
      return { error: err.message };
    }
    return handleError(err, {
      source: 'storefront.account.return',
      userMessage: 'Could not submit return request.',
    });
  }
}

export function meta() {
  return [{ title: 'Request Return' }];
}

export default function AccountOrderReturnRoute() {
  const { order } = useLoaderData();
  const actionData = useActionData();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Request Return — {order.orderNumber}
      </h1>

      {actionData?.error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error}
        </p>
      )}

      <Form method="post" className="space-y-4">
        <div className="space-y-3">
          {order.lines
            .filter((l) => l.available > 0)
            .map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {line.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Available: {line.available}
                  </p>
                </div>
                <input
                  type="number"
                  name={`qty-${line.id}`}
                  min={0}
                  max={line.available}
                  defaultValue={0}
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
              </div>
            ))}
        </div>

        <div>
          <label className="mb-1 block text-sm text-zinc-600">Reason</label>
          <textarea
            name="reason"
            rows={3}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            placeholder="Optional reason for return"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Submit Return Request
        </button>
      </Form>
    </div>
  );
}
