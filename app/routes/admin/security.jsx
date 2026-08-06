// app/routes/admin/security.jsx
// Admin security settings — enable/disable email OTP two-factor auth.

import { useState } from 'react';
import { Link, useLoaderData, useRevalidator } from 'react-router';

import { adminAuthClient } from '#/libs/auth/admin-client';
import { authenticate } from '#/libs/auth/admin/index.server';
import { isAdminEmailReady } from '#/core/auth/email-ready.server';
import { useT } from '#/core/i18n';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button from '#/components/ui/button';

/**
 * @param {{ request: Request }} args
 * @returns {Promise<{
 *   twoFactorEnabled: boolean,
 *   emailReady: boolean,
 * }>}
 */
export async function loader({ request }) {
  const session = await authenticate(request);
  return {
    twoFactorEnabled: Boolean(session.user?.twoFactorEnabled),
    emailReady: isAdminEmailReady(),
  };
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminSecurityRoute() {
  const t = useT();
  const { twoFactorEnabled, emailReady } = useLoaderData();
  const revalidator = useRevalidator();
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [backupCodes, setBackupCodes] = useState(
    /** @type {string[] | null} */ (null)
  );
  const [submitting, setSubmitting] = useState(false);

  /**
   * @param {'enable' | 'disable'} intent
   */
  async function handleSubmit(intent) {
    setErrorMessage('');
    setSuccessMessage('');
    setBackupCodes(null);

    if (!password.trim()) {
      setErrorMessage(t('admin.security.passwordRequired'));
      return;
    }

    if (intent === 'enable' && !emailReady) {
      setErrorMessage(t('admin.security.emailNotReady'));
      return;
    }

    setSubmitting(true);
    try {
      if (intent === 'enable') {
        const { data, error } = await adminAuthClient.twoFactor.enable({
          password,
        });
        if (error) {
          setErrorMessage(error.message || t('admin.security.enableFailed'));
          return;
        }
        if (Array.isArray(data?.backupCodes) && data.backupCodes.length > 0) {
          setBackupCodes(data.backupCodes);
        }
        setSuccessMessage(t('admin.security.enableSuccess'));
      } else {
        const { error } = await adminAuthClient.twoFactor.disable({
          password,
        });
        if (error) {
          setErrorMessage(error.message || t('admin.security.disableFailed'));
          return;
        }
        setSuccessMessage(t('admin.security.disableSuccess'));
      }
      setPassword('');
      revalidator.revalidate();
    } catch {
      setErrorMessage(t('admin.security.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('admin.security.title')}
        subtitle={t('admin.security.subtitle')}
      />

      <SuccessAlert message={successMessage} />
      <ErrorAlert message={errorMessage} />

      {!emailReady ? (
        <div className="bg-warn/10 border-warn/30 mb-4 rounded-md border p-4">
          <p className="text-text text-sm/6">
            {t('admin.security.emailNotReadyHelp')}{' '}
            <Link
              to="/admin/plugins"
              className="text-accent font-semibold hover:underline"
            >
              {t('admin.security.pluginsLink')}
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="space-y-12">
        <FormSection
          title={t('admin.security.twoFactorTitle')}
          description={t('admin.security.twoFactorDescription')}
          last
        >
          <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
            <div className="sm:col-span-6">
              <p className="text-text text-sm">
                {twoFactorEnabled
                  ? t('admin.security.statusEnabled')
                  : t('admin.security.statusDisabled')}
              </p>
            </div>
            <Field
              className="sm:col-span-4"
              label={t('admin.security.password')}
              htmlFor="security-password"
            >
              <Input
                id="security-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
            </Field>
            <div className="flex flex-wrap items-end gap-3 sm:col-span-6">
              {twoFactorEnabled ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={submitting}
                  onClick={() => handleSubmit('disable')}
                >
                  {submitting
                    ? t('admin.security.working')
                    : t('admin.security.disableButton')}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={submitting || !emailReady}
                  onClick={() => handleSubmit('enable')}
                >
                  {submitting
                    ? t('admin.security.working')
                    : t('admin.security.enableButton')}
                </Button>
              )}
            </div>
          </div>
        </FormSection>
      </div>

      {backupCodes ? (
        <div className="bg-surface border-border mt-8 rounded-md border p-4">
          <h3 className="text-text text-sm font-semibold">
            {t('admin.security.backupCodesTitle')}
          </h3>
          <p className="text-text-muted mt-1 text-sm">
            {t('admin.security.backupCodesHelp')}
          </p>
          <ul className="text-text mt-3 list-inside list-disc font-mono text-sm">
            {backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
