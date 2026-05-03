import Accordion from '#/components/ui/accordion';

// FAQ data
const faqs = [
  {
    question: 'What is CursorStack?',
    answer:
      'CursorStack is a complete React Router boilerplate with all you need to build your SaaS, AI tool, or any other web app. It includes authentication, database integration, payment processing, and more, all pre-configured and ready to go.',
  },
  {
    question: 'Do I need to know React to use CursorStack?',
    answer:
      'Yes, CursorStack is built on React and React Router, so you should have a basic understanding of React concepts. However, the boilerplate is well documented and designed to be easy to use, even for developers who are new to React.',
  },
  {
    question: 'Can I use CursorStack for commercial projects?',
    answer:
      'Yes, you can use CursorStack for both personal and commercial projects. Once you purchase a license, you can use it for as many projects as you want.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      "Yes, we offer a 14-day money-back guarantee. If you're not satisfied with CursorStack, you can request a refund within 14 days of purchase.",
  },
  {
    question: 'How do I get support if I have questions?',
    answer:
      'We offer support via email and our Discord community. Premium customers get priority support with faster response times.',
  },
  {
    question: 'Will I get updates to CursorStack?',
    answer:
      'Yes, Standard plan users get updates for 6 months, while Premium plan users get updates for 1 year. Updates include new features, bug fixes, and security patches.',
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
