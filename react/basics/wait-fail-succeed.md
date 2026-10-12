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
* `isFailed(actionType)`: Is true if the given action type just failed with a `UserException`.
* `exceptionFor(actionType)`: Returns the `UserException` that caused the action to fail.
* `clearExceptionFor(actionType)`: Clears the exception that caused the action to fail.

Note `isFailed` and `exceptionFor` only consider `UserException`s.
If the action fails with any other error, `isFailed` is false, and `exceptionFor` returns `null`.
If you want them to consider other errors too, your action can turn them into `UserException`s
with its `wrapError()` method, as shown [below](#combining-iswaiting-and-isfailed).

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
Since `isFailed` only considers `UserException`s, the action uses `wrapError()`
to turn any error into a `UserException`:

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

<hr></hr>

You now know the basics of Kiss: 
How to create and read the state, dispatch actions to change the state,
run asynchronous actions, show spinners when actions are running, and error messages when they fail.
That is enough for you to be productive with Kiss, and create your own apps with it.

But before we enter the advanced features, let's review the basics by implementing a few simple
counter apps.
