---
sidebar_position: 2
---

# Comparing with TanStack Query

This page is for people who know TanStack Query (also called React Query). It shows how to get
the same results with Kiss, which does things in a different way.

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

## Not only queries

While Redux ignores async processes, leaving them to middleware (like thunks), TanStack Query
takes the opposite approach, treating all state management as querying, fetching, and caching.

In my opinion, viewing state management in terms of queries is the **wrong abstraction**. See
this article in
Medium: [What I learned from React-Query, and why I will not use it in my next project](https://medium.com/duda/what-i-learned-from-react-query-and-why-i-will-not-use-it-in-my-next-project-a459f3e91887)

Kiss manages state through a synchronous global state, and actions that can be sync or async.
Actions can fetch data, but they can also change the state in any other way. Actions can fail
or succeed. You can wait for them to finish, retry them, debounce them, throttle them, and do
optimistic updates.

|                           | TanStack Query | Redux Toolkit    | Kiss                |
|---------------------------|----------------|------------------|---------------------|
| Sync processes            | No             | Actions/Reducers | Actions/Reducers    |
| Async processes           | Queries        | Thunks           | Actions/Reducers    |
| Global local state        | No             | Yes              | Yes                 |
| Local persistence         | No             | Objects          | Objects and classes |
| Loading and failed states | Yes            | No               | Yes                 |
| Deduplication             | Yes            | No               | Yes                 |
| Smart refetches           | Yes            | No               | Yes                 |
| Retry                     | Yes            | No               | Yes                 |
| Optimistic updates        | Manual         | No               | Yes                 |
| Server-side rendering     | Yes            | Yes              | Yes                 |

## Quick translation

If you know TanStack Query, this table tells you where to look in Kiss. The sections below
explain each line.

| TanStack Query                                     | Kiss                                                                                   |
|----------------------------------------------------|----------------------------------------------------------------------------------------|
| `useQuery` with a `queryFn`                        | An async action, whose `reduce()` fetches the data and puts it in the state             |
| The cache                                          | The state                                                                              |
| `queryKey`                                         | The action class, and its constructor parameters                                       |
| `data`                                             | `useSelect((state) => state.something)`                                                |
| `isPending`, `isError`, `error`                    | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`               |
| `staleTime`                                        | `fresh`                                                                                |
| `refetchOnMount`                                   | `useStoreEffect({ onMount })`                                                          |
| `refetchOnWindowFocus`                             | `useStoreEffect({ onFocus })`                                                          |
| `refetchOnReconnect`                               | `useStoreEffect({ onOnline })`                                                         |
| `refetchInterval`                                  | Polling: `pollInterval`, `Poll.start`, `Poll.stop`                                     |
| `refetchIntervalInBackground: false`               | `pollOnlyWhenFocused` (the default)                                                    |
| `enabled: false`, dependent queries                | Don't dispatch; or `dispatchWhen`, `waitCondition`                                     |
| `useQueries`                                       | `dispatchAll`, `dispatchAndWaitAll`                                                    |
| `placeholderData: keepPreviousData`                | `ignoreOld` (the state keeps the old data until the new one arrives)                   |
| `initialData`                                      | The `initialState` of the store                                                        |
| `select`                                           | `useSelect`, `useObject`                                                               |
| `prefetchQuery`                                    | Dispatch the action early (for example, on mouse hover), with `fresh`                  |
| `signal` in the `queryFn`                          | `this.abortSignal`, with `ignoreOld`                                                   |
| `retry`, `retryDelay`                              | `retry`                                                                                |
| `networkMode`, `onlineManager`                     | `checkInternet`, `unlimitedRetryCheckInternet`, `store.isOnline`, `useIsOnline()`      |
| `useMutation`                                      | An action (sync or async)                                                              |
| `onMutate` and rollback (optimistic update)        | `OptimisticCommand`, `OptimisticSync`, `OptimisticSyncWithPush`                        |
| `invalidateQueries`                                | Not needed: the action that saves reloads what it needs (see below)                    |
| `setQueryData`                                     | A sync action                                                                          |
| `useIsFetching`                                    | `store.actionsInProgress()`                                                            |
| `dehydrate`, `hydrate`, `HydrationBoundary`        | `serverState`, `StoreSlice`                                                            |
| `persistQueryClient`                               | The persistor                                                                          |
| `onlineManager.setOnline(false)` in tests          | `store.setOnline(false)`, `store.forceInternetOnOffSimulation`                         |
| `QueryClient.clear()`                              | `store.logOut()`, `store.clearInternalActionProps()`                                   |

## Global local state

TanStack Query has a shared cache for all queries. The cache is global sync state, but it's an
implementation detail for handling fresh and stale data. It's not meant for direct access.
That's why the table above says TanStack Query has no "global local state".

If we want to abuse the cache as local state, we can do something like this:

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

You have to manage globally unique keys by hand (like `'count'` above), so that they don't
repeat, and use `initialData`. And there is no type safety when calling `setQueryData`.

Kiss has a global local state that is **meant** for direct access:

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

## Caching and stale data

TanStack Query assumes the server, not the frontend, owns the data. When your component needs
data, the library gives it from the cache if it's fresh, and fetches it from the server if it's
stale.

Kiss needs no cache, because the state has all the information. It assumes both the frontend
and the server own some of the data, and helps you keep them in sync. When your component
needs data, it reads the state, synchronously. When the data is stale, you dispatch an action
that fetches it again and puts it in the state.

TanStack Query has a `staleTime` option to say for how long the data is fresh. The default is
0 seconds, so by default a query fetches again every time a component uses it. Kiss has the
same default, but uses the [fresh](../advanced-actions/control-features#fresh) feature. Each
action decides for how long its data is fresh.

Without `fresh`, an action runs every time it's dispatched:

```tsx
class LoadText extends Action {
  async reduce() { ... }
}
```

With `fresh = 5000`, its data is fresh for 5 seconds. Dispatching it again in that time does
nothing:

```tsx
class LoadText extends Action {
  fresh = 5000;
  async reduce() { ... }
}
```

If the action fails, its data is not fresh, so the next dispatch runs right away.

In TanStack Query, the `queryKey` separates the data of different things (user 1, user 2). In
Kiss, the action's parameters do that. Override `freshKeyParams()` to give each user their own
fresh period:

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
show parts of a list, with the same query key, only one request is made.

In Kiss this is not necessary, because the components read the state, not the server. When you
enter the page, one component dispatches the action that fetches the list and puts it in the
state. The 3 components read the list from the state.

If you still need to prevent an action from running twice at the same time, add
[nonReentrant](../advanced-actions/control-features#nonreentrant) to it:

```tsx
class LoadText extends Action {
  nonReentrant = true;
  async reduce() { ... }
}
```

## Debouncing

TanStack Query has no debouncing. In Kiss, use the
[debounce](../advanced-actions/control-features#debounce) feature to limit how often an action
runs when it's dispatched many times in a row, like when the user types in a search box:

```tsx
class SearchText extends Action {
  constructor(readonly text: string) { super(); }
  debounce = 300;
  async reduce() { ... }
}
```

## Keeping the old data while the new one loads

In TanStack Query, when the query key changes (the user picks another page or filter), the
`data` becomes `undefined` until the new data arrives, unless you use
`placeholderData: keepPreviousData`.

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
first three only fetch if the data is stale.

In Kiss, the component says when to dispatch the action, with
[useStoreEffect](../basics/hooks-to-dispatch-actions#dispatching-when-the-component-mounts).
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

To fetch at intervals, use [polling](../advanced-actions/control-features#polling). For
example, to fetch the text every 5 seconds while the component is on screen:

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

Like TanStack Query (`refetchIntervalInBackground: false`), the polling pauses while the user
is on another tab, and also while the app is offline. A tick that comes due while the user is
away runs as soon as the user comes back. See
[Polling only while the app is focused and online](../advanced-actions/control-features#polling-only-while-the-app-is-focused-and-online).

One difference: in TanStack Query, the interval belongs to the query, and runs while any
component uses the query. In Kiss, the polling is started and stopped by the actions you
dispatch. If two components need the same polling, start it in a parent component, or in an
action that runs when the user enters that part of the app.

## Dependent and parallel queries

In TanStack Query, a query that depends on another uses `enabled: false` until the first one
has data. In Kiss, an action can simply dispatch the next one, or wait for it:

```tsx
class LoadUserAndPosts extends Action {
  async reduce() {
    await this.dispatchAndWait(new LoadUser(this.userId));
    this.dispatch(new LoadPosts(this.state.user.id));
    return null;
  }
}
```

Or, from a component, with [dispatchWhen](../basics/dispatching-actions#dispatch-when), which
dispatches an action when a state condition becomes true. See also
[waitCondition](../miscellaneous/wait-for-condition).

For parallel queries (`useQueries`), use `dispatchAll` or `dispatchAndWaitAll`:

```tsx
await store.dispatchAndWaitAll([new LoadUser(id), new LoadPosts(id), new LoadComments(id)]);
```

## Prefetching

TanStack Query has `prefetchQuery`, to fetch data before a component needs it (for example,
when the mouse hovers a link). In Kiss, just dispatch the action early. If the action has
`fresh`, the component that mounts later dispatches it again, and nothing happens, because the
data is still fresh:

```tsx
<Link onMouseEnter={() => dispatch(new LoadUser(id))} to={`/users/${id}`}>
```

## Cancelling

TanStack Query gives the `queryFn` a `signal`, and cancels the fetch when the query is
cancelled. In Kiss, an action with `ignoreOld` has `this.abortSignal`, which is aborted when a
newer action of the same class is dispatched. Pass it to `fetch` (see the `LoadPage` example
above).

## Retry

TanStack Query retries a failed query 3 times, silently, with exponential backoff, before it
shows the error. Kiss doesn't retry by default, but you can turn it on with `retry = {on: true}`:

```tsx
class LoadText extends Action {
  retry = { on: true };
  async reduce() { ... }
}
```

You can set `initialDelay`, `multiplier`, `maxRetries` and `maxDelay`. The defaults
are [here](../advanced-actions/control-features#retry).

## Offline

TanStack Query has an `onlineManager`, and a `networkMode` option that pauses queries while
offline, and resumes them when the internet comes back.

Kiss has `store.isOnline` (in the browser, `navigator.onLine`), and `useIsOnline()` to show an
"offline" banner. Actions use it through these
[internet features](../advanced-actions/internet-features):

* `checkInternet`: the action fails (or is aborted) if there is no internet.
* `unlimitedRetryCheckInternet`: the action waits for the internet, and runs when it's back.
  It also retries if the action fails.
* `onOnline` in `useStoreEffect`: dispatches an action when the internet comes back.
* Polling pauses while offline, by default.

In React Native, give `createStore` an `onlineSource` (with `NetInfo`), and all of the above
follow it. See
[Where "focused" and "online" come from](../basics/hooks-to-dispatch-actions#where-focused-and-online-come-from).

## Mutations

In TanStack Query, changing data on the server is a **mutation**, with `useMutation`. It gives
you `mutate`, `isPending`, `isError`, and callbacks like `onSuccess` and `onError`. An
optimistic update is done by hand, in `onMutate`: you save the old data, change the cache, and
put the old data back in `onError`.

In Kiss, a mutation is just an action. It sends the change to the server in `reduce()`, and
changes the state when the server answers. The component shows the progress with
`useIsWaiting(SaveText)` and `useIsFailed(SaveText)`, like for any action:

```tsx
class SaveText extends Action {
  constructor(readonly text: string) { super(); }

  async reduce() {
    await api.saveText(this.text);
    return (state: State) => state.copy({ text: this.text });
  }
}
```

For optimistic updates, Kiss has ready-made action classes, so you don't write the rollback by
hand. See [Optimistic features](../advanced-actions/optimistic-features):

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

## Invalidation

In TanStack Query, after a mutation, you call `invalidateQueries` to mark the related queries
as stale, so they fetch again. This is needed because the library owns the cache, and the
mutation doesn't know what's in it.

Kiss doesn't need this. The action that saves already knows what to reload, and does it right
away:

* An `OptimisticCommand` reloads the value with `reloadFromServer()`.
* An `OptimisticSync` can reload in `onFinish`.
* An `OptimisticSyncWithPush` gets the changes pushed by the server, so there is nothing to
  reload.
* Any action can dispatch the action that loads the data:

```tsx
class SaveText extends Action {
  async reduce() {
    await api.saveText(this.text);
    this.dispatch(new LoadTexts());
    return null;
  }
}
```

If `LoadTexts` uses `fresh`, give it a `force` parameter, and override `ignoreFresh` to return
it (see [Forcing the action to run](../advanced-actions/control-features#forcing-the-action-to-run)).

## Loading and failed states

This is how TanStack Query lets a component know if a query is loading or has failed:

```tsx
function MyComponent() {
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
function MyComponent() {
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

There are two differences here:

* TanStack Query ties the component to the query: the component that calls `useQuery` is the
  one that fetches. So one component can't easily know if a query started by **another**
  component is loading. In Kiss, `useIsWaiting(LoadText)` and `useIsFailed(LoadText)` work in
  any component, no matter which one dispatched the action.

* TanStack Query's status is per query key: `isPending` for user 1 is separate from user 2.
  Kiss's `useIsWaiting(LoadUser)` is true while **any** `LoadUser` runs. To get the status of
  one user, give the action a `statusKey` (`get statusKey() { return this.userId; }`) and pass
  it to the hooks: `useIsWaiting(LoadUser, { statusKey: userId })`. See
  [Status per key](../basics/wait-fail-succeed#status-per-key).

For a global "something is loading" indicator (`useIsFetching`), use
`store.actionsInProgress()`.

## Server-side rendering

TanStack Query renders on the server by prefetching the queries, serializing the cache with
`dehydrate`, and giving it to the client with `HydrationBoundary`.

In Kiss, you create one store per request, dispatch the actions that load the data, and render
with the state. The state travels to the client as JSON, and the client creates its store with
it. In Next.js, each route puts its data in the store with `StoreSlice`. See
[Server-side rendering](../miscellaneous/server-side-rendering).

## Persistence

TanStack Query can persist the cache with `persistQueryClient`. Kiss persists the state with a
[persistor](../miscellaneous/persistor), which saves the state as it changes, and loads it when
the app starts. It works with plain objects and with class instances.

## Testing

TanStack Query ties the component to the query. So, testing an app that uses it usually means
testing UI components, which is more work.

Kiss doesn't tie the component to the action. You can test the actions and reducers directly,
without any UI. Kiss also has many features to [help you test](../category/testing) your
actions:

```ts
// Start with some IBM stocks.
const store = new Store<State>({ initialState: new State({ portfolio: ['IBM'] }) });

// Buy Tesla stocks.
await store.dispatchAndWait(new BuyAction('TSLA'));

// Check we now have IBM and Tesla.
expect(store.state.portfolio).toEqual(['IBM', 'TSLA']);
```

To test what happens when the app is offline, or when the user comes back to the tab:

```ts
store.setOnline(false);  // Actions with checkInternet now fail with "No Internet".
store.setFocused(false); // The user went to another tab.
store.setFocused(true);  // The user came back: the onFocus callbacks run.
```
