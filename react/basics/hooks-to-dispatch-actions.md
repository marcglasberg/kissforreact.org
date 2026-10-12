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

## useStore

Alternatively, `useStore` gives you all the dispatch methods
(`store.dispatch`, `store.dispatchSync`, `store.dispatchAll`, `store.dispatchAndWait`,
`store.dispatchAndWaitAll` and `store.dispatchWhen`),
and all the wait methods (`store.waitCondition`, `store.waitAllActions`, etc.).

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
