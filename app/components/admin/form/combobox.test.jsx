import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@headlessui/react', () => ({
  Combobox: ({ children, ...props }) => (
    <div data-testid="combobox" {...props}>
      {typeof children === 'function' ? children({}) : children}
    </div>
  ),
  ComboboxInput: (props) => <input data-testid="combobox-input" {...props} />,
  ComboboxButton: ({ children, ...props }) => (
    <button type="button" data-testid="combobox-button" {...props}>
      {children}
    </button>
  ),
  ComboboxOptions: ({ children }) => (
    <ul data-testid="combobox-options">{children}</ul>
  ),
  ComboboxOption: ({ children, value, ...props }) => (
    <li data-testid={`combobox-option-${value.id}`} {...props}>
      {typeof children === 'function'
        ? children({ focus: false, selected: false })
        : children}
    </li>
  ),
}));

import Combobox from '#/components/admin/form/combobox';

describe('admin Combobox', () => {
  it('renders options and a hidden input for the selected value', () => {
    render(
      <Combobox
        id="customer"
        name="customerId"
        value={{ id: 'c1', label: 'Alice' }}
        onChange={vi.fn()}
        onQueryChange={vi.fn()}
        options={[
          { id: 'c1', label: 'Alice', description: 'a@example.com' },
          { id: 'c2', label: 'Bob' },
        ]}
        placeholder="Search customers…"
      />
    );

    expect(screen.getByTestId('combobox-input')).toBeInTheDocument();
    expect(screen.getByDisplayValue('c1')).toBeInTheDocument();
    expect(screen.getByTestId('combobox-option-c1')).toHaveTextContent('Alice');
    expect(screen.getByTestId('combobox-option-c2')).toHaveTextContent('Bob');
  });
});
