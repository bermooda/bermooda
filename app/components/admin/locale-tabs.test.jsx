import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LocaleTabs from '#/components/admin/locale-tabs';

describe('LocaleTabs', () => {
  it('renders locale labels and calls onSelect when a tab is clicked', () => {
    const onSelect = vi.fn();

    render(
      <LocaleTabs
        locales={['en', 'fr']}
        activeLocale="en"
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('tab', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'FR' })).toBeInTheDocument();

    screen.getByRole('tab', { name: 'FR' }).click();
    expect(onSelect).toHaveBeenCalledWith('fr');
  });
});
