import { describe, expect, it } from 'vitest';

import { controlClassName } from '#/components/admin/form/input';

/** @param {string} classes */
const tokens = (classes) => classes.split(/\s+/);

describe('controlClassName', () => {
  it('defaults to full width', () => {
    expect(tokens(controlClassName())).toContain('w-full');
    expect(tokens(controlClassName('pr-8'))).toContain('w-full');
  });

  it('drops w-full when the caller sets a base width', () => {
    const classes = tokens(controlClassName('w-24'));
    expect(classes).toContain('w-24');
    expect(classes).not.toContain('w-full');
    expect(tokens(controlClassName('pr-8', 'w-auto'))).not.toContain('w-full');
  });

  it('keeps w-full for responsive or max/min width utilities', () => {
    expect(tokens(controlClassName('sm:w-44'))).toContain('w-full');
    expect(tokens(controlClassName('max-w-md min-w-0'))).toContain('w-full');
  });
});
