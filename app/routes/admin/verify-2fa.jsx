import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { adminAuthClient } from '#/libs/auth/admin-client';
import { useT } from '#/core/i18n';
import AuthLayout from '#/components/auth/auth-layout';
import OtpInput from '#/components/auth/otp-input';
import { ErrorAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

export const handle = {
  htmlClass: 'h-full',
  bodyClass: 'h-full',
};

export function meta() {
  return [
    { title: 'Admin — Verify 2FA' },
    { name: 'description', content: 'Verify your admin identity' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

/**
 * Admin 2FA Verification Route
 * @returns {React.ReactElement}
 */
export default function AdminVerify2FARoute() {
  const t = useT();
  const navigate = useNavigate();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [trustDevice, setTrustDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [initialOtpSent, setInitialOtpSent] = useState(false);
  const sessionExpiredMessage = t('admin.auth.verify2fa.sessionExpired');

  // Send initial OTP on page load
  useEffect(() => {
    const sendInitialOtp = async () => {
      if (initialOtpSent) return;

      try {
        const { error } = await adminAuthClient.twoFactor.sendOtp();

        if (error) {
          setErrorMessage(sessionExpiredMessage);
          return;
        }

        setInitialOtpSent(true);
      } catch {
        setErrorMessage(sessionExpiredMessage);
      }
    };

    sendInitialOtp();
  }, [initialOtpSent, sessionExpiredMessage]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async (event) => {
    event.preventDefault();

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setErrorMessage(t('admin.auth.verify2fa.incompleteCode'));
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const { error } = await adminAuthClient.twoFactor.verifyOtp({
        code: otpCode,
        trustDevice,
      });

      if (error) {
        setErrorMessage(
          error?.message || t('admin.auth.verify2fa.invalidCode')
        );
        setIsLoading(false);
        setOtp(['', '', '', '', '', '']);
        return;
      }

      navigate('/admin/dashboard', { replace: true });
    } catch {
      setErrorMessage(t('admin.auth.verify2fa.genericError'));
      setIsLoading(false);
      setOtp(['', '', '', '', '', '']);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setErrorMessage('');
    setResendCooldown(60);

    try {
      const { error } = await adminAuthClient.twoFactor.sendOtp();

      if (error) {
        setErrorMessage(t('admin.auth.verify2fa.resendFailed'));
        setResendCooldown(0);
      }
    } catch {
      setErrorMessage(t('admin.auth.verify2fa.resendFailed'));
      setResendCooldown(0);
    }
  };

  return (
    <AuthLayout
      title={t('admin.auth.verify2fa.title')}
      subtitle={t('admin.auth.verify2fa.subtitle')}
    >
      <ErrorAlert message={errorMessage} />

      <form onSubmit={handleVerify} className="space-y-6">
        <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

        <div className="flex items-center">
          <input
            id="trust-device"
            name="trust-device"
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            disabled={isLoading}
            className="border-border text-accent focus:ring-accent/40 bg-surface h-4 w-4 rounded border"
          />
          <label
            htmlFor="trust-device"
            className="text-text ml-2 block text-sm"
          >
            {t('admin.auth.verify2fa.trustDevice')}
          </label>
        </div>

        <div>
          <ButtonSubmit className="w-full" disabled={isLoading}>
            {isLoading
              ? t('admin.auth.verify2fa.submitting')
              : t('admin.auth.verify2fa.submit')}
          </ButtonSubmit>
        </div>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-accent text-sm font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resendCooldown > 0
            ? t('admin.auth.verify2fa.resendCooldown', {
                seconds: resendCooldown,
              })
            : t('admin.auth.verify2fa.resend')}
        </button>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/admin/login"
          prefetch="intent"
          className="text-text-muted hover:text-text text-sm font-medium"
        >
          {t('admin.auth.verify2fa.backToLogin')}
        </Link>
      </div>
    </AuthLayout>
  );
}
