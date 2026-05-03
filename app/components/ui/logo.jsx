import useTheme from '#/hooks/use-theme';

/**
 * Logo component that switches between light and dark mode variants
 *
 * @param {Object} props - Component props
 * @param {string} [props.alt='Logo'] - Alt text for the image
 * @param {string} [props.className=''] - Additional CSS classes
 * @returns {React.ReactElement} The logo image element
 */
export default function Logo({ alt = 'Logo', className = '' }) {
  const { isDark } = useTheme();

  const logoSrc = isDark
    ? '/assets/images/logo-dark.svg'
    : '/assets/images/logo.svg';

  return <img alt={alt} src={logoSrc} className={className} />;
}
