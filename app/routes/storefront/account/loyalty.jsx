// app/routes/storefront/account/loyalty.jsx

import { redirect, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import {
  getCustomerLoyaltySummary,
  getOrCreateReferralCode,
  listLoyaltyTransactions,
} from '#/core/loyalty/index.server';

export async function loader({ request }) {
  const session = await getCustomerSession(request);
  if (!session?.user) return redirect('/account/login');

  const customerId = session.user.id;
  const [loyalty, { transactions }, referralCode] = await Promise.all([
    getCustomerLoyaltySummary(customerId),
    listLoyaltyTransactions(customerId, { limit: 20 }),
    getOrCreateReferralCode(customerId),
  ]);

  return {
    config: loyalty.config,
    balance: loyalty.balance,
    valueCents: loyalty.valueCents,
    transactions,
    referralCode: referralCode.code,
  };
}

export function meta() {
  return [{ title: 'Loyalty Rewards' }];
}

export default function AccountLoyaltyRoute() {
  const { config, balance, valueCents, transactions, referralCode } =
    useLoaderData();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Loyalty rewards
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Earn {config.pointsPerDollar} point(s) per dollar spent. Redeem at
          checkout.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-500">Your balance</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">
          {balance.toLocaleString()} pts
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Worth approximately{' '}
          {new Intl.NumberFormat('en', {
            style: 'currency',
            currency: 'USD',
          }).format(valueCents / 100)}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium">Refer a friend</h2>
        <p className="mt-1 text-sm text-slate-500">
          Share your code — you earn {config.referralBonusPoints} bonus points
          when they place their first order.
        </p>
        <code className="mt-3 inline-block rounded bg-slate-100 px-3 py-2 font-mono text-lg dark:bg-slate-800">
          {referralCode}
        </code>
        <p className="mt-2 text-xs text-slate-400">Link: ?ref={referralCode}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-medium">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex justify-between border-b border-slate-100 py-2 dark:border-slate-800"
              >
                <span>{tx.reason ?? tx.referenceType ?? 'Adjustment'}</span>
                <span
                  className={tx.points >= 0 ? 'text-green-600' : 'text-red-600'}
                >
                  {tx.points >= 0 ? '+' : ''}
                  {tx.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
