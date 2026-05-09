// Benefits data
const benefits = [
  'Storefront and merchant admin in one deployable app',
  'Catalog, cart, and orders with Prisma and SQLite (or your database)',
  'Stripe Checkout for payments',
  'Transactional email with Resend and ready-to-use templates',
  'Responsive UI with Tailwind CSS',
  'Server-side rendering with React Router 7',
  'Docker- and Fly.io-friendly deployment patterns',
];

/**
 * Benefits section component
 * Displays the key benefits and features of bermooda
 */
export default function Benefits() {
  return (
    <section className="bg-white px-6 py-24 sm:px-8 lg:px-16 dark:bg-transparent">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Run Your Shop From One Codebase
            </h2>
            <p className="dark:text-dark-400 mt-6 text-lg text-gray-600">
              bermooda gives you a storefront, customer accounts, checkout, and
              back-office tools without stitching together a dozen services.
              Focus on products and customers while the stack handles commerce
              fundamentals out of the box.
            </p>
            <ul className="mt-8 space-y-4">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <div className="shrink-0">
                    <svg
                      className="dark:text-accent-cyan h-6 w-6 text-indigo-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="dark:text-dark-400 ml-3 text-gray-600">
                    {benefit}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="aspect-h-3 aspect-w-2 lg:aspect-h-4 lg:aspect-w-3 overflow-hidden rounded-xl">
            <div className="dark:bg-accent-violet/10 h-full w-full bg-indigo-100 object-cover object-center p-8">
              <div className="dark-glass glow-accent-sm flex h-full flex-col items-center justify-center rounded-lg bg-white p-8 shadow-lg">
                <div className="text-6xl">🚀</div>
                <div className="mt-6 text-xl font-semibold dark:text-white">
                  From idea to launch in hours, not months
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
