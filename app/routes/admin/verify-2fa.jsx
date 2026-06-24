import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { adminAuthClient } from '#/libs/auth/admin-client';
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
  const navigate = useNavigate();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [trustDevice, setTrustDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [initialOtpSent, setInitialOtpSent] = useState(false);

  // Send initial OTP on page load
  useEffect(() => {
    const sendInitialOtp = async () => {
      if (initialOtpSent) return;

      try {
        const { error } = await adminAuthClient.twoFactor.sendOtp();

        if (error) {
          setErrorMessage(
            'Session expired. Please log in again to receive a new code.'
          );
          return;
        }

        setInitialOtpSent(true);
      } catch {
        setErrorMessage(
          'Session expired. Please log in again to receive a new code.'
        );
      }
    };

    sendInitialOtp();
  }, [initialOtpSent]);

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
      setErrorMessage('Please enter a complete 6-digit code');
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
        setErrorMessage(error?.message || 'Invalid verification code');
        setIsLoading(false);
        setOtp(['', '', '', '', '', '']);
        return;
      }

      navigate('/admin/dashboard', { replace: true });
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
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
        setErrorMessage('Failed to resend code. Please try logging in again.');
        setResendCooldown(0);
      }
    } catch {
      setErrorMessage('Failed to resend code. Please try logging in again.');
      setResendCooldown(0);
    }
  };

  return (
    <AuthLayout
      title="Verify your identity"
      subtitle="We've sent a 6-digit verification code to your email address"
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
            Trust this device for 30 days
          </label>
        </div>

        <div>
          <ButtonSubmit className="w-full" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify'}
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
            ? `Resend code in ${resendCooldown}s`
            : 'Resend verification code'}
        </button>
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/admin/login"
          prefetch="intent"
          className="text-text-muted hover:text-text text-sm font-medium"
        >
          Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
