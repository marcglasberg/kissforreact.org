---
sidebar_position: 1
---

# Action features

You can add **features** to your actions to handle common tasks.
For example, instead of writing:

```tsx
class LoadText extends Action { ...
```

You can add `checkInternet` to check for internet connectivity:

```tsx
class LoadText extends Action {
  checkInternet = { dialog: true };
  ...
```

Or even combine multiple features:

```tsx
class LoadText extends Action {
  checkInternet = { dialog: true };
  nonReentrant = true;
  retry = { on: true };
  ...
```

Most features are turned on by setting a property in your action, like the ones above.
The optimistic features are different: your action extends a Kiss base class
(like `OptimisticCommand`) instead of your own base action.

## All available features

| Feature                                                             | Purpose                                                                   | How to add                          |
|---------------------------------------------------------------------|---------------------------------------------------------------------------|-------------------------------------|
| [checkInternet](./internet-features#checkinternet)                  | Checks internet before the action; fails, with or without a dialog, if offline | `checkInternet = { dialog: true }` or `{ dialog: false }` |
| [checkInternet (abort)](./internet-features#aborting-when-there-is-no-internet) | Checks internet before the action; aborts silently if offline      | `checkInternet = { abort: true }`   |
| [unlimitedRetryCheckInternet](./internet-features#unlimitedretrycheckinternet) | Combines internet check + unlimited retry + non-reentrant      | `unlimitedRetryCheckInternet = true` |
| [nonReentrant](./control-features#nonreentrant)                     | Aborts if the same action is already running                              | `nonReentrant = true`               |
| [retry](./control-features#retry)                                   | Retries the action on error with exponential backoff                      | `retry = { on: true }`              |
| [throttle](./control-features#throttle)                             | Limits action execution to at most once per throttle period               | `throttle = 5000`                   |
| [debounce](./control-features#debounce)                             | Delays execution until after a period of inactivity                       | `debounce = 300`                    |
| [ignoreOld](./control-features#ignoreold)                           | Ignores and cancels the older actions, when a newer one is dispatched     | `ignoreOld = true`                  |
| [fresh](./control-features#fresh)                                   | Skips the action if its data is still fresh (not stale)                   | `fresh = 5000`                      |
| [polling](./control-features#polling)                               | Adds periodic polling to any action                                       | `poll` and `createPollingAction()`  |
| [sequential](./control-features#sequential)                         | Runs actions one at a time, in the order they were dispatched             | `sequential = true`                 |
| [OptimisticCommand](./optimistic-features#optimisticcommand)        | Applies state changes optimistically, rolls back on error                 | Extend `OptimisticCommand`          |
| [OptimisticSync](./optimistic-features#optimisticsync)              | Optimistic updates with coalescing; merges rapid dispatches into one sync | Extend `OptimisticSync`             |
| [OptimisticSyncWithPush](./optimistic-features#optimisticsyncwithpush-and-serverpush) | Like `OptimisticSync`, but with revision tracking for server pushes | Extend `OptimisticSyncWithPush` |
| [ServerPush](./optimistic-features#optimisticsyncwithpush-and-serverpush) | Handles server-pushed updates for `OptimisticSyncWithPush`          | Extend `ServerPush`                 |

## Compatibility matrix

Not all features can be combined.
Kiss throws a `StoreException` when you dispatch an action with incompatible features.
If you use the [Kiss linter](../linter), its `incompatible-action-features` rule also
reports them in your editor, before you run the code.

|                                 | check<br/>Internet | non<br/>Reentrant | retry | unlimited<br/>Retry<br/>Check<br/>Internet | throttle | debounce | ignore<br/>Old | fresh | Optimistic<br/>Command | Optimistic<br/>Sync | Optimistic<br/>Sync<br/>WithPush | Server<br/>Push | polling | sequential |
|---------------------------------|:------------------:|:-----------------:|:-----:|:------------------------------------------:|:--------:|:--------:|:--------------:|:-----:|:----------------------:|:-------------------:|:--------------------------------:|:---------------:|:-------:|:----------:|
| **checkInternet**               |         —          |        ✅         |  ✅   |                     ❌                     |    ✅    |    ✅    |       ✅       |  ✅   |           ✅           |         ✅          |                ✅                |       ❌        |    ⚠️    |     ✅     |
| **nonReentrant**                |         ✅         |         —         |  ✅   |                     ❌                     |    ❌    |    ✅    |       ❌       |  ❌   |           ❌           |         ❌          |                ❌                |       ❌        |    ⚠️    |     ✅     |
| **retry**                       |         ✅         |        ✅         |   —   |                     ❌                     |    ✅    |    ❌    |       ✅       |  ✅   |           ⚠️            |         ❌          |                ❌                |       ❌        |   ❌    |     ✅     |
| **unlimitedRetryCheckInternet** |         ❌         |        ❌         |  ❌   |                     —                      |    ❌    |    ❌    |       ❌       |  ❌   |           ❌           |         ❌          |                ❌                |       ❌        |   ❌    |     ❌     |
| **throttle**                    |         ✅         |        ❌         |  ✅   |                     ❌                     |    —     |    ✅    |       ✅       |  ❌   |           ❌           |         ❌          |                ❌                |       ❌        |    ⚠️    |     ✅     |
| **debounce**                    |         ✅         |        ✅         |  ❌   |                     ❌                     |    ✅    |    —     |       ✅       |  ✅   |           ❌           |         ❌          |                ❌                |       ❌        |   ❌    |     ❌     |
| **ignoreOld**                   |         ✅         |        ❌         |  ✅   |                     ❌                     |    ✅    |    ✅    |       —        |  ✅   |           ❌           |         ❌          |                ❌                |       ❌        |   ✅    |     ❌     |
| **fresh**                       |         ✅         |        ❌         |  ✅   |                     ❌                     |    ❌    |    ✅    |       ✅       |   —   |           ❌           |         ❌          |                ❌                |       ❌        |    ⚠️    |     ✅     |
| **OptimisticCommand**           |         ✅         |        ❌         |   ⚠️   |                     ❌                     |    ❌    |    ❌    |       ❌       |  ❌   |           —            |         ❌          |                ❌                |       ❌        |   ❌    |     ✅     |
| **OptimisticSync**              |         ✅         |        ❌         |  ❌   |                     ❌                     |    ❌    |    ❌    |       ❌       |  ❌   |           ❌           |          —          |                ❌                |       ❌        |   ❌    |     ❌     |
| **OptimisticSyncWithPush**      |         ✅         |        ❌         |  ❌   |                     ❌                     |    ❌    |    ❌    |       ❌       |  ❌   |           ❌           |         ❌          |                —                 |       ❌        |   ❌    |     ❌     |
| **ServerPush**                  |         ❌         |        ❌         |  ❌   |                     ❌                     |    ❌    |    ❌    |       ❌       |  ❌   |           ❌           |         ❌          |                ❌                |        —        |   ❌    |     ❌     |
| **polling**                     |         ⚠️          |         ⚠️         |  ❌   |                     ❌                     |    ⚠️     |    ❌    |       ✅       |   ⚠️   |           ❌           |         ❌          |                ❌                |       ❌        |    —    |     ⚠️      |
| **sequential**                  |         ✅         |        ✅         |  ✅   |                     ❌                     |    ✅    |    ❌    |       ❌       |  ✅   |           ✅           |         ❌          |                ❌                |       ❌        |    ⚠️    |     —      |

#### ✅ Compatible (can be combined)

#### ❌ Incompatible (cannot be combined)

#### ⚠️ Can be combined, but read the caveat in the feature page

Note `checkInternet = { dialog: ... }` and `checkInternet = { abort: true }` are two ways
of using the same property, so they can't be used together.

Some features also have other requirements:

* `retry` and `unlimitedRetryCheckInternet` need an **async** reducer.
  With a sync reducer, the dispatch fails with a `StoreException`.
* Actions with `debounce` or `sequential` are always async,
  so they can't be dispatched with `dispatchSync`.

## Clearing the features on logout

The store keeps some information for these features: the fresh keys, the throttle and
debounce locks, the `ignoreOld` keys, the polling timers, the sequential queues, the actions
waiting to retry,
the `OptimisticSync` and `OptimisticSyncWithPush` keys, and the revisions kept by
`OptimisticSyncWithPush` and `ServerPush`.

On logout, call `store.clearInternalActionProps()`, so that the actions of the previous user
stop, and don't affect the next user. For example, without it, loading the data of the new
user could be aborted because the data of the previous user is still "fresh".

```tsx
class Logout extends Action {
  reduce() {
    this.store.clearInternalActionProps();
    return State.initialState();
  }
}
```

It does the following:

* Removes the fresh keys and the throttle locks.
* Makes the debounced actions that are still waiting finish, without running their reducer.
* Forgets the `ignoreOld` keys. The actions dispatched after it don't make the ones dispatched
  before it old.
* Stops all polling.
* Discards the actions waiting in sequential queues, so they don't run after the logout.
* Stops the actions that retry (with `retry` or `unlimitedRetryCheckInternet`),
  so they don't keep retrying for the previous user. They are aborted, so they don't fail,
  and don't show errors.
* Releases the `OptimisticSync` and `OptimisticSyncWithPush` keys. An action whose request is
  in flight stops when the request finishes, without sending follow-up requests.
* Removes the revisions kept by `OptimisticSyncWithPush` and `ServerPush`. The server
  revisions you saved in the state are kept, and still used.

Actions that are already running still finish, and may still change the state.
The `nonReentrant` keys are not cleared directly, since they belong to the actions that are
running, but stopping a retrying action releases its key.

It's also called when the store is shut down with `store.setShutDown(true)`.

<hr></hr>

All features are explained in detail in the following pages:

* [Internet features](./internet-features)
* [Control features](./control-features)
* [Optimistic features](./optimistic-features)
