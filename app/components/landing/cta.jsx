import { Link } from 'react-router';

/**
 * Call to Action section component
 * Bottom CTA section encouraging users to get started
 */
export default function CTA() {
  return (
    <section className="accent-gradient bg-indigo-600 px-6 py-24 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Boost Your App, Launch, Earn
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Join hundreds of developers who are building faster with CursorStack
          </p>
          <div className="mt-10">
            <Link
              to="/account/register"
              className="dark:text-dark-900 rounded-md bg-white px-6 py-3 text-base font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white/95 dark:hover:bg-white"
            >
              Get CursorStack
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
