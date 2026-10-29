---
sidebar_position: 2
---

# Comparing with TanStack Query

This page is for people who know TanStack Query (also called React Query). It shows how to get
the same results with Kiss, which does things in a different way, and what changes when an AI
agent writes the code. Each section shows the TanStack Query code first, and then the Kiss code
that does the same. If you use SWR, most of this page applies to it too, and the [SWR](#swr)
section at the end translates its options.

TanStack Query is an asynchronous state management package based on **queries** and a **cache**.
A query fetches data from a server (with [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API),
[axios](https://axios-http.com), [ky](https://www.npmjs.com/package/ky), etc.), and the result
goes into a cache that the library owns. The library then decides when the data is stale, and
fetches it again by itself: when a component mounts, when the user comes back to the tab, when
the internet comes back, at intervals, or when you "invalidate" the query.

Kiss is based on **actions** and **state**. An action may call the server, and its reducer may
change the state. The state belongs to your app, and you shape it as you like. There is no
cache apart from the state. Components dispatch actions and read the state.

So, every time TanStack Query "fetches a query again", Kiss "dispatches an action again". And
every time TanStack Query asks "is this query loading, stale, or failed?", Kiss asks "is this
action running, fresh, or failed?".

## The big difference

Redux ignores async work and leaves it to middleware. TanStack Query goes the other way: it
treats all state management as fetching and caching. Everything is a query.

We think that is the wrong starting point. Most apps have data that is not a query result: a
draft the user is typing, a filter, a selection, a calculation across two lists. With TanStack
Query, that data has to live somewhere else, in `useState`, in a context, or in a second
library. (This article says it well:
[What I learned from React-Query, and why I will not use it in my next project](https://medium.com/duda/what-i-learned-from-react-query-and-why-i-will-not-use-it-in-my-next-project-a459f3e91887).)

Kiss starts from the state. There is one state object, and actions that change it. An action
can be sync or async. It can fetch data, but it can also change the state in any other way.
It can fail or succeed. You can wait for it to finish, retry it, debounce it, throttle it, and
make it optimistic.

Three things follow from this, and they come up in every section below:

* **The loading rules are on the action, not in the component.** In TanStack Query, "for how
  long is this data fresh", "retry how many times", and "poll every 10 seconds" are options on
  a hook, inside a component. Five components can use the same query with five different
  answers. That's easy to end up with when an agent writes each component in a different
  session. In Kiss, those rules are declared once, on the action, and every component gets the
  same answer.

* **Refreshing re-runs the action, not just the fetch.** TanStack Query fetches raw data and
  stores it. Anything you do with that data, like joining it with other data or reshaping it,
  happens afterwards, in each component. In Kiss, the action loads the data, transforms it,
  and puts it where it belongs. That logic runs once, and every component reads the result.

* **The state has a shape you can read.** The query cache has no declared shape. It's a map of
  string keys. The Kiss state is a class you wrote, so you can see everything the app knows,
  and how the pieces relate, in one file.

|                           | TanStack Query | Redux Toolkit    | Kiss                |
|---------------------------|----------------|------------------|---------------------|
| Sync processes            | No             | Actions/Reducers | Actions/Reducers    |
| Async processes           | Queries        | Thunks           | Actions/Reducers    |
| Client state (not from a server) | No      | Yes              | Yes                 |
| Persistence               | No             | Objects          | Objects and classes |
| Loading and failed states | Yes            | No               | Yes                 |
| Deduplication             | Yes            | No               | Yes                 |
| Smart refetches           | Yes            | No               | Yes                 |
| Retry                     | Yes            | No               | Yes                 |
| Optimistic updates        | Manual         | No               | Yes                 |
| Server-side rendering     | Yes            | Yes              | Yes                 |

## Quick translation

If you know TanStack Query, this table tells you where to look in Kiss. The sections below
explain each line, with code.

| TanStack Query                                                      | Kiss                                                                                         |
|---------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| `useQuery` with a `queryFn`                                         | An async action, whose `reduce()` fetches the data and puts it in the state                  |
| The cache                                                           | The state                                                                                    |
| `queryKey`                                                          | The action class, and its constructor parameters                                             |
| `data`                                                              | `useSelect((state) => state.something)`                                                      |
| `select`, `structuralSharing`                                       | `useSelect`, `useObject`                                                                     |
| `initialData`, `placeholderData`                                    | The `initialState` of the store                                                              |
| `isPending`, `isError`, `error`                                     | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`                     |
| `isFetching` while there is data (a refresh)                        | `useIsWaiting(Action)`, while the state already has the data                                 |
| Status per `queryKey`                                               | `statusKey` in the action, and `{ statusKey }` in the hooks                                  |
| `useSuspenseQuery`, `throwOnError`                                  | `useSuspense(Action)`                                                                        |
| `staleTime`                                                         | `fresh`                                                                                      |
| `refetchOnMount`                                                    | `useStoreEffect({ onMount })`                                                                |
| `refetchOnWindowFocus`                                              | `useStoreEffect({ onFocus })`                                                                |
| `refetchOnReconnect`                                                | `useStoreEffect({ onOnline })`                                                               |
| `refetchInterval`                                                   | Polling: `pollInterval`, `Poll.start`, `Poll.stop`                                           |
| `refetchIntervalInBackground: false`                                | `pollOnlyWhenFocused` and `pollOnlyWhenOnline` (the defaults)                                |
| `focusManager`, `onlineManager`                                     | `store.isFocused`, `store.isOnline`, `useIsFocused()`, `useIsOnline()`                       |
| `focusManager.setEventListener`, `onlineManager.setEventListener`   | `focusSource`, `onlineSource` in `createStore`                                               |
| `enabled: false`, dependent queries, `skipToken`                    | Don't dispatch; or `dispatchAndWait`, `dispatchWhen`, `waitCondition`                        |
| `useQueries`                                                        | `dispatchAll`, `dispatchAndWaitAll`                                                          |
| `placeholderData: keepPreviousData`                                 | `ignoreOld` (the state keeps the old data until the new one arrives)                         |
| `prefetchQuery`, `ensureQueryData`                                  | Dispatch the action early (for example, on mouse hover), with `fresh`                        |
| `signal` in the `queryFn`, `cancelQueries`                          | `this.abortSignal`, aborted by `ignoreOld`, `store.abort` or `action.abort()`                |
| `retry`, `retryDelay`                                               | `retry`                                                                                      |
| `retry: (failureCount, error) => boolean`                           | `shouldRetry(error, attempt)`                                                                |
| `networkMode: 'online'` (paused while offline)                      | `checkInternet`, `unlimitedRetryCheckInternet`                                               |
| `useMutation`                                                       | An action (sync or async)                                                                    |
| `onSuccess`, `onError`, `onSettled`                                 | The reducer, `wrapError()`, `after()`                                                        |
| `onMutate` and rollback (optimistic update)                         | `OptimisticCommand`, `OptimisticSync`, `OptimisticSyncWithPush`                              |
| Mutation `scope` (one mutation at a time)                           | `sequential`                                                                                 |
| `useInfiniteQuery`, `fetchNextPage`, `hasNextPage`                  | `LoadPages`, dispatched with `'next'`, and the `Pages` value in the state                    |
| `invalidateQueries`                                                 | Not needed: the action that saves reloads what it needs                                      |
| `setQueryData`                                                      | A sync action                                                                                |
| `useIsFetching`, `useIsMutating`                                    | One `useIsWaiting` per action, then `\|\|`; or `store.actionsInProgress()`                   |
| `dehydrate`, `hydrate`, `HydrationBoundary`                         | `serverState`, `StoreSlice`                                                                  |
| `persistQueryClient`                                                | The persistor                                                                                |
| `QueryClient.clear()`, `removeQueries`                              | `store.logOut()`, `store.clearInternalActionProps()`, a reset action                         |
| `gcTime` (forget unused data)                                       | Not needed: dispatch a clean-up action in `onUnmount`                                        |
| Devtools                                                            | `actionObserver`, `stateObserver` (no UI)                                                    |
| `onlineManager.setOnline(false)` in tests                           | `store.setOnline(false)`, `store.forceInternetOnOffSimulation`                               |
| Debounce and throttle (not in TanStack Query)                       | `debounce`, `throttle`                                                                       |

## Queries and the state

In TanStack Query, a component declares a query with a key and a function that fetches. The
result is kept in the cache, and comes back as `data`:

```tsx
function TextScreen() {
  const { data } = useQuery({ queryKey: ['text'], queryFn: () => api.loadText() });
  return <pre>{data}</pre>;
}
```

In Kiss, an action fetches the data in its `reduce()` method, and puts it in the state. The
component dispatches the action when it mounts, and reads the state with `useSelect`:

```tsx
class LoadText extends Action {
  async reduce() {
    const text = await api.loadText();
    return (state: State) => state.copy({ text });
  }
}

function TextScreen() {
  useStoreEffect({ onMount: (store) => store.dispatch(new LoadText()) });
  const text = useSelect((state: State) => state.text);
  return <pre>{text}</pre>;
}
```

This is how each part translates:

* The `queryFn` is the `reduce()` method of the action.
* The cache is the state. Since the state belongs to your app, you decide its shape.
* The `queryKey` is the action class, plus its constructor parameters (`new LoadUser(userId)`).
* `data` is whatever `useSelect` reads from the state. The `select` option is `useSelect` too,
  and `useObject` does what `structuralSharing` does: the component only re-renders when the
  selected value changes.
* `initialData` and `placeholderData` are the `initialState` you give to `createStore`.

## Client state

Not all state comes from a server. A counter, a filter, a draft, or a selection is client
state. TanStack Query has a cache shared by all queries, but the cache is an internal detail
for keeping data fresh. It's not meant to be used as state. That's why the table above says
TanStack Query has no client state.

If you want to use the cache as client state anyway, you can, but it's awkward:

```tsx
function useGlobalLocalState(key, initialValue) {
  const { data: state } = useQuery({
    queryKey: [key],
    queryFn: () => queryClient.getQueryData([key]),
    initialData: initialValue,
  });

  const setState = (value) => queryClient.setQueryData([key], value);

  return [state, setState];
}

function Counter() {
  const [count, setCount] = useGlobalLocalState('count', 0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>add</button>
    </div>
  );
}
```

You have to invent unique string keys by hand (like `'count'` above), and make sure they
never repeat. You need `initialData`. And `setQueryData` has no type safety: a wrong key or a
wrong value compiles fine.

In Kiss, client state is just state. It goes in the same `State` class as the server data,
and is read and changed the same way:

```tsx
function Counter() {
  const count = useSelect((state: State) => state.count);
  const dispatch = useDispatch();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => dispatch(new IncrementCount())}>add</button>
    </div>
  );
}
```

## Loading and failed states

This is how TanStack Query lets a component know if a query is loading or has failed:

```tsx
function TextScreen() {
  const { data, error, isPending, isError } = useQuery({
    queryKey: ['text'],
    queryFn: fetchText,
  });

  if (isPending) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;
  return <pre>{data}</pre>;
}
```

This is how Kiss does it (see [Wait, fail, succeed](../basics/wait-fail-succeed)):

```tsx
function TextScreen() {
  const text = useSelect((state: State) => state.text);
  const isWaiting = useIsWaiting(LoadText);
  const isFailed = useIsFailed(LoadText);
  const error = useExceptionFor(LoadText);

  if (isWaiting) return <div>Loading...</div>;
  if (isFailed) return <div>Error: {error?.message}</div>;
  return <pre>{text}</pre>;
}
```

Note `useIsFailed` is true for any error, but `useExceptionFor` only returns `UserException`s.
To have a message for other errors too, like a failed fetch, the action turns them into
`UserException`s in `wrapError()`:

```tsx
class LoadText extends Action {
  async reduce() { ... }

  wrapError(error: any) {
    return (error instanceof UserException)
      ? error
      : new UserException('Failed to load the text.', { hardCause: error });
  }
}
```

One difference: TanStack Query ties the component to the query. The component that calls
`useQuery` is the one that fetches, so one component can't easily know if a query started by
**another** component is loading. In Kiss, `useIsWaiting(LoadText)` and `useIsFailed(LoadText)`
work in any component, no matter which one dispatched the action.

### First load and refresh

TanStack Query separates `isPending` (there is no data yet) from `isFetching` (a request is
running, maybe while the old data is shown). This lets you show a big spinner on the first
load, and a small one on a refresh:

```tsx
const { data, isPending, isFetching } = useQuery({ queryKey: ['text'], queryFn: fetchText });

if (isPending) return <Spinner />;
return <>{isFetching && <SmallSpinner />}<pre>{data}</pre></>;
```

In Kiss the data is in the state, so the component just looks at it. On the first load the
state is still empty. On a refresh, it already has data:

```tsx
const text = useSelect((state: State) => state.text);
const isWaiting = useIsWaiting(LoadText);

if (text === null) return <Spinner />;
return <>{isWaiting && <SmallSpinner />}<pre>{text}</pre></>;
```

### Status per key

TanStack Query's status is per query key: `isPending` for user 1 is separate from user 2:

```tsx
const { isPending } = useQuery({ queryKey: ['user', userId], queryFn: () => api.loadUser(userId) });
```

Kiss's `useIsWaiting(LoadUser)` is true while **any** `LoadUser` runs. To get the status of
one user, give the action a `statusKey`, and pass the same value to the hooks:

```tsx
class LoadUser extends Action {
  constructor(readonly userId: string) { super(); }
  get statusKey() { return this.userId; }
  async reduce() { ... }
}

const isWaiting = useIsWaiting(LoadUser, { statusKey: userId });
const isFailed = useIsFailed(LoadUser, { statusKey: userId });
const error = useExceptionFor(LoadUser, { statusKey: userId });
```

See [Status per key](../basics/wait-fail-succeed#status-per-key).

## Suspense and error boundaries

If you use `useSuspenseQuery` and `throwOnError`, with `<Suspense>` and error boundaries:

```tsx
function UserName({ userId }: { userId: string }) {
  const { data: user } = useSuspenseQuery({ queryKey: ['user', userId], queryFn: () => api.loadUser(userId) });
  return <p>{user.name}</p>;
}
```

Kiss has `useSuspense(LoadUser)`. It suspends the component while `LoadUser` runs, and throws
the error to the nearest error boundary if it failed. The data is read from the state, as
always:

```tsx
function UserName({ userId }: { userId: string }) {
  useSuspense(LoadUser, { statusKey: userId });
  const user = useSelect((state: State) => state.users[userId]);
  return <p>{user.name}</p>;
}
```

In both cases, the component goes inside a `<Suspense>` and an error boundary:

```tsx
<ErrorBoundary fallback={<p>Loading failed.</p>}>
  <Suspense fallback={<Spinner />}>
    <UserName userId={userId} />
  </Suspense>
</ErrorBoundary>
```

Pass `{ throwErrors: false }` to only suspend, and handle the failure with `useIsFailed`. See
[Suspense and error boundaries](../basics/wait-fail-succeed#suspense-and-error-boundaries).

## Caching and stale data

TanStack Query assumes the server, not the frontend, owns the data. When your component needs
data, the library gives it from the cache if it's fresh, and fetches it from the server if it's
stale. The `staleTime` option says for how long the data is fresh. The default is 0 seconds, so
by default a query fetches again every time a component uses it:

```tsx
useQuery({ queryKey: ['text'], queryFn: fetchText, staleTime: 5000 });
```

Kiss needs no cache, because the state has all the information. It assumes both the frontend
and the server own some of the data, and helps you keep them in sync. When your component
needs data, it reads the state, synchronously. When the data is stale, you dispatch an action
that fetches it again and puts it in the state.

Kiss has the same default as TanStack Query (an action runs every time it's dispatched), but
uses the [fresh](../advanced-actions/control-features#fresh) feature. Each action decides for
how long its data is fresh. With `fresh = 5000`, its data is fresh for 5 seconds. Dispatching
it again in that time does nothing:

```tsx
class LoadText extends Action {
  fresh = 5000;
  async reduce() { ... }
}
```

If the action fails, its data is not fresh, so the next dispatch runs right away.

In TanStack Query, the `queryKey` separates the data of different things (user 1, user 2):

```tsx
useQuery({ queryKey: ['user', userId], queryFn: () => api.loadUser(userId), staleTime: 5000 });
```

In Kiss, the action's parameters do that. Override `freshKeyParams()` to give each user their
own fresh period:

```tsx
class LoadUser extends Action {
  constructor(readonly userId: string) { super(); }
  fresh = 5000;
  freshKeyParams() { return this.userId; }
  async reduce() { ... }
}
```

## Deduplication

TanStack Query deduplicates queries by their **query key**. If a page has 3 components that
use the same query key, only one request is made:

```tsx
function Header() { const { data } = useQuery({ queryKey: ['todos'], queryFn: api.loadTodos }); ... }
function List()   { const { data } = useQuery({ queryKey: ['todos'], queryFn: api.loadTodos }); ... }
```

In Kiss this is not necessary, because the components read the state, not the server. When you
enter the page, one component dispatches the action that fetches the list and puts it in the
state. The other components read the list from the state:

```tsx
function TodosPage() {
  useStoreEffect({ onMount: (store) => store.dispatch(new LoadTodos()) });
  return <><Header /><List /></>;
}

function Header() { const todos = useSelect((state: State) => state.todos); ... }
function List()   { const todos = useSelect((state: State) => state.todos); ... }
```

If you still need to prevent an action from running twice at the same time, add
[nonReentrant](../advanced-actions/control-features#nonreentrant) to it:

```tsx
class LoadTodos extends Action {
  nonReentrant = true;
  async reduce() { ... }
}
```

## Debouncing and throttling

TanStack Query has no debouncing or throttling. In Kiss, use the
[debounce](../advanced-actions/control-features#debounce) feature to limit how often an action
runs when it's dispatched many times in a row, like when the user types in a search box:

```tsx
class SearchText extends Action {
  constructor(readonly text: string) { super(); }
  debounce = 300;
  async reduce() { ... }
}
```

And the [throttle](../advanced-actions/control-features#throttle) feature to run an action at
most once in a period, no matter how many times it's dispatched:

```tsx
class LoadPrices extends Action {
  throttle = 1000;
  async reduce() { ... }
}
```

## Keeping the old data while the new one loads

In TanStack Query, when the query key changes (the user picks another page or filter), the
`data` becomes `undefined` until the new data arrives, unless you use
`placeholderData: keepPreviousData`:

```tsx
useQuery({
  queryKey: ['items', page],
  queryFn: () => api.items(page),
  placeholderData: keepPreviousData,
});
```

In Kiss, the state keeps the old data until the action puts the new one there. Nothing becomes
`undefined`. The only risk is a slow old request finishing **after** a newer one, and
overwriting the newer data. The [ignoreOld](../advanced-actions/control-features#ignoreold)
feature prevents that: when the action is dispatched again, the older ones still running are
ignored, and their requests are cancelled:

```tsx
class LoadPage extends Action {
  constructor(readonly page: number) { super(); }
  ignoreOld = true;

  async reduce() {
    const response = await fetch(`/api/items?page=${this.page}`, { signal: this.abortSignal });
    const items = await response.json();
    return (state: State) => state.copy({ items });
  }
}
```

## Refetching

TanStack Query fetches a query again by itself, in four situations: when a component mounts
(`refetchOnMount`), when the user comes back to the browser tab (`refetchOnWindowFocus`), when
the internet comes back (`refetchOnReconnect`), and at intervals (`refetchInterval`). The
first three are on by default, and only fetch if the data is stale:

```tsx
useQuery({
  queryKey: ['text'],
  queryFn: fetchText,
  staleTime: 10000,
  refetchOnMount: true,        // The default.
  refetchOnWindowFocus: true,  // The default.
  refetchOnReconnect: true,    // The default.
});
```

In Kiss, the component says when to dispatch the action, with
[useStoreEffect](../basics/hooks-to-dispatch-actions#dispatching-when-the-app-is-focused-or-online-again).
And the action says if the data is still fresh, with `fresh`:

```tsx
function TextScreen() {
  useStoreEffect({
    onMount: (store) => store.dispatch(new LoadText()),
    onFocus: (store) => store.dispatch(new LoadText()),
    onOnline: (store) => store.dispatch(new LoadText()),
  });
  ...
}

class LoadText extends Action {
  fresh = 10000;
  async reduce() { ... }
}
```

This dispatches `LoadText` when the component mounts, when the user comes back to the tab, and
when the internet comes back. But it only fetches if the last fetch was more than 10 seconds
ago. Without `fresh`, it fetches every time, like `refetchOnWindowFocus: 'always'`.

`onFocus` and `onOnline` run only on the transitions (the tab becomes visible, the internet
comes back), never on mount. `onBlur` and `onOffline` run on the opposite transitions.

### Polling

To fetch at intervals, TanStack Query has `refetchInterval`. By default, the interval pauses
while the tab is hidden (`refetchIntervalInBackground: false`):

```tsx
useQuery({ queryKey: ['text'], queryFn: fetchText, refetchInterval: 5000 });
```

In Kiss, use [polling](../advanced-actions/control-features#polling). For example, to fetch
the text every 5 seconds while the component is on screen:

```tsx
function TextScreen() {
  useStoreEffect({
    onMount: (store) => store.dispatch(new LoadText(Poll.start)),
    onUnmount: (store) => store.dispatch(new LoadText(Poll.stop)),
  });
  ...
}

class LoadText extends Action {
  constructor(readonly poll = Poll.once) { super(); }
  pollInterval = 5000;
  createPollingAction() { return new LoadText(); }
  async reduce() { ... }
}
```

Like TanStack Query, the polling pauses while the user is on another tab, and also while the
app is offline. A tick that comes due while the user is away runs as soon as the user comes
back. To poll in the background anyway, set `pollOnlyWhenFocused = false` or
`pollOnlyWhenOnline = false` in the action. See
[Polling only while the app is focused and online](../advanced-actions/control-features#polling-only-while-the-app-is-focused-and-online).

One difference: in TanStack Query, the interval belongs to the query, and runs while any
component uses the query. In Kiss, the polling is started and stopped by the actions you
dispatch. If two components need the same polling, start it in a parent component, or in an
action that runs when the user enters that part of the app.

## Knowing if the app is focused and online

TanStack Query has a `focusManager` and an `onlineManager`. They tell if the tab is visible and
if the app is online, and you can replace where they get it from (for example, in React
Native):

```tsx
import { focusManager, onlineManager } from '@tanstack/react-query';

onlineManager.isOnline();
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));
```

Kiss has `store.isFocused` and `store.isOnline`. In the browser, they follow
`document.visibilityState` and `navigator.onLine`. To show them in a component, use
`useIsFocused()` and `useIsOnline()`:

```tsx
function OfflineBanner() {
  const isOnline = useIsOnline();
  return isOnline ? null : <Banner>You are offline.</Banner>;
}
```

To get them from somewhere else, give `createStore` a `focusSource` or an `onlineSource`. All
the features that depend on them (`onFocus`, `onOnline`, polling, `checkInternet`) follow it:

```tsx
const store = createStore<State>({
  initialState: State.initialState,
  onlineSource: (setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
});
```

See [Where "focused" and "online" come from](../basics/hooks-to-dispatch-actions#where-focused-and-online-come-from).

## Dependent and parallel queries

In TanStack Query, a query that depends on another uses `enabled: false` until the first one
has data:

```tsx
const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => api.loadUser(userId) });
const { data: posts } = useQuery({
  queryKey: ['posts', user?.id],
  queryFn: () => api.loadPosts(user!.id),
  enabled: !!user,
});
```

In Kiss, an action can simply dispatch the next one, or wait for it:

```tsx
class LoadUserAndPosts extends Action {
  constructor(readonly userId: string) { super(); }

