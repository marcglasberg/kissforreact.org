---
sidebar_position: 2
---

# Internet features

The features explained in this page help us check for internet connectivity
before running an action. See all features, and which ones can be combined,
in [Action features](./action-features).

| Feature                                                           | Purpose                                                          |
|-------------------------------------------------------------------|------------------------------------------------------------------|
| `checkInternet = { dialog: true }`                                | Checks internet before action; shows dialog if no connection     |
| `checkInternet = { dialog: false }`                               | Checks internet before action; fails without a dialog            |
| `checkInternet = { abort: true }`                                 | Checks internet before action; aborts silently if no connection  |
| `unlimitedRetryCheckInternet`                                     | Combines internet check + unlimited retry + non-reentrant        |

---

## checkInternet

Adding `checkInternet = { dialog: true }` to your action ensures it only runs with internet.
If there is no internet, the action fails, and an **error dialog** opens with the title
_"There is no Internet"_ and the message _"Please, verify your connection."_

```tsx
class LoadPrices extends Action {

  checkInternet = { dialog: true }

  async reduce() { ... }
}
```

Use `checkInternet = { dialog: false }` if you don't want to open a dialog.
The action still fails, so you can display some information in your components instead:

```tsx
function MyComponent() {
  const isFailed = useIsFailed(LoadPrices);

  return (
    <div>
      {isFailed ? <p>No Internet connection</p> : null}
    </div>
  );
};
```

Or use the exception, which is a `UserException`:

```tsx
function MyComponent() {
  const isFailed = useIsFailed(LoadPrices);
  const exception = useExceptionFor(LoadPrices);

  return (
    <div>
      {isFailed ? <p>{exception?.message ?? 'No Internet'}</p> : null}
    </div>
  );
};
```

**Note:** `checkInternet` only checks if the device's internet is on or off.
It does not verify if the internet provider is working or if the server is available.
The check may pass, but network requests can still fail.

### Checking the internet connection

