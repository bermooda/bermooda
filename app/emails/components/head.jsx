import { Head } from '@react-email/components';

/**
 * Email template for head
 */
export default function EmailHead() {
  return (
    <Head>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <style>
        {`
            @media (prefers-color-scheme: dark) {
              .dark-mode { background-color: #16161e !important; color: #F9FAFB !important; }
              .dark-mode-text { color: #F9FAFB !important; }
              .dark-mode-text-secondary { color: #A1A1AA !important; }
              .dark-mode-heading { color: #F3F4F6 !important; }
              .dark-mode-bg { background-color: #242534 !important; }
              .dark-mode-border { border-color: #242534 !important; }
              .dark-mode-link { color: #93C5FD !important; }
              .dark-mode-logo { display: none !important; }
              .dark-mode-logo-dark { display: block !important; }
            }
          `}
      </style>
    </Head>
  );
}
