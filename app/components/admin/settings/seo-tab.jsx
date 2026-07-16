import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';

import {
  CHECKBOX_CLASS,
  FieldLabel,
  SaveButton,
  SectionCard,
  inputClass,
} from '#/components/admin/settings/shared';

/**
 * SEO image uploader for settings.
 *
 * @param {Object} props
 * @param {string} [props.imageUrl]
 * @returns {React.ReactElement}
 */
export function SeoImageUploader({ imageUrl }) {
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();
  const fileRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);

  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      if (
        fetcher.data.intent === 'upload-seo-image' &&
        fetcher.data.ogImageUrl
      ) {
        setPreviewUrl(fetcher.data.ogImageUrl);
      }
      if (fetcher.data.intent === 'remove-seo-image') {
        setPreviewUrl('');
      }
      revalidate();
    }
  }, [fetcher.state, fetcher.data, revalidate]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('intent', 'upload-seo-image');
    fd.append('file', file);
    fetcher.submit(fd, { method: 'post', encType: 'multipart/form-data' });
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleRemove() {
    const fd = new FormData();
    fd.append('intent', 'remove-seo-image');
    fetcher.submit(fd, { method: 'post' });
  }

  const isUploading =
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'upload-seo-image';
  const isRemoving =
    fetcher.state !== 'idle' &&
    fetcher.formData?.get('intent') === 'remove-seo-image';

  return (
    <div>
      <FieldLabel>Social / hero image</FieldLabel>
      <p className="text-text-muted mb-3 text-xs">
        Used for Open Graph and Twitter cards when pages do not have their own
        image. Recommended size: 1200×630 px.
      </p>

      {previewUrl ? (
        <div className="border-border bg-surface-2 relative max-w-md overflow-hidden rounded-lg border">
          <img
            src={previewUrl}
            alt="SEO hero preview"
            className="aspect-[1200/630] w-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={isRemoving}
            className="bg-surface/90 text-text hover:text-danger absolute top-2 right-2 rounded-md p-1.5 shadow-sm transition disabled:opacity-50"
            aria-label="Remove image"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          className={clsx(
            'border-border text-text-muted hover:border-accent hover:bg-accent/5 hover:text-accent flex max-w-md cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors',
            isUploading && 'cursor-wait opacity-60'
          )}
        >
          {isUploading ? (
            <span className="text-sm">Uploading…</span>
          ) : (
            <>
              <PhotoIcon className="h-8 w-8" />
              <span className="mt-2 text-sm font-medium">Upload image</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}

      {previewUrl && (
        <div className="mt-3">
          <label
            className={clsx(
              'text-accent inline-flex cursor-pointer items-center gap-1 text-sm hover:underline',
              isUploading && 'cursor-wait opacity-60'
            )}
          >
            {isUploading ? 'Uploading…' : 'Replace image'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * SEO settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function SeoTab({ data }) {
  const fetcher = useFetcher();

  return (
    <SectionCard title="SEO">
      <fetcher.Form method="post" className="max-w-lg space-y-6">
        <input type="hidden" name="intent" value="save-seo" />

        <p className="text-text-muted text-sm">
          Default title and description for your storefront homepage and social
          previews. Product and content pages can override these with their own
          SEO fields.
        </p>

        <div>
          <FieldLabel>Meta title</FieldLabel>
          <input
            type="text"
            name="metaTitle"
            defaultValue={data.seoMetaTitle}
            placeholder={data.shopName || 'My Awesome Store'}
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            Shown in browser tabs and search results. Falls back to shop name
            when empty.
          </p>
        </div>

        <div>
          <FieldLabel>Meta description</FieldLabel>
          <textarea
            name="metaDescription"
            defaultValue={data.seoMetaDescription}
            rows={3}
            placeholder="Discover our curated collection…"
            className={inputClass('resize-y')}
          />
          <p className="text-text-muted mt-1 text-xs">
            Short summary for search engines and link previews (aim for ~160
            characters).
          </p>
        </div>

        <div>
          <FieldLabel>Title template</FieldLabel>
          <input
            type="text"
            name="titleTemplate"
            defaultValue={data.seoTitleTemplate}
            placeholder="{pageTitle} | {shopName}"
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            Applied to product, category, and content pages. Use{' '}
            <code className="text-text">{`{pageTitle}`}</code> and{' '}
            <code className="text-text">{`{shopName}`}</code>. The homepage uses
            the meta title above instead.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="allowIndexing"
            defaultChecked={data.seoAllowIndexing}
            className={clsx(CHECKBOX_CLASS, 'mt-0.5')}
          />
          <span>
            <span className="text-text block text-sm font-medium">
              Allow search engines to index this store
            </span>
            <span className="text-text-muted mt-0.5 block text-xs">
              Turn off for staging or pre-launch sites. Adds{' '}
              <code className="text-text">noindex</code> site-wide and blocks
              crawlers in robots.txt.
            </span>
          </span>
        </label>

        <div className="border-border border-t pt-6">
          <h3 className="text-text mb-4 text-sm font-semibold">
            Search engine verification
          </h3>
          <div className="space-y-4">
            <div>
              <FieldLabel>Google Search Console</FieldLabel>
              <input
                type="text"
                name="googleSiteVerification"
                defaultValue={data.seoGoogleSiteVerification}
                placeholder="verification token"
                className={inputClass()}
              />
              <p className="text-text-muted mt-1 text-xs">
                Content value from the HTML meta tag Google provides.
              </p>
            </div>
            <div>
              <FieldLabel>Bing Webmaster Tools</FieldLabel>
              <input
                type="text"
                name="bingSiteVerification"
                defaultValue={data.seoBingSiteVerification}
                placeholder="verification token"
                className={inputClass()}
              />
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>Twitter / X handle</FieldLabel>
          <input
            type="text"
            name="twitterHandle"
            defaultValue={data.seoTwitterHandle}
            placeholder="myshop"
            className={inputClass()}
          />
          <p className="text-text-muted mt-1 text-xs">
            Optional. Used for <code className="text-text">twitter:site</code>{' '}
            on shared links (with or without @).
          </p>
        </div>

        <SaveButton fetcher={fetcher} intent="save-seo" />
      </fetcher.Form>

      <div className="border-border mt-8 max-w-lg border-t pt-8">
        <SeoImageUploader imageUrl={data.seoOgImageUrl} />
      </div>
    </SectionCard>
  );
}
