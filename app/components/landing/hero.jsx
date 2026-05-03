import { Form, Link } from 'react-router';

import config from '#/config';

/**
 * Hero section component
 * Displays the main headline, description, and CTA buttons
 */
export default function Hero() {
  return (
    <section className="dark-gradient-hero bg-linear-to-b from-indigo-50 to-white px-6 py-24 sm:px-8 lg:px-16 dark:from-transparent dark:to-transparent">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl dark:text-white">
            Build Your SaaS Faster Than Ever With{' '}
            <span className="text-gradient-accent text-indigo-600">
              {config.appName}
            </span>
          </h1>
          <p className="dark:text-dark-400 mt-6 text-lg leading-8 text-gray-600">
            The complete React Router & Tailwind stack for developers who want
            to launch quickly without compromising on quality or features.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            {/* Use this for stripe */}
            <Form method="POST">
              <input
                type="hidden"
                name="priceId"
                value={config.stripe.plans[0].priceId}
              />
              <button
                type="submit"
                id="purchase-button"
                className="accent-gradient glow-accent-sm rounded-md bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Get {config.appName} Now
              </button>
            </Form>
            {/* Use this for polar */}
            {/* <Link
              to="/checkout/polar?productId=4230c2ed-b5ab-44eb-b730-e28d5932fb04"
              className="rounded-md bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get {config.appName} Now
            </Link> */}
            <Link
              to="#features"
              className="dark:text-dark-300 text-base leading-6 font-semibold text-gray-900 dark:hover:text-white"
            >
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
