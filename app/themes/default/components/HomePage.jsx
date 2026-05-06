import { Link } from 'react-router';

import ProductGrid from './ProductGrid.jsx';

export default function HomePage({ products, categories, locale, currency }) {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gray-50 px-4 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
            bermooda
          </h1>
          <p className="mb-8 text-lg text-gray-500 dark:text-gray-400">
            Discover our collection
          </p>
          <Link
            to="/"
            className="inline-block rounded-md bg-gray-900 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            Shop Now
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
          Featured Products
        </h2>
        <ProductGrid products={products} locale={locale} currency={currency} />
      </section>

      {/* Categories */}
      {categories?.length > 0 && (
        <section className="bg-gray-50 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
              Shop by Category
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id ?? category.slug}
                  to={`/categories/${category.slug}`}
                  className="block rounded-lg border border-gray-200 bg-white p-6 text-center transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-500"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {category.title ?? category.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
