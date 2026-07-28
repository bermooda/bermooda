import ProductCard from './product-card';

export default function ProductGrid({ products, locale, currency }) {
  if (!products?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 py-16 text-center text-sm text-stone-500">
        No products found
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
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
