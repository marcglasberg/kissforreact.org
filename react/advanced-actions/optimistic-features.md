---
sidebar_position: 4
---

# Optimistic features

Suppose we have a like button.
When the user taps it, we update the UI right away, and send the new value to the server in
the background. If the user taps the button many times quickly, we want to combine those rapid
changes into as few server calls as possible. If the server rejects the change, we may want to
roll back the UI. And if the user changes the same data on another device, we need to handle
the updates the server pushes to us.

Making all this work correctly is tricky, but the features in this page make it easy.
They are base classes, which your action extends instead of your own base action:

| Feature                  | Purpose                                                                  |
|--------------------------|--------------------------------------------------------------------------|
| `OptimisticCommand`      | Applies a state change optimistically, and rolls it back on error        |
| `OptimisticSync`         | Optimistic updates that coalesce rapid dispatches into few server calls  |
| `OptimisticSyncWithPush` | Like `OptimisticSync`, but with revision tracking for server pushes      |
| `ServerPush`             | Applies the server-pushed updates, for `OptimisticSyncWithPush`          |

Which one to choose:

* Use `OptimisticCommand` for a **command** that must run on the server once per dispatch,
  like creating, deleting, submitting, uploading, or paying.

* Use `OptimisticSync` for a **save** operation where only the last value matters, and the
  user may change it many times quickly, like a "like" button, a settings switch, a slider or
  a checkbox.

* Use `OptimisticSyncWithPush` (together with `ServerPush`) instead of `OptimisticSync` when
  your app also receives server pushes that may change the same value, and more than one
  device may change it.

These features are listed together with all the other action features, and the compatibility
matrix that says which can be combined, in [Action features](./action-features).

---

## OptimisticCommand

`OptimisticCommand` is for actions that send a **command** to the server.
A command is something you want to run on the server once per dispatch. For example:

* Create something (add a todo, create a comment, send a message)
* Delete something
* Submit a form
* Upload a file
* Checkout, place an order, confirm a payment

To give the user instant feedback, it changes the state right away (optimistically),
before the server confirms that the command succeeded.
If the command fails, the state is changed back (rolled back), and the action fails with
the error, which you can show to the user.
Optionally, it can also apply the server response, and reload the value from the server.

### When to use OptimisticSync instead

