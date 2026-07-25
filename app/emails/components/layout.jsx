import {
  Body,
  Container,
  Html,
  Preview,
  Tailwind,
} from '@react-email/components';

import { PLATFORM_NAME } from '#/core/config';
import EmailFooter from '#/emails/components/footer';
import EmailHead from '#/emails/components/head';
import EmailLogo from '#/emails/components/logo';
import EmailSeparator from '#/emails/components/separator';

/**
 * Email template for layout
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The child components
 * @param {string} props.preview - Preview text shown in the inbox
 * @param {string} [props.brandName] - Brand shown in logo alt / footer
 */
export default function EmailLayout({
  children,
  preview,
  brandName = PLATFORM_NAME,
}) {
  return (
    <Html className="white dark-mode">
      <EmailHead />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="dark-mode font-sans">
          <Container className="max-w-[600px] rounded-md px-4 py-8">
            <EmailLogo brandName={brandName} />
            {children}
            <EmailSeparator />
            <EmailFooter brandName={brandName} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
