---
sidebar_position: 7
---

# Hooks to dispatch actions

You can use the provided hooks to dispatch actions from inside React components,
and also when they mount and unmount.
                                                                                
## useDispatch etc

You can directly use 
hooks `useDispatch`, `useDispatchSync`, `useDispatchAll`, `useDispatchAndWait`,
`useDispatchAndWaitAll` and `useDispatchWhen`.

For example:

```tsx
function MyComponent() { 
  const dispatch = useDispatch();  

  return (
    <Button onClick={() => dispatch(new LoadText())}> 
      Click me! 
    </Button>
  );
};
```

## Dispatching when the component mounts

Use `useStoreEffect` instead of a `useEffect`
to dispatch actions when the component mounts (`onMount`),
when some values change (`deps` and `onDepsChange`),
and when it unmounts (`onUnmount`):

```tsx
function UserProfile({ userId }: { userId: string }) {

  useStoreEffect({
    deps: userId,
    onMount: (store) => store.dispatch(new LoadUser(userId)),
    onDepsChange: (store, oldUserId) => {
      store.dispatch(new StopListening(oldUserId));
      store.dispatch(new LoadUser(userId));
    },
    onUnmount: (store) => store.dispatch(new CleanResources()),
  });

  const dispatch = useDispatch();

  return (
    <Button onClick={() => dispatch(new SaveUser())}>
      Save
    </Button>
  );
};
```

* `onMount` is called once, when the component mounts.

* `onDepsChange` is called when `deps` change. It gets the old value.
  The new value is the one in your component, as usual.

* `onUnmount` is called once, when the component unmounts.

All of them are optional, and they get the store,
so you can use any of its dispatch methods (`store.dispatch`, `store.dispatchAndWait`, etc.),
and read its current `store.state`. They may also be async:

```tsx
useStoreEffect({
  onMount: async (store: Store<State>) => {
    await store.dispatchAndWait(new LoadUser(userId));
    if (store.state.user.isAdmin) store.dispatch(new LoadAdminPanel());
  },
});
```

Note they are not awaited. In the example above, if the component unmounts
while `onMount` is still waiting for `LoadUser`, `onUnmount` runs right away,
and `onMount` continues after it.

To get a typed `store.state`, type the store: `onMount: (store: Store<State>) => ...`.

The `deps` can also be an array of values.
In this case, `onDepsChange` gets the old array, and you can check which value changed:

```tsx
useStoreEffect({
  deps: [userId, filter],
  onMount: (store) => store.dispatch(new LoadUser(userId, filter)),
  onDepsChange: (store, [oldUserId, oldFilter]) => {
    if (userId !== oldUserId) {
      store.dispatch(new StopListening(oldUserId));
      store.dispatch(new LoadUser(userId, filter));
    }
    else if (filter !== oldFilter) store.dispatch(new ApplyFilter(filter));
  },
});
```

The `deps` are compared with `Object.is`, like React's dependencies.
So, don't create new objects or arrays in each render,
or they will be considered changed in every render.

Note changing the `deps` doesn't call `onMount` again.
If you want to dispatch the same actions on mount and when the `deps` change,
call the same function from both `onMount` and `onDepsChange`.

### What about useEffect?

You can still dispatch actions from a `useEffect`, as usual, if you prefer.
Using `useStoreEffect` is just more convenient, because it handles two things for you:

