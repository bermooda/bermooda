import { Link } from 'react-router';

import config from '#/config';

/**
 * Pricing section component
 * Displays pricing plans with features and CTA buttons
 */
export default function Pricing() {
  return (
    <section
      id="pricing"
      className="dark:bg-dark-900/50 bg-gray-50 px-6 py-24 sm:px-8 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="dark:text-dark-400 mt-4 text-lg text-gray-600">
            Choose the plan that works best for your project
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Standard Plan */}
          <div className="dark:border-dark-700/50 dark-gradient-card rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg leading-8 font-semibold text-gray-900 dark:text-white">
              {config.stripe.plans[0].name}
            </h3>
            <p className="dark:text-dark-500 mt-4 text-sm leading-6 text-gray-600">
              Perfect for small projects and startups
            </p>
            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                ${config.stripe.plans[0].price}
              </span>
              <span className="dark:text-dark-500 text-sm leading-6 font-semibold text-gray-600">
                one-time payment
              </span>
            </p>
            <ul className="dark:text-dark-400 mt-8 space-y-3 text-sm leading-6 text-gray-600">
              {config.stripe.plans[0].features.map((feature, index) => (
                <li key={index} className="flex gap-x-3">
                  <svg
                    className="dark:text-accent-cyan h-6 w-5 flex-none text-indigo-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className="accent-gradient mt-8 block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get {config.stripe.plans[0].name}
            </Link>
          </div>

          {/* Premium Plan */}
          <div className="dark:border-accent-violet/30 dark-gradient-card dark:ring-accent-violet/20 glow-accent relative rounded-2xl border border-indigo-200 bg-white p-8 shadow-sm ring-1 ring-indigo-600/20">
            {config.stripe.plans[1].highlighted && (
              <div className="accent-gradient absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1 text-xs font-semibold tracking-wide text-white uppercase">
                Most Popular
              </div>
            )}
            <h3 className="text-lg leading-8 font-semibold text-gray-900 dark:text-white">
              {config.stripe.plans[1].name}
            </h3>
            <p className="dark:text-dark-500 mt-4 text-sm leading-6 text-gray-600">
              For professional developers and businesses
            </p>
            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                ${config.stripe.plans[1].price}
              </span>
              <span className="dark:text-dark-500 text-sm leading-6 font-semibold text-gray-600">
                one-time payment
              </span>
            </p>
            <ul className="dark:text-dark-400 mt-8 space-y-3 text-sm leading-6 text-gray-600">
              {config.stripe.plans[1].features.map((feature, index) => (
                <li key={index} className="flex gap-x-3">
                  <svg
                    className="dark:text-accent-cyan h-6 w-5 flex-none text-indigo-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className="accent-gradient mt-8 block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get {config.stripe.plans[1].name}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
