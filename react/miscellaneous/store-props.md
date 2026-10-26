---
sidebar_position: 7
---

# Store props, and disposing the store

Apps have long-lived things that are not state: intervals and timeouts, WebSockets,
`EventSource`s, `AbortController`s, Firebase `onSnapshot` listeners (which return an
unsubscribe function), RxJS subscriptions. To work with **timers and listeners**, follow these
guidelines:

* Don't put timers or listeners in the store state. They produce state changes, but they are
  not state themselves. The lint rule `non-state-object-in-state` reports them there.

* Don't send timers or listeners down to components. Don't create, subscribe to, or
  unsubscribe from them inside components.

* Create actions to start and stop them, and keep them in the store **props**.

The props are a map that belongs to the store, where actions can put these things, read
them, and close them. Since they belong to the store, each test (or each request, in
server-side rendering) has its own, and they can all be closed at once: when the app finishes,
on logout, or at the end of each test.

## Example

Suppose you want to listen to changes of the user document in Firestore. Create one action to
start listening, and another to stop. The listener's callback dispatches an action, which puts
the data into the state. Components that use that part of the state update automatically:

```tsx
class StartListeningToUser extends Action {
  reduce() {
    const unsubscribe = onSnapshot(doc(db, 'users', this.userId), (snapshot) => {
      this.dispatch(new SetUser(snapshot.data() as User));
    });
    this.setProp('userListener', unsubscribe, { dispose: (unsubscribe) => unsubscribe() });
    return null;
  }
}

class StopListeningToUser extends Action {
  reduce() {
    this.disposeProp('userListener');
    return null;
  }
}
```

When to dispatch these actions depends on how long the listener should live:

