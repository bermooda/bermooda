import { Img, Section } from '@react-email/components';

import config from '#bermooda.config';

/**
 * Email template for logo
 */
export default function EmailLogo() {
  return (
    <Section className="mt-5">
      <Img
        src={`${config.baseUrl}/assets/images/logo.svg`}
        width="50"
        height="50"
        alt={`${config.appName} Logo`}
        className="dark-mode-logo mx-auto my-0"
      />
      <Img
        src={`${config.baseUrl}/assets/images/logo-dark.svg`}
        width="50"
        height="50"
        alt={`${config.appName} Logo`}
        className="dark-mode-logo-dark mx-auto my-0 hidden"
      />
    </Section>
  );
}