Use [OptimisticSync](#optimisticsync) or
[OptimisticSyncWithPush](#optimisticsyncwithpush-and-serverpush) when the action is a
**save** operation, where only the last value matters, and intermediate values can be skipped:

* A like or follow toggle
* A settings switch
* A slider or a checkbox
* A field where the last value wins

In save operations, users may tap many times quickly. With `OptimisticCommand`, each tap would
become a separate server call (or be aborted, since it's non-reentrant).
`OptimisticSync` coalesces the rapid changes into as few server calls as possible.

### The problem

Suppose we want to add a new todo to a todo list. This action saves the todo,
then reloads the todo list from the server:

```tsx
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }

  async reduce() {
    try {
      await api.addTodo(this.todo);
    } finally {
      let todos = await api.loadTodos();
      return (state: State) => state.copy({ todos });
    }
  }
}
```

The problem is that it may take a second for the new todo to show up on screen,
while we save and then reload.

The solution is to add the todo to the state _optimistically_, before saving it.
But then, if saving fails, we have to remove it again (roll back). And we must be careful
to not roll back if the todo list was changed by something else in the meantime.
Writing this by hand for every action is tedious and easy to get wrong.

### How to use it

Extend `OptimisticCommand` instead of your base action, and **don't** write a `reduce()` method.
Instead, provide these methods:

| Method                            | Description                                                      |
|-----------------------------------|------------------------------------------------------------------|
| `optimisticValue()`               | Returns the value to apply to the state right away               |
| `getValueFromState(state)`        | Reads that value from the given state                            |
| `applyValueToState(state, value)` | Returns a new state, with the given value applied                |
| `sendCommandToServer(value)`      | Sends the command to the server, and may return the response     |
| `reloadFromServer()`              | Optional. Reloads the value from the server                      |

The `sendCommandToServer` method gets the optimistic value, but it may also use the action
fields.

### Complete example

```tsx
class AddTodo extends OptimisticCommand<State, Todo[]> {
  constructor(readonly todo: Todo) { super(); }

  // The new todo list, to be applied to the state right away.
  optimisticValue() { 
    return [...this.state.todos, this.todo]; 
  }

  // How to read the todo list from the state.
  getValueFromState(state: State) { 
    return state.todos; 
  }

  // How to apply a todo list to the state.
  applyValueToState(state: State, todos: Todo[]) { 
    return state.copy({ todos }); 
  }

  // Send the command to the server.
  sendCommandToServer(todos: Todo[]) { 
    return api.addTodo(this.todo); 
  }

  // Optional: Reload the todo list from the server (by default, only if the command fails).
  reloadFromServer() { 
    return api.loadTodos(); 
  }
}
```

The second type parameter (`Todo[]` above) is the type of the value. It's optional.

Note `OptimisticCommand` extends `KissAction`, not your own base action.
So, if your base action overrides methods like `hasInternet` or `wrapError`,
you have to override them again in your optimistic commands.

This is what happens when the action is dispatched:

1. The optimistic value is applied to the state, right away.
2. The command is sent to the server, with `sendCommandToServer`.
3. If the server returns a response, you can apply it to the state with
   `applyServerResponseToState` (see below).
4. If the command fails, the state is rolled back to the value it had when the action was
   dispatched. But only if the state still has the optimistic value. If something else
   changed that value in the meantime, there is no rollback, so we don't undo newer changes.
5. If you wrote a `reloadFromServer` method, and the command failed,
   the value is reloaded from the server and applied to the state.
6. If the command failed, the action fails with the command error.
   So, a `UserException` is shown to the user, and you can use `useIsFailed(AddTodo)`
   and `useExceptionFor(AddTodo)` in your components.

To check if the command is still running, for example to show a spinner, use `useIsWaiting(AddTodo)`.

Note: To know if the state still has the optimistic value, the values are compared with `Object.is`
(which is the same as `===`, except that `NaN` is equal to `NaN`).
So make sure `getValueFromState` returns the same object that was applied by `applyValueToState`,
or override `shouldRollback` (see below).

### Applying the server response

If `sendCommandToServer` returns a value (not `null` or `undefined`), it's passed to
`applyServerResponseToState`, which may return a new state.
By default, it returns `null`, which means the server response is not applied.

For example, if the server returns the saved todo, with its final id:

```tsx
async sendCommandToServer() {
  return await api.addTodo(this.todo); // Returns the saved todo.
}

applyServerResponseToState(state: State, savedTodo: Todo) {
  return state.copy({ todos: state.todos.map(t => t.id === this.todo.id ? savedTodo : t) });
}
```

### Customizing the rollback

By default, the rollback applies the initial value (the value in `this.initialState`)
with `applyValueToState`. To roll back in a different way, override `rollbackState`.
It gets the initial value, the optimistic value, and the error.
For example, to keep the new todo, but mark it as failed:

```tsx
rollbackState({ initialValue, optimisticValue, error }: {
  initialValue: Todo[], optimisticValue: Todo[], error: any
}) {
  return this.state.copy({ todos: this.state.todos.map(t => 
    t.id === this.todo.id ? t.copy({ failed: true }) : t) 
  });
}
```

Return `null` from `rollbackState` to skip the rollback.

To change _when_ the rollback happens, override `shouldRollback`. It gets the current value,
the initial value, the optimistic value, and the error. For example, to always roll back,
even if the value was changed in the meantime:

```tsx
shouldRollback({ currentValue, initialValue, optimisticValue, error }: {
  currentValue: Todo[], initialValue: Todo[], optimisticValue: Todo[], error: any
}) {
  return true;
}
```

### Customizing the reload

If you don't write a `reloadFromServer` method, there is no reload.
If you do, these methods let you control it:

* `shouldReload` decides if it should reload. By default, it reloads only when the command fails.
  Return `true` to also reload when the command succeeds.

* `shouldApplyReload` decides if the reloaded value should be applied to the state.
  By default, it's always applied, since the server is the source of truth.

* `applyReloadResultToState(state, reloadResult)` applies the reloaded value to the state.
  By default, it uses `applyValueToState`. Override it if the reload returns something
  with a different shape. Return `null` to not apply it.

Both `shouldReload` and `shouldApplyReload` get:

* `currentValue`: The value currently in the state.
* `lastAppliedValue`: The last value this action applied: the optimistic value, or the
  server response value if it was applied, or the rollback value if there was a rollback.
* `optimisticValue`: The optimistic value.
* `rollbackValue`: The value after the rollback, or `undefined` if there was no rollback.
* `error`: The command error, or `null` if the command succeeded.

And `shouldApplyReload` also gets the `reloadResult`.

For example, to also reload on success, but only apply the reloaded value if no other
action changed the value while reloading:

```tsx
shouldReload() {
  return true;
}

shouldApplyReload({ currentValue, lastAppliedValue }: {
  currentValue: Todo[], lastAppliedValue: Todo[]
}) {
  return currentValue === lastAppliedValue;
}
```

If the reload fails after the command succeeded, the action fails with the reload error.
If both the command and the reload fail, the action fails with the command error.

### Non-reentrant

An `OptimisticCommand` is always non-reentrant. If it's dispatched while the same command
is still running, the new dispatch is aborted. This prevents optimistic updates that
overwrite each other, wrong rollbacks, and duplicate requests to the server.

By default, all actions of the same class block each other. If your action has parameters,
and you want to allow commands for different items to run at the same time,
override `nonReentrantKeyParams`:

```tsx
class SaveTodo extends OptimisticCommand<State> {
  constructor(readonly todoId: string) { super(); }

  nonReentrantKeyParams() { return this.todoId; }
  ...
}
```

Now `SaveTodo('A')` and `SaveTodo('B')` can run at the same time,
but a second `SaveTodo('A')` is aborted while the first one is running.
This is useful, for example, to upload many files at the same time (key by file id),
or to send many chat messages at the same time (key by message id).

If you want different action classes to block each other,
override `computeNonReentrantKey` to return the same key:

```tsx
class SaveUser extends OptimisticCommand<State> {
  constructor(readonly userId: string) { super(); }
  
  computeNonReentrantKey() { return this.userId; }
  ...
}

class DeleteUser extends OptimisticCommand<State> {
  constructor(readonly userId: string) { super(); }
  
  computeNonReentrantKey() { return this.userId; }
  ...
}
```

Now `SaveUser('123')` and `DeleteUser('123')` can't run at the same time.

Keys are compared with `Object.is`, except arrays and plain objects, which are compared
by their contents. So `nonReentrantKeyParams()` may return, for example,
`[this.listId, this.todoId]` or `{ id: this.todoId }`.

Don't add `nonReentrant = true` to an `OptimisticCommand`,
since it's already non-reentrant. If you do, the dispatch throws a `StoreException`.

### Retry

You can add the [retry](./control-features#retry) feature. In this case, only
`sendCommandToServer` is retried. The optimistic value stays in the state during the retries,
and the rollback only happens if all attempts fail. This avoids the UI flickering between the
optimistic value and the rolled back value on each attempt.

```tsx
class AddTodo extends OptimisticCommand<State, Todo[]> {
  retry = { maxRetries: 3 };
  ...
}
```

Unlimited retries are not allowed (`maxRetries: -1` or `unlimitedRetries: true`),
since a command that never finishes would block new dispatches of the same command forever.
If you use them, the dispatch throws a `StoreException`.

In a server store (created with `server: true`, the store that loads the data of a request in
[server-side rendering](../miscellaneous/server-side-rendering#the-loading-store)),
`sendCommandToServer` is called once, and not retried.

### CheckInternet

You can add the [checkInternet](./internet-features#checkinternet) feature. In this case, if
there is no internet, the optimistic value is not applied, nothing is sent to the server, and
the action fails (with `checkInternet = { abort: true }`, it's aborted silently instead).

```tsx
class AddTodo extends OptimisticCommand<State, Todo[]> {
  checkInternet = { dialog: true };
  ...
}
```

### Other features

An `OptimisticCommand` can also be combined with `sequential`.
It can't be combined with `nonReentrant` (it's already non-reentrant), `debounce`, `throttle`,
`fresh`, `ignoreOld`, polling or `unlimitedRetryCheckInternet`. Dispatching it with those throws
a `StoreException`.

---

## OptimisticSync

`OptimisticSync` is for actions where user interactions (like toggling a "like" button)
should update the UI immediately, and send the updated value to the server, making sure the
server and the UI are eventually consistent.

Every dispatch applies its value to the state right away, giving instant feedback on every
interaction. However, only **one** request is in flight at a time per key. The changes made
while a request is in flight are coalesced into a single follow-up request, sent when the
current one finishes. This keeps the UI responsive, while minimizing server load.

Typical examples:

* A like or follow toggle
* A settings switch
* A slider or a checkbox
* Any field where the last value wins

> Note: `OptimisticSync` is not built for commands that must run once per dispatch (create,
> delete, submit, upload, checkout...). For those, use [OptimisticCommand](#optimisticcommand).
> And if your app receives server pushes that may change the same value, use
> [OptimisticSyncWithPush](#optimisticsyncwithpush-and-serverpush).

### How it works

1. **Immediate UI feedback**: Every dispatch applies the value returned by `valueToApply()` to
   the state right away, using `applyOptimisticValueToState`.

2. **Single in-flight request**: Only one request runs at a time per key. The first dispatch
   takes the key, and calls `sendValueToServer`.

3. **Follow-up requests**: When the request finishes, the value in the state
   (`getValueFromState`) is compared with the value that was sent. If they are different, the
   user changed it while the request was in flight, so a follow-up request sends the current
   value. This repeats until the state stabilizes.

4. **No unnecessary requests**: If the state changes while the request is in flight, but goes
   back to the value that was sent (for example, the user tapped the button twice), no
   follow-up request is needed.

5. **Server response**: If `sendValueToServer` returns a value, it's applied to the state with
   `applyServerResponseToState`, but only when the state stabilizes.

6. **Completion**: When the synchronization finishes, `onFinish` is called, with the error if
   a request failed.

```
State: liked = false (server confirmed)

User taps LIKE:
  → State: liked = true (optimistic)
  → Key taken, Request 1 sends: setLiked(true)

User taps UNLIKE (Request 1 still in flight):
  → State: liked = false (optimistic)
  → No request sent (key is taken)

User taps LIKE (Request 1 still in flight):
  → State: liked = true (optimistic)
  → No request sent (key is taken)

Request 1 completes:
  → Sent value was `true`, current state is `true`
  → They match, no follow-up needed, key released
```

If the state had been `false` when Request 1 completed,
a follow-up Request 2 would automatically be sent with `false`.

### How to use it

Extend `OptimisticSync` instead of your base action, and **don't** write a `reduce()` method.
Instead, provide these methods:

| Method                                        | Description                                                 |
|-----------------------------------------------|-------------------------------------------------------------|
| `valueToApply()`                              | Returns the value to apply optimistically, and then send    |
| `applyOptimisticValueToState(state, value)`   | Returns a new state, with the given value applied           |
| `getValueFromState(state)`                    | Reads the value from the state, to detect follow-ups        |
| `sendValueToServer(value)`                    | Sends the value to the server, and may return the response  |
| `optimisticSyncKeyParams()`                   | Optional. Separates the keys, for example by item           |
| `applyServerResponseToState(state, response)` | Optional. Applies the server response to the state          |
| `onFinish(error)`                             | Optional. Runs when the synchronization finishes            |

The `valueToApply()` method is called once per dispatch, when the action starts. Its value can
come from the action fields, from the current state, or both. For example, `return true`,
`return this.isLiked`, or `return !this.state.isLiked(this.itemId)` to toggle it.

### Complete example

```tsx
class ToggleLike extends OptimisticSync<State, boolean> {
  constructor(readonly itemId: string) { super(); }

  // Different items can have concurrent requests.
  optimisticSyncKeyParams() { return this.itemId; }

  // The new value to apply (toggle the current state).
  valueToApply() { return !this.state.isLiked(this.itemId); }

  // Apply the optimistic value to the state.
  applyOptimisticValueToState(state: State, liked: boolean) {
    return state.setLiked(this.itemId, liked);
  }

  // Read the current value from the state (used to detect if a follow-up is needed).
  getValueFromState(state: State) { return state.isLiked(this.itemId); }

  // Send the value to the server, and optionally return the server-confirmed value.
  async sendValueToServer(liked: boolean) {
    const response = await api.setLiked(this.itemId, liked);
    return response.liked; // Or return null if the server doesn't return a value.
  }

  // Optional: Apply the server response (can be different from the optimistic value).
  applyServerResponseToState(state: State, liked: boolean) {
    return state.setLiked(this.itemId, liked);
  }

  // Optional: Called when the state stabilizes, or a request fails.
  async onFinish(error: any) {
    if (error !== null) {
      // Reload from the server, to restore the correct state.
      const item = await api.getItem(this.itemId);
      return this.state.setLiked(this.itemId, item.liked);
    }
    return null; // Success, no state change needed.
  }
}
```

Note `OptimisticSync` extends `KissAction`, not your own base action.
So, if your base action overrides methods like `hasInternet` or `wrapError`,
you have to override them again in these actions.

### Using parameters to separate keys

By default, all actions of the same class share the same key. So, while `ToggleLike('A')` has
a request in flight, `ToggleLike('B')` changes the state, but doesn't send its own request.
And the follow-up of `ToggleLike('A')` only checks item A, so item B may never be sent to the
server.

So, if the action changes a different part of the state depending on its fields, override
`optimisticSyncKeyParams` to make the key depend on them too:

```tsx
optimisticSyncKeyParams() { return this.itemId; }
```

Now `ToggleLike('A')` and `ToggleLike('B')` can have concurrent requests.
You can also return an array, like `[this.userId, this.itemId]`.
Params are compared with `Object.is`, except arrays and plain objects, which are compared
by their contents.

By default, the key combines the action class with `optimisticSyncKeyParams()`.
To make different action classes share the same key, override `computeOptimisticSyncKey`:

```tsx
computeOptimisticSyncKey() { return this.itemId; }
```

### Customizing the follow-up requests

The default comparison that decides if a follow-up is needed uses `Object.is`.
So, make sure `getValueFromState` returns the same object you applied, or override
`ifShouldSendAnotherRequest` to use your own equality logic. It gets the value in the state,
the value that was sent, and the number of requests already sent by this action:

```tsx
class SaveSettings extends OptimisticSync<State, Settings> {
  ...

  ifShouldSendAnotherRequest({ stateValue, sentValue, requestCount }: {
    stateValue: Settings, sentValue: Settings, requestCount: number
  }) {
    return !stateValue.equals(sentValue);
  }
}
```

To avoid infinite loops, the number of follow-up requests is limited by `maxFollowUpRequests`,
which is `10000` by default. If the state is still changing after that many follow-ups, the
action fails with a `StoreException`. Use `-1` for no limit:

```tsx
class SaveText extends OptimisticSync<State, string> {
  maxFollowUpRequests = 100;
  ...
}
```

### Server response handling

If `sendValueToServer` returns a value (not `null` or `undefined`), it's passed to
`applyServerResponseToState`, but **only when the state stabilizes** (when no follow-up request
is needed). This prevents the server response from overwriting the changes the user made while
the request was in flight. By default, `applyServerResponseToState` returns `null`, which
means the server response is not applied.

This is useful when the server normalizes or changes the values, or returns the current
state after the update. The server response is applied as is, and doesn't start a follow-up
request.

### Error handling with onFinish

`onFinish` is called when the synchronization for the key finishes. On success, it runs after
the state is stable. On failure, it runs right after the request fails, with the error, and
there are no more follow-up requests. In both cases, the key is released *before* `onFinish`
runs, so new dispatches may already start a new request while it runs.

If `onFinish` returns a state, it's applied. If the request failed, the optimistic value stays
in the state, and after `onFinish` the action fails with the error, so a `UserException` is
shown to the user, and `useIsFailed(ToggleLike)` returns `true`.

Two fields help with rollback logic:

* `optimisticValue`: The value returned by `valueToApply()` for this dispatch.
* `lastSentValue`: The most recent value passed to `sendValueToServer` (`undefined` if this
  dispatch sent no request).

For example, to roll back only if the state still has our optimistic value:

```tsx
async onFinish(error: any) {
  if (error !== null) {
    // If the user made another change, don't overwrite it.
    if (this.getValueFromState(this.state) === this.optimisticValue) {
      return this.applyOptimisticValueToState(this.state, this.getValueFromState(this.initialState));
    }
  }
  return null;
}
```

Note `initialState` is the state when the action that sends the requests was dispatched.
If some of its requests succeeded before one failed, the server may already have a newer value.
That's why reloading the value from the server is usually a safer choice than rolling back:

```tsx
async onFinish(error: any) {
  try {
    const fresh = await api.fetchValue(this.itemId);
    return this.applyServerResponseToState(this.state, fresh);
  } catch (_) {
    return null; // Ignore reload failures, and keep the current state.
  }
}
```

If `onFinish` throws, its error becomes the action error (even if the request succeeded).
You can handle it in `wrapError`.

### Which dispatch sends the requests

Only the dispatch that took the key sends the requests (including the follow-ups), calls
`onFinish`, and waits for them: `dispatchAndWait` waits until the state stabilizes, and
`useIsWaiting(ToggleLike)` is `true` meanwhile. The dispatches made while the key is taken
apply their optimistic value, and then finish right away.

### Clearing

`store.clearInternalActionProps()` (also called by `store.setShutDown(true)`) releases all
keys at once, which is useful on logout. The dispatches made from then on send their own
requests. An action whose request was in flight stops when that request finishes: it doesn't
send follow-up requests, doesn't apply the server response, and doesn't call `onFinish`.
It's aborted, so it doesn't fail, and doesn't show errors.

### Combining with other features

`OptimisticSync` can only be combined with [checkInternet](./internet-features#checkinternet)
(both `{ dialog: true | false }` and `{ abort: true }`). If there is no internet, the
optimistic value is not applied, and no request is sent.

It can't be combined with `nonReentrant`, `retry`, `unlimitedRetryCheckInternet`, `debounce`,
`throttle`, `fresh`, `ignoreOld`, `sequential` or polling. Dispatching it with those throws a
`StoreException`. In special, `sequential` would make the dispatches wait for each other, so
the UI would stop responding immediately, and nothing would be coalesced. Note `OptimisticSync`
already sends a single request per key at a time.

### Difference from other features

| Feature             | Behavior                                                             |
|---------------------|----------------------------------------------------------------------|
| `debounce`          | Waits for inactivity before sending *any* request                    |
| `nonReentrant`      | Aborts the dispatches made while the action runs                     |
| `OptimisticCommand` | Runs once per dispatch, rolls back on failure, and is non-reentrant  |
| `OptimisticSync`    | Immediate feedback, sends the first request right away, coalesces    |

---

## OptimisticSyncWithPush and ServerPush

These two base classes work together, to handle optimistic updates when your app receives
**server-pushed updates** (WebSockets, Server-Sent Events, Firebase, etc.) that may change the
same state your action controls.

* **Extend `OptimisticSyncWithPush`** in the action that sends the user changes to the server.
* **Extend `ServerPush`** in the action that applies the server-pushed updates to the state.

If your app does **not** receive server-pushed updates, use [OptimisticSync](#optimisticsync)
instead. In any case, read the `OptimisticSync` section first, since `OptimisticSyncWithPush`
builds upon that behavior.

**Note:** `ServerPush` must be used alone. It can't be combined with any other feature, not
even `checkInternet`, because a pushed value has to be applied to the state as soon as it
arrives. Any feature that delays, aborts, retries or reorders the action would break that.

### When to use

Use them when:

* Your app receives real-time updates from the server.
* Multiple devices can change the same data.
* You want "last write wins" semantics across devices.
* Updates may arrive out of order.

### How it differs from OptimisticSync

`OptimisticSyncWithPush` works like `OptimisticSync`, but adds revision tracking:

* Each dispatch increments a **local revision** of its key. The server pushes don't.

* When a request finishes, a follow-up request is sent if the latest change of the key was
  made locally, and is newer than the one sent. It's sent even if the value is the same as the
  value that was sent, since other devices may have changed the value on the server meanwhile.
  `OptimisticSync`, in contrast, compares the values, assuming only this device changes them.

* If the latest change came from a **push**, no follow-up is needed, because the push already
  came from the server.

* The server response is only applied if no newer **server revision** is known for the key
  (for example, because a newer push arrived while the request was in flight).

```
State: liked = false

User taps LIKE:
  → State: liked = true (optimistic)
  → Key taken, Request 1 sends: setLiked(true)
  → Local revision is 1

User taps UNLIKE (Request 1 still in flight):
  → State: liked = false (optimistic)
  → No request sent (key is taken)
  → Local revision is 2

A PUSH arrives with liked = false.

Request 1 completes:
  → The last state change was done by a PUSH
  → So a follow-up is NOT needed
  → Key released
```

Without the push, Request 1 would finish with local revision 1, while the current local
revision is 2, so a follow-up request would send `false`.

### OptimisticSyncWithPush example

It has the same methods as `OptimisticSync` (except `ifShouldSendAnotherRequest`), but
`sendValueToServer` also gets the local revision and the device ID, and you must also
implement `getServerRevisionFromState`:

```tsx
class ToggleLike extends OptimisticSyncWithPush<State, boolean> {
  constructor(readonly itemId: string) { super(); }

  optimisticSyncKeyParams() { return this.itemId; }

  valueToApply() { return !this.state.isLiked(this.itemId); }

  applyOptimisticValueToState(state: State, liked: boolean) {
    return state.setLiked(this.itemId, liked);
  }

  getValueFromState(state: State) { return state.isLiked(this.itemId); }

  // IMPORTANT: Read the server revision saved in the state for this key, or -1.
  getServerRevisionFromState(state: State, key: any) {
    return state.revisionOf(this.itemId) ?? -1;
  }

  async sendValueToServer(liked: boolean, localRevision: number, deviceId: number) {
    const response = await api.setLiked(this.itemId, liked, localRevision, deviceId);
    if (!response.ok) throw new Error('Server error');

    // IMPORTANT: Inform the server revision from the response.
    this.informServerRevision(response.serverRevision);

    return response.liked; // Kiss decides whether to apply this.
  }

  applyServerResponseToState(state: State, liked: boolean) {
    return state.setLiked(this.itemId, liked);
  }
}
```

### Key methods for revision tracking

| Method                                                    | Description                                                    |
|-----------------------------------------------------------|----------------------------------------------------------------|
| `sendValueToServer(value, localRevision, deviceId)`       | Sends the value, the local revision and the device ID          |
| `informServerRevision(revision)`                          | Call it in `sendValueToServer`, with the response's revision   |
| `getServerRevisionFromState(state, key)`                  | Reads the server revision saved in the state, or returns `-1`  |
| `OptimisticSyncWithPush.deviceId`                         | Returns the ID of this device                                  |

**Important:** `sendValueToServer` must call `informServerRevision()` after each successful
request. If it doesn't, the action fails with a `StoreException`. If the request fails,
throw an error, and don't call `informServerRevision()`.

The server revision must be a number that always increases (for example, a version number or
a timestamp), and is comparable across devices and users. You can also pass a `Date`, which is
converted to its milliseconds since the epoch:

```tsx
this.informServerRevision(new Date(response.updatedAt));
```

`informServerRevision` only moves the known server revision forward, so stale or out-of-order
responses never make it go back.

The device ID tells apart the revisions of different devices, so the app can recognize the
pushes of its own requests. By default, it's a random number generated once per app run.
You can change it to return a persistent unique ID per device:

```tsx
OptimisticSyncWithPush.deviceId = () => myDeviceId;
```

### What the server must do

* Return the new server revision in the response of each request.
* Push each change to all devices (including the one that made it), with the new value and
  its `PushMetadata`: the server revision, and the local revision and device ID that the
  device that made the change sent in `sendValueToServer`.

### ServerPush example

Extend `ServerPush` in the action that applies the incoming server updates. Dispatch it when
a push arrives:

```tsx
class PushLike extends ServerPush<State> {
  constructor(
    readonly itemId: string, 
    readonly liked: boolean, 
    readonly metadata: PushMetadata,
  ) { super(); }

  // The OptimisticSyncWithPush class that controls this value.
  associatedAction() { return ToggleLike; }

  // Same key params as the associated action.
  optimisticSyncKeyParams() { return this.itemId; }

  // The metadata that came with the push: { serverRevision, localRevision, deviceId }.
  pushMetadata() { return this.metadata; }

  // Apply the push, and save the server revision.
  applyServerPushToState(state: State, key: any, serverRevision: number) {
    return state.setLiked(this.itemId, this.liked).setRevision(this.itemId, serverRevision);
  }

  // Read the server revision saved in the state for this key, or -1.
  getServerRevisionFromState(state: State, key: any) {
    return state.revisionOf(this.itemId) ?? -1;
  }
}

// When the server pushes a change:
socket.on('like', (msg) => store.dispatch(new PushLike(msg.itemId, msg.liked, {
  serverRevision: msg.serverRevision,
  localRevision: msg.localRevision,
  deviceId: msg.deviceId,
})));
```

The key of the push is `associatedAction()` combined with `optimisticSyncKeyParams()`, so it's
the same key as the one of the associated action. If you overrode `computeOptimisticSyncKey`
in the associated action, override it in the `ServerPush` too, so both compute the same key.

Return `null` from `applyServerPushToState` to ignore a push. Its server revision is still
recorded as the newest known one, so older pushes and responses are ignored.

### How revisions work together

```
Local dispatch (ToggleLike):
  → Local revision is 1
  → Sends the request with localRevision = 1
  → The server responds with serverRevision = 100
  → informServerRevision(100) records it

Server push arrives (PushLike):
  → serverRevision is 99 (older than 100)
  → The push is ignored as stale

Server push arrives (PushLike):
  → serverRevision is 101 (newer than 100)
  → The push is applied to the state
  → The request in flight for this key won't send a follow-up,
    unless the user changes the value again
```

### Stale push protection

`ServerPush` automatically ignores stale and out-of-order pushes:

* If the push's server revision is not newer than the newest known server revision for the
  key, the push is ignored. This prevents older server states from overwriting newer ones.

* If the push is the echo of an **older** request of this same device (the user changed the
  value again after that request was sent), it's not applied, since the state already has a
  newer local value. Its server revision is recorded, but it doesn't count as a push, so the
  newer local value is still sent in a follow-up request.

* Otherwise (a push from another device, or the echo of the latest request of this device),
  it's applied, and recorded as the latest change of the key.

### Persisting the server revision

You must save the server revision in your state (in `applyServerPushToState`), and read it in
`getServerRevisionFromState`, in both actions. The newest known server revision is the newest
of the one Kiss keeps in memory, and the one in the state. Saving it in the state is what lets
the app ignore stale pushes even after the revisions Kiss keeps are lost, for example when the
app restarts with a persisted state:

```tsx
class Item {
  constructor(
    readonly liked: boolean,
    readonly serverRevision: number = -1, // Persist this!
  ) {}
}
```

### Clearing

`store.clearInternalActionProps()` (also called by `store.setShutDown(true)`) releases all
keys, and removes the revisions Kiss keeps for them, which is useful on logout. The server
revisions you saved in the state are kept, and still used. As with `OptimisticSync`, an action
whose request was in flight stops when that request finishes, and is aborted without failing.

### Combining with other features

`OptimisticSyncWithPush` can only be combined with
[checkInternet](./internet-features#checkinternet), like `OptimisticSync`.
`ServerPush` can't be combined with any feature. Dispatching them with a feature they can't use
throws a `StoreException`.
