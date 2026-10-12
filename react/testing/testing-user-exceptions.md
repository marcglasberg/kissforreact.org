---
sidebar_position: 2
---

# Testing UserExceptions

As [previously discussed](../basics/user-exceptions), 
when an action encounters an error which is not a bug, but rather a user mistake, 
it can throw the built-in `UserException` error. 

This page discusses how to test when `UserException`s are thrown.

For example, suppose you want to test that users are warned 
if they typed letters in some field that only accepts numbers. 
To that end, your test would dispatch the appropriate action, wait for it
to finish, and then check the [action.status](../advanced-actions/action-status) field.

The status can tell us if the action finished with or without errors:

* `status.isCompleted` is `true` if the action finished, and `false` if the action is still running,
  or if it hasn't been dispatched yet.

* `status.isCompletedOk` is `true` if the action finished without errors (in more detail, if the
  action's methods `before` and `reduce` finished without throwing any errors).

* `status.isCompletedFailed` is `true` if the action finished with errors.

Note both `isCompletedOk` and `isCompletedFailed` are `false` while the action is still running,
or if it hasn't been dispatched yet. So `isCompletedFailed` is the same as
`isCompleted && !isCompletedOk`.

And then, there are two errors we can read:

* `status.originalError` is the error that was originally thrown by the action's `before`
  or `reduce` methods. However, this error might have been changed by the action itself, by the
  action's `wrapError()` method.

* `status.wrappedError` is the error that was thrown by the action's `before` or `reduce` methods,
  after being changed by the action itself, by the action's `wrapError()` method.
  If the action didn't change the error, `status.originalError` and `status.wrappedError` will be
  the same.

Since the `action.status` field is immutable, the whole field will be replaced during the action 
lifecycle. This means your test needs to wait until the action is finished before getting 
a copy of its status.

Here's an example:

```ts
let status = await store.dispatchAndWait(new MyAction());
expect(status.isCompletedFailed).toBe(true);

let error = status.wrappedError; 
expect(error).toBeInstanceOf(UserException);
expect(error.message).toBe("You can't do this.");
```

## Checking the error queue

Since `UserException`s don't represent bugs in the code, 
Kiss puts them into the store's `userExceptionsQueue` queue. 
They are then shown to the user, one at a time, by the store's `showUserException` function
(usually a modal error dialog). 

Each `UserException` is removed from the queue when it's shown. 
When the UI calls `next()`, the next one in the queue is shown.
In other words, this queue holds the `UserException`s that were thrown by actions,
but were not shown to the user yet.

Note that, by default, `showUserException` only logs the error and calls `next()` right away,
so the queue is usually empty. 

If you want to check the queue in your test, you can create the store with
a `showUserException` that never calls `next()`. 
This way, the first `UserException` is shown, and the others stay in the queue, 
in the order they were thrown:

```ts
let shown: UserException[] = [];

const store = new Store<State>({
  initialState: new State(),
  
  // Never calls next(), so the first error stays shown.
  showUserException: (exception, count, next) => { shown.push(exception); },
});

await store.dispatchAndWaitAll([
  new MyAction1(), 
  new MyAction2(), 
  new MyAction3()
]);

// The first error was shown.
expect(shown.length).toBe(1);
expect(shown[0].message).toBe("You can't do this.");

// The other errors are waiting in the queue.
let errors = store.userExceptionsQueue;
expect(errors.length).toBe(2);
expect(errors[0].message).toBe("You can't do that.");
expect(errors[1].message).toBe("You can't do the other thing.");
```

 
