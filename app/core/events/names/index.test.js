import { describe, expect, it } from 'vitest';

import {
  BEFORE_HOOK_ACTIONS,
  BEFORE_HOOK_PREFIX,
  DOMAIN_EVENT_WILDCARD,
  DOMAIN_EVENTS,
  beforeHookKey,
  isBeforeHookAction,
  isBeforeHookEvent,
  isDomainEvent,
  isDomainEventOrWildcard,
} from '#/core/events/names';

describe('domain event names', () => {
  it('includes public lifecycle events and excludes cart churn', () => {
    expect(DOMAIN_EVENTS).toEqual(
      expect.arrayContaining([
        'order.updated',
        'order.fulfilled',
        'checkout.completed',
        'customer.registered',
        'product.created',
        'product.updated',
        'product.deleted',
      ])
    );
    expect(DOMAIN_EVENTS).not.toContain('cart.created');
    expect(DOMAIN_EVENTS).not.toContain('cart.itemAdded');
  });

  it('isDomainEvent matches the canonical list', () => {
    expect(isDomainEvent('order.created')).toBe(true);
    expect(isDomainEvent('cart.created')).toBe(false);
  });

  it('isDomainEventOrWildcard accepts wildcard', () => {
    expect(isDomainEventOrWildcard(DOMAIN_EVENT_WILDCARD)).toBe(true);
    expect(isDomainEventOrWildcard('order.created')).toBe(true);
    expect(isDomainEventOrWildcard('cart.updated')).toBe(false);
  });
});

describe('before-hook helpers', () => {
  it('beforeHookKey prefixes bare action names', () => {
    expect(beforeHookKey('shipment.create')).toBe('before.shipment.create');
  });

  it('isBeforeHookEvent detects before.* registrations', () => {
    expect(isBeforeHookEvent('before.shipment.create')).toBe(true);
    expect(isBeforeHookEvent('order.created')).toBe(false);
  });

  it('documents core before-hook actions', () => {
    expect(BEFORE_HOOK_ACTIONS).toEqual(
      expect.arrayContaining([
        'checkout.advance',
        'order.place',
        'order.cancel',
        'shipment.create',
        'shipment.ship',
        'shipment.deliver',
        'refund.create',
      ])
    );
    for (const action of BEFORE_HOOK_ACTIONS) {
      expect(isBeforeHookAction(action)).toBe(true);
      expect(beforeHookKey(action).startsWith(BEFORE_HOOK_PREFIX)).toBe(true);
    }
  });
});