* If it should run all the time, dispatch the start action as soon as the app launches,
  right after creating the store. Stop it when the app finishes, with
  [`store.dispose()`](#disposing-the-store).

* If it should run only while a screen is open, start it when the screen mounts, and stop it
  when it unmounts, with [`useStoreEffect`](../basics/hooks-to-dispatch-actions#dispatching-when-the-component-mounts):

  ```tsx
  function UserScreen({ userId }: { userId: string }) {
    useStoreEffect({
      onMount: (store) => store.dispatch(new StartListeningToUser(userId)),
      onUnmount: (store) => store.dispatch(new StopListeningToUser()),
    });
    ...
  }
  ```

* If it should run only when some action needs it, that action can dispatch the start and
  stop actions.

## Setting and disposing a prop

The same works for timers. Here, an interval that dispatches a `Tick` action every second:

```tsx
class StartClock extends Action {
  reduce() {
    const interval = setInterval(() => this.dispatch(new Tick()), 1000);
    this.setProp('clock', interval, { dispose: clearInterval });
    return null;
  }
}

class StopClock extends Action {
  reduce() {
    this.disposeProp('clock');
    return null;
  }
}
```

`setProp(key, value, options?)` sets the prop. The key can be any value. Keys are compared by
identity, like the keys of a `Map`: equal strings are the same key, but two different objects
are not.

`disposeProp(key)` disposes the value, and removes the prop. It does nothing if there is no
prop with that key.

These methods are also available on the store, as `store.setProp()` and `store.disposeProp()`,
together with:

* `prop(key)` returns the prop, or `undefined` if there is none. Give it the type of the
  value: `this.prop<number>('clock')`. Reading the prop doesn't dispose it.
* `props` lists all the props, with their keys and values, in the order they were set. It's a
  read-only map, useful in tests.
* `disposeProps(predicate?)` disposes many props at once, as explained below.

## How a prop is disposed

When a prop is disposed, Kiss closes its value. In order:

1. The `dispose` option given to `setProp`, if any. It gets the value.
2. The value's `[Symbol.asyncDispose]()` or `[Symbol.dispose]()` method (TC39 explicit resource
   management, the one TypeScript's `using` uses).
3. An `AbortController` is aborted.
4. A `WebSocket`, `EventSource`, `BroadcastChannel` or `MessagePort` is closed, and a `Worker`
   is terminated.
5. An object with an `unsubscribe()` method, like an RxJS subscription, is unsubscribed.
6. Otherwise, the value can't be disposed, and it's only removed from the props.

Some things to note:

* **Timers need the `dispose` option.** In browsers, `setTimeout` and `setInterval` return
  numbers, which can't be told apart from other numbers. Use `{ dispose: clearInterval }` or
  `{ dispose: clearTimeout }`.
* **Functions are not called automatically.** An unsubscribe function looks the same as a
  callback kept in a prop. Use `{ dispose: (unsubscribe) => unsubscribe() }`.
* **Promises can't be cancelled.** They're only removed. Keep an `AbortController` in a prop to
  cancel the work.
* **Setting a prop again disposes the previous value.** If `StartClock` is dispatched twice,
  the first interval is cleared when the second one replaces it, so it doesn't leak. Setting
  the same value again only updates its `dispose` option.
* **A disposal that fails doesn't stop the others.** If the `dispose` throws, or returns a
  promise that rejects, the error is given to the `errorObserver` (with a `null` action), or
  logged if there is none. The other props are still disposed.
* **The `dispose` option can be async.** `disposeProp` and `disposeProps` don't wait for it,
  but `store.dispose()` and `logOut` do.

## Disposing many props

`disposeProps()` disposes all the props, and removes them. With a predicate, it disposes only
the props the predicate selects, and keeps the others:

```tsx
// Disposes all props.
store.disposeProps();

// Disposes only the props whose key starts with 'user'.
store.disposeProps((key, value) => String(key).startsWith('user'));
```

The props are disposed in the order they were set.

## Logout

By default, `logOut()` keeps the props, since some of them belong to the app, and not to the
user: a connectivity listener, for example. Pass `disposeProps: true` to dispose all of them, or
a predicate to dispose only the ones that belong to the user:

```tsx
await store.logOut({
  initialState: State.initialState,
  disposeProps: (key) => key !== 'connectivity',
});
```

They are disposed right away, when logOut starts, so that the previous user's timers and
listeners stop before the new user logs in.

## Disposing the store

To end the store, call `store.dispose()`. This is useful at the end of each test, so that
timers and listeners don't leak from one test to the next, and don't keep Jest from exiting:

```tsx
let store: Store<State>;

beforeEach(() => { store = createStore<State>({ initialState: State.initialState }); });
afterEach(() => store.dispose());
```

It's also how the store that loads the data of a request is ended, at the end of the request,
in [server-side rendering](./server-side-rendering#one-store-per-request).

It does the following, in order:

1. Shuts down the store (`setShutDown(true)`), so that the actions dispatched from now on are
   aborted. This also calls `clearInternalActionProps()`, which stops the polling, the retries,
   the debounce timers, the sequential queues, and the other action features.
2. Cancels the `dispatchWhen`s that are still waiting, so their actions are not dispatched, and
   their `onTimeout` is not called.
3. Pauses the persistor, and cancels its pending save. A save that is already running still
   finishes. If you want the current state saved first, call `await store.persistAndPause()`
   before.
4. Disposes all the props, and removes them.

It returns a promise that resolves when the async disposals of the props finish. It never
rejects: a disposal that fails is reported as explained above, and the other props are still
disposed.

The store can't be used again. `setShutDown(false)` doesn't turn it back on, and a prop set
after it (for example, by an async action that was still running) is disposed right away, and
not kept. `store.isDisposed` tells if the store was disposed. Calling `dispose()` again does
nothing. Note the actions that were already running still finish, and may still change the
state.

The store also implements `[Symbol.dispose]` and `[Symbol.asyncDispose]`, so you can use
TypeScript's explicit resource management, which disposes the store at the end of the block:

```tsx
test('Selecting an item', async () => {
  await using store = createStore<State>({ initialState: State.initialState });

  await store.dispatchAndWait(new SelectItem(2));
  expect(store.state.selectedItem).toBe(2);
});
```

## Summary

1. Put timers and listeners in the store props, with `setProp`, never in the state.
2. Create actions to start and stop them. The stop action calls `disposeProp`.
3. The timer or listener callback should dispatch actions to put the data into the state.
4. Give `setProp` a `dispose` option for timers and functions. Other things, like an
   `AbortController` or a `WebSocket`, Kiss knows how to close.
5. Call `store.dispose()` when the app finishes, and at the end of each test.

See also [dependency injection](./dependency-injection), for the services the actions use
(API clients, repositories, etc), which are injected into the store and disposed with it.
