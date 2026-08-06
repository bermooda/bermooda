/**
 * Demo customers with credential accounts and addresses.
 */

import bcrypt from 'bcryptjs';

import { DEMO_ADDRESS, daysAgo } from './helpers.js';
import { customerId } from './ids.js';

const DEMO_CUSTOMER_PASSWORD =
  process.env.SEED_CUSTOMER_PASSWORD ?? 'changeme123!';

const CUSTOMER_NAMES = [
  ['Alex', 'Rivera'],
  ['Jordan', 'Lee'],
  ['Sam', 'Patel'],
  ['Casey', 'Nguyen'],
  ['Riley', 'Brooks'],
  ['Morgan', 'Chen'],
  ['Taylor', 'Garcia'],
  ['Quinn', 'Murphy'],
  ['Avery', 'Kim'],
  ['Parker', 'Sullivan'],
  ['Reese', 'Torres'],
  ['Blake', 'Anderson'],
  ['Cameron', 'Wright'],
  ['Drew', 'Foster'],
  ['Jamie', 'Hayes'],
];

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedCustomers(prisma) {
  const passwordHash = await bcrypt.hash(DEMO_CUSTOMER_PASSWORD, 12);

  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const index = i + 1;
    const id = customerId(index);
    const [firstName, lastName] = CUSTOMER_NAMES[i];
    const email =
      index === 1
        ? 'customer@bermooda.dev'
        : `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const name = `${firstName} ${lastName}`;

    await prisma.customer.upsert({
      where: { email },
      create: {
        id,
        email,
        name,
        emailVerified: true,
        phone: `+1-415-555-${String(1000 + index).slice(-4)}`,
        preferredLocale: index % 3 === 0 ? 'de' : 'en',
        createdAt: daysAgo(40 - index),
      },
      update: {
        name,
        emailVerified: true,
        phone: `+1-415-555-${String(1000 + index).slice(-4)}`,
      },
    });

    // Resolve actual customer id (email upsert may keep prior id on re-seed)
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { email },
    });

    const credential = await prisma.customerAccount.findFirst({
      where: {
        customerId: customer.id,
        providerId: 'credential',
      },
    });
    if (credential) {
      await prisma.customerAccount.update({
        where: { id: credential.id },
        data: { password: passwordHash },
      });
    } else {
      await prisma.customerAccount.create({
        data: {
          id: `seed-cust-acct-${String(index).padStart(2, '0')}`,
          customerId: customer.id,
          accountId: email,
          providerId: 'credential',
          password: passwordHash,
        },
      });
    }

    const addressId = `seed-addr-${String(index).padStart(2, '0')}`;
    const existingAddr = await prisma.address.findFirst({
      where: { id: addressId },
    });
    if (existingAddr) {
      await prisma.address.update({
        where: { id: addressId },
        data: {
          firstName,
          lastName,
          line1: DEMO_ADDRESS.line1,
          line2: DEMO_ADDRESS.line2,
          city: DEMO_ADDRESS.city,
          state: DEMO_ADDRESS.state,
          postalCode: DEMO_ADDRESS.postalCode,
          country: DEMO_ADDRESS.country,
          phone: customer.phone,
          isDefault: true,
        },
      });
    } else {
      await prisma.address.create({
        data: {
          id: addressId,
          customerId: customer.id,
          firstName,
          lastName,
          line1: DEMO_ADDRESS.line1,
          line2: DEMO_ADDRESS.line2,
          city: DEMO_ADDRESS.city,
          state: DEMO_ADDRESS.state,
          postalCode: DEMO_ADDRESS.postalCode,
          country: DEMO_ADDRESS.country,
          phone: customer.phone,
          isDefault: true,
        },
      });
    }
  }

  console.log(
    `Seeded ${CUSTOMER_NAMES.length} customers (login: customer@bermooda.dev / ${DEMO_CUSTOMER_PASSWORD}).`
  );
}

/**
 * Resolve seeded customers in stable order for dependent modules.
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function listSeedCustomers(prisma) {
  const emails = CUSTOMER_NAMES.map(([first, last], i) =>
    i === 0
      ? 'customer@bermooda.dev'
      : `${first.toLowerCase()}.${last.toLowerCase()}@example.com`
  );
  const customers = await prisma.customer.findMany({
    where: { email: { in: emails } },
    orderBy: { email: 'asc' },
  });
  // Prefer demo login customer first
  customers.sort((a, b) => {
    if (a.email === 'customer@bermooda.dev') return -1;
    if (b.email === 'customer@bermooda.dev') return 1;
    return a.email.localeCompare(b.email);
  });
  return customers;
}