  async reduce() {
    await this.dispatchAndWait(new LoadUser(this.userId));
    this.dispatch(new LoadPosts(this.state.user.id));
    return null;
  }
}
```

Or, from a component, with [dispatchWhen](../basics/dispatching-actions#dispatch-when), which
dispatches an action when a state condition becomes true:

```tsx
store.dispatchWhen(new LoadPosts(userId), (state) => state.user !== null);
```

See also [waitCondition](../miscellaneous/wait-for-condition).

For parallel queries, TanStack Query has `useQueries`:

```tsx
useQueries({
  queries: [
    { queryKey: ['user', id], queryFn: () => api.loadUser(id) },
    { queryKey: ['posts', id], queryFn: () => api.loadPosts(id) },
  ],
});
```

In Kiss, use `dispatchAll`, or `dispatchAndWaitAll` to wait for all of them:

```tsx
await store.dispatchAndWaitAll([new LoadUser(id), new LoadPosts(id)]);
```

## Infinite queries

TanStack Query loads a list page by page with `useInfiniteQuery`. You give it the first page
param, a `queryFn` that loads one page, and `getNextPageParam` to get the param of the next
page from the last page loaded. It keeps the pages in `data.pages`, and gives you
`fetchNextPage`, `hasNextPage` and `isFetchingNextPage`:

```tsx
function TodoList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['todos'],
    queryFn: ({ pageParam, signal }) => api.todosAfter(pageParam, 20, signal),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.length < 20 ? null : lastPage.at(-1).id,
  });

  const items = data?.pages.flat() ?? [];
  ...
  <button disabled={!hasNextPage || isFetchingNextPage} onClick={() => fetchNextPage()}>Load more</button>
}
```

In Kiss, extend [LoadPages](../advanced-actions/paged-loading). The same three things go in
the action, with the same names, and the pages go in the state, in a `Pages` value:

```tsx
class LoadTodos extends LoadPages<State, Todo[], string | null> {
  getPagesFromState(state: State) { return state.todos; }
  applyPagesToState(state: State, todos: Pages<Todo[], string | null>) { return state.copy({ todos }); }
  initialPageParam() { return null; }
  loadPage(cursor: string | null) { return api.todosAfter(cursor, 20, this.abortSignal); }
  nextPageParam(lastPage: Todo[]) { return lastPage.length < 20 ? null : lastPage.at(-1)!.id; }
}

