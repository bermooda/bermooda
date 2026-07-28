import StorefrontShell from './storefront-chrome';

export default function PagePage({ page }) {
  return (
    <StorefrontShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl tracking-tight text-stone-900 md:text-5xl">
          {page.title}
        </h1>
        {page.body && (
          <div className="prose prose-stone mt-8 max-w-none whitespace-pre-wrap text-stone-700">
            {page.body}
          </div>
        )}
      </article>
    </StorefrontShell>
  );
}
