import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SlotBlocks from '#/components/admin/slot-blocks';

describe('SlotBlocks', () => {
  it('forwards slot props to each plugin block', () => {
    function WidgetBlock({ totalOrders, heading }) {
      return (
        <div>
          {heading}: {totalOrders}
        </div>
      );
    }

    render(
      <SlotBlocks
        blocks={[{ pluginId: 'sample-analytics', component: WidgetBlock }]}
        slotProps={{
          heading: 'Tracked orders',
          totalOrders: 42,
        }}
      />
    );

    expect(screen.getByText('Tracked orders: 42')).toBeInTheDocument();
  });
});
