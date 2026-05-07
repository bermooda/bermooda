import { Transition, TransitionChild } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';

import config from '#/config';
import Logo from '#/components/ui/logo';
import ThemeToggle from '#/components/ui/theme-toggle';

/**
 * LandingHeader component
 * A simple header for the landing page with navigation and branding
 */
export default function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="dark-glass sticky top-0 z-50 bg-white/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo / Brand */}
          <div className="shrink-0">
            <Link to="/" className="flex items-center">
              <Logo alt={config.appName} className="h-8 w-auto" />
              <span className="ml-1 text-xl font-bold dark:text-white">
                {config.appName}
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden space-x-8 md:flex">
            <Link
              to="#features"
              className="dark:text-dark-400 text-gray-600 hover:text-gray-900 dark:hover:text-white"
            >
              Features
            </Link>
            <Link
              to="#pricing"
              className="dark:text-dark-400 text-gray-600 hover:text-gray-900 dark:hover:text-white"
            >
              Pricing
            </Link>
            <Link
              to="/help"
              className="dark:text-dark-400 text-gray-600 hover:text-gray-900 dark:hover:text-white"
            >
              Help
            </Link>
            <Link
              to="#faqs"
              className="dark:text-dark-400 text-gray-600 hover:text-gray-900 dark:hover:text-white"
            >
              FAQs
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden items-center space-x-2 md:flex">
            <ThemeToggle />
            <Link
              to="/login"
              prefetch="intent"
              className="dark:text-dark-400 px-2 text-gray-600 hover:text-gray-900 dark:hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              prefetch="intent"
              className="accent-gradient glow-accent-sm rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="dark:text-dark-400 text-gray-600 hover:text-gray-900 dark:hover:text-white"
              aria-label="Toggle menu"
              onClick={() => setIsMenuOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <Transition show={isMenuOpen} as={Fragment}>
        <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
          {/* Backdrop */}
          <TransitionChild
            as={Fragment}
            enter="ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className="fixed inset-0 bg-gray-600/90 transition-opacity"
              onClick={() => setIsMenuOpen(false)}
            />
          </TransitionChild>

          {/* Side Menu Panel */}
          <TransitionChild
            as={Fragment}
            enter="transform transition ease-in-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in-out duration-300"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <div className="dark-gradient-subtle dark:border-dark-700/50 fixed inset-y-0 right-0 flex h-full w-screen max-w-80 flex-col overflow-y-scroll bg-white py-4 shadow-xl dark:border-l">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center">
                  <Logo alt={config.appName} className="h-8 w-auto" />
                  <span className="ml-1 text-xl font-bold dark:text-white">
                    {config.appName}
                  </span>
                </div>
                <button
                  type="button"
                  className="dark:text-dark-500 dark:hover:text-dark-400 text-gray-400 hover:text-gray-500"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="sr-only">Close panel</span>
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-10 flex flex-col space-y-5 px-4">
                <Link
                  to="#features"
                  className="dark:text-dark-400 text-lg font-medium text-gray-700 hover:text-gray-900 dark:hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  to="#pricing"
                  className="dark:text-dark-400 text-lg font-medium text-gray-700 hover:text-gray-900 dark:hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  to="#faqs"
                  className="dark:text-dark-400 text-lg font-medium text-gray-700 hover:text-gray-900 dark:hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  FAQs
                </Link>
                <div className="dark:border-dark-700/50 mt-4 border-t border-gray-100 pt-6">
                  <Link
                    to="/login"
                    prefetch="intent"
                    className="dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-700 block w-full rounded-md bg-white px-3 py-2 text-center text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    prefetch="intent"
                    className="accent-gradient mt-3 block w-full rounded-md bg-indigo-600 px-3 py-2 text-center text-base font-medium text-white hover:bg-indigo-500"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          </TransitionChild>
        </div>
      </Transition>
    </>
  );
}
