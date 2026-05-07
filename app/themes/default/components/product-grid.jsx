import ProductCard from './product-card';

export default function ProductGrid({ products, locale, currency }) {
  if (!products?.length) {
    return (
      <p className="py-12 text-center text-gray-500 dark:text-gray-400">
        No products found
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          currency={currency}
        />
      ))}
    </div>
  );
}
