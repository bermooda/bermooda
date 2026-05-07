import {
  MagnifyingGlassIcon,
  TruckIcon,
  GiftIcon,
  HeartIcon,
  SparklesIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { Link } from 'react-router';

import { formatPrice } from '#/core/index.js';

function resolvePrice(product) {
  if (product.displayPrice != null) return product.displayPrice;
  if (product.variantPrices?.[0]?.priceCents != null)
    return product.variantPrices[0].priceCents;
  if (product.variants?.[0]?.prices?.[0]?.priceCents != null)
    return product.variants[0].prices[0].priceCents;
  return null;
}

function resolveSlug(product) {
  return product.slug?.slug ?? product.slug ?? product.id;
}

function fmt(price, currency, locale) {
  return price != null
    ? formatPrice(price, currency ?? 'USD', locale ?? 'en')
    : '—';
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) {
    h = (h * 31 + String(str).charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

function fakeRating(id) {
  return Math.round(((hashSeed(id) % 12) / 10 + 3.8) * 10) / 10;
}
function fakeReviews(id) {
  return (hashSeed(id) % 480) + 20;
}

const GREEN = '#2f4a3a';
const CREAM = '#f7f1e6';
const SAND = '#e8dcc4';

function StarRow({ rating, count }) {
  const full = Math.floor(rating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <StarSolid
            key={i}
            className={`h-3.5 w-3.5 ${i < full ? 'text-[#c2913a]' : 'text-stone-300'}`}
          />
        ))}
      </div>
      <span className="text-xs text-stone-600">
        {rating.toFixed(1)} · {count} reviews
      </span>
    </div>
  );
}

