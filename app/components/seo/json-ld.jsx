import { serializeJsonLd } from '#/core/seo/input/index';

export function JsonLd({ data }) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : [data];
  return items.map((item, index) => (
    <script
      key={index}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
    />
  ));
}