function TodoList() {
  useStoreEffect({ onMount: (store) => store.dispatch(new LoadTodos()) });
  const todos = useSelect((state: State) => state.todos);
  const isLoading = useIsWaiting(LoadTodos);
  const dispatch = useDispatch();

  const items = todos.pages.flat();
  ...
  <button disabled={!todos.hasNextPage || isLoading} onClick={() => dispatch(new LoadTodos('next'))}>Load more</button>
}
```

This is how each part translates:

| TanStack Query                                                      | Kiss                                                                                   |
|---------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| `initialPageParam`                                                  | `initialPageParam()`                                                                   |
| `queryFn: ({ pageParam, signal })`                                  | `loadPage(pageParam)`, with `this.abortSignal`                                         |
| `getNextPageParam(lastPage, allPages, lastPageParam, allPageParams)` | `nextPageParam(lastPage, allPages, lastPageParam, allPageParams)`                      |
| `getPreviousPageParam`                                              | `previousPageParam`                                                                    |
| `maxPages`                                                          | `maxPages`                                                                             |
| `data.pages`, `data.pageParams`                                     | `pages.pages`, `pages.pageParams` (the `Pages` value, read from the state)             |
| `hasNextPage`, `hasPreviousPage`                                    | `pages.hasNextPage`, `pages.hasPreviousPage`                                           |
| `fetchNextPage()`, `fetchPreviousPage()`                            | `dispatch(new LoadTodos('next'))`, `dispatch(new LoadTodos('previous'))`               |
| `refetch()` (all the pages again, from the first)                   | `dispatch(new LoadTodos())`, or `dispatch(new LoadTodos('refresh'))`                   |
| `resetQueries` (back to the first page)                             | `dispatch(new LoadTodos('first'))`                                                     |
| `isFetching`, `isFetchingNextPage`                                  | `useIsWaiting(LoadTodos)`                                                              |
| `isError`, `isFetchNextPageError`                                   | `useIsFailed(LoadTodos)`, `useExceptionFor(LoadTodos)`                                 |
| `setQueryData` (to remove an item, etc.)                            | A sync action that puts `pages.copy({ pages: ... })` in the state                      |

The rules are the same. A `'next'` adds the page to the end, and `maxPages` drops the
first page when the limit is passed. A `'refresh'` loads the pages again one after the
other, from the first page param, getting each new param from `nextPageParam`, so the pages
stay consistent, and changes the state once, at the end. `hasNextPage` is `false` when
`nextPageParam` returns `null` or `undefined`. The page param can be a cursor from the
server, the id of the last item, or a page number.

Two differences:

* TanStack Query warns that calling `fetchNextPage` while a fetch is running can overwrite
  the data, and tells you to check `!isFetching` first. Kiss does that for you: a `'next'`
  dispatched while the list is loading is aborted, so two quick taps load one page, and a
  `'first'` or `'refresh'` aborts the loads that are running (like `cancelRefetch: true`).

* The query key separates the lists (the comments of post 1, of post 2). In Kiss, override
  `pagesKeyParams()` to return the post id. It's also the `statusKey`, so
  `useIsWaiting(LoadComments, { statusKey: postId })` tells if that list is loading.

## Prefetching

TanStack Query has `prefetchQuery`, to fetch data before a component needs it (for example,
when the mouse hovers a link). The component that mounts later finds the data in the cache,
still fresh:

```tsx
const queryClient = useQueryClient();

