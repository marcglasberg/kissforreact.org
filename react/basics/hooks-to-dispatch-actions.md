---
sidebar_position: 7
---

# Hooks to dispatch actions

You can use the provided hooks to dispatch actions from inside React components,
and also when they mount and unmount.
                                                                                
## useDispatch etc

You can directly use 
hooks `useDispatch`, `useDispatchAll`, `useDispatchAndWait`,
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

`useDispatch` also accepts `onMount`, `onUnmount`, and `onDepsChange` with its `deps`.
Use them to dispatch actions when the component mounts, when some values change,
and when it unmounts:

```tsx
function UserProfile({ userId }: { userId: string }) {

  const dispatch = useDispatch({
    deps: userId,
    onMount: (store) => store.dispatch(new LoadUser(userId)),
    onDepsChange: (store, oldUserId) => {
      store.dispatch(new StopListening(oldUserId));
      store.dispatch(new LoadUser(userId));
    },
    onUnmount: (store) => store.dispatch(new CleanResources()),
  });

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
const dispatch = useDispatch({
  onMount: async (store: Store<State>) => {
    await store.dispatchAndWait(new LoadUser(userId));
    if (store.state.user.isAdmin) store.dispatch(new LoadAdminPanel());
  },
});
```

To get a typed `store.state`, type the store: `onMount: (store: Store<State>) => ...`.

The `deps` can also be an array of values.
In this case, `onDepsChange` gets the old array, and you can check which value changed:

```tsx
const dispatch = useDispatch({
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
Using `useDispatch` is just more convenient, because it handles two things for you:

* **The store must be ready.** Actions can't be dispatched before the store loaded the
  persisted state (see [Persistor](../miscellaneous/persistor#waiting-for-the-store-to-be-ready)).
  If the store is not ready when the component mounts, `onMount` is called as soon as it is.
  And if the component unmounts before that, none of them is called.
  Most components are only shown after the store is ready, so this is usually not a problem
  with `useEffect` either. But if yours can be shown before that, check `useIsStoreReady()`.

* **They run once.** In development, React's `StrictMode` mounts each component twice,
  which would run a `useEffect` twice. With `useDispatch`, `onMount` and `onUnmount` run once,
  and `onDepsChange` runs once per change.

They always run in order: `onMount`, then `onDepsChange` (any number of times),
then `onUnmount`.

## useStore

Alternatively, getting a store reference with `useStore` also allows you to dispatch actions
with `store.dispatch`, `store.dispatchAll`, `store.dispatchAndWait`, `store.dispatchAndWaitAll`
and `store.dispatchWhen`.

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
