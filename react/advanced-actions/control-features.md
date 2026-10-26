---
sidebar_position: 3
---

# Control features

The features explained in this page help you control when and how actions run.
They let you prevent duplicate work, retry on failure, limit how often actions run,
cancel the requests of old actions, skip work when data is already up to date, poll periodically,
and run actions one at a time.

They are listed together with all the other features, and their compatibility matrix,
in [Action features](./action-features).

| Feature                       | How to add it          | Purpose                                                       |
|-------------------------------|------------------------|---------------------------------------------------------------|
| [nonReentrant](#nonreentrant) | `nonReentrant = true`  | Aborts the dispatch if the same action is already running     |
| [retry](#retry)               | `retry = {on: true}`   | Retries the action on error, with exponential backoff         |
| [throttle](#throttle)         | `throttle = 5000`      | Runs the action at most once per throttle period              |
| [debounce](#debounce)         | `debounce = 300`       | Waits until the action stops being dispatched, then runs it   |
| [ignoreOld](#ignoreold)       | `ignoreOld = true`     | Ignores and cancels the older actions, when a newer one runs  |
| [fresh](#fresh)               | `fresh = 5000`         | Skips the action while its data is still fresh                |
| [polling](#polling)           | `poll` property        | Dispatches an action periodically                             |
| [sequential](#sequential)     | `sequential = true`    | Runs actions one at a time, in the order they were dispatched |

---

## nonReentrant

To prevent an action from running again while it is already running,
add `nonReentrant = true` to your action. The new dispatch is silently aborted,
as if it had never been dispatched.

```tsx
class SaveText extends Action {
  nonReentrant = true;

  async reduce() {
    await fetch('https://myapi.com/save', { method: 'PUT', body: 'data' });
    return null;
  }
}
```

The non-reentrant key is released when the action finishes, with or without errors.

### Using parameters to differentiate actions

By default, the non-reentrant check is based on the action class.
This means two actions of the same class can't run at the same time.
Note subclasses are different classes, so they don't block each other.

If you want actions with different parameters to run in parallel,
override `nonReentrantKeyParams()`:

```tsx
class SaveItem extends Action {
  constructor(readonly itemId: string) { super(); }

  nonReentrant = true;
  nonReentrantKeyParams() { return this.itemId; }
  ...
}
```

With this setup, `SaveItem('A')` and `SaveItem('B')` can run in parallel,
but two `SaveItem('A')` dispatched at the same time will not both run.

Params are compared with `Object.is`, except arrays and plain objects, which are compared
by their contents. So `nonReentrantKeyParams()` may return, for example,
`[this.listId, this.itemId]` or `{ id: this.itemId }`.

### Sharing a key across action classes

If you want different action classes to block each other,
override `computeNonReentrantKey()` to return the same key:

```tsx
class SaveUser extends Action {
  constructor(readonly userId: string) { super(); }

  nonReentrant = true;
  computeNonReentrantKey() { return this.userId; }
  ...
}

class DeleteUser extends Action {
  constructor(readonly userId: string) { super(); }

  nonReentrant = true;
  computeNonReentrantKey() { return this.userId; }
  ...
}
```

With this setup, `SaveUser('123')` and `DeleteUser('123')` can't run at the same time,
because they share the same key.

These keys are also used by [OptimisticCommand](./optimistic-features#optimisticcommand),
which is always non-reentrant. So, a `nonReentrant` action and an `OptimisticCommand`
with the same key can't run at the same time either.

### Combining with other features

* It can be combined with [retry](#retry) and [checkInternet](./internet-features#checkinternet).
  With `retry`, the key is only released after the last attempt.

* It can be combined with [sequential](#sequential). Duplicates are then dropped while the
  original action is waiting in the queue or running, and the actions that get through still
  run one at a time.

* It can't be combined with [throttle](#throttle), [fresh](#fresh) or [ignoreOld](#ignoreold),
  nor used in an `OptimisticCommand` (which is already non-reentrant) or a
  [LoadPages](./paged-loading) (which already runs one load per list at a time), nor combined
  with [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet)
  (which is also already non-reentrant). Doing so throws a `StoreException`.

* If `abortDispatch()` returns `true`, the action is aborted before the non-reentrant
  check, and doesn't take the key.

---

## retry

To retry an action a few times with exponential backoff if it fails,
add the `retry` property to your action class.

```tsx
class LoadText extends Action {
  retry = {on: true}

  async reduce() {
    let response = await fetch('https://example.com/text');
    let text = await response.text();
    return (state: State) => state.copy({ text });
  }
}
```

If the `before` method throws an error, the retry will NOT happen.

Retry only works with **async** reducers. A sync reducer is a pure function of the state,
so if it fails once it will fail again, and retrying it makes no sense.
If you add `retry` to an action with a sync reducer, the action fails with a `StoreException`,
even if the reducer itself succeeds.

### Parameters

You can change these parameters to customize the retry behavior:

| Parameter      | Default   | Description                                                    |
|----------------|-----------|----------------------------------------------------------------|
| `initialDelay` | 350 ms    | Delay before the first retry                                   |
| `multiplier`   | 2         | Factor by which the delay increases for each subsequent retry  |
| `maxRetries`   | 3         | Maximum number of retries (total attempts = `maxRetries` + 1)  |
| `maxDelay`     | 5000 ms   | Maximum delay between retries, to avoid very long waits        |

With the defaults, the delays are: 350 millis, 700 millis, and 1.4 seconds.

You can change one or more of the default values. Doing so also turns on the retry:

```tsx
class LoadText extends Action {

  retry = {
    initialDelay: 350, // Delay in milliseconds before the first retry
    maxRetries: 3,     // Number of retries before stopping
    multiplier: 2,     // Factor used to increase the delay after each retry
    maxDelay: 5000,    // Maximum delay between retries, in milliseconds
  }

  async reduce() { ... }
}
```

A `multiplier` of `1` keeps the delay constant.

Invalid values (for example, a `multiplier` below `1`, a negative delay, or a `maxRetries`
that is not an integer `>= -1`) make the dispatch throw a `StoreException` that explains the
problem.

To turn off a retry that a base class turned on, use `retry = {on: false}`.

**Note:** The retry delay only starts after the reducer finishes executing. For example, if
the reducer takes 1 second to fail, and the retry delay is 350 millis, the first retry will
happen 1.35 seconds after the first reducer started.

### Tracking retry attempts

If necessary, you can know the current _attempt number_ by using `this.attempts`.
It's `0` in the first attempt, `1` in the first retry, and so on.

```tsx
class LoadText extends Action {
  retry = {on: true}

  async reduce() {
    console.log('Attempt number: ' + this.attempts);
    ...
  }
}
```

### Giving up on some errors

By default, every error is retried, including `UserException`s. A `UserException` thrown by
the reducer may well be transient ("Could not reach the server, please try again"), and only
the action knows.

Some errors are permanent: a 404, a 401, a validation error from the server. Retrying them
wastes time, and delays the error message. To give up on them, override
`shouldRetry(error, attempt)` to return `false`:

```tsx
class LoadUser extends Action {
  retry = {on: true}

  shouldRetry(error: unknown, attempt: number) {
    return !(error instanceof NotFoundError) && !(error instanceof UnauthorizedError);
  }

  async reduce() { ... }
}
```

* `error` is the error thrown by the attempt that just failed.
* `attempt` is the number of that attempt, starting at `1`. It's the same as `this.attempts`
  after the failure.

It's called after each failed attempt that still has retries left. When it returns `false`,
the action fails right away with that error, as if the retries had run out. It's not called
when the retries ran out (the action fails anyway), nor when the action was aborted on
purpose with an `AbortDispatchException`, which is never retried. If `shouldRetry` itself
throws, the action fails with that error.

The same method is used by [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet)
(but not when there is no internet, since the action then waits for the internet, and doesn't
fail), and by an [OptimisticCommand](./optimistic-features#optimisticcommand) with `retry`,
after each failed server call.

### Unlimited retries

If you want to retry unlimited times, make `maxRetries` equal to `-1`,
or set `unlimitedRetries` to `true`:

```tsx
class LoadText extends Action {
  retry = {maxRetries: -1};
  ...
}
```

**Warning:** If you `await dispatchAndWait(action)` and the action uses unlimited retries,
it may never finish if it keeps failing. So, be careful when using it. This can't happen in a
server store (created with `server: true`), where the reducer runs once and is never retried.

To stop the retries, call `store.clearInternalActionProps()` (for example, on logout), or
shut down the store with `store.setShutDown(true)`. The action is then aborted with an
`AbortDispatchException`, so it doesn't fail. To stop on a permanent error (a 404, a 401),
override `shouldRetry` (see [Giving up on some errors](#giving-up-on-some-errors)). The action
then fails with that error.

Note combining `retry` with [checkInternet](./internet-features#checkinternet) will not retry
when there is no internet. It only retries if there IS internet, but the action fails for some
other reason. To retry unlimited times until the internet is available, use
[unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet) instead.

### Combining with nonReentrant

For most actions that use `retry`, consider also making them
[non-reentrant](#nonreentrant), to avoid multiple instances of the same action running at the
same time:

```tsx
class LoadText extends Action {
  retry = {on: true}
  nonReentrant = true;
  ...
}
```

### Other notes

* While the action waits to retry, it's still in progress. For example, `useIsWaiting(LoadText)`
  returns `true`, and `useIsFailed(LoadText)` returns `false`.

* When the action finally fails, the last error is rethrown, and the previous ones are
  ignored. Only the last error goes through `wrapError`, and is shown to the user.

* If some other action changes the state while the action waits to retry, those changes
  are kept: the function returned by the async reducer gets the current state,
  not the state from when the action was dispatched.

* When used with [OptimisticCommand](./optimistic-features#optimisticcommand), only the server
  call is retried, and unlimited retries are not allowed.

* It can be combined with [sequential](#sequential). The retries then happen while the action
  holds the queue, which delays the actions waiting behind it.

* It can't be combined with [debounce](#debounce), [polling](#polling),
  [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet),
  or [OptimisticSync](./optimistic-features#optimisticsync).
  Doing so throws a `StoreException`.

* In a server store (created with `server: true`, the store that loads the data of a request
  in [server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)), the
  reducer runs once, and if it throws, the action fails with that error right away, without
  retrying.

---

## throttle

To prevent an action from running too often, add something like `throttle = 5000` to your
action class, where `5000` means 5 seconds.

If an action is dispatched multiple times within the throttle period,
only the first dispatch runs, and the others are silently aborted.
After the throttle period has passed, the next dispatch is allowed to run again,
which starts a new throttle period.

This is useful when an action may be triggered many times in a short time
(for example, by fast user input or component re-renders),
but you only want it to run from time to time.

For example, a component may load some information when it mounts:

```tsx
function MyScreen() {
  useStoreEffect({ onMount: (store) => store.dispatch(new LoadInformation()) });
  const information = useSelect((state: State) => state.information);

  return <div>Information: {information}</div>;
}
```

And the throttle makes sure it doesn't reload that information too often:

```tsx
class LoadInformation extends Action {

  throttle = 5000 // Milliseconds

  async reduce() {
    let information = await loadInformation();
    return (state: State) => state.copy({ information });
  }
}
```

The `throttle` value is in milliseconds. Set it to `true` to use the default of `1000`
milliseconds (1 second):

```tsx
class LoadInformation extends Action {
  throttle = true;
  ...
}
```

The throttle period starts when the action is dispatched, not when it finishes.

To turn off a throttle that a base class turned on, use `throttle = false`. For TypeScript to
accept that, the base class must declare it as `throttle: number | boolean`.

### Bypassing the throttle

Override `ignoreThrottle` to ignore the throttle period under some conditions.
For example, to add a `force` flag:

```tsx
class LoadInformation extends Action {
  constructor(readonly force = false) { super(); }

  throttle = 5000;
  get ignoreThrottle() { return this.force; }
  ...
}
```

Now dispatching `new LoadInformation(true)` always runs, even inside the throttle period,
and starts a new throttle period.

### Behavior on failure

By default, the throttle lock is NOT removed if the action fails.
This means that if the action fails, and you dispatch it again within the throttle period,
it will not run a second time.

To allow it to run again right away after a failure, set `removeThrottleLockOnError` to `true`:

```tsx
class LoadInformation extends Action {
  throttle = 5000;
  removeThrottleLockOnError = true;
  ...
}
```

If you need more control, you can instead call `removeThrottleLock()` yourself,
for example in the `after()` method:

```tsx
after() {
  if (this.status.originalError instanceof SomeSpecificError) this.removeThrottleLock();
}
```

You can also remove all throttle locks at once with `removeAllThrottleLocks()`.

### Custom lock

By default, the throttle is based on the action class. In other words, the class is the
"lock". Note subclasses are different classes, so they don't throttle each other.
Override `throttleLockBuilder()` to use a different lock.

Two action classes sharing the same lock:

```tsx
class LoadPrices extends Action {
  throttle = 5000;
  throttleLockBuilder() { return 'marketData'; }
  ...
}

class LoadVolumes extends Action {
  throttle = 5000;
  throttleLockBuilder() { return 'marketData'; }
  ...
}
```

Throttle based on a field of the action:

```tsx
class LoadItem extends Action {
  constructor(readonly itemId: string) { super(); }

  throttle = 5000;
  throttleLockBuilder() { return [this.constructor, this.itemId]; }
  ...
}
```

With this setup, `LoadItem('A')` and `LoadItem('B')` have independent throttle periods.

Locks are compared with `Object.is`, except arrays and plain objects, which are compared by
their contents. Expired locks are removed automatically, to prevent memory leaks.

### Combining with other features

* It works with both sync and async actions, and can be combined with [retry](#retry),
  [checkInternet](./internet-features#checkinternet), [debounce](#debounce) and
  [ignoreOld](#ignoreold).

* It can be combined with [sequential](#sequential). The throttle period then starts when the
  action is dispatched, and not when it gets its turn in the queue.

* It can't be combined with [nonReentrant](#nonreentrant) or [fresh](#fresh), nor used in an
  `OptimisticCommand` or an `OptimisticSync`. Doing so throws a `StoreException`.

* In a [LoadPages](./paged-loading), it only applies to `'first'` and `'refresh'`: a
  `'next'` or `'previous'` always runs.

* An invalid value (for example, a negative number) makes the dispatch throw a
  `StoreException`.

---

## debounce

To delay running an action until it stops being dispatched for some time,
add something like `debounce = 300` to your action class,
where `300` is the number of milliseconds. Each new dispatch resets the wait time.

For example, when a user types into a search bar, debouncing makes sure that not every
keystroke triggers a server request. Instead, the action waits until the user stops typing for
a short time before running.

```tsx
class SearchText extends Action {
  constructor(readonly searchTerm: string) { super(); }

  debounce = 300 // Milliseconds

  async reduce() {
    let result = await loadJson('https://example.com/?q=', this.searchTerm);
    return (state: State) => state.copy({ searchResult: result });
  }
}
```

Set `debounce` to `true` to use the default wait time of `333` milliseconds (1/3 of a second):

```tsx
class SearchText extends Action {
  debounce = true;
  ...
}
```

When another action with the same lock is dispatched during the wait time, the previous action
finishes right away, without running its reducer (it doesn't change the state, and doesn't
fail). Its `before()` and `after()` methods still run. Only the last action runs its reducer,
after the wait time.

The wait time starts after the `before()` method finishes, and the action is in progress while
it waits. So, `useIsWaiting(SearchText)` is `true` during the wait time.

To turn off a debounce that a base class turned on, use `debounce = false`. For TypeScript to
accept that, the base class must declare it as `debounce: number | boolean`.

### Difference from throttle

* **throttle**: Runs right away on the first dispatch, and then blocks the other dispatches
  for the throttle period.
* **debounce**: Waits for some quiet time, and only runs after the dispatches stop.

### Custom lock

By default, debouncing is based on the action class. Note subclasses are different classes,
so they don't debounce each other. Override `debounceLockBuilder()` to use a different lock.

Two action classes sharing the same lock:

```tsx
class SearchUsers extends Action {
  debounce = 300;
  debounceLockBuilder() { return 'search'; }
  ...
}

class SearchProducts extends Action {
  debounce = 300;
  debounceLockBuilder() { return 'search'; }
  ...
}
```

Debounce based on a field of the action, so that each search field has its own wait time:

```tsx
class SearchField extends Action {
  constructor(readonly fieldId: string, readonly text: string) { super(); }

  debounce = 300;
  debounceLockBuilder() { return [this.constructor, this.fieldId]; }
  ...
}
```

Locks are compared with `Object.is`, except arrays and plain objects, which are compared by
their contents.

To remove all debounce locks at once, call `removeAllDebounceLocks()`. Actions that are still
waiting for their debounce period finish right away, without running their reducer.

### Combining with other features

* It works with both sync and async reducers, but the action is always **async**, since it
  waits for the debounce period. So, it can't be dispatched with `dispatchSync`.
  Doing so throws a `StoreException`.

* It can be combined with [nonReentrant](#nonreentrant), [throttle](#throttle),
  [fresh](#fresh), [ignoreOld](#ignoreold) and
  [checkInternet](./internet-features#checkinternet).

* The debounce only delays the start of the reducer. Once the reducer starts, a newer dispatch
  doesn't stop it. So, if the user pauses for longer than the wait time and then types again,
  two requests run at the same time, and the older one may finish last and overwrite the newer
  result. To prevent that, combine it with [ignoreOld](#ignoreold), which also lets you cancel
  the older request.

* It can't be combined with [retry](#retry), [polling](#polling), or
  [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet),
  nor used in an `OptimisticCommand` or an `OptimisticSync`.
  Doing so throws a `StoreException`.

* It can't be combined with [sequential](#sequential), because the debounce period would only
  start when the action gets its turn in the queue, which defeats the purpose of debouncing.

* An invalid value (for example, a negative number) makes the dispatch throw a
  `StoreException`.

* In a server store (created with `server: true`, the store that loads the data of a request
  in [server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)), the
  debounce period is not waited: the reducer runs right away. The action is still async.

## ignoreOld

When the same action may be dispatched again before the previous one finishes, and both change
the same part of the state, a slow older request may finish last, and overwrite the newer
information. To prevent that, add `ignoreOld = true` to your action. When the action is
dispatched again, the actions of the previous dispatches that are still running become
**old**: their results are ignored, and their requests can be cancelled. Only the newest
dispatch changes the state.

For example, when the user selects a tab, you load the items of that tab:

```tsx
class LoadTab extends Action {
  constructor(readonly tab: string) { super(); }

  ignoreOld = true;

  async reduce() {
    let response = await fetch(`/api/items?tab=${this.tab}`, { signal: this.abortSignal });
    let items = await response.json();
    return (state: State) => state.copy({ items });
  }
}
```

If the user selects tab "A" and then tab "B", without `ignoreOld` both requests run, and if the
request for "A" is slower and finishes last, the items of "A" are shown while tab "B" is
selected. With `ignoreOld`, as soon as "B" is dispatched, the action for "A" is old. Its
request is cancelled (since it got the `abortSignal`), and even if it finishes, its result is
ignored. The screen keeps what it showed before, until the items of "B" arrive. Meanwhile,
`useIsWaiting(LoadTab)` is `true`, so you can show a spinner.

In more detail:

* The actions are numbered in the order they are dispatched. When an action is dispatched, all
  the actions with the same key that are still running become old.

* An old action is aborted silently when it finishes: its result is ignored (it doesn't change
  the state), and so are its errors. It shows no error dialog, doesn't count as failed, and
  isn't retried. Its status has `isDispatchAborted: true`.

* The newest action is never old, even if it fails. In that case the state is not changed,
  and the error is processed as usual.

* A dispatch that is aborted before it runs (by `abortDispatch()`, [throttle](#throttle) or
  [fresh](#fresh)) doesn't make the other actions old. Neither does a dispatch with
  `Poll.stop`, or with `Poll.start` while polling is already active, since they don't run the
  reducer.

* This is different from [sequential](#sequential), which also prevents the overwrite, but
  makes each action wait for the previous ones, and applies all their results.

### Cancelling the requests of old actions

Each action has an `abortSignal`, which is aborted when the action becomes old. Pass it to
`fetch`, or to any other API that accepts an `AbortSignal` (like axios), so that the request is
cancelled as soon as a newer action is dispatched. This saves bandwidth, and work in the
server.

When the signal is aborted, `fetch` throws an `AbortError`. You don't need to catch it, since
the errors of an old action are ignored.

For work that doesn't accept a signal, you can check it yourself, between the steps:

```tsx
async reduce() {
  let user = await loadUser(this.userId);
  this.abortSignal.throwIfAborted();
  let posts = await loadPosts(user);
  return (state: State) => state.copy({ user, posts });
}
```

The signal is also aborted when the action is aborted from outside, with `store.abort` or
`action.abort()`. See [aborting actions](./aborting-actions).

### Checking if the action is old

Only the state returned by the reducer is ignored. Anything else the reducer did still
happened, like dispatching other actions. To avoid that, check `this.isAborted`, which is
`true` when an action with the same key was dispatched after this one (or when the action was
aborted from outside):

```tsx
async reduce() {
  let items = await loadItems(this.tab);
  if (!this.isAborted) this.dispatch(new LoadItemImages(items));
  return (state: State) => state.copy({ items });
}
```

### Using parameters to separate keys

By default, the key is based on the action class. This means dispatching an action makes the
running actions of the same class old. Note subclasses are different classes, so they don't
affect each other.

Choose the key according to the part of the state the actions change. Actions that change the
same part of the state should share the key, and actions that change different parts should
not. For example, if `LoadItem` always puts the item into the same `selectedItem` field, keep
the default key, so that loading item "B" makes loading item "A" old. But if it puts each item
into a cache, by id, override `ignoreOldKeyParams()` to use the id in the key, since item "A"
is still useful:

```tsx
class LoadItem extends Action {
  constructor(readonly itemId: string) { super(); }

  ignoreOld = true;
  ignoreOldKeyParams() { return this.itemId; }

  async reduce() {
    let item = await loadItem(this.itemId, this.abortSignal);
    return (state: State) => state.withCachedItem(item);
  }
}
```

Params are compared with `Object.is`, except arrays and plain objects, which are compared by
their contents. For example, `[this.userId, this.cartId]` is a valid param.

### Sharing a key across action classes

Override `computeIgnoreOldKey()` if you want different action classes to share the same key:

```tsx
class LoadUserProfile extends Action {
  constructor(readonly userId: string) { super(); }
  ignoreOld = true;
  computeIgnoreOldKey() { return 'selectedUser'; }
  ...
}

class LoadUserSummary extends Action {
  constructor(readonly userId: string) { super(); }
  ignoreOld = true;
  computeIgnoreOldKey() { return 'selectedUser'; }
  ...
}
```

With this setup, dispatching a `LoadUserSummary` makes the running `LoadUserProfile` actions
old, and vice versa.

### Combining with other features

* Use it with [debounce](#debounce) to search while the user types. The `debounce` avoids
  sending a request for each key pressed. But if the user pauses for longer than the wait time
  and then types again, the older request would still be running. With `ignoreOld`, it's
  cancelled, and its results don't overwrite the newer ones:

  ```tsx
  class SearchText extends Action {
    constructor(readonly searchTerm: string) { super(); }

    debounce = 300;
    ignoreOld = true;

    async reduce() {
      let response = await fetch(`/api/search?q=${this.searchTerm}`, { signal: this.abortSignal });
      let result = await response.json();
      return (state: State) => state.copy({ searchResult: result });
    }
  }
  ```

  Note that without `debounce`, each key pressed would cancel the previous request, and no
  results would be shown until the user stops typing. Also note an action replaced during its
  wait time is old too, so it's aborted (instead of finishing without running its reducer).

* It can be combined with [retry](#retry) and
  [checkInternet](./internet-features#checkinternet). An action that becomes old while waiting
  to retry stops waiting, and is aborted right away.

* It can be combined with [throttle](#throttle) and [fresh](#fresh). These abort the
  dispatches inside their period, so those don't make the running action old. But when the
  period ends while an older action is still running, the next dispatch runs, and makes it old.

* When [polling](#polling), add it to the action returned by `createPollingAction()`. It's
  useful when `pollWaitsForRun` is `false`, or when you also dispatch the action yourself, for
  example from a "refresh" button.

* It can't be combined with [nonReentrant](#nonreentrant) or
  [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet), since those
  never let two actions with the same key run at the same time, nor with
  [sequential](#sequential), which already applies the results in the dispatch order. It also
  can't be used in the [optimistic](./optimistic-features) actions, which already decide which
  values win, nor in a [LoadPages](./paged-loading), which already aborts the older loads of
  the list. Doing so throws a `StoreException`.

### Other notes

* It works with both sync and async reducers. Even sync reducers can be affected, when an
  async `before` (for example, the one of `checkInternet`) makes an older action reach its
  reducer after a newer one was dispatched.

* Calling `store.clearInternalActionProps()` (or `store.setShutDown(true)`) forgets the keys.
  The actions dispatched after it don't make the ones dispatched before it old.

---

## fresh

To prevent an action from running while its data is still considered _fresh_,
add something like `fresh = 5000` to your action class, where `5000` means 5 seconds.
After the fresh period ends, the data becomes _stale_, and the next dispatch runs again,
and starts a new fresh period.

This helps you avoid reloading the same information too often.
You can think of the fresh period as the time during which the loaded data is still good to
use.

```tsx
class LoadInformation extends Action {

  fresh = 5000 // Fresh for 5 seconds

  async reduce() {
    let information = await loadInformation();
    return (state: State) => state.copy({ information });
  }
}
```

The `fresh` value is in milliseconds. Set it to `true` to use the default of `1000`
milliseconds (1 second).

The fresh period starts when the action is dispatched, not when it finishes.

To turn off a fresh period that a base class turned on, use `fresh = false`. For TypeScript to
accept that, the base class must declare it as `fresh: number | boolean`.

### Using parameters to separate fresh periods

By default, freshness is tracked per action class, so all actions of the same class share one
fresh period. Note subclasses are different classes, so they don't share it.

Many actions need a separate fresh period per id, url, or some other field.
In that case, override `freshKeyParams()`:

```tsx
class LoadUserCart extends Action {
  constructor(readonly userId: string) { super(); }

  fresh = 5000;
  freshKeyParams() { return this.userId; }
  ...
}
```

With this setup:

* `LoadUserCart('A')` and `LoadUserCart('B')` have independent fresh periods.
* Two `LoadUserCart('A')` dispatched quickly will only run the first one.

You can return more than one field by using an array:

```tsx
freshKeyParams() { return [this.userId, this.cartId]; }
```

Params are compared with `Object.is`, except arrays and plain objects, which are compared by
their contents.

### Forcing the action to run

Override `ignoreFresh` to run the action even while its data is still fresh.
A common pattern is to add a `force` flag:

```tsx
class LoadInformation extends Action {
  constructor(readonly force = false) { super(); }

  fresh = 5000;
  get ignoreFresh() { return this.force; }
  ...
}
```

With this setup:

* `new LoadInformation()` runs only when its data is stale.
* `new LoadInformation(true)` always runs, and also starts a new fresh period.

### Behavior on failure

If an action fails, it behaves as if that failed run didn't make its key fresh:

* The key the action made fresh is removed, so you can dispatch the action again right away.
  This is also true for a forced run (`ignoreFresh`): if it fails, the key becomes stale,
  even if it was fresh before the forced run.

* If another action using the same key started after this one (for example, a forced run),
  that newer fresh period is kept as is.

So, errors never extend the fresh period, and a failure from an older action doesn't cancel a
newer successful action with the same key.

You can also control the freshness by hand, from your action's `reduce()` or `before()`
methods:

* Call `removeFreshKey()` to make the key of this action stale, so the next dispatch with that
  key runs right away.
* Call `removeAllFreshKeys()` to make all keys stale.

Expired keys are removed automatically, so you usually don't need to worry about old entries.

### Sharing a key across action classes

Override `computeFreshKey()` to make different action classes share the same fresh period.
This is useful when several actions read or write the same data:

```tsx
class LoadUserProfile extends Action {
  constructor(readonly userId: string) { super(); }

  fresh = 5000;
  computeFreshKey() { return this.userId; }
  ...
}

class LoadUserSettings extends Action {
  constructor(readonly userId: string) { super(); }

  fresh = 5000;
  computeFreshKey() { return this.userId; }
  ...
}
```

Here, `LoadUserProfile('123')` and `LoadUserSettings('123')` share one fresh period,
because they return the same key. Any value can be a key, for example a constant string or an
enum value.

### Combining with other features

* It works with both sync and async actions, and can be combined with [retry](#retry),
  [checkInternet](./internet-features#checkinternet), [debounce](#debounce) and
  [ignoreOld](#ignoreold). With `retry`, the key is only removed if the last attempt fails.

* It can be combined with [sequential](#sequential). The fresh period then starts when the
  action is dispatched, and not when it gets its turn in the queue. If the action is
  discarded from the queue, its key is removed, since it never ran.

* It can't be combined with [nonReentrant](#nonreentrant) or [throttle](#throttle), nor used
  in an `OptimisticCommand` or an `OptimisticSync`. Doing so throws a `StoreException`.

* In a [LoadPages](./paged-loading), it only applies to `'first'` and `'refresh'`: a
  `'next'` or `'previous'` always runs, and starts a new fresh period. So, dispatch a
  `'refresh'` with `fresh` whenever the screen is shown, and it only reloads the pages when
  the data is old.

* If `abortDispatch()` returns `true`, the action is aborted before the fresh check, and
  doesn't make its key fresh.

* An invalid value (for example, a negative number) makes the dispatch throw a
  `StoreException`.

---

## polling

To periodically dispatch an action at a fixed interval, add a `poll` property to your action
(usually as a constructor parameter), and override `createPollingAction()` to return the action
that each tick dispatches.

This is useful when you need to keep data fresh by fetching it from a server at regular
intervals, such as refreshing prices, checking for new messages, or monitoring wallet balances.

```tsx
class PollPrices extends Action {
  constructor(readonly poll = Poll.once) { super(); }

  createPollingAction() { return new PollPrices(); }

  async reduce() {
    const prices = await api.getPrices();
    return (state: State) => state.copy({ prices });
  }
}

// Run only once
dispatch(new PollPrices());

// Start polling
dispatch(new PollPrices(Poll.start));

// Stop polling
dispatch(new PollPrices(Poll.stop));
```

Every action that uses polling must override `createPollingAction()`.
Otherwise, dispatching it throws a `StoreException`.
When `poll` is `undefined` (the default), the action doesn't use polling.

To stop all polling at once (for example, on logout), call `stopAllPolling()` from any action.
Polling also stops when you call `store.clearInternalActionProps()`, or when the store is shut
down with `store.setShutDown(true)`.

### Poll interval

The `pollInterval` is the delay between polling ticks, in milliseconds.
The default is `10000` (10 seconds). Change it to set the frequency:

```tsx
pollInterval = 5 * 60 * 1000; // 5 minutes
```

### Overlapping runs

By default, polling runs never overlap. Each tick waits for the previous run to finish,
and only then does `pollInterval` start counting for the next tick.
In other words, the interval is measured from the **end** of each run,
and the actual period is `runDuration + pollInterval`.
If a run takes longer than the interval, ticks simply happen less often,
instead of piling up.

If you'd rather have ticks at a fixed rate, measured from the **start** of each run,
set `pollWaitsForRun` to `false`:

```tsx
pollWaitsForRun = false;
```

Now runs may overlap when they take longer than `pollInterval`.
If that's a problem, add [nonReentrant](#nonreentrant), [throttle](#throttle) or
[sequential](#sequential) to the action returned by `createPollingAction()`.

### Polling only while the app is focused and online

By default, the ticks only run while the app is **focused** (in the browser, the tab is visible
and the window is not minimized) and **online**. There's no point in polling a server while the
user is on another tab, and polling while offline would fail on every tick.

A tick that comes due while the user is away waits, and runs as soon as the user comes back to
the tab, or the internet comes back. The polling then goes on at the normal interval. A tick
that is not yet due when the user comes back runs at its normal time. So, coming back to the
tab refreshes the data at once if it's old. The immediate run of `Poll.start` and
`Poll.runNowAndRestart` is not affected: it always runs.

To keep polling anyway, set the options to `false` in the action that controls the polling:

```tsx
pollOnlyWhenFocused = false; // Keep polling while the user is on another tab.
pollOnlyWhenOnline = false;  // Keep polling while offline (for an action that doesn't use the internet).
```

What "focused" and "online" mean comes from the store: `store.isFocused` and `store.isOnline`
(see [Where "focused" and "online" come from](../basics/hooks-to-dispatch-actions#where-focused-and-online-come-from)).
Where the store can't know (the server, Node, React Native without a `focusSource` or
`onlineSource` in `createStore`), the app counts as focused and online, and the polling never
pauses. In tests, use `store.setFocused(false)` and `store.setOnline(false)`.

In a server store (created with `server: true`, the store that loads the data of a request in
[server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)),
`Poll.start` and `Poll.runNowAndRestart` run the action once, like `Poll.once`, and start no
polling: the server renders once, and nothing would use the next tick.

### Poll values

The `poll` property controls the behavior of each dispatch:

| Value                   | Behavior                                                                                                                        |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `Poll.start`            | Starts polling and runs `reduce` immediately. If polling is already active for this key, does nothing.                          |
| `Poll.stop`             | Cancels the polling for this key and skips `reduce`.                                                                            |
| `Poll.runNowAndRestart` | Runs `reduce` immediately and restarts the polling timer from that moment. If polling is not active, behaves like `Poll.start`. |
| `Poll.once`             | Runs `reduce` immediately, without affecting the polling (does not start or stop the timer).                                    |

Even when `reduce` is skipped, the action's `before` and `after` methods still run,
and the action completes without changing the state.

### Option 1: Single action for everything

Use one action class that both controls polling and does the work.
The `createPollingAction()` returns the same action class with `Poll.once`
(or with no poll parameter at all, since `Poll.once` is the default),
so timer ticks run the action without restarting the timer:

```tsx
class LoadBalance extends Action {
  constructor(readonly address: string, readonly poll = Poll.once) { super(); }

  pollInterval = 5 * 60 * 1000;

  createPollingAction() { return new LoadBalance(this.address); }

  async reduce() {
    const balance = await api.getBalance(this.address);
    return (state: State) => state.copy({ balance });
  }
}

// Run only once
dispatch(new LoadBalance(address));

// Start polling
dispatch(new LoadBalance(address, Poll.start));

// Stop polling
dispatch(new LoadBalance(address, Poll.stop));
```

### Option 2: Separate action classes

Use one action to control polling, and a different action to do the work.
This is useful when you want `useIsWaiting` and `useIsFailed` to track a different class than
the polling controller:

```tsx
class PollBalance extends Action {
  constructor(readonly address: string, readonly poll = Poll.once) { super(); }

  pollInterval = 5 * 60 * 1000;

  createPollingAction() { return new LoadBalance(this.address); }

  async reduce() {
    await this.dispatchAndWait(new LoadBalance(this.address));
    return null;
  }
}

class LoadBalance extends Action {
  constructor(readonly address: string) { super(); }

  async reduce() {
    const balance = await api.getBalance(this.address);
    return (state: State) => state.copy({ balance });
  }
}

// Start polling
dispatch(new PollBalance(address, Poll.start));

// Stop polling
dispatch(new PollBalance(address, Poll.stop));
```

In your components, track the worker action:

```tsx
const isWaiting = useIsWaiting(LoadBalance);
const isFailed = useIsFailed(LoadBalance);
```

### Polling keys

By default, each action class gets its own independent polling timer, keyed by its class.
All instances of the same action class share one timer.
Note subclasses are different classes, so they get their own timers.

#### Using pollingKeyParams to separate instances

If you need separate polling timers per id, address, or some other field,
override `pollingKeyParams()`. Actions of the same class but with different
`pollingKeyParams()` values get independent timers.

```tsx
class PollBalance extends Action {
  constructor(readonly address: string, readonly poll = Poll.once) { super(); }

  // Each address gets its own independent polling timer.
  pollingKeyParams() { return this.address; }

  createPollingAction() { return new LoadBalance(this.address); }

  async reduce() {
    await this.dispatchAndWait(new LoadBalance(this.address));
    return null;
  }
}

// These start two independent polling timers:
dispatch(new PollBalance(address1, Poll.start));
dispatch(new PollBalance(address2, Poll.start));

// Stop only address1:
dispatch(new PollBalance(address1, Poll.stop));
```

You can also return more than one field by using an array:

```tsx
// Each (userId, walletId) pair gets its own timer.
pollingKeyParams() { return [this.userId, this.walletId]; }
```

#### Sharing a timer across action classes

If you want different action classes to share the same polling timer,
override `computePollingKey()` and return any key you want:

```tsx
class PollPrices extends Action {
  computePollingKey() { return 'market-data'; }
  ...
}

class PollVolumes extends Action {
  computePollingKey() { return 'market-data'; } // Same key
  ...
}
```

With this setup, starting `PollPrices` and then `PollVolumes` means
`PollVolumes` is a no-op (the key is already active). Stopping either
one cancels the shared timer.

Keys are compared with `Object.is`, except arrays and plain objects, which are compared by
their contents.

### Errors

Errors don't stop the polling. If a run fails, the next tick is scheduled anyway, as if the
run had succeeded. This is also true for the immediate run of `Poll.start` and
`Poll.runNowAndRestart`: if it fails, the polling is started anyway.

The ticks are dispatched like any other action, so their errors are processed as usual.
For example, a `UserException` shows an error dialog,
and `useIsFailed` becomes `true` for the tick's action class.

### Combining with other features

Polling can be combined with [checkInternet](./internet-features#checkinternet),
[nonReentrant](#nonreentrant), [throttle](#throttle), [fresh](#fresh),
[sequential](#sequential) and
[unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet).
But add them to the action returned by `createPollingAction()`,
and not to the action that starts and stops the polling.

The reason is that all of them can abort or fail a dispatch,
and none of them can tell a `Poll.stop` apart from a regular tick.
On the polling action, they may block the `Poll.stop` itself,
leaving you unable to stop the polling:

| Feature                       | A `Poll.stop` is blocked when                   |
|-------------------------------|-------------------------------------------------|
| `throttle`                    | it's dispatched inside the throttle period      |
| `nonReentrant`                | a run is still in progress                      |
| `fresh`                       | the data is still fresh                         |
| `checkInternet`               | there is no internet, as it fails in `before`   |
| `checkInternet = {abort: true}` | there is no internet, as it's silently aborted |
| `sequential`                  | the queue is busy, as it waits for its turn     |

Adding `unlimitedRetryCheckInternet` to the polling action itself even throws a
`StoreException`, but you can add it to the tick action.

Putting these features on the tick action instead is both safe and more useful:

```tsx
class PollBalance extends Action {
  constructor(readonly poll = Poll.once) { super(); }

  // The tick action is the one that checks the internet.
  createPollingAction() { return new LoadBalance(); }
  ...
}

class LoadBalance extends Action {
  checkInternet = { abort: true };
  ...
}
```

Note that with the default `pollWaitsForRun` of `true`, ticks can't pile up, since a tick is
only dispatched after the previous one finishes. So adding `nonReentrant`, `throttle` or
`sequential` to the tick action only matters when `pollWaitsForRun` is `false`.

You can also add [ignoreOld](#ignoreold) to the tick action. It doesn't block a `Poll.stop`,
but it's only useful when `pollWaitsForRun` is `false`, or when you also dispatch the action
yourself, for example from a "refresh" button.

Polling can't be combined with [retry](#retry) or [debounce](#debounce), nor used in an
`OptimisticCommand` or an `OptimisticSync`. Doing so throws a `StoreException`.
An invalid `poll` or `pollInterval` value also makes the dispatch throw a `StoreException`.

---

## sequential

To make actions run one at a time, in the exact order they were dispatched,
add `sequential = true` to them.
This is useful when each action depends on the ones dispatched before it,
or when the server must receive your changes in the right order.

```tsx
class SaveItem extends Action {
  constructor(readonly item: Item) { super(); }

  sequential = true;

  async reduce() {
    await fetch('https://myapi.com/items', { method: 'PUT', body: JSON.stringify(this.item) });
    return null;
  }
}
```

All actions with `sequential = true` share a single FIFO queue (first in, first out).
When an action is dispatched, it takes its place at the end of the queue,
and then waits until every action dispatched before it has finished.
Only then does it run its `before`, `reduce` and `after` methods.

This works across all sequential action classes: if `SaveItem` and `DeleteItem`
are both sequential, they wait for each other.
Two actions of the same class also enter the queue and run one after the other.

The queue position is reserved synchronously, at the moment `dispatch` is called.
This guarantees the run order is the dispatch order,
even if the actions are dispatched from different places or in quick succession.

When an action finishes, the next action in the queue is released.
This happens no matter how the action finished:

* It completed successfully.
* It threw an error (from `before` or `reduce`).
* It was aborted by throwing an `AbortDispatchException` (from `before` or `reduce`).

Note that when the dispatch is aborted (for example, when `abortDispatch()` returns `true`),
the action never enters the queue.

### Using parameters to separate queues

By default, all sequential actions share **one** queue, whose key is `null`.
If you want independent queues, override `sequentialKeyParams()` to return any value.
Actions with the same key wait for each other,
while actions with different keys run in parallel.

For example, here each user has its own queue,
so the actions of different users don't block each other:

```tsx
class SaveUser extends Action {
  constructor(readonly userId: string) { super(); }

  sequential = true;
  sequentialKeyParams() { return this.userId; }
  ...
}

class DeleteUser extends Action {
  constructor(readonly userId: string) { super(); }

  sequential = true;
  sequentialKeyParams() { return this.userId; }
  ...
}
```

With this setup, `SaveUser('A')` and `DeleteUser('A')` run one after the other,
but `SaveUser('A')` and `SaveUser('B')` may run at the same time.

You can also return the action class, so that only actions of the same class
wait for each other:

```tsx
sequentialKeyParams() { return this.constructor; }
```

Keys are compared with `Object.is`, except arrays and plain objects, which are compared by
their contents. Keys are removed from memory as soon as their queue becomes empty.

### Discarding the queue when an action fails

Actions are often queued because each one depends on the previous ones.
For example, an action that creates an item, followed by one that updates it.
In that case, if the first action fails, running the rest makes no sense.

Override `discardQueueOnError()` to return `true` when you want a failure
to abort all the actions that are waiting behind the failed one:

```tsx
class SaveItem extends Action {
  sequential = true;
  discardQueueOnError(error: any) { return !(error instanceof AbortDispatchException); }
  ...
}
```

The discarded actions are aborted: they don't run their `before` and `reduce` methods,
and they finish with an `AbortDispatchException`
(which the store treats silently, without showing any error dialog).
Their `status.isDispatchAborted` is `true`,
and you can check `wasDiscardedFromSequentialQueue` on those actions, if you need to know.

Actions dispatched after the failure are not affected, and start a fresh queue.
The default is `false`, which means the queue simply continues with the next action.

Note the error given to `discardQueueOnError()` is the original error, before being processed
by `wrapError`. It may itself be an `AbortDispatchException`, if the action was aborted (for
example, by `checkInternet = {abort: true}`). You may want to keep the queue in that case, as
shown in the code above.

### Do not wait for an action in the same queue

An action that is running (and therefore holds the queue)
must **not** wait for another action that uses the same queue.
If it does, both actions will wait for each other forever (a deadlock):

```tsx
class Parent extends Action {
  sequential = true;

  async reduce() {
    // WRONG: `Child` enters the queue behind `Parent`, and waits for
    // `Parent` to finish. But `Parent` waits for `Child` here. Deadlock!
    await this.dispatchAndWait(new Child());
    return null;
  }
}

class Child extends Action {
  sequential = true;
  ...
}
```

The same applies to any other way of waiting for a queued action, such as
`waitActionType(Child)`, `waitAllActions`, or a `waitCondition`
that only becomes true after `Child` runs.

If you need to dispatch another action of the same queue from inside a running action,
you have these options:

* Dispatch it without waiting for it: `this.dispatch(new Child())`.
  The child is queued and will run right after the parent finishes.
* Give the child a different key, so it uses a different queue.
* Don't make the child sequential.

### Combining with other features

* It can be combined with [retry](#retry) and
  [checkInternet](./internet-features#checkinternet).
  Retries happen while the action holds the queue,
  and the internet check happens when the action gets its turn.
  Note that with unlimited retries, a single failing action blocks every action behind it,
  for as long as it keeps failing. To keep the ordering and still retry,
  prefer a limited number of retries, possibly together with `discardQueueOnError()`.

* It can also be combined with [nonReentrant](#nonreentrant), [throttle](#throttle),
  [fresh](#fresh) and [OptimisticCommand](./optimistic-features#optimisticcommand).
  For example, `nonReentrant` plus `sequential` means duplicates are dropped
  while the original is queued or running,
  and the ones that get through still run one at a time.
  Note the throttle and fresh periods start when the action is dispatched,
  not when it gets its turn in the queue.
  And the optimistic value of an `OptimisticCommand` is only applied to the state
  when the action gets its turn, and not as soon as it's dispatched.

It can't be combined with the features below. Doing so throws a `StoreException`:

* [debounce](#debounce): the debounce period would only start when the action gets its turn
  in the queue, which defeats the purpose of debouncing.

* [ignoreOld](#ignoreold): the actions already run, and apply their results, in the dispatch
  order, so no result arrives late.

* [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet): it aborts
  the dispatch while another action with the same key is in progress, and an action waiting
  in the queue does count as in progress. Two actions of the same class would then never
  queue behind each other: the later ones would be silently dropped instead of being ordered,
  which is the opposite of what `sequential` is for.
  It also retries forever while holding the queue,
  so a single action can block everything behind it for as long as the internet is down.
  To keep the ordering and still retry, use [retry](#retry) with a limited number of
  attempts, optionally together with `discardQueueOnError()`.

* [OptimisticSync](./optimistic-features#optimisticsync): it applies the optimistic value
  on dispatch, and coalesces overlapping dispatches into a single follow-up request.
  Both need dispatches to overlap.
  With `sequential`, the optimistic update would only happen when the action gets its turn,
  so the UI would stop giving immediate feedback.
  And since queued actions never overlap, nothing would ever be coalesced,
  so every dispatch would send its own request.
  It already guarantees a single in-flight request per key,
  so `sequential` adds nothing.

* `OptimisticSyncWithPush`: same reasons, plus its revision tracking assumes
  server pushes can be applied to the state while a request is in flight.

* `ServerPush`: pushed values must be applied as soon as they arrive,
  and `sequential` would delay them behind unrelated queued actions.
  Worse, a push is what tells an in-flight `OptimisticSyncWithPush` request
  that no follow-up is needed.
  Queued behind that very request, the signal would arrive too late.

#### Combining with polling

You can combine `sequential` with [polling](#polling), but add it to the action returned by
`createPollingAction()`, and not to the action that starts and stops the polling.
Otherwise a `Poll.stop` dispatch also has to wait its turn,
and you can't stop the polling while the queue is busy.

Note ticks can only pile up in the queue if you set `pollWaitsForRun` to `false`
on the polling action. By default, a tick is only dispatched
after the previous one has finished.

### Other notes

* Sequential actions are always **async**, even if their `before` and `reduce` methods are
  sync. This means you can't dispatch them with `dispatchSync`.
  Doing so throws a `StoreException`.

* The action only runs its `before` method when it gets its turn. So you can override
  `before`, `reduce` and `after` as usual, and all of them run when it's the action's turn.

* While an action is waiting in the queue, it counts as being "in progress",
  so `useIsWaiting(SaveItem)` returns `true` for it.
  This is usually what you want, as it lets you show a spinner
  as soon as the action is dispatched.
  You can also check `isWaitingInSequentialQueue` on the action itself.

* Calling `store.clearInternalActionProps()` (or `store.setShutDown(true)`) discards the
  actions waiting in all queues, as if a failed action had discarded them. The actions that
  are running keep running, but actions dispatched after that start new queues, and don't
  wait for them.
