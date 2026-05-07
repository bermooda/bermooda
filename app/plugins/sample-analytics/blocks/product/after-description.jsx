// Rendered after the product description via the theme's product.afterDescription slot.
export default function ProductAfterDescriptionBlock({ product }) {
  if (!product) return null;

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      <span className="font-medium text-slate-700">Analytics</span> — this
      product is being tracked by the Sample Analytics plugin.
    </div>
  );
}
