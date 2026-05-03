import { Link, Text } from '@react-email/components';

/**
 * Email template for heading
 *
 * @param {Object} props - Component props
 * @param {string} props.url - URL for the link
 */
export default function EmailFooterLink({ url }) {
  return (
    <Text className="dark-mode-text mt-6 py-4 text-sm text-slate-700">
      If the button above doesn&apos;t work, you can also use this link:{' '}
      <Link href={url} className="dark-mode-link text-indigo-600">
        {url}
      </Link>
    </Text>
  );
}