<Link
  onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['user', id], queryFn: () => api.loadUser(id), staleTime: 10000 })}
  to={`/users/${id}`}
/>
```

In Kiss, just dispatch the action early. If the action has `fresh`, the component that mounts
later dispatches it again, and nothing happens, because the data is still fresh:

```tsx
<Link onMouseEnter={() => dispatch(new LoadUser(id))} to={`/users/${id}`} />

class LoadUser extends Action {
  constructor(readonly userId: string) { super(); }
  fresh = 10000;
  freshKeyParams() { return this.userId; }
  async reduce() { ... }
}
```

## Cancelling

TanStack Query gives the `queryFn` a `signal`, and cancels the fetch when the query is
cancelled with `cancelQueries`:

```tsx
useQuery({
  queryKey: ['items', page],
  queryFn: ({ signal }) => fetch(`/api/items?page=${page}`, { signal }).then((r) => r.json()),
});

queryClient.cancelQueries({ queryKey: ['items'] });
```

In Kiss, every action has `this.abortSignal`. Pass it to `fetch` (see the `LoadPage` example
above). Then, call `store.abort` with the action class, for example from a "Cancel" button, or
when the component unmounts:

```tsx
store.abort(LoadPage);                        // All the LoadPage actions in progress.
store.abort(LoadPage, { statusKey: page });   // Only the ones with this statusKey.

