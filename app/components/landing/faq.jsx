import Accordion from '#/components/ui/accordion';

// FAQ data
const faqs = [
  {
    question: 'What is bermooda?',
    answer:
      'bermooda is an open-source ecommerce platform built with React Router 7 (SSR), Prisma, and SQLite. One application runs your storefront and merchant admin—catalog, cart, checkout, orders, and integrations—so you can sell online without composing many separate products.',
  },
  {
    question: 'Do I need ecommerce experience to use bermooda?',
    answer:
      'Basic familiarity with Node.js helps for deployment and customization. Store staff can use the admin UI for day-to-day work without writing code.',
  },
  {
    question: 'Can I run bermooda in production?',
    answer:
      'Yes. Configure Stripe, email (Resend), and your host (for example Fly.io) with your own credentials. Point Prisma at PostgreSQL or another supported database when you outgrow local SQLite.',
  },
  {
    question: 'What does it cost?',
    answer:
      'The software is open source. You only pay for infrastructure, payment processing fees, and any third-party services you connect.',
  },
  {
    question: 'How do I get help or report issues?',
    answer:
      'Use the project repository for bug reports and discussions. Deployment steps and environment variables are documented in the README and `.env.example`.',
  },
  {
    question: 'What is on the roadmap?',
    answer:
      'Themes and plugins for developers, richer internationalization and currencies, and a public REST API under `/api/*` are planned as the platform grows.',
  },
];

/**
 * FAQ section component
 * Displays frequently asked questions with accordion
 */
export default function FAQ() {
  return (
    <section
      id="faqs"
      className="bg-white px-6 py-24 sm:px-8 lg:px-16 dark:bg-transparent"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="dark:text-dark-400 mt-4 text-lg text-gray-600">
            Have questions? We have answers.
          </p>
        </div>
        <div className="mt-16 space-y-4">
          {faqs.map((faq) => (
            <Accordion
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
