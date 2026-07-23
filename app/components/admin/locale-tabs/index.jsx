import Tabs from '#/components/admin/tabs';

/**
 * Tab bar for switching editor locales.
 *
 * @param {Object} props
 * @param {string[]} props.locales
 * @param {string} props.activeLocale
 * @param {(locale: string) => void} props.onSelect
 */
export default function LocaleTabs({ locales, activeLocale, onSelect }) {
  const activeIndex = Math.max(0, locales.indexOf(activeLocale));

  return (
    <Tabs
      tabs={locales.map((locale) => locale.toUpperCase())}
      active={activeIndex}
      onChange={(index) => onSelect(locales[index])}
      variant="pills"
    />
  );
}