useStoreEffect({ onUnmount: (store) => store.abort(LoadPage) });
```

The aborted action finishes silently: its result and errors are ignored, and the state is
unchanged. The signal is also aborted when a newer action of the same class is dispatched
(with `ignoreOld`), and by `action.abort()` on one action. See
[aborting actions](../advanced-actions/aborting-actions).

## Retry

TanStack Query retries a failed query 3 times, silently, with exponential backoff, before it
shows the error:

```tsx
useQuery({
  queryKey: ['text'],
  queryFn: fetchText,
  retry: 3,                                                          // The default.
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),     // The default.
});
```

Kiss doesn't retry by default, but you can turn it on with `retry = { on: true }`. The delays
are set in the same object:

```tsx
class LoadText extends Action {
  retry = { on: true, maxRetries: 3, initialDelay: 1000, multiplier: 2, maxDelay: 30000 };
  async reduce() { ... }
}
```

The defaults are [here](../advanced-actions/control-features#retry).

### Giving up on some errors

Some errors are permanent: a 404, a 401, a validation error from the server. Retrying them
wastes time. In TanStack Query, `retry` can be a function that decides:

```tsx
useQuery({
  queryKey: ['user', userId],
  queryFn: () => api.loadUser(userId),
  retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 3,
});
```

In Kiss, override `shouldRetry(error, attempt)`. It returns `true` by default, for every error:

```tsx
class LoadUser extends Action {
  retry = { on: true, maxRetries: 3 };

