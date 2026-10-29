import React from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocPaginator from '@theme/DocPaginator';

/**
 * Swizzled from @docusaurus/theme-classic to allow a doc to override its "Next" button
 * with any link, including a category's generated index page (which the built-in
 * `pagination_next` front matter can't point to, because it only accepts doc IDs).
 *
 * Usage, in the doc's front matter:
 *
 *   pagination_next_link:
 *     title: Tutorial
 *     permalink: /react/category/tutorial
 */
export default function DocItemPaginator() {
  const {metadata, frontMatter} = useDoc();
  const next = frontMatter.pagination_next_link ?? metadata.next;
  return (
    <DocPaginator
      className="docusaurus-mt-lg"
      previous={metadata.previous}
      next={next}
    />
  );
}
