import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Link } from 'react-router';

/**
 * Accordion component
 *
 * @param {Object} props - Component props
 * @param {string} props.question - The question or header text
 * @param {string} props.answer - The answer or content text
 * @param {string} [props.link] - Optional link URL for the content
 * @param {string} [props.linkText] - Optional link text
 */
export default function Accordion({ question, answer, link, linkText }) {
  return (
    <div className="dark:border-dark-700/50 dark-glass rounded-lg border border-gray-200 bg-white">
      <Disclosure>
        {({ open }) => (
          <div>
            <DisclosureButton className="flex w-full cursor-pointer items-center justify-between gap-4 p-6 text-left">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {question}
              </h3>
              <ChevronDownIcon
                className={clsx(
                  'dark:text-dark-500 h-5 min-w-5 text-gray-500 transition-transform duration-300 ease-in-out',
                  open ? 'rotate-180 transform' : 'rotate-0'
                )}
              />
            </DisclosureButton>
            <DisclosurePanel className="dark:border-dark-700/50 border-t border-gray-200 px-6 py-4">
              <div className="dark:text-dark-400 text-gray-600">
                <p>{answer}</p>
                {link && linkText && (
                  <div className="mt-2">
                    <Link
                      to={link}
                      className="dark:text-accent-fuchsia dark:hover:text-accent-violet text-indigo-600 hover:text-indigo-500"
                    >
                      {linkText}
                    </Link>
                  </div>
                )}
              </div>
            </DisclosurePanel>
          </div>
        )}
      </Disclosure>
    </div>
  );
}
