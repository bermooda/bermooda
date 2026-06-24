import { useEffect, useRef } from 'react';

/**
 * OTP Input Component
 * 6-digit OTP input grid with auto-focus, paste handling, and keyboard navigation
 * OTP input for admin two-factor verification
 *
 * @param {Object} props Component props
 * @param {string[]} props.value Array of 6 digit strings
 * @param {Function} props.onChange Callback when OTP value changes
 * @param {boolean} [props.disabled] Disabled state
 * @param {string} [props.label] Optional label for the input group
 * @returns {React.ReactElement} OTP input component
 */
export default function OtpInput({
  value,
  onChange,
  disabled = false,
  label = 'Enter verification code',
}) {
  const inputRefs = useRef([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  /**
   * Handle OTP input change
   * @param {number} index Input index
   * @param {string} inputValue Input value
   */
  const handleOtpChange = (index, inputValue) => {
    // Only allow digits
    if (inputValue && !/^\d$/.test(inputValue)) {
      return;
    }

    const newOtp = [...value];
    newOtp[index] = inputValue;
    onChange(newOtp);

    // Auto-focus next input
    if (inputValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Handle key down events for OTP inputs
   * @param {number} index Input index
   * @param {React.KeyboardEvent} event Keyboard event
   */
  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Handle paste event for OTP inputs
   * @param {React.ClipboardEvent} event Clipboard event
   */
  const handlePaste = (event) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData('text').trim();

    // Only process if it's a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      onChange(newOtp);
      // Focus the last input
      inputRefs.current[5]?.focus();
    }
  };

  return (
    <div>
      <label htmlFor="otp-0" className="text-text block text-sm/6 font-medium">
        {label}
      </label>
      <div className="mt-2 flex justify-between gap-2">
        {value.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            disabled={disabled}
            className="bg-surface text-text border-border focus:border-accent focus:ring-accent/40 block w-full rounded-md border px-3 py-3 text-center text-2xl font-semibold outline-none focus:ring-2"
            aria-label={`Digit ${index + 1}`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
          />
        ))}
      </div>
      <p className="text-text-muted mt-2 text-xs">Code expires in 5 minutes</p>
    </div>
  );
}
