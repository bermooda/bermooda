# Companion patches

## `theme-default-notfound-self-wrap.patch`

Required companion to Phase A Task 2 (Layout ownership / 404 self-wrap) in bermooda.

Apply in [bermooda/theme-default](https://github.com/bermooda/theme-default):

```bash
cd theme-default
git apply ../bermooda/docs/superpowers/patches/theme-default-notfound-self-wrap.patch
# or: patch -p1 < path/to/theme-default-notfound-self-wrap.patch
```

Then publish `@bermooda/theme-default` (or install from the sibling checkout) **before or with** merging the bermooda PR that removes the 404 route `Layout` wrap. Without this, 404 pages render without storefront chrome.