By default, the connection checked is the **online signal of the store**, `store.isOnline`
(see [Where "focused" and "online" come from](../basics/hooks-to-dispatch-actions#where-focused-and-online-come-from)).
In the browser, that's `navigator.onLine`, following the `online` and `offline` events.
However, `navigator.onLine` is not very useful, as it only tells you if there's a local
connection, and not whether the internet is accessible. Also, this only really works for the
web. In other environments (Node.js, React Native) the default assumes there is internet.

In other words, to make `checkInternet` work properly you will need to provide your own logic to
check for internet availability. The recommended way is giving the store an `onlineSource`,
which also feeds `useIsOnline()` and the `onOnline` callback of `useStoreEffect`.
For example, with the [NetInfo](https://www.npmjs.com/package/@react-native-community/netinfo)
package for React Native, first add it to your `package.json`:

```json
"dependencies": {
   "@react-native-community/netinfo": "^11.4.1"
}
```

Then, give the store an `onlineSource` that listens to it:

```typescript
import NetInfo from '@react-native-community/netinfo';

const store = createStore<State>({
  initialState: State.initialState,
  onlineSource: (setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
});
```

Note `isConnected` is `null` while NetInfo doesn't know yet. The `!== false` counts that as online,
so the action still tries. That's safer: a wrong "online" only costs a request that fails, while a
wrong "offline" would block a request that could have worked.

The source is started when the signal is first read (for example, by the first action with
`checkInternet`), and stopped by `store.dispose()`. A server store (created with `server: true`,
for [server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)) never
starts it: there, the app always counts as online.

Alternatively, override the `hasInternet()` method of your base action, to check the connection
on demand each time an action needs it (for example, with the
[is-online](https://www.npmjs.com/package/is-online) package for Node.js and the browser, or by
pinging your own server). The override then ignores `store.isOnline`:

```typescript
export abstract class Action extends KissAction<State> {

   protected hasInternet(): Promise<boolean> {
      return NetInfo.fetch().then(state => state.isConnected !== false);
   }
}
```

The same check is also used by [unlimitedRetryCheckInternet](#unlimitedretrycheckinternet).

### Customizing the error

To show a different error, override the `noInternetException()` method of the action,
and return your own `UserException`:

```tsx
class LoadPrices extends Action {

  checkInternet = { dialog: true }

  noInternetException() {
    return new UserException('You are offline. The prices could not be loaded.');
  }

  async reduce() { ... }
}
```

Kiss calls `noInternetException()` only when there is no internet. The `dialog` option of
`checkInternet` still decides if your exception opens a dialog. With
`checkInternet = { abort: true }`, it's not called, since the action is aborted silently.

### Overriding before()

Kiss checks the internet before it calls the action's
[`before()`](./before-and-after-the-reducer#before) method.
So you can override `before()`, and you don't need to call `super.before()`.
If there is no internet, `before()` and `reduce()` don't run, but `after()` still runs.

Note `checkInternet` makes the action async, even if its `before()` and `reduce()` are sync,
because the internet check is async. So you can't dispatch it with `dispatchSync()`.

### Combining with other features

* `checkInternet` can be combined with [retry](./control-features#retry). But since only
  `reduce()` is retried, the internet is only checked once. So `retry` plus `checkInternet` doesn't
  retry when there is no internet. It only retries if there IS internet, but the action fails
  for some other reason. To retry until there is internet, use
  [unlimitedRetryCheckInternet](#unlimitedretrycheckinternet) instead.

* It can be combined with [sequential](./control-features#sequential). The internet is then
  checked when the action gets its turn in the queue.

* It can be combined with [OptimisticCommand](./optimistic-features#optimisticcommand),
  [OptimisticSync](./optimistic-features#optimisticsync) and
  [OptimisticSyncWithPush](./optimistic-features#optimisticsyncwithpush-and-serverpush).
  If there is no internet, the optimistic value is not applied, and nothing is sent to the
  server.

* It can't be combined with [unlimitedRetryCheckInternet](#unlimitedretrycheckinternet),
  which already checks the internet, nor used in a
  [ServerPush](./optimistic-features#optimisticsyncwithpush-and-serverpush).
  Doing so makes the dispatch throw a `StoreException`.

* When polling, add it to the action returned by `createPollingAction()`, not to the action
  that starts and stops the polling. See [polling](./control-features#polling).

## Aborting when there is no internet

Use `checkInternet = { abort: true }` to abort the action silently when there is no internet,
as if it had never been dispatched. No errors are thrown, and no dialogs are shown.

```tsx
class LoadPrices extends Action {

  checkInternet = { abort: true }

  async reduce() { ... }
}
```

Technically, the action throws an `AbortDispatchException`, so it doesn't fail,
and its [status](./action-status) has `isDispatchAborted: true`.
This means `useIsFailed(LoadPrices)` returns `false`.

You can't set both `dialog` and `abort: true`. Doing so makes the dispatch throw a
`StoreException`.

**Note:** This only checks if the device's internet is on or off.
It does not verify if the internet provider is working or if the server is available.
The check may pass, but network requests can still fail.

## unlimitedRetryCheckInternet

Adding `unlimitedRetryCheckInternet = true` to your action retries it indefinitely, until it
succeeds. It checks for internet connectivity before each attempt, and waits if there is no
connection. It also retries if there is internet, but the action fails for other reasons.

This is useful for critical actions that must eventually succeed,
such as loading essential data when your app opens.

```tsx
class LoadInitialData extends Action {

  unlimitedRetryCheckInternet = true

  async reduce() {
    let response = await fetch('https://example.com/initialData');
    let data = await response.json();
    return (state: State) => state.copy({ data });
  }
}
```

It works like [retry](./control-features#retry) with unlimited retries, plus `checkInternet`,
plus [nonReentrant](./control-features#nonreentrant), but with one difference: Combining
`retry` with `checkInternet` will not retry when there is no internet, while
`unlimitedRetryCheckInternet` will.

It only works with **async** reducers. If the reducer is sync, the dispatch fails with a
`StoreException`.

### Parameters

You can change one or more of these parameters to customize the retries.
Changing them also turns the feature on:

| Parameter            | Default | Description                                              |
|----------------------|---------|----------------------------------------------------------|
| `initialDelay`       | 350 ms  | Delay before the first retry                             |
| `multiplier`         | 2       | Factor by which delay increases each retry               |
| `maxDelay`           | 5 sec   | Maximum delay when retrying after errors (with internet) |
| `maxDelayNoInternet` | 1 sec   | Maximum delay when waiting for internet                  |

```tsx
class LoadInitialData extends Action {

  unlimitedRetryCheckInternet = {
    initialDelay: 350,        // Delay in milliseconds before the first retry
    multiplier: 2,            // Factor used to increase the delay after each retry
    maxDelay: 5000,           // Maximum delay between retries, when the action fails
    maxDelayNoInternet: 1000, // Maximum delay between retries, when there is no internet
  }

  async reduce() { ... }
}
```

The shorter `maxDelayNoInternet` allows faster recovery when connectivity returns.
A `multiplier` of `1` keeps the delay constant.
Invalid values (for example, a `multiplier` below `1`, or a negative delay) make the dispatch
throw a `StoreException` that explains the problem.

### Non-reentrant

The action is non-reentrant: while it is running, dispatching another one with the same
non-reentrant key is aborted silently. Since it keeps retrying until it succeeds, this lasts
the whole time from when the action is dispatched until it succeeds, including the waits
between retries.

As with [nonReentrant](./control-features#nonreentrant), the key is based on the action class
by default. Override `nonReentrantKeyParams()` so that actions of the same class, but with
different parameters, don't block each other. Or override `computeNonReentrantKey()` so that
different action classes share the same key:

```tsx
class LoadUser extends Action {
  constructor(readonly userId: string) { super(); }

  unlimitedRetryCheckInternet = true

  nonReentrantKeyParams() { return this.userId; }

  async reduce() { ... }
}
```

### Tracking retry attempts

Use `this.attempts` to check the current attempt number. It's `0` in the first attempt,
`1` in the first retry, and so on. Attempts that found no internet count too.

```tsx
class LoadInitialData extends Action {

  unlimitedRetryCheckInternet = true

  async reduce() {
    console.log('Attempt number: ' + this.attempts);
    ...
  }
}
```

### Logging retries

All retries are logged with `Store.log`, including the action, the attempt number, and
whether the problem was no internet. To send the logs somewhere else, or to turn them off,
use the `logger` parameter when you create the store:

```tsx
const store = createStore<State>({
  initialState: new State(),
  logger: null, // Turns off logging
});
```

### Notes

* If you `await dispatchAndWait(action)`, it only finishes when the action succeeds. This may
  take a long time (or never happen) if there is no internet, or if the action keeps failing.

* If your `before` method throws an error, retries will **not** happen.

* An action that aborts itself by throwing an `AbortDispatchException` is not retried.

* Calling `store.clearInternalActionProps()` (for example, on logout), or shutting down the
  store with `store.setShutDown(true)`, stops the retries. The action is then aborted with an
  `AbortDispatchException`, so it doesn't fail.

* It can't be combined with `retry`, `checkInternet` or `nonReentrant`, since it already does
  what they do. It can't be combined with `debounce`, `throttle`, `fresh`, `ignoreOld`,
  `sequential` or polling either, nor used in the [optimistic](./optimistic-features) actions. Doing so makes
  the dispatch throw a `StoreException`. When polling, add it to the action returned by
  `createPollingAction()` instead.

* This only checks if the device's internet is on or off.
  It does not verify if the internet provider is working or if the server is available.
  The check may pass, but network requests can still fail.

* In a server store (created with `server: true`, the store that loads the data of a request
  in [server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)), the
  internet is not checked (the server counts as online), the reducer runs once, and if it
  throws, the action fails with that error right away.

## Simulating the connection in tests

During tests, you can simulate the internet being on or off. This works for all actions that
use `checkInternet` or `unlimitedRetryCheckInternet`, and the simulation takes precedence over
the `hasInternet()` method, even if you override it. (You can also set the online signal of the
store with `store.setOnline(false)`, which affects the actions, `useIsOnline()` and the
`onOnline`/`onOffline` callbacks alike, but the simulation below takes precedence over it.)

**Option 1:** Set `forceInternetOnOffSimulation` on the store to affect all actions:

```tsx
store.forceInternetOnOffSimulation = () => false; // Simulates NO internet for all actions
```

Return `true` to simulate having internet, `false` to simulate no internet,
or `null` to use the real connectivity status (the default).
Since it's tied to the store, it resets automatically when the store is recreated.

**Option 2:** Override the `internetOnOffSimulation` getter in a single action:

```tsx
class LoadPrices extends Action {

  checkInternet = { dialog: false }

  get internetOnOffSimulation(): boolean | null {
    return false; // Simulates NO internet
  }

  async reduce() { ... }
}
```

By default, `internetOnOffSimulation` returns the value of
`store.forceInternetOnOffSimulation()`.
