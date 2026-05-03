import {
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

import SupportCard from '#/components/support/support-card';

/**
 * SEO meta tags
 */
export function meta() {
  return [
    { title: 'Support' },
    {
      name: 'description',
      content:
        'Get help with our app. Browse FAQs, visit our help center, or contact our support team.',
    },
  ];
}

/**
 * Support Route
 * Displays support options for authenticated users
 *
 * @returns {React.ReactElement}
 */
export default function SupportRoute() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <ChatBubbleLeftRightIcon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
        <h1 className="text-2xl font-semibold text-zinc-950 sm:text-xl dark:text-white">
          Support
        </h1>
      </div>

      {/* Welcome message */}
      <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-6 dark:border-cyan-800 dark:bg-cyan-900/20">
        <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          Hey there! We&apos;re here to help you get the most out of Tieout.
          Whether you have a question, need guidance, or want to report an
          issue, we&apos;ve got you covered. Check out the options below to find
          the support you need.
        </p>
      </div>

      {/* Support Options Grid */}
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* FAQ */}
        <SupportCard
          icon={<QuestionMarkCircleIcon className="h-6 w-6" />}
          title="Frequently Asked Questions"
          description="Quick answers to common questions about Tieout, credits, comparisons, and more. Start here for instant help."
          href="/#faqs"
          linkText="View FAQs"
        />

        {/* Help Center */}
        <SupportCard
          icon={<BookOpenIcon className="h-6 w-6" />}
          title="Help Center"
          description="Comprehensive guides and tutorials to help you understand how Tieout works, from getting started to advanced features."
          href="/help"
          linkText="Browse articles"
        />

        {/* Email Support */}
        <SupportCard
          icon={<EnvelopeIcon className="h-6 w-6" />}
          title="Email Support"
          description="Need personalized assistance? Our friendly support team is ready to help. We typically respond within 24 hours."
          href="mailto:support@sturmfrei.com.au"
          isExternal={true}
          linkText="Send us an email"
        />
      </div>

      {/* Additional Info */}
      <div className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800/50">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          What to Include in Your Support Request
        </h2>
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span>
              A clear description of the issue or question you&apos;re facing
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span>
              Any error messages you&apos;ve encountered (screenshots help!)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span>Steps to reproduce the problem, if applicable</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span>Your account email address for faster identification</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
