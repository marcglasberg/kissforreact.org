import React from 'react';
import {useCurrentSidebarCategory} from '@docusaurus/plugin-content-docs/client';
import DocCategoryGeneratedIndexPage from '@theme-original/DocCategoryGeneratedIndexPage';

/**
 * Wraps the original component to allow a category's generated index page to override
 * its "Previous" and "Next" buttons with any link.
 *
 * Usage, in the category's _category_.json:
 *
 *   "customProps": {
 *     "pagination_previous_link": { "title": "Install and set up", "permalink": "/react/intro" }
 *   }
 */
export default function DocCategoryGeneratedIndexPageWrapper(props) {
  const {customProps} = useCurrentSidebarCategory();
  const {categoryGeneratedIndex} = props;
  const {navigation} = categoryGeneratedIndex;
  return (
    <DocCategoryGeneratedIndexPage
      {...props}
      categoryGeneratedIndex={{
        ...categoryGeneratedIndex,
        navigation: {
          previous: customProps?.pagination_previous_link ?? navigation.previous,
          next: customProps?.pagination_next_link ?? navigation.next,
        },
      }}
    />
  );
}