  shouldRetry(error: unknown, attempt: number) {
    return !(error instanceof NotFoundError);
  }

  async reduce() { ... }
}
```

When it returns `false`, the action fails right away with that error. It also works with
`unlimitedRetryCheckInternet` (see below), where it's the only way to stop an action that would
otherwise retry forever. See [Giving up on some errors](../advanced-actions/control-features#giving-up-on-some-errors).

## Offline

TanStack Query has a `networkMode` option. With the default, `'online'`, a query doesn't run
while the app is offline. It's paused, and runs when the internet comes back:

```tsx
useQuery({ queryKey: ['text'], queryFn: fetchText, networkMode: 'online' }); // The default.
```

Kiss has two [internet features](../advanced-actions/internet-features) for this. With
`checkInternet`, the action fails (or is aborted) if there is no internet. With
`unlimitedRetryCheckInternet`, the action waits for the internet, and runs when it's back. It
also retries if the action fails:

```tsx
class LoadText extends Action {
  checkInternet = true;
  async reduce() { ... }
}

class SaveNote extends Action {
  unlimitedRetryCheckInternet = true;
  async reduce() { ... }
}
```

Also, `onOnline` in `useStoreEffect` dispatches an action when the internet comes back, and
polling pauses while offline, by default (see [Refetching](#refetching)). To show an "offline"
banner, use `useIsOnline()`. In React Native, give `createStore` an `onlineSource`, and all of
the above follow it (see [Knowing if the app is focused and online](#knowing-if-the-app-is-focused-and-online)).

## Mutations

In TanStack Query, changing data on the server is a **mutation**, with `useMutation`. It gives
you `mutate`, `isPending`, `isError`, and callbacks like `onSuccess`, `onError` and
`onSettled`:

```tsx
function SaveButton({ text }: { text: string }) {
  const { mutate, isPending, isError } = useMutation({
    mutationFn: (text: string) => api.saveText(text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['text'] }),
    onError: (error) => showError(error),
    onSettled: () => log('done'),
  });

  return <button onClick={() => mutate(text)} disabled={isPending}>Save</button>;
}
```

In Kiss, a mutation is just an action. It sends the change to the server in `reduce()`, and
changes the state when the server answers. That's the `onSuccess`. The `wrapError()` method
is the `onError`, and `after()` is the `onSettled`, since it always runs. The component shows
the progress with `useIsWaiting(SaveText)` and `useIsFailed(SaveText)`, like for any action:

```tsx
class SaveText extends Action {
  constructor(readonly text: string) { super(); }

  async reduce() {
    await api.saveText(this.text);
    return (state: State) => state.copy({ text: this.text }); // onSuccess.
  }

  wrapError(error: any) { return new UserException('Could not save.', { hardCause: error }); } // onError.
  after() { log('done'); } // onSettled.
}

function SaveButton({ text }: { text: string }) {
  const dispatch = useDispatch();
  const isSaving = useIsWaiting(SaveText);
  return <button onClick={() => dispatch(new SaveText(text))} disabled={isSaving}>Save</button>;
}
```

A `UserException` returned by `wrapError()` is shown to the user in a dialog, by default, so
you don't need the `showError` call.

### Optimistic updates

In TanStack Query, an optimistic update is done by hand, in `onMutate`: you cancel the queries
in flight, save the old data, change the cache, and put the old data back in `onError`:

```tsx
useMutation({
  mutationFn: (todo: Todo) => api.addTodo(todo),
  onMutate: async (todo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previous = queryClient.getQueryData<Todo[]>(['todos']);
    queryClient.setQueryData<Todo[]>(['todos'], (old) => [...(old ?? []), todo]);
    return { previous };
  },
  onError: (_error, _todo, context) => queryClient.setQueryData(['todos'], context?.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
});
```

In Kiss, there are ready-made action classes, so you don't write the rollback by hand. See
[Optimistic features](../advanced-actions/optimistic-features):

```tsx
class AddTodo extends OptimisticCommand<State, Todo[]> {
  constructor(readonly todo: Todo) { super(); }

  optimisticValue() { return [...this.state.todos, this.todo]; }
  getValueFromState(state: State) { return state.todos; }
  applyValueToState(state: State, todos: Todo[]) { return state.copy({ todos }); }
  sendCommandToServer() { return api.addTodo(this.todo); }
  reloadFromServer() { return api.loadTodos(); }
}
```

* [OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand): for commands
  like "add a todo" or "send a message". It changes the state right away, sends the command to
  the server, and puts the old state back if the command fails. It can also reload the value
  from the server, with `reloadFromServer()`.

* [OptimisticSync](../advanced-actions/optimistic-features#optimisticsync): for values that
  change fast, like a "like" button. Every click changes the state right away, but only one
  request at a time goes to the server, with the latest value.

* [OptimisticSyncWithPush](../advanced-actions/optimistic-features#optimisticsyncwithpush-and-serverpush):
  the same, for apps where the server also pushes changes (WebSockets, Firebase), and more than
  one device can change the same value.

### One mutation at a time

In TanStack Query, mutations with the same `scope` id run one after the other:

```tsx
useMutation({ mutationFn: (todo: Todo) => api.saveTodo(todo), scope: { id: 'todos' } });
```

In Kiss, use the [sequential](../advanced-actions/control-features#sequential) feature. The
actions of the class run one after the other, in the order they were dispatched:

```tsx
class SaveTodo extends Action {
  sequential = true;
  async reduce() { ... }
}
```

## Invalidation

In TanStack Query, after a mutation, you call `invalidateQueries` to mark the related queries
as stale, so they fetch again. This is needed because the library owns the cache, and the
mutation doesn't know what's in it:

```tsx
useMutation({
  mutationFn: (text: string) => api.saveText(text),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['texts'] }),
});
```

Kiss doesn't need this. The action that saves already knows what to reload, and does it right
away:

```tsx
class SaveText extends Action {
  constructor(readonly text: string) { super(); }

