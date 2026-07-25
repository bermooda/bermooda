import { Text } from '@react-email/components';

import config from '#bermooda.config';

/**
 * Email template for footer
 */
export default function EmailFooter() {
  return (
    <Text className="dark-mode-text-secondary text-center text-sm text-slate-500">
      © {new Date().getFullYear()} {config.appName}. All rights reserved.
    </Text>
  );
}
