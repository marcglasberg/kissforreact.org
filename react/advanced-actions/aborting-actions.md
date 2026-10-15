---
sidebar_position: 11
---

# Aborting actions

An action that is in progress can be aborted: its request is cancelled, its result is ignored,
and it finishes silently. This is what a "Cancel" button needs, and what a component needs
to stop a request it started, when the component unmounts.

## store.abort

Call `store.abort(ActionType)` to abort all the actions of that type (or of a subclass) that
are in progress:

```tsx
class UploadFile extends Action {
  constructor(readonly file: File) { super(); }

  async reduce() {
    let response = await fetch('/api/upload', { method: 'POST', body: this.file, signal: this.abortSignal });
    let { url } = await response.json();
    return (state: State) => state.copy({ uploadedUrl: url });
  }
}

function UploadButtons() {
  const store = useStore();
  const isUploading = useIsWaiting(UploadFile);
  return (
    <>
      <button onClick={() => store.dispatch(new UploadFile(file))}>Upload</button>
      <button onClick={() => store.abort(UploadFile)} disabled={!isUploading}>Cancel</button>
    </>
  );
}
```

Each aborted action finishes silently:

* Its `abortSignal` is aborted. If the request got the signal, it's cancelled right away.
* Its result is ignored: the state is not changed.
* Its errors are ignored: no error dialog, it doesn't count as failed (`isFailed` is `false`),
  and it isn't retried. This includes the `AbortError` that `fetch` throws when its signal is
  aborted.
* Its status has `isDispatchAborted: true`, and `dispatchAndWait` resolves.
* Inside the action, `this.isAborted` is `true`.

If no action of the type is in progress, `store.abort` does nothing.

### Requests that don't use the signal

Pass `this.abortSignal` to `fetch`, or to any other API that accepts an `AbortSignal` (like
axios), so that the request is cancelled as soon as the action is aborted. For work that doesn't
accept a signal, check it yourself, between the steps:

```tsx
async reduce() {
  let user = await loadUser(this.userId);
  this.abortSignal.throwIfAborted();
  let posts = await loadPosts(user);
  return (state: State) => state.copy({ user, posts });
}
```

If the request ignores the signal, the action is still in progress (`isWaiting` is `true`)
until the request finishes. Only then its result is ignored. So the state is always protected,
but the spinner only goes away when the request ends.

### Aborting only some actions

Pass `{ statusKey }` to abort only the actions with that [statusKey](../basics/wait-fail-succeed#status-per-key):

```tsx
store.abort(LoadUser, { statusKey: userId });
```

### Aborting when a component unmounts

In [useStoreEffect](../basics/hooks-to-dispatch-actions#dispatching-when-the-component-mounts), abort in `onUnmount`
the action that `onMount` dispatched. If the user leaves the page before the request finishes,
the request is cancelled, and its result doesn't land in the state later:

```tsx
useStoreEffect({
  onMount: (store) => store.dispatch(new LoadUser(userId)),
  onUnmount: (store) => store.abort(LoadUser),
});
```

## action.abort

To abort a single action instance, call its `abort()` method. The other actions of the same
type are not affected:

```tsx
const action = new LoadUser(userId);
store.dispatch(action);
...
action.abort();
```

An action aborted before it's dispatched doesn't run at all: `before`, `reduce` and `after` are
not called, and its status has `isDispatchAborted: true`. Aborting an action that already
finished has no effect.

## isAborted

Inside the action, `this.isAborted` is `true` when the action was aborted, by `store.abort`,
by `abort()`, or by [ignoreOld](./control-features#ignoreold), when a newer action with the
same key was dispatched. Only the state returned by the reducer is ignored. Anything else the
reducer does still happens, like dispatching other actions. To avoid that, check `isAborted`
after the `await`:

```tsx
async reduce() {
  let items = await loadItems(this.tab);
  if (!this.isAborted) this.dispatch(new LoadItemImages(items));
  return (state: State) => state.copy({ items });
}
```

## Other notes

* An action aborted during its `before` method doesn't run its reducer.
* An action aborted while waiting to [retry](./control-features#retry) stops retrying right
  away.
* This is different from [aborting the dispatch](./aborting-the-dispatch), where the action
  itself decides, in `abortDispatch()`, that it must not run.
