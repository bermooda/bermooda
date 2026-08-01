import { Img, Section } from '@react-email/components';

import config, { PLATFORM_NAME } from '#/libs/config';

/**
 * Email template for logo
 *
 * @param {Object} props
 * @param {string} [props.brandName]
 */
export default function EmailLogo({ brandName = PLATFORM_NAME }) {
  return (
    <Section className="mt-5">
      <Img
        src={`${config.baseUrl}/assets/images/logo.svg`}
        width="50"
        height="50"
        alt={`${brandName} Logo`}
        className="dark-mode-logo mx-auto my-0"
      />
      <Img
        src={`${config.baseUrl}/assets/images/logo-dark.svg`}
        width="50"
        height="50"
        alt={`${brandName} Logo`}
        className="dark-mode-logo-dark mx-auto my-0 hidden"
      />
    </Section>
  );
}