  async reduce() {
    await api.saveText(this.text);
    this.dispatch(new LoadTexts());
    return null;
  }
}
```

If `LoadTexts` uses `fresh`, give it a `force` parameter, and override `ignoreFresh` to return
it (see [Forcing the action to run](../advanced-actions/control-features#forcing-the-action-to-run)).

The optimistic classes do it for you: an `OptimisticCommand` reloads the value with
`reloadFromServer()`, an `OptimisticSync` can reload in `onFinish`, and an
`OptimisticSyncWithPush` gets the changes pushed by the server, so there is nothing to reload.

## Changing the data by hand

TanStack Query lets you change the cache directly, with `setQueryData`:

```tsx
queryClient.setQueryData<Todo[]>(['todos'], (old) => old?.filter((todo) => todo.id !== id));
```

In Kiss, that's a sync action, which changes the state and nothing else:

```tsx
class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }

  reduce() {
    return (state: State) => state.copy({ todos: state.todos.filter((todo) => todo.id !== this.id) });
  }
}
```

## A global loading indicator

TanStack Query has `useIsFetching` and `useIsMutating`, for a top progress bar that shows while
anything is loading:

```tsx
const isFetching = useIsFetching();
```

In Kiss, list the actions the bar should show:

```tsx
// One hook per line. Writing `useIsWaiting(A) || useIsWaiting(B)` would break the rules of hooks.
const isLoadingUser = useIsWaiting(LoadUser);
const isLoadingPosts = useIsWaiting(LoadPosts);
const isLoading = isLoadingUser || isLoadingPosts;
```

This is on purpose. In TanStack Query, the library owns every request, so counting them makes
sense. In Kiss, actions are not only requests: a global count would mix the actions that load
data with the ones that save, poll, sync, or just change the state, and the bar would blink
for things the user doesn't care about. For the rare case that really needs the global count,
`store.actionsInProgress()` returns all the actions in progress.

## Server-side rendering

TanStack Query renders on the server by prefetching the queries, serializing the cache with
`dehydrate`, and giving it to the client with `HydrationBoundary`:

```tsx
export default async function UserPage({ params }) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({ queryKey: ['user', params.id], queryFn: () => api.loadUser(params.id) });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserView />
    </HydrationBoundary>
  );
}
```

In Kiss, you create one store per request, and render with the state. The state travels to
the client as JSON, and the client creates its store with it. In Next.js, each route loads its
data on the server, and puts it in the store with `StoreSlice`:

```tsx
export default async function UserPage({ params }) {
  const user = await api.loadUser(params.id);
  return (
    <StoreSlice state={{ user }} key={`${user.id}:${user.updatedAt}`}>
      <UserView />
    </StoreSlice>
  );
}
```

On the server, TanStack Query never polls (`refetchInterval` belongs to the component
subscription, created in an effect, which the server never runs) and turns retries off
(`retry` is 0 there). Kiss does the same in the store that loads the data of a request, created
with `server: true`: `Poll.start` runs the action once, `retry` and
`unlimitedRetryCheckInternet` run the reducer once, and `debounce` runs it right away. In both
libraries, the server does explicit loads and nothing else, and the persisted data (TanStack's
`PersistQueryClientProvider`, Kiss's persistor) is restored in the browser, after hydration.

See [Server-side rendering](../miscellaneous/server-side-rendering).

## Persistence

TanStack Query can persist the cache with `persistQueryClient`:

```tsx
const persister = createSyncStoragePersister({ storage: window.localStorage });

<PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
  <App />
</PersistQueryClientProvider>
```

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state
as it changes, and loads it when the app starts. It works with plain objects and with class
instances:

```tsx
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});
```

## Clearing the data

TanStack Query clears the whole cache with `queryClient.clear()`, or some queries with
`removeQueries`. Unused data is also forgotten by itself, after `gcTime`:

```tsx
queryClient.clear();
queryClient.removeQueries({ queryKey: ['user'] });
```

In Kiss, the state is explicit, so you decide what to clear and when. To clear everything when
the user logs out, call `store.logOut()`, which resets the state and forgets all the fresh
periods, failures and polling. To clear a part of the state, dispatch a sync action:

```tsx
await store.logOut({ initialState: State.initialState });

class ClearUser extends Action {
  reduce() { return (state: State) => state.copy({ user: null }); }
}
```

There is no `gcTime`, because nothing is kept apart from what you put in the state. To free
memory when a screen is left, dispatch a clean-up action in `onUnmount`.

## Devtools

TanStack Query has a devtools panel that shows the queries and their status. Kiss has no UI
for this, but you can log every action and every state change, with `actionObserver` and
`stateObserver` in `createStore`:

```tsx
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'start' : 'end', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

## Testing

In TanStack Query, the queries and mutations are declared inside components. So the logic
lives in the UI tree, and testing it means rendering components, with a `QueryClientProvider`
around them, and waiting for the hooks to settle. That is more work, and slower.

In Kiss, the logic lives in actions, and actions don't need components. You create a store,
dispatch the action, wait for it, and check the state. No rendering. Kiss also has many
features to [help you test](../category/testing) your actions:

```ts
// Start with some IBM stocks.
const store = new Store<State>({ initialState: new State({ portfolio: ['IBM'] }) });

// Buy Tesla stocks.
await store.dispatchAndWait(new BuyAction('TSLA'));

// Check we now have IBM and Tesla.
expect(store.state.portfolio).toEqual(['IBM', 'TSLA']);
```

To simulate the app going offline or to another tab, TanStack Query has:

```ts
onlineManager.setOnline(false);
focusManager.setFocused(false);
```

Kiss has the same in the store:

