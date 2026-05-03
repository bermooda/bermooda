import { Link } from 'react-router';

import config from '#/config';

// Footer links data
const footerLinks = {
  product: [
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/#pricing' },
  ],
  resources: [
    { name: 'Help Center', href: '/help' },
    { name: 'Contact', href: '/contact' },
    { name: 'FAQs', href: '/#faqs' },
  ],
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Privacy Policy', href: '/privacy-policy' },
    { name: 'Terms & Conditions', href: '/terms-conditions' },
  ],
};

/**
 * Footer component
 * Site footer with navigation links and copyright
 */
export default function Footer() {
  return (
    <footer className="dark:bg-dark-950 dark:border-dark-800 bg-gray-900 px-6 py-16 sm:px-8 lg:px-16 dark:border-t">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Product Section */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase">
              Product
            </h3>
            <ul className="mt-4 space-y-4">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Section */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase">
              Resources
            </h3>
            <ul className="mt-4 space-y-4">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Section */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase">
              Company
            </h3>
            <ul className="mt-4 space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Logo & Copyright */}
          <div>
            <h3 className="text-lg font-semibold text-white">
              {config.appName}
            </h3>
            <p className="mt-4 text-gray-300">
              Built with modern technologies to help you launch faster.
            </p>
            <p className="mt-8 text-sm text-gray-400">
              &copy; {new Date().getFullYear()} {config.appName}. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
