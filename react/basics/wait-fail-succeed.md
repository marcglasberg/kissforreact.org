---
sidebar_position: 9
---

# Wait, fail, succeed

A common pattern in app development involves having a process that can either succeed or fail.
You want to display a spinner during the process, show the result when it completes,
and present an error message if it fails.

These are called "process phases":

* **Waiting**: The process is currently running.
* **Failed**: The process failed with an error.
* **Succeeded**: The process succeeded.

In Kiss, these processes start when actions are dispatched, which means we need a way to
know if an action is currently being processed, if it just failed, and eventually show an error.

Thankfully, this is very easy to do with Kiss, by using the following functions:

* `isWaiting(actionType)`: Is true if the given action type is currently being processed.
* `isFailed(actionType)`: Is true if the given action type just failed, with any error.
* `exceptionFor(actionType)`: Returns the `UserException` that caused the action to fail.
* `clearExceptionFor(actionType)`: Clears the failed state of the action.

Each of them also accepts an array of action types, like `isWaiting([LoadUser, LoadPosts])`,
to ask about several types at once. See [several action types](#several-action-types).

Note `isFailed` is true for any error, but `exceptionFor` only returns `UserException`s.
If the action fails with some other error, `isFailed` is true, but `exceptionFor` returns `null`.
If you want an error message for those errors too, your action can turn them into
`UserException`s with its `wrapError()` method, as shown [below](#combining-iswaiting-and-isfailed).

## In actions

In actions, we have direct access to the process phase functions above by
using `this.isWaiting`, `this.isFailed`, `this.exceptionFor` and `this.clearExceptionFor`.

For example, suppose we want to create a `SellAction` action that sells a stock.
However, if there is already a `BuyAction` action currently running,
we want to show an error message instead. This is how you can do it:

```ts    
class SellAction extends Action {
  constructor(public stock: string) { super(); }

  async reduce() {
  
    // Make sure we're not in the middle of a buy process 
    if (this.isWaiting(BuyAction)) {
      throw new UserException('Please wait for the current order to complete.');
    }
    
    // Only then post the sell order to the backend
    let amount = await postSellOrder(this.stock);    
    
    return (state: State) => 
      state.copy({
        stocks: state.stocks.setAmount(this.stock, amount)
      });
  }
}
```

Note we can't use `this.isWaiting(SellAction)` to check if another `SellAction` is running.
The running action is itself a `SellAction`, so that would always be true.

If you also don't want two `SellAction`s running at the same time,
add [nonReentrant](../advanced-actions/control-features#nonreentrant) to the action.
Then, if a `SellAction` is dispatched while another one is still running,
the new one is aborted. It's silently ignored, as if it had never been dispatched:

```ts
class SellAction extends Action {
  constructor(public stock: string) { super(); }
  
  // Aborts the action if another SellAction is still running
  nonReentrant = true;

  async reduce() {
    ...
  }
}
```

## In components

In components, we have access to the process phase functions by using the
hooks `useIsWaiting`, `useIsFailed`, `useExceptionFor` and `useClearExceptionFor`.

We have already previously seen how to read the state and dispatch actions from components:

```tsx    
function MyComponent() {

  const state = useAllState<State>(); 
  const store = useStore();
  
  return (
    <div>
      <p>Counter: {state.counter}</p>
      <button onClick={() => store.dispatch(new IncrementAction())}>Increment</button>
    </div>
  );
};
```

Now, let's see how to show a spinner while an action is being processed, and show an error message.

## Show a spinner

Hook `useIsWaiting(actionType)` returns true if the given action type is currently being
processed. By using this hook, you can show a spinner while an action is being processed:

```tsx
function MyComponent() {

  const isWaiting = useIsWaiting(IncrementAction);
  const state = useAllState<State>(); 
    
  return (
    <div>
      {
      isWaiting 
        ? <CircularProgress /> 
        : <p>Counter: {state.counter}</p>
      }
    </div>
  );
};
```

## Show an error message

Hook `useIsFailed(actionType)` returns true if the given action type just failed
with a `UserException`.
By using this hook, you can show an error message when an action fails:

```tsx
function MyComponent() {

  const isFailed = useIsFailed(IncrementAction);
  const state = useAllState<State>(); 
    
  return (
    <div>
      {
      isFailed 
        ? <p>Loading failed...</p> 
        : <p>Counter: {state.counter}</p>
      }
    </div>
  );
};
```

You can also get the `UserException` by doing
`let error = useExceptionFor(actionType)` and then get the error message
to eventually show it in the UI.

```tsx
function MyComponent() {

  const isFailed = useIsFailed(IncrementAction);
  const exception = useExceptionFor(IncrementAction);
  const state = useAllState<State>(); 
    
  return (
    <div>
      {
      isFailed 
        ? <p>Loading failed: {exception?.message}</p>
        : <p>Counter: {state.counter}</p>
      }
    </div>
  );
};
```

## Combining isWaiting and isFailed

Let's suppose we've got an async action that loads some text from a server.
Loading may fail with any error, for example when there is no internet.
`isFailed` will be true for any of them. But if you also want an error message to show,
`exceptionFor` only returns `UserException`s, so the action uses `wrapError()`
to turn any error into a `UserException` with a message:

```ts
class LoadText extends Action {

  async reduce() {
    let response = await fetch('https://www.example.com/text');
    let text = await response.text();
    return (state: State) => state.copy({someText: text});
  }

  wrapError(error: any) {
    return new UserException('Loading failed.', {hardCause: error});
  }
}
```

Now you can show a spinner while the action is being processed,
and show an error message if the action fails:

```tsx
function MyComponent() {

  const isWaiting = useIsWaiting(LoadText); 
  const isFailed = useIsFailed(LoadText);  
  const state = useAllState<State>();  
  
  if (isWaiting) return <CircularProgress />
  if (isFailed) return <p>Loading failed...</p>;
  return <p>{state.someText}</p>;
}
```

Now let's repeat the previous code, but add a button that retries the action:

```tsx
function MyComponent() {

  const isWaiting = useIsWaiting(LoadText); 
  const isFailed = useIsFailed(LoadText);  
  const state = useAllState<State>();  
  const store = useStore();
  
  if (isWaiting) return <CircularProgress />
  
  if (isFailed) return (
    <div>
      <p>Loading failed...</p>
      <button onClick={() => store.dispatch(new LoadText())}>Retry</button>    
    </div>
  );
  
  return <p>{state.someText}</p>;
}
```

As soon as the user presses the retry button, the spinner will be shown again, and the
error message will be cleared. This happens because the error message is cleared automatically
when the action is dispatched again.

You could always clear the error message explicitly by defining
`let clearExceptionFor = useClearExceptionFor();` and then calling `clearExceptionFor(LoadText)`,
but it's not necessary to do so before dispatching the action again.

## Several action types

A screen often loads more than one thing. To show one spinner while any of them runs, and
one error message if any of them fails, pass an array of action types:

```tsx
function ProfileScreen() {

  const isWaiting = useIsWaiting([LoadUser, LoadPosts]);
  const isFailed = useIsFailed([LoadUser, LoadPosts]);
  const exception = useExceptionFor([LoadUser, LoadPosts]);
  const user = useSelect((state: State) => state.user);
  const posts = useSelect((state: State) => state.posts);

  if (isWaiting) return <CircularProgress />;
  if (isFailed) return <p>{exception?.message ?? 'Loading failed.'}</p>;
  return <Profile user={user} posts={posts} />;
}
```

With an array:

* `isWaiting` is true while an action of **any** of the types runs.
* `isFailed` is true if **any** of the types failed.
* `exceptionFor` returns the `UserException` of the first type in the array that has one.
  So put first the type whose message matters most.
* `clearExceptionFor([LoadUser, LoadPosts])` clears the failures of all the types.

Don't write `useIsWaiting(LoadUser) || useIsWaiting(LoadPosts)`. When the first hook returns
true, the second hook is not called, and that breaks React's rules of hooks. Use the array,
or call each hook in its own line.

## Status per key

The functions above work per action class. `useIsWaiting(LoadUser)` is true while **any**
`LoadUser` is running, and `useIsFailed(LoadUser)` is true if **any** `LoadUser` failed.

Suppose a list of users, where each row dispatches `LoadUser(userId)` to load its own user.
With the functions above, every row would show a spinner while any one user loads.

To tell the actions apart, give the action a `statusKey`. It's a getter that returns a value
made from the action's own fields:

```ts
class LoadUser extends Action {
  constructor(readonly userId: string) { super(); }

  get statusKey() { return this.userId; }

  async reduce() {
    let user = await loadUser(this.userId);
    return (state: State) => state.withUser(user);
  }
}
```

Then, pass the same value to the hooks, in the `statusKey` option. Each row now sees only its
own user:

```tsx
function UserRow({ userId }: { userId: string }) {

  const isWaiting = useIsWaiting(LoadUser, { statusKey: userId });
  const isFailed = useIsFailed(LoadUser, { statusKey: userId });
  const error = useExceptionFor(LoadUser, { statusKey: userId });
  const user = useSelect((state: State) => state.users[userId]);

  if (isWaiting) return <CircularProgress />;
  if (isFailed) return <p>{error?.message ?? 'Loading failed.'}</p>;
  return <p>{user?.name}</p>;
}
```

The same option works in `store.isWaiting`, `store.isFailed`, `store.exceptionFor` and
`store.clearExceptionFor`, in their `this.` versions inside actions, and in the function
returned by `useClearExceptionFor`. Without the option, they consider all actions of the
type, whatever their keys, as before.

With an [array of action types](#several-action-types), the key applies to all the types:
`useIsWaiting([LoadUser, LoadPosts], { statusKey: userId })`.

The key can be a string, a number, an array like `[userId, cartId]`, or a plain object.
Arrays and plain objects are compared by content.

Two rules:

* **The key must always be the same.** Make it only from the fields set in the action's
  constructor. Don't use anything that can change: the state, the current time, or a field
  the action changes while it runs. The store reads the key when the action is dispatched,
  when it fails, and every time `isWaiting` is asked, so a key that changes would leave an
  old error on screen, or make the spinner stop matching the action.

* **Failures stay in memory until cleared.** For `isWaiting`, nothing extra is kept. For
  `isFailed` and `exceptionFor`, the store keeps a small record of each failure (the action
  type, the key, and the error). Without `statusKey` there is at most one record per action
  class. With `statusKey`, there is one record per key that failed, for example one per user
  whose `LoadUser` failed. A record goes away when the action runs again for that key, when
  you call `clearExceptionFor(LoadUser, { statusKey: userId })`, or when you call
  `clearExceptionFor(LoadUser)` without a key, which clears all keys of that type.
  `store.clearAllExceptions()` clears all types. You rarely need it, because `logOut()`,
  `clearInternalActionProps()` and the shutdown of the store already call it.

## Suspense and error boundaries

The hooks above are the recommended style: the component reads the status, and decides what
to show. But if your app already uses React's `<Suspense>` and error boundaries, you can use
the `useSuspense` hook instead. It does the same work as `useIsWaiting` and `useIsFailed`
together, in the Suspense style:

```tsx
function UserName({ userId }: { userId: string }) {
  useSuspense(LoadUser, { statusKey: userId });
  const user = useSelect((state: State) => state.users[userId]);
  return <p>{user.name}</p>;
}

function UserCard({ userId }: { userId: string }) {
  return (
    <ErrorBoundary fallback={<p>Loading failed.</p>}>
      <Suspense fallback={<CircularProgress />}>
        <UserName userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

This is what happens:

* **While `LoadUser` runs** for that key, `useSuspense` throws a promise. React stops the
  render at that line (the code after the hook doesn't run), and shows the `fallback` of the
  nearest `<Suspense>` above the component, in its place. When the action finishes, the
  promise resolves, and React renders the component again from the start. Only the nearest
  `<Suspense>` is affected. Other boundaries, above it or in other branches of the tree, keep
  showing their content.

* **If `LoadUser` failed** for that key, `useSuspense` throws the error. The nearest error
  boundary above the component catches it, and shows its fallback instead. Like `useIsFailed`,
  it throws any error, not only `UserException`s. The failure stays recorded in the store until
  the action is dispatched again, or `clearExceptionFor` is called. So a "retry" button in the
  boundary should dispatch the action again, and then reset the boundary: the component
  mounts again, suspends while the action runs, and then shows the result. If you want to
  handle the failure yourself, pass `throwErrors: false`, and use `useIsFailed` or
  `useExceptionFor` in the component.

* **Otherwise**, the hook returns, and the component renders normally.

Without `statusKey`, `useSuspense(LoadUser)` suspends while **any** `LoadUser` runs (or any
action of a subclass, like `useIsWaiting`), and throws the most recent failure of the type.

When the component needs the result of several actions, pass an array:
`useSuspense([LoadUser, LoadPosts])`. The component suspends while an action of **any** of the
types runs, and renders again when none of them runs. Then, if any of them failed, it throws
the error of the first type in the array that failed.

On the server, and while hydrating, `useSuspense` never suspends or throws, like the other
status hooks (see [server-side rendering](../miscellaneous/server-side-rendering)). After
hydration, it follows the live store.

Two things to know about React's Suspense:

* A component that suspends on its **first** render is thrown away, and rendered again from
  the start when the action finishes. Its local state (`useState`, `useRef`) is lost. A
  component that had already rendered keeps its state while suspended: React hides it, and
  shows the fallback in its place.

* The store creates a promise only when a component actually suspends, and releases it when
  the action finishes. An app that never calls `useSuspense` pays nothing for it.

<hr></hr>

You now know the basics of Kiss: 
How to create and read the state, dispatch actions to change the state,
run asynchronous actions, show spinners when actions are running, and error messages when they fail.
That is enough for you to be productive with Kiss, and create your own apps with it.

But before we enter the advanced features, let's review the basics by implementing a few simple
counter apps.