```ts
store.setOnline(false);  // Actions with checkInternet now fail with "No Internet".
store.setFocused(false); // The user went to another tab.
store.setFocused(true);  // The user came back: the onFocus callbacks run.
```

## SWR

[SWR](https://swr.vercel.app), by Vercel, is built on the same idea as TanStack Query: a hook
with a key and a function that fetches, a cache that the library owns, and new fetches when a
component mounts, when the user comes back to the tab, when the internet comes back, and at
intervals. The key is often the URL itself. SWR is smaller, with fewer options, and no devtools:

```tsx title="SWR"
import useSWR from 'swr';

function TextScreen() {
  const { data, error, isLoading, isValidating } = useSWR('/api/text', fetcher, {
    refreshInterval: 10000,
  });

  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <>{isValidating && <SmallSpinner />}<pre>{data}</pre></>;
}
```

The Kiss version is the same as in [First load and refresh](#first-load-and-refresh), with
[polling](#polling) for the `refreshInterval`. Everything in
[The big difference](#the-big-difference) applies to SWR as it does to TanStack Query: the cache
is for server data only, the loading rules are options in each component, and the cache has no
shape of its own. With SWR, the keys are usually URLs, so the components also know the
endpoints of your API.

This is how SWR translates to Kiss:

| SWR                                                                     | Kiss                                                                    |
|-------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `useSWR(key, fetcher)`                                                  | An async action that puts the data in the state, and `useSelect`        |
| The `key`                                                               | The action class, and its constructor parameters                        |
| A `null` key (don't fetch yet)                                          | Don't dispatch yet; or `dispatchWhen`                                   |
| `isLoading` (no data yet)                                               | The state has no data yet, and `useIsWaiting(Action)`                   |
| `isValidating` (any fetch, also a refresh)                              | `useIsWaiting(Action)`                                                  |
| `error`                                                                 | `useIsFailed(Action)`, `useExceptionFor(Action)`                        |
| `dedupingInterval` (2 seconds, by default)                              | `fresh`, `nonReentrant`                                                 |
| `revalidateOnMount`, `revalidateIfStale`                                | `useStoreEffect({ onMount })`                                           |
| `revalidateOnFocus`, `revalidateOnReconnect` (on, by default)           | `useStoreEffect({ onFocus, onOnline })`                                 |
| `refreshInterval`                                                       | Polling: `pollInterval`, `Poll.start`, `Poll.stop`                      |
| `refreshWhenHidden`, `refreshWhenOffline` (off, by default)             | `pollOnlyWhenFocused`, `pollOnlyWhenOnline` (on, by default)            |
| `shouldRetryOnError`, `errorRetryCount`, `onErrorRetry` (on, by default) | `retry`, `shouldRetry` (off, by default)                               |
| `keepPreviousData`                                                      | `ignoreOld` (the state keeps the old data until the new one arrives)    |
| `suspense: true`                                                        | `useSuspense(Action)`                                                   |
| `fallbackData`, the `fallback` of `SWRConfig`                           | The `initialState`; `serverState` and `StoreSlice` on the server       |
| `mutate(key, data)` (change the cache)                                  | A sync action                                                           |
| `mutate(key)` (fetch again)                                             | Dispatch the action again                                               |
| `useSWRMutation`, `trigger`, `isMutating`                               | An action, and `useIsWaiting(Action)`                                   |
| `optimisticData`, `rollbackOnError`                                     | `OptimisticCommand`, `OptimisticSync`                                   |
| `useSWRInfinite`, `size`, `setSize`                                     | `LoadPages`                                                             |
| `SWRConfig` (options for all the hooks)                                 | A [base action](../advanced-actions/base-action-with-common-logic)      |
| Debounce, throttle, run one at a time (not in SWR)                      | `debounce`, `throttle`, `sequential`                                    |

The sections above explain each Kiss feature, with code.

## Why this matters

Line by line, the Kiss code is about as short as the TanStack Query code. The gain is in where
the decisions live:

* **One place for the rules.** Freshness, retry, polling, and deduplication are declared on
  the action. You read one class and you know how that data is loaded.
* **One shape for the data.** Server data and client state live in the same `State` class.
  You can see how the pieces relate, and you can change the shape when the app grows.
* **Logic outside the UI.** Loading, transforming, saving, and reloading all happen in
  actions, so none of it depends on which components are mounted, and all of it can be tested
  without rendering.
* **It stays simple when the app grows.** An app that only shows server data is easy either
  way. When the app gets client logic, Kiss has a place for it, and TanStack Query doesn't.

## When an AI agent writes the code

When your agent writes the code and you review it, this is what changes:

* **The rules live in one place.** In TanStack Query, `staleTime`, `retry`, and
  `refetchInterval` are repeated in each `useQuery` call. Your agent writes each call on its
  own, so the same data can get different rules in different components, or in different
  sessions. In Kiss, `fresh`, `retry`, and `pollInterval` are declared once, on the action. To
  check them, you read one class, not every component that uses the data.
* **Client state has a home too.** With TanStack Query, your agent still has to decide where
  client state goes: `useState`, a context, or a second library. It may decide differently each
  time. In Kiss, client state goes in the same `State` class as the server data, so there is
  nothing to decide.
* **Checks it can run itself.** The logic is in actions, not in components, so your agent tests
  it with `dispatchAndWait`, with no rendering and no `QueryClientProvider` (see
  [Testing](#testing)), and runs the test on its own. With the
  [Kiss ESLint plugin](../getting-started/intro.md#linter), it also runs `npx eslint` to find
  mistakes that compile fine, like `retry` on an action whose `reduce` is sync, and fixes them
  before you see the code.
* **Where TanStack Query is ahead.** It has an official ESLint plugin
  (`@tanstack/eslint-plugin-query`), and a devtools panel. It's also very widely used, so your
  agent has seen far more of it than of Kiss, and writes it fluently. Kiss makes up for the
  training data with the [single-file docs](../getting-started/intro.md#docs), its own linter,
  and the code already in your project, which shows your agent the pattern to follow. See also
  [Claude's own take](../getting-started/claude-opinion-kiss.md#react-query-tanstack-query).

---

Give it a try: [follow the tutorial](../tutorial/setting-up-the-store), or
[give your agent the docs](../getting-started/intro.md#docs) and ask it to rewrite one of your
queries with Kiss.