* **The store must be ready.** Actions can't be dispatched before the store loaded the
  persisted state (see [Persistor](../miscellaneous/persistor#waiting-for-the-store-to-be-ready)).
  If the store is not ready when the component mounts, `onMount` is called as soon as it is.
  And if the component unmounts before that, none of them is called.
  Most components are only shown after the store is ready, so this is usually not a problem
  with `useEffect` either. But if yours can be shown before that, check `useIsStoreReady()`.

* **They run once.** In development, React's `StrictMode` mounts each component twice,
  which would run a `useEffect` twice. With `useStoreEffect`, `onMount` and `onUnmount` run once,
  and `onDepsChange` runs once per change.

They are always called in order: `onMount`, then `onDepsChange` (any number of times),
then `onUnmount`. But, as said above, async ones are not awaited.

### When they run

Apart from the two points above, they work like a `useEffect`, in production and in development:

* `onMount` runs at the same time as a `useEffect(..., [])` in the same place of the component.
  `onDepsChange` runs at the same time as a `useEffect(..., [deps])`,
  but not after the first render.
  And `onUnmount` runs at the same time as the cleanup of a `useEffect`.
  So the actions they dispatch are dispatched at the same time as from a `useEffect`.

* When a component is replaced by another one in the same render (in a route switch, for
  example), the `onUnmount` of the old one runs before the `onMount` of the new one.

* They always see the values of the latest render.

* Some React features disconnect the effects and connect them again, without really unmounting
  the component. As for a `useEffect`, this calls `onUnmount`, and then `onMount` again.
  For example, `<Activity>` does it when it hides the component and shows it again.
  And in development, Fast Refresh does it to a component when you edit its code.

* Their errors are not caught, as in a `useEffect`. A sync error goes to React,
  which shows the nearest error boundary. A rejected promise is an unhandled promise rejection.

* A component can call `useStoreEffect` more than once. They run in the order they are called.

There's only one difference in timing, which you'll hardly ever notice:
if the component unmounts in the same synchronous run as its mount (before any microtask),
`onUnmount` waits one microtask. This is how Kiss knows if it's `StrictMode`'s fake unmount,
which happens right after the mount. In this case, `onUnmount` is cancelled.
Also, when `onMount` waits for the store to be ready, or `onUnmount` waits that microtask,
even a sync error is an unhandled promise rejection.

## Dispatching when the app is focused or online again

The data on screen gets old while the user is on another browser tab, or offline.
To reload it when the user comes back to the tab, or when the internet comes back,
add `onFocus` and `onOnline` to `useStoreEffect`:

```tsx
useStoreEffect({
  onMount: (store) => store.dispatch(new LoadPrices()),
  onFocus: (store) => store.dispatch(new LoadPrices()),
  onOnline: (store) => store.dispatch(new LoadPrices()),
});
```

* `onFocus` is called when the app is focused again. In the browser, that's when the document
  becomes visible: the user comes back to the tab, or restores the window.
  `onBlur` is called when it loses focus.

* `onOnline` is called when the app is online again, and `onOffline` when it goes offline.

They are called on the transitions only, never on mount, and only while the component is
mounted (and after `onMount` was called, so after the store is ready).
Like the other callbacks, they get the store, see the values of the latest render,
and are not awaited.

To reload only when the data is old, give the action a
[`fresh`](../advanced-actions/control-features#fresh) period.
A focus within the period is then aborted silently, and the data on screen is kept.
Without `fresh`, the action runs on every focus.

### Where "focused" and "online" come from

The store knows whether the app is focused and online, in `store.isFocused` and `store.isOnline`.
In the browser, by default, the app is focused when `document.visibilityState` is not `hidden`,
and online when `navigator.onLine` is true, following the `visibilitychange`, `online` and
`offline` events. Where the store can't know (the server, Node, React Native), both are `true`.

To use something else, give `createStore` a `focusSource` or an `onlineSource`.
Each is a function that gets a setter to call whenever the value changes
(and right away, with the current value, if it knows it),
and returns a function that stops listening, called by `store.dispose()`.
For example, in React Native:

```tsx
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const store = createStore<State>({
  initialState: State.initialState,
  focusSource: (setFocused) => {
    setFocused(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
    return () => sub.remove();
  },
  onlineSource: (setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
});
```

The sources are only started when something first reads the signal: `store.isFocused`,
`useIsFocused()`, or a `useStoreEffect` with `onFocus`. A component with `onMount` only
doesn't make the store listen to anything. A server store (created with `server: true`, for
[server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)) never
starts them: there, both signals are always `true`.

The online signal is also what the
[`checkInternet`](../advanced-actions/internet-features#checkinternet) and
`unlimitedRetryCheckInternet` action features check by default,
so an `onlineSource` makes them work in React Native with no change to the actions.

### Showing it in components

The hooks `useIsFocused()` and `useIsOnline()` return the signals, and re-render the component
when they change. For example, to show an "offline" banner:

```tsx
function OfflineBanner() {
  const isOnline = useIsOnline();
  if (isOnline) return null;
  return <Banner>You are offline. Changes will be sent when you are back online.</Banner>;
}
```

On the server, both are always `true`.

### In tests

Drive the signals by hand with `store.setFocused(false)` and `store.setOnline(false)`.
The store then stops listening to its source, and only changes when you call them again.
Pass `null` to listen to the source again.

```tsx
store.setFocused(false); // The user went to another tab.
store.setFocused(true);  // The user came back: the onFocus callbacks run.
```

## useStore

Alternatively, `useStore` gives you all the dispatch methods
(`store.dispatch`, `store.dispatchSync`, `store.dispatchAll`, `store.dispatchAndWait`,
`store.dispatchAndWaitAll` and `store.dispatchWhen`),
all the wait methods (`store.waitCondition`, `store.waitAllActions`, etc.),
and `store.abort`, to [abort the actions](../advanced-actions/aborting-actions) of a type.

For example:

```tsx
function MyComponent() { 
  const store = useStore();  

  return (
    <Button onClick={() => store.dispatch(new LoadText())}> 
      Click me! 
    </Button>
  );
};
```

The methods also work when destructured: `const { dispatch, dispatchAndWait } = useStore()`.

It also has `store`, which is the store itself, with its `state` and all its other methods:

```tsx
const { store } = useStore();
console.log(store.actionsInProgress());
```

But note `useStore` doesn't make the component re-render when the state changes.
So, read `store.state` only in event handlers, effects and callbacks, never to render the component.
To render it, use `useSelect`, `useObject` or `useAllState`, and `useIsWaiting`, `useIsFailed`, etc.
