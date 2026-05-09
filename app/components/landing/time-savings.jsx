// Time savings data
const timeSavings = [
  {
    hours: 40,
    title: 'Authentication System',
    description:
      'Skip building auth flows, user management, and permissions from scratch.',
  },
  {
    hours: 35,
    title: 'Payment Integration',
    description: 'Save time integrating Stripe and building payment flows.',
  },
  {
    hours: 25,
    title: 'UI Components',
    description: 'Pre-built, responsive UI components ready to use.',
  },
];

/**
 * Time Savings section component
 * Displays development hours saved by shipping with bermooda
 */
export default function TimeSavings() {
  return (
    <section className="dark:bg-dark-900/50 bg-indigo-50 px-6 py-24 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Save Countless Development Hours
          </h2>
          <p className="dark:text-dark-400 mt-4 text-lg text-gray-600">
            Focus on building your product rather than setting up
            infrastructure.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {timeSavings.map((item) => (
            <div
              key={item.title}
              className="dark:border-dark-700/50 dark-gradient-card rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
            >
              <div className="accent-gradient glow-accent-sm flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white">
                <span className="text-xl font-bold">{item.hours}h</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                {item.title}
              </h3>
              <p className="dark:text-dark-400 mt-2 text-gray-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="text-gradient-accent text-xl font-semibold text-indigo-600">
            Save 100+ hours of development time in total!
          </p>
        </div>
      </div>
    </section>
  );
}
