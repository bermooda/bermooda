import config from '#/config';
import LandingHeader from '#/components/header/landing';
import Benefits from '#/components/landing/benefits';
import CTA from '#/components/landing/cta';
import FAQ from '#/components/landing/faq';
import Footer from '#/components/landing/footer';
import Hero from '#/components/landing/hero';
import Pricing from '#/components/landing/pricing';
import Technologies from '#/components/landing/technologies';
import Testimonials from '#/components/landing/testimonials';
import TimeSavings from '#/components/landing/time-savings';

export function meta() {
  return [
    { title: config.appName },
    { name: 'description', content: config.appDescription },
  ];
}

/**
 * Landing page route
 * A comprehensive landing page with multiple sections showcasing the CursorStack template
 */
export default function LandingRoute() {
  return (
    <div className="dark-mesh-gradient bg-white">
      <LandingHeader />
      <Hero />
      <Technologies />
      <TimeSavings />
      <Benefits />
      <Pricing />
      <FAQ />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}
