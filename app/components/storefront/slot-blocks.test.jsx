import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SlotBlocks from '#/components/storefront/slot-blocks';

describe('SlotBlocks', () => {
  it('forwards slot props to each plugin block', () => {
    function HeroBlock({ product, heading }) {
      return (
        <div>
          {heading}: {product?.title}
        </div>
      );
    }

    render(
      <SlotBlocks
        blocks={[{ pluginId: 'sample-analytics', component: HeroBlock }]}
        slotProps={{
          heading: 'Featured product',
          product: { title: 'Stoneware Mug' },
        }}
      />
    );

    expect(
      screen.getByText('Featured product: Stoneware Mug')
    ).toBeInTheDocument();
  });
});
