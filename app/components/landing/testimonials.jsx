// Testimonials data
const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Founder, Indie Goods Co.',
    quote:
      'We replaced spreadsheets with bermooda and shipped a real storefront in weeks. Orders and inventory finally live in one system.',
  },
  {
    name: 'Michael Chen',
    role: 'Operations, Northwind Retail',
    quote:
      'Stripe and email were already integrated—we dropped in keys and went live. Checkout just works for our small team.',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Solo merchant',
    quote:
      'I wanted something I could host myself. bermooda let me sell online without renting a heavyweight SaaS cart.',
  },
];

/**
 * Testimonials section component
 * Displays customer testimonials and success stories
 */
export default function Testimonials() {
  return (
    <section className="dark:bg-dark-900/50 bg-indigo-50 px-6 py-24 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Success Stories
          </h2>
          <p className="dark:text-dark-400 mt-4 text-lg text-gray-600">
            Hear from merchants building with bermooda.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="dark-glass dark:ring-dark-700/50 rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200"
            >
              <div className="flex items-center gap-4">
                <div className="dark:bg-accent-violet/20 h-12 w-12 overflow-hidden rounded-full bg-indigo-100">
                  <div className="dark:text-accent-fuchsia flex h-full w-full items-center justify-center font-semibold text-indigo-600">
                    {testimonial.name.charAt(0)}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </h3>
                  <p className="dark:text-dark-500 text-sm text-gray-600">
                    {testimonial.role}
                  </p>
                </div>
              </div>
              <p className="dark:text-dark-400 mt-6 text-gray-600">
                {testimonial.quote}
              </p>
              <div className="mt-4 flex gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                      clipRule="evenodd"
                    />
                  </svg>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
