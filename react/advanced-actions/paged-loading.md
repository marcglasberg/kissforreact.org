---
sidebar_position: 5
---

# Paged loading

To load a list page by page (a "load more" button, or an infinite scroll), extend `LoadPages`.
It keeps the loaded pages in the state, in an immutable `Pages` value, and knows how to load
the next page, the previous page, the first page again, or all the loaded pages again.

Loading a list page by page by hand needs a lot of small decisions: where to keep the pages,
how to ask for the next one, how to know there are no more pages, what to do when the user
taps "load more" twice, and how to reload the list without losing the pages the user already
scrolled through. `LoadPages` makes those decisions for you.

## How to use it

Your action says where the pages are in the state, what the first page param is, how to
load a page, and how to get the param of the next page from the last page loaded:

```tsx
class LoadTodos extends LoadPages<State, Todo[], string | null> {

  // Where the pages are in the state.
  getPagesFromState(state: State) { return state.todos; }
  applyPagesToState(state: State, todos: Pages<Todo[], string | null>) { return state.copy({ todos }); }

  // The first page has no cursor.
  initialPageParam() { return null; }

  // Loads 20 items with id > cursor.
  loadPage(cursor: string | null) { return api.todosAfter(cursor, 20); }

  // The cursor of the next page is the id of the last item. A page with less than 20 items
  // is the last one: return null (or undefined) to say there are no more pages.
  nextPageParam(lastPage: Todo[]) { return lastPage.length < 20 ? null : lastPage.at(-1)!.id; }
}
```

The three type parameters are the state, the page (whatever `loadPage` returns), and the
page param (what `loadPage` receives). The page param can be anything:

* The id of the last item, as above. The server returns the items after it.
* A page number: `initialPageParam()` returns `1`, and `nextPageParam` returns
  `lastPageParam + 1` (its third parameter), or `null` when the page is empty.
* An opaque cursor from the server. If the server returns the cursor of the next page with
  each page, make the page an object with it, like `{ items: Todo[], nextCursor: string | null }`,
  and return `lastPage.nextCursor` from `nextPageParam`.

The state keeps the pages in a `Pages` value:

```tsx
class State {
  constructor(readonly todos: Pages<Todo[], string | null> = Pages.empty()) {}
  ...
}
```

`getPagesFromState` may also return `null` or `undefined` when nothing was loaded yet, which
is the same as `Pages.empty()`.

## Which pages to load

Dispatch the action with the pages to load. The default is `'refresh'`:

```tsx
dispatch(new LoadTodos());           // Same as 'refresh'. When mounting the screen.
dispatch(new LoadTodos('next'));     // The "load more" button, or the end of the scroll.
dispatch(new LoadTodos('first'));    // Start over: a pull-to-refresh, or when a filter changes.
dispatch(new LoadTodos('previous')); // Only if `previousPageParam` is implemented.
```

* **`'refresh'`** loads again the pages that are in the state, one after the other from the
  first one. It uses the param of the first page, and then the params `nextPageParam` gives
  for each new page, so the pages stay consistent if items were added or removed in the
  server. The state only changes at the end, with all the pages. It stops early if
  `nextPageParam` says there are no more pages. If no page was loaded yet, it loads the first
  page. So, it's safe to dispatch it whenever the screen is shown, or the app comes back to
  the foreground, together with [fresh](./control-features#fresh), to skip it when the data
  is recent.

* **`'next'`** loads the page after the last one, and adds it to the end. If there is no next
  page (`pages.hasNextPage` is `false`), nothing is loaded: the dispatch is aborted. If no
  page was loaded yet, it loads the first page.

* **`'previous'`** is the same, for the page before the first one, and adds it to the start.
  Implement `previousPageParam` to use it (see below).

* **`'first'`** loads the first page, with `initialPageParam()`, and throws away the other
  pages.

If you subclass with your own constructor, pass the pages to load to `super`:

```tsx
class LoadComments extends LoadPages<State, Comment[], number> {
  constructor(readonly postId: string, which: PagesToLoad = 'refresh') { super(which); }
  ...
}
```

## The Pages value

The `Pages` value in the state has:

* `pages`: the pages loaded so far, in order. Each page is whatever `loadPage` returned.
* `pageParams`: the page params used to load each page. `pageParams[i]` loaded `pages[i]`.
* `hasNextPage`: `true` if there is a page after the last one, as told by `nextPageParam`.
* `hasPreviousPage`: `true` if there is a page before the first one, as told by
  `previousPageParam`. Always `false` if the action doesn't implement it.
* `isEmpty`: `true` if no page was loaded.

It's immutable: each load puts a new `Pages` in the state. To change it yourself (for
example, to remove an item that was deleted), use `copy` with the new `pages` array. Keep
`pageParams` with one param per page, since a `'refresh'` reloads the pages with them:

```tsx
class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }

  reduce() {
    const todos = this.state.todos;
    return this.state.copy({
      todos: todos.copy({ pages: todos.pages.map(page => page.filter(todo => todo.id !== this.id)) }),
    });
  }
}
```

If you persist the state with a [ClassPersistor](../miscellaneous/persistor), add `Pages`
to its classes.

## In the component

The component reads the `Pages` value from the state, and flattens the pages to show the
items. `useIsWaiting(LoadTodos)` tells if the list is loading:

```tsx
function TodoList() {
  useStoreEffect({ onMount: (store) => store.dispatch(new LoadTodos()) });
  const todos = useSelect((state: State) => state.todos);
  const isLoading = useIsWaiting(LoadTodos);
  const dispatch = useDispatch();
  const items = todos.pages.flat();

  return (
    <>
      {items.map(todo => <TodoItem key={todo.id} todo={todo} />)}
      <button disabled={!todos.hasNextPage || isLoading} onClick={() => dispatch(new LoadTodos('next'))}>
        {isLoading ? 'Loading...' : 'Load more'}
      </button>
    </>
  );
}
```

For an infinite scroll, dispatch `new LoadTodos('next')` when the last item becomes visible
(for example, with an `IntersectionObserver`). You don't need to check if the list is already
loading, or if there is a next page: the dispatch is aborted in those cases.

## Only one load per list at a time

While a `LoadTodos` is running, a `'next'` or `'previous'` dispatched for the same list is
aborted, as if it was not dispatched. So two quick taps on "load more" load one page, and a
scroll handler can dispatch `'next'` freely.

A `'first'` or `'refresh'` instead aborts the loads of the same list that are running, and
runs: the newest request wins. The results of the aborted loads are ignored, even if they
arrive later. The aborted action's `abortSignal` is aborted, so pass it to `fetch` in
`loadPage` to cancel its request:

```tsx
async loadPage(cursor: string | null) {
  const response = await fetch(`/api/todos?after=${cursor ?? ''}`, { signal: this.abortSignal });
  return await response.json() as Todo[];
}
```

A `'next'` page is added to the pages as they are when it arrives, and not as they were when
the load started. So, if another action removed an item meanwhile, the item stays removed.

## Several lists with the same action

If the same action class loads different lists (one per user, per post, per tab, etc.),
override `pagesKeyParams()` to tell them apart. Loads of different keys don't affect each
other. The key is also the `statusKey` of the action, so
`useIsWaiting(LoadComments, { statusKey: postId })` tells if that list is loading:

```tsx
class LoadComments extends LoadPages<State, Comment[], number> {
  constructor(readonly postId: string, which: PagesToLoad = 'refresh') { super(which); }

  pagesKeyParams() { return this.postId; }
  getPagesFromState(state: State) { return state.commentsOf(this.postId); }
  applyPagesToState(state: State, pages: Pages<Comment[], number>) { return state.withComments(this.postId, pages); }
  initialPageParam() { return 1; }
  loadPage(page: number) { return api.comments(this.postId, page); }
  nextPageParam(lastPage: Comment[], allPages: Comment[][], lastPageParam: number) {
    return lastPage.length === 0 ? null : lastPageParam + 1;
  }
}
```

The key is compared with `Object.is`, except arrays and plain objects, which are compared by
their contents. Don't override `statusKey` itself: override `pagesKeyParams()`.

## Previous pages

Implement `previousPageParam` to load pages in the other direction. It's given the first
page, all the pages, the param of the first page, and all the params, and returns the param
of the page before the first one, or `null` or `undefined` if there is none:

```tsx
class LoadMessages extends LoadPages<State, Message[], number> {
  initialPageParam() { return this.state.newestPage; }  // Start at the newest messages.
  loadPage(page: number) { return api.messages(page); }
  nextPageParam(lastPage: Message[], allPages: Message[][], lastPageParam: number) { return lastPageParam + 1; }
  previousPageParam(firstPage: Message[], allPages: Message[][], firstPageParam: number) {
    return firstPageParam > 1 ? firstPageParam - 1 : null;
  }
  ...
}

dispatch(new LoadMessages('previous')); // When the user scrolls up: adds the older page to the start.
```

`loadPage` gets the direction as its second parameter: `'backward'` for a `'previous'` page,
and `'forward'` otherwise.

## Limiting the pages in memory

Set `maxPages` to keep at most that many pages. When a `'next'` page is added past the
limit, the first page is dropped (and when a `'previous'` page is added, the last one). A
`'refresh'` then only reloads the pages kept. Implement `previousPageParam` too, so that the
user can load the dropped pages again by scrolling back:

```tsx
class LoadTodos extends LoadPages<State, Todo[], number> {
  maxPages = 5;
  ...
}
```

## Combining with other features

* [fresh](./control-features#fresh) and [throttle](./control-features#throttle) only apply
  to `'first'` and `'refresh'`: a `'next'` or `'previous'` always runs, since loading more is
  never "the same data again" (it also starts a new fresh period). If you override
  `ignoreFresh` or `ignoreThrottle`, keep that: for example,
  `get ignoreFresh() { return this.force || super.ignoreFresh; }`.

* [retry](./control-features#retry), [checkInternet](./internet-features#checkinternet)
  and [debounce](./control-features#debounce) work as usual. With `retry`, the whole load is
  retried (all the pages of a `'refresh'`).

* It can't be combined with [nonReentrant](./control-features#nonreentrant) or
  [ignoreOld](./control-features#ignoreold), since it already decides which loads run.
  Dispatching it with those throws a `StoreException`.

* With [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet), the
  action becomes non-reentrant per class, so a `'first'` or `'refresh'` can't abort a running
  load anymore: it's aborted instead, like a `'next'`.

* To [poll](./control-features#polling) a list, override `createPollingAction()` to return a
  `'refresh'`.

* Don't override `reduce`, `abortDispatch` or `statusKey`. The
  [Kiss linter](../ai/linter) reports these overrides.

* Nothing is kept in the store for this feature, so there is nothing to clear on logout.
