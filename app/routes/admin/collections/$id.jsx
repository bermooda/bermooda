import { useState } from 'react';
import { redirect } from 'react-router';
import { Form, Link, useLoaderData } from 'react-router';

import Badge from '#/components/admin/badge';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import Textarea from '#/components/admin/form/textarea';
import PageHeader from '#/components/admin/page-header';
import Button, { ButtonSubmit } from '#/components/ui/button';

import {
  getCollection,
  listCollectionRuleOptions,
  listProductsForCollectionPicker,
  parseCollectionRulesFromForm,
  updateCollection,
  deleteCollection,
} from '#/core/collections/index.server';

const RULE_TYPES = [
  { value: 'tag', label: 'Product tag' },
  { value: 'category', label: 'Category' },
  { value: 'price_min', label: 'Minimum price (cents)' },
  { value: 'price_max', label: 'Maximum price (cents)' },
  { value: 'in_stock', label: 'In stock' },
];

function emptyCondition() {
  return { type: 'tag', value: '' };
}

function RulesBuilder({ initialRules, categories, tags }) {
  const [match, setMatch] = useState(
    initialRules?.match === 'any' ? 'any' : 'all'
  );
  const [conditions, setConditions] = useState(
    initialRules?.conditions?.length
      ? initialRules.conditions.map((c) => ({ ...c }))
      : [emptyCondition()]
  );

  function updateCondition(index, field, value) {
    setConditions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function removeCondition(index) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <Field label="Match mode" htmlFor="rules-match">
        <Select
          id="rules-match"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
        >
          <option value="all">All conditions</option>
          <option value="any">Any condition</option>
        </Select>
      </Field>

      <input type="hidden" name="rulesMatch" value={match} />

      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-wrap items-end gap-3">
          <Field label="Rule type" className="min-w-40 flex-1">
            <Select
              value={condition.type}
              onChange={(e) => updateCondition(index, 'type', e.target.value)}
            >
              {RULE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Value" className="min-w-48 flex-1">
            {condition.type === 'category' ? (
              <Select
                value={String(condition.value ?? '')}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </Select>
            ) : condition.type === 'in_stock' ? (
              <Select
                value={String(condition.value ?? 'true')}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
              >
                <option value="true">In stock</option>
                <option value="false">Out of stock</option>
              </Select>
            ) : condition.type === 'tag' ? (
              <Select
                value={String(condition.value ?? '')}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
              >
                <option value="">Select tag</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type="number"
                min="0"
                value={condition.value ?? ''}
                onChange={(e) =>
                  updateCondition(index, 'value', e.target.value)
                }
                placeholder="Amount in cents"
              />
            )}
          </Field>

          <input
            type="hidden"
            name={`ruleType[${index}]`}
            value={condition.type}
          />
          <input
            type="hidden"
            name={`ruleValue[${index}]`}
            value={condition.value ?? ''}
          />

          <Button
            type="button"
            variant="secondary"
            onClick={() => removeCondition(index)}
          >
            Remove
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
      >
        Add condition
      </Button>
    </div>
  );
}

export async function loader({ params }) {
  const collection = await getCollection(params.id);
  if (!collection) {
    throw new Response('Collection not found', { status: 404 });
  }

  const [products, ruleOptions] = await Promise.all([
    listProductsForCollectionPicker({
      selectedProductIds: collection.productIds ?? [],
    }),
    listCollectionRuleOptions(),
  ]);

  return {
    collection,
    products,
    categories: ruleOptions.categories,
    tags: ruleOptions.tags,
  };
}

export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'delete') {
    await deleteCollection(params.id);
    return redirect('/admin/collections');
  }

  const collectionType = formData.get('collectionType')?.toString() ?? 'manual';
  const productIds = formData.getAll('productIds[]').map((id) => id.toString());

  try {
    await updateCollection(params.id, {
      handle: formData.get('handle'),
      title: formData.get('title'),
      description: formData.get('description'),
      collectionType,
      rules:
        collectionType === 'smart'
          ? parseCollectionRulesFromForm(formData)
          : undefined,
      productIds: collectionType === 'manual' ? productIds : undefined,
      published: formData.get('published') === 'on',
    });
    return redirect('/admin/collections');
  } catch (err) {
    if (err.code === 'COLLECTION_NOT_FOUND') {
      throw new Response('Collection not found', { status: 404 });
    }
    if (err.code === 'COLLECTION_INVALID') {
      return { error: err.message };
    }
    throw err;
  }
}

export function meta({ loaderData }) {
  const title = loaderData?.collection?.title ?? 'Edit collection';
  return [{ title: `${title} — Collections` }];
}

export default function AdminEditCollectionRoute() {
  const { collection, products, categories, tags } = useLoaderData();
  const [collectionType, setCollectionType] = useState(
    collection.collectionType ?? 'manual'
  );

  return (
    <div>
      <PageHeader
        title={collection.title || collection.handle}
        subtitle="Edit collection details, products, or smart rules."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={collection.publishedAt ? 'success' : 'neutral'}>
              {collection.publishedAt ? 'Published' : 'Draft'}
            </Badge>
            <Button as={Link} to="/admin/collections" variant="secondary">
              Back
            </Button>
          </div>
        }
      />

      <Form method="post" className="max-w-3xl space-y-6">
        <Field label="Handle" htmlFor="handle">
          <Input
            id="handle"
            name="handle"
            defaultValue={collection.handle}
            required
          />
        </Field>

        <Field label="Title" htmlFor="title">
          <Input
            id="title"
            name="title"
            defaultValue={collection.title}
            required
          />
        </Field>

        <Field label="Description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={collection.description ?? ''}
          />
        </Field>

        <Field label="Collection type" htmlFor="collectionType">
          <Select
            id="collectionType"
            name="collectionType"
            value={collectionType}
            onChange={(e) => setCollectionType(e.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="smart">Smart (rule-based)</option>
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={Boolean(collection.publishedAt)}
          />
          Published on storefront
        </label>

        {collectionType === 'smart' ? (
          <RulesBuilder
            initialRules={collection.rules}
            categories={categories}
            tags={tags}
          />
        ) : (
          <Field label="Products">
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    name="productIds[]"
                    value={product.id}
                    defaultChecked={product.selected}
                  />
                  <span className="text-sm font-medium">{product.title}</span>
                  {product.sku && (
                    <span className="text-xs text-stone-500">
                      {product.sku}
                    </span>
                  )}
                </label>
              ))}
              {!products.length && (
                <p className="text-sm text-stone-500">No products available.</p>
              )}
            </div>
          </Field>
        )}

        <div className="flex flex-wrap gap-3">
          <ButtonSubmit>Save collection</ButtonSubmit>
          <Button as={Link} to="/admin/collections" variant="secondary">
            Cancel
          </Button>
        </div>
      </Form>

      <Form method="post" className="mt-10 max-w-3xl">
        <input type="hidden" name="intent" value="delete" />
        <Button
          type="submit"
          variant="secondary"
          onClick={(e) => {
            if (
              !window.confirm('Delete this collection? This cannot be undone.')
            ) {
              e.preventDefault();
            }
          }}
        >
          Delete collection
        </Button>
      </Form>
    </div>
  );
}
