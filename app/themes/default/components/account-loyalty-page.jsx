import { useT } from '#/core/i18n/index';
import { formatPrice } from '#/core/index';

export default function AccountLoyaltyPage({
  config,
  balance,
  valueCents,
  transactions,
  referralCode,
  locale,
  currency,
}) {
  const t = useT();
  const displayCurrency = currency ?? 'USD';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('account.loyalty')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t('account.loyaltyEarn', { points: config.pointsPerDollar })}
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">{t('account.loyaltyBalance')}</p>
        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {balance.toLocaleString()} {t('account.loyaltyPoints')}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {t('account.loyaltyValue', {
            value: formatPrice(valueCents, displayCurrency, locale ?? 'en'),
          })}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          {t('account.loyaltyReferTitle')}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {t('account.loyaltyReferDescription', {
            points: config.referralBonusPoints,
          })}
        </p>
        <code className="mt-3 inline-block rounded bg-zinc-100 px-3 py-2 font-mono text-lg dark:bg-zinc-800">
          {referralCode}
        </code>
        <p className="mt-2 text-xs text-zinc-400">
          {t('account.loyaltyReferLink', { code: referralCode })}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          {t('account.loyaltyActivity')}
        </h2>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            {t('account.loyaltyNoActivity')}
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex justify-between border-b border-zinc-100 py-2 dark:border-zinc-800"
              >
                <span>
                  {tx.reason ??
                    tx.referenceType ??
                    t('account.loyaltyAdjustment')}
                </span>
                <span
                  className={tx.points >= 0 ? 'text-green-600' : 'text-red-600'}
                >
                  {tx.points >= 0 ? '+' : ''}
                  {tx.points} {t('account.loyaltyPointsShort')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
