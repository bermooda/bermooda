import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SlugField from '#/components/admin/slug-field';

describe('SlugField', () => {
  it('renders a slug input with a leading slash prefix', () => {
    render(
      <SlugField
        id="page-slug"
        name="slug"
        label="URL slug"
        defaultValue="about-us"
      />
    );

    expect(screen.getByLabelText('URL slug')).toHaveValue('about-us');
    expect(screen.getByText('/')).toBeInTheDocument();
  });
});
