import { Text } from '@react-email/components';

import { PLATFORM_NAME } from '#/libs/config';

/**
 * Email template for footer
 *
 * @param {Object} props
 * @param {string} [props.brandName]
 */
export default function EmailFooter({ brandName = PLATFORM_NAME }) {
  return (
    <Text className="dark-mode-text-secondary text-center text-sm text-slate-500">
      © {new Date().getFullYear()} {brandName}. All rights reserved.
    </Text>
  );
}
