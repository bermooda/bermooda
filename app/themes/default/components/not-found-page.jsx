import { Link } from 'react-router';

import { useT } from '#/core/i18n/index.js';

export default function NotFoundPage() {
  const t = useT();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="mb-4 text-sm font-medium tracking-widest text-gray-400 uppercase dark:text-gray-500">
          404
        </p>
        <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white">
          {t('common.notFound')}
        </h1>
        <p className="mb-8 text-gray-500 dark:text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          to="/"
          className="inline-block rounded-md bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          {t('common.backToHome')}
        </Link>
      </div>
    </div>
  );
}