export default function HomePage({
  products = [],
  categories = [],
  locale,
  currency,
}) {
  const featuredCollections = (categories.length ? categories : products)
    .slice(0, 3)
    .map((entry, i) => {
      const isCategory = !!entry.slug && !entry.media;
      const product = products[i];
      return {
        title: entry.title ?? entry.name ?? `Collection ${i + 1}`,
        href: isCategory
          ? `/categories/${entry.slug}`
          : `/products/${resolveSlug(entry)}`,
        img:
          product?.media?.[0]?.media?.url ??
          entry.media?.[0]?.media?.url ??
          null,
      };
    });

  const newArrivals = products.slice(0, 8);
  const favorites = products.slice(2, 6);

  return (
    <div className="bg-[#fbf7ef] font-sans text-stone-800">
      {/* Promo bar */}
      <div className="border-b border-stone-200" style={{ background: GREEN }}>
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide text-white sm:px-6 lg:px-8">
          <SparklesIcon className="h-4 w-4 text-amber-200" />
          <span>
            Take <strong>15% off</strong> your first order with code{' '}
            <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono">
              WELCOME15
            </span>
          </span>
        </div>
      </div>

      {/* Search-forward sub-header */}
      <div className="border-b border-stone-200 bg-[#fbf7ef]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 focus-within:border-stone-700 focus-within:ring-2 focus-within:ring-stone-200 sm:max-w-md">
            <MagnifyingGlassIcon className="h-4 w-4 text-stone-400" />
            <input
              type="search"
              placeholder="Search the shop"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
          </div>
          <div className="flex items-center gap-5 text-xs tracking-wide text-stone-600 uppercase">
            <Link to="/" className="hover:text-stone-900">
              Gift Guide
            </Link>
            <Link to="/" className="hover:text-stone-900">
              Trade Program
            </Link>
            <Link to="/" className="hover:text-stone-900">
              Stores
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-stone-200"
        style={{ background: CREAM }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, ${SAND}, transparent 50%), radial-gradient(circle at 80% 80%, #d6c8a8, transparent 50%)`,
          }}
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-[11px] font-medium tracking-[0.18em] uppercase backdrop-blur"
              style={{ borderColor: 'rgba(47,74,58,.2)', color: GREEN }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: GREEN }}
              />
              New season — fresh in this week
            </div>
            <h1 className="mt-6 font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Beautifully made
              <br />
              <span style={{ color: GREEN }} className="italic">
                everyday things.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-stone-600">
              From morning coffee to evening light — pieces chosen with care
              from independent makers and trusted heritage brands.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#new-arrivals"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: GREEN }}
              >
                Shop new arrivals
                <ChevronRightIcon className="h-4 w-4" />
              </a>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-stone-400 px-7 py-3 text-sm font-semibold text-stone-800 hover:border-stone-700"
              >
                <GiftIcon className="h-4 w-4" />
                Shop gifts
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <StarSolid key={i} className="h-3.5 w-3.5 text-[#c2913a]" />
                  ))}
                </div>
                <span>
                  <strong className="text-stone-800">4.9/5</strong> from 8,200+
                  reviews
                </span>
              </div>
            </div>
          </div>

          {/* Hero collage */}
          <div className="relative h-[480px] w-full">
            {products[0]?.media?.[0]?.media?.url && (
              <div
                className="absolute top-0 right-0 w-[68%] overflow-hidden rounded-3xl bg-white"
                style={{ boxShadow: '0 24px 48px -16px rgba(47,74,58,.25)' }}
              >
                <div className="aspect-4/5">
                  <img
                    src={products[0].media[0].media.url}
                    alt={products[0].title}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
            {products[1]?.media?.[0]?.media?.url && (
              <div
                className="absolute bottom-4 left-0 w-[55%] overflow-hidden rounded-3xl bg-white"
                style={{ boxShadow: '0 20px 40px -14px rgba(47,74,58,.25)' }}
              >
                <div className="aspect-square">
                  <img
                    src={products[1].media[0].media.url}
                    alt={products[1].title}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
            <div
              className="absolute right-4 bottom-12 z-10 hidden rounded-2xl bg-white px-4 py-3 md:block"
              style={{ boxShadow: '0 12px 24px -8px rgba(47,74,58,.2)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: SAND }}
                >
                  <HeartIcon className="h-4 w-4" style={{ color: GREEN }} />
                </div>
                <div>
                  <div className="text-xs font-semibold">
                    12,000+ happy homes
                  </div>
                  <div className="text-[11px] text-stone-500">
                    in 38 countries
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured collections */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div
              className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: GREEN }}
            >
              Featured
            </div>
            <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">
              Shop our collections
            </h2>
          </div>
          <Link
            to="/"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-stone-700 hover:text-stone-900 md:inline-flex"
            style={{ color: GREEN }}
          >
            View all <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {featuredCollections.map((c) => (
            <Link
              key={c.title}
              to={c.href}
              className="group relative block overflow-hidden rounded-2xl bg-stone-100"
              style={{ boxShadow: '0 16px 32px -16px rgba(47,74,58,.18)' }}
            >
              <div className="aspect-4/5">
                {c.img ? (
                  <img
                    src={c.img}
                    alt={c.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{
                      background: `linear-gradient(135deg, ${SAND}, ${CREAM})`,
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/0 to-black/0" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h3 className="font-serif text-2xl text-white drop-shadow md:text-3xl">
                  {c.title}
                </h3>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-stone-900 transition-all group-hover:gap-2">
                  Shop now
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      <section
        id="new-arrivals"
        className="border-y border-stone-200"
        style={{ background: '#f3ecdc' }}
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div
                className="text-[11px] font-semibold tracking-[0.22em] uppercase"
                style={{ color: GREEN }}
              >
                Just in
              </div>
              <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">
                New arrivals
              </h2>
              <p className="mt-2 max-w-lg text-sm text-stone-600">
                Hand-picked for the season. Limited quantities — once they're
                gone, they're gone.
              </p>
            </div>
            <div className="flex gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-white"
                style={{ background: GREEN }}
              >
                All
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-400 px-4 py-2 text-stone-700 hover:border-stone-700"
              >
                Under {fmt(5000, currency, locale)}
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-400 px-4 py-2 text-stone-700 hover:border-stone-700"
              >
                Best sellers
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {newArrivals.map((p, i) => {
              const img = p.media?.[0]?.media?.url ?? null;
              const slug = resolveSlug(p);
              const price = resolvePrice(p);
              const isNew = i < 4;
              return (
                <Link
                  key={p.id}
                  to={`/products/${slug}`}
                  className="group flex flex-col"
                >
                  <div className="relative overflow-hidden rounded-xl bg-white">
                    <div className="aspect-square">
                      {img ? (
                        <img
                          src={img}
                          alt={p.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background: `linear-gradient(135deg, ${SAND}, ${CREAM})`,
                          }}
                        />
                      )}
                    </div>
                    {isNew && (
                      <span
                        className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest text-white uppercase"
                        style={{ background: GREEN }}
                      >
                        New
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Add to favorites"
                      className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-stone-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-600"
                    >
                      <HeartIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 px-1">
                    <div className="text-[11px] tracking-[0.18em] text-stone-500 uppercase">
                      Bermooda Studio
                    </div>
                    <h3 className="mt-1 line-clamp-2 font-serif text-lg leading-snug text-stone-900">
                      {p.title}
                    </h3>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-semibold text-stone-900">
                        {fmt(price, currency, locale)}
                      </span>
                      <StarRow
                        rating={fakeRating(p.id)}
                        count={fakeReviews(p.id)}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Customer favorites */}
      {favorites.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mb-10 text-center">
            <div
              className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: GREEN }}
            >
              ★ ★ ★ ★ ★
            </div>
            <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-5xl">
              Customer favorites
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-stone-600">
              Top-rated by thousands of shoppers. Free shipping on orders over{' '}
              {fmt(7500, currency, locale)}.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {favorites.map((p) => {
              const img = p.media?.[0]?.media?.url ?? null;
              const slug = resolveSlug(p);
              const price = resolvePrice(p);
              return (
                <Link
                  key={p.id}
                  to={`/products/${slug}`}
                  className="group flex gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-lg"
                >
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                    {img && (
                      <img
                        src={img}
                        alt={p.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="line-clamp-2 font-serif text-base leading-snug text-stone-900">
                      {p.title}
                    </h3>
                    <StarRow
                      rating={fakeRating(p.id)}
                      count={fakeReviews(p.id)}
                    />
                    <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
                      <span className="font-semibold">
                        {fmt(price, currency, locale)}
                      </span>
                      <span
                        className="text-xs font-semibold underline-offset-4 group-hover:underline"
                        style={{ color: GREEN }}
                      >
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Why shop with us */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                Icon: TruckIcon,
                title: 'Complimentary shipping',
                body: `Free standard delivery on every order over ${fmt(7500, currency, locale)}.`,
              },
              {
                Icon: SparklesIcon,
                title: 'Considered sourcing',
                body: 'Working with small studios and heritage makers we know personally.',
              },
              {
                Icon: HeartIcon,
                title: 'Lovingly packed',
                body: 'Each order is wrapped by hand and sent with a note.',
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: SAND, color: GREEN }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter offer */}
      <section
        className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
        style={{ background: GREEN }}
      >
        <div className="mx-auto max-w-3xl text-center text-white">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-100 uppercase">
            ✶ Join the list
          </div>
          <h2 className="mt-3 font-serif text-3xl leading-tight md:text-5xl">
            10% off your first order.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/80">
            Plus early access to new arrivals, members-only sales, and the
            occasional thoughtful note.
          </p>
          <form className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              placeholder="your@email.com"
              className="flex-1 rounded-full bg-white/10 px-5 py-3 text-sm text-white ring-1 ring-white/30 outline-none placeholder:text-white/60 focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
            >
              Sign me up
            </button>
          </form>
          <p className="mt-3 text-xs text-white/60">
            No spam, ever. Unsubscribe anytime.
          </p>
        </div>
      </section>
    </div>
  );
}
