// app/core/customers/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock prisma — must be hoisted before imports that use it
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => {
  const tx = {
    address: {
      updateMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const prisma = {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    address: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(tx)),
    _tx: tx,
  };

  return { default: prisma };
});

import prisma from '#/libs/prisma.server';

import {
  getCustomer,
  updateCustomer,
  getCustomerByEmail,
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  listOrders,
  getOrder,
} from '#/core/customers/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCustomer(overrides = {}) {
  return {
    id: 'cust_1',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice',
    phone: null,
    preferredLocale: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    addresses: [],
    ...overrides,
  };
}

function makeAddress(overrides = {}) {
  return {
    id: 'addr_1',
    customerId: 'cust_1',
    firstName: 'Alice',
    lastName: 'Smith',
    company: null,
    line1: '123 Main St',
    line2: null,
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US',
    phone: null,
    isDefault: false,
    ...overrides,
  };
}

function makeOrder(overrides = {}) {
  return {
    id: 'order_1',
    orderNumber: 'ORD-001',
    customerId: 'cust_1',
    status: 'pending',
    currency: 'USD',
    totalCents: 5000,
    createdAt: new Date('2024-03-01'),
    lines: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the transaction mock to execute the callback by default
  prisma.$transaction.mockImplementation((fn) => fn(prisma._tx));
  prisma._tx.address.updateMany.mockResolvedValue({ count: 0 });
  prisma._tx.address.create.mockResolvedValue({});
  prisma._tx.address.update.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// getCustomer
// ---------------------------------------------------------------------------

describe('getCustomer', () => {
  it('returns customer with addresses when found', async () => {
    const customer = makeCustomer({ addresses: [makeAddress()] });
    prisma.customer.findUnique.mockResolvedValue(customer);

    const result = await getCustomer('cust_1');

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'cust_1' },
      include: { addresses: true },
    });
    expect(result).toEqual(customer);
  });

  it('returns null when customer is not found', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    const result = await getCustomer('cust_unknown');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateCustomer — only allows name, phone, preferredLocale
// ---------------------------------------------------------------------------

describe('updateCustomer', () => {
  it('only updates allowed fields (name, phone, preferredLocale)', async () => {
    const updated = makeCustomer({
      name: 'Bob',
      phone: '+1555',
      preferredLocale: 'fr',
    });
    prisma.customer.update.mockResolvedValue(updated);

    await updateCustomer('cust_1', {
      name: 'Bob',
      phone: '+1555',
      preferredLocale: 'fr',
      email: 'hacker@evil.com', // should be stripped
      emailVerified: false, // should be stripped
    });

    const callData = prisma.customer.update.mock.calls[0][0].data;
    expect(callData).toEqual({
      name: 'Bob',
      phone: '+1555',
      preferredLocale: 'fr',
    });
    expect(callData.email).toBeUndefined();
    expect(callData.emailVerified).toBeUndefined();
  });

  it('omits undefined fields from the update payload', async () => {
    prisma.customer.update.mockResolvedValue(makeCustomer({ phone: '+1999' }));

    await updateCustomer('cust_1', { phone: '+1999' });

    const callData = prisma.customer.update.mock.calls[0][0].data;
    expect(callData).toEqual({ phone: '+1999' });
    expect(callData.name).toBeUndefined();
    expect(callData.preferredLocale).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getCustomerByEmail
// ---------------------------------------------------------------------------

describe('getCustomerByEmail', () => {
  it('returns customer when found by email', async () => {
    const customer = makeCustomer();
    prisma.customer.findUnique.mockResolvedValue(customer);

    const result = await getCustomerByEmail('alice@example.com');

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { email: 'alice@example.com' },
    });
    expect(result).toEqual(customer);
  });

  it('returns null when email not found', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    const result = await getCustomerByEmail('nobody@example.com');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listAddresses
// ---------------------------------------------------------------------------

describe('listAddresses', () => {
  it('returns all addresses for a customer', async () => {
    const addresses = [makeAddress(), makeAddress({ id: 'addr_2' })];
    prisma.address.findMany.mockResolvedValue(addresses);

    const result = await listAddresses('cust_1');

    expect(prisma.address.findMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1' },
    });
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// addAddress — isDefault=true unsets other defaults in a transaction
// ---------------------------------------------------------------------------

describe('addAddress', () => {
  it('creates address without transaction when isDefault is false', async () => {
    const addr = makeAddress({ isDefault: false });
    prisma.address.create.mockResolvedValue(addr);

    await addAddress('cust_1', {
      line1: '123 Main St',
      country: 'US',
      isDefault: false,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.address.create).toHaveBeenCalled();
  });

  it('unsets existing defaults and creates address in a transaction when isDefault=true', async () => {
    const newAddr = makeAddress({ isDefault: true });
    prisma._tx.address.create.mockResolvedValue(newAddr);

    await addAddress('cust_1', {
      firstName: 'Alice',
      lastName: 'Smith',
      line1: '123 Main St',
      city: 'Springfield',
      country: 'US',
      isDefault: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma._tx.address.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma._tx.address.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust_1',
          isDefault: true,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// updateAddress — isDefault=true uses transaction
// ---------------------------------------------------------------------------

describe('updateAddress', () => {
  it('unsets other defaults then updates address in transaction when isDefault=true', async () => {
    const updated = makeAddress({ id: 'addr_2', isDefault: true });
    prisma._tx.address.update.mockResolvedValue(updated);

    await updateAddress('addr_2', 'cust_1', { isDefault: true });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma._tx.address.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', isDefault: true, id: { not: 'addr_2' } },
      data: { isDefault: false },
    });
    expect(prisma._tx.address.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'addr_2', customerId: 'cust_1' } })
    );
  });

  it('updates address without transaction when isDefault is not set', async () => {
    prisma.address.update.mockResolvedValue(
      makeAddress({ line1: '456 Oak Ave' })
    );

    await updateAddress('addr_1', 'cust_1', { line1: '456 Oak Ave' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.address.update).toHaveBeenCalledWith({
      where: { id: 'addr_1', customerId: 'cust_1' },
      data: { line1: '456 Oak Ave' },
    });
  });
});

// ---------------------------------------------------------------------------
// deleteAddress — promotes next address when deleted was default
// ---------------------------------------------------------------------------

describe('deleteAddress', () => {
  it('does nothing when address is not found', async () => {
    prisma.address.findUnique.mockResolvedValue(null);

    await deleteAddress('addr_missing', 'cust_1');

    expect(prisma.address.delete).not.toHaveBeenCalled();
    expect(prisma.address.update).not.toHaveBeenCalled();
  });

  it('deletes non-default address without promoting another', async () => {
    prisma.address.findUnique.mockResolvedValue(
      makeAddress({ isDefault: false })
    );
    prisma.address.delete.mockResolvedValue({});

    await deleteAddress('addr_1', 'cust_1');

    expect(prisma.address.delete).toHaveBeenCalledWith({
      where: { id: 'addr_1' },
    });
    expect(prisma.address.findFirst).not.toHaveBeenCalled();
    expect(prisma.address.update).not.toHaveBeenCalled();
  });

  it('promotes most recently created address as default when deleted address was default', async () => {
    prisma.address.findUnique.mockResolvedValue(
      makeAddress({ id: 'addr_1', isDefault: true })
    );
    prisma.address.delete.mockResolvedValue({});

    const nextAddr = makeAddress({ id: 'addr_2', isDefault: false });
    prisma.address.findFirst.mockResolvedValue(nextAddr);
    prisma.address.update.mockResolvedValue({ ...nextAddr, isDefault: true });

    await deleteAddress('addr_1', 'cust_1');

    expect(prisma.address.delete).toHaveBeenCalledWith({
      where: { id: 'addr_1' },
    });
    expect(prisma.address.findFirst).toHaveBeenCalledWith({
      where: { customerId: 'cust_1' },
      orderBy: { id: 'desc' },
    });
    expect(prisma.address.update).toHaveBeenCalledWith({
      where: { id: 'addr_2' },
      data: { isDefault: true },
    });
  });

  it('does not call update when deleted was default but no other addresses remain', async () => {
    prisma.address.findUnique.mockResolvedValue(
      makeAddress({ id: 'addr_1', isDefault: true })
    );
    prisma.address.delete.mockResolvedValue({});
    prisma.address.findFirst.mockResolvedValue(null);

    await deleteAddress('addr_1', 'cust_1');

    expect(prisma.address.delete).toHaveBeenCalled();
    expect(prisma.address.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setDefaultAddress — unsets all other defaults, sets new one
// ---------------------------------------------------------------------------

describe('setDefaultAddress', () => {
  it('unsets other defaults then sets target as default in a transaction', async () => {
    const target = makeAddress({ id: 'addr_3', isDefault: true });
    prisma._tx.address.updateMany.mockResolvedValue({ count: 1 });
    prisma._tx.address.update.mockResolvedValue(target);

    await setDefaultAddress('addr_3', 'cust_1');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma._tx.address.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', isDefault: true, id: { not: 'addr_3' } },
      data: { isDefault: false },
    });
    expect(prisma._tx.address.update).toHaveBeenCalledWith({
      where: { id: 'addr_3', customerId: 'cust_1' },
      data: { isDefault: true },
    });
  });
});

// ---------------------------------------------------------------------------
// listOrders — pagination and ordering
// ---------------------------------------------------------------------------

describe('listOrders', () => {
  it('fetches orders newest first with default limit 20', async () => {
    prisma.order.findMany.mockResolvedValue([makeOrder()]);

    await listOrders('cust_1');

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { customerId: 'cust_1' },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('applies pagination skip correctly for page 2 with limit 10', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await listOrders('cust_1', { page: 2, limit: 10 });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it('applies pagination skip correctly for page 3 with limit 5', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await listOrders('cust_1', { page: 3, limit: 5 });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });

  it('orders by createdAt desc', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await listOrders('cust_1');

    const call = prisma.order.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: 'desc' });
  });
});

// ---------------------------------------------------------------------------
// getOrder — verifies customerId ownership
// ---------------------------------------------------------------------------

describe('getOrder', () => {
  it('returns order with lines when it belongs to the customer', async () => {
    const order = makeOrder({ lines: [{ id: 'line_1', orderId: 'order_1' }] });
    prisma.order.findFirst.mockResolvedValue(order);

    const result = await getOrder('order_1', 'cust_1');

    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: 'order_1', customerId: 'cust_1' },
      include: {
        lines: true,
        shipments: { include: { lines: true } },
        returns: { include: { lines: true } },
      },
    });
    expect(result).toEqual(order);
  });

  it('returns null when orderId does not belong to customerId', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    const result = await getOrder('order_1', 'cust_other');

    expect(result).toBeNull();
  });

  it('uses findFirst with both id and customerId to enforce ownership', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await getOrder('order_99', 'cust_1');

    const call = prisma.order.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'order_99', customerId: 'cust_1' });
  });
});
