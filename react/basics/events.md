---
sidebar_position: 10
---

# Events

Some things in a React app belong to the component, not to the state.
An input keeps its own text. A list keeps its own scroll position. A dialog is open or closed.
The component reaches them through refs:

```tsx
const inputRef = useRef<HTMLInputElement>(null);
const listRef = useRef<HTMLDivElement>(null);
```

When an action is dispatched, you may need to clear that input, or scroll that list to the top.
Should the refs be stored in the state, so that the reducer can reach them?
The answer is no. The reducer only creates a new state, and must not touch the UI.

There are also situations where no ref is involved, but you still need to do something once,
like opening a dialog or focusing a field.

Kiss solves these cases with **events**: an action puts an `Evt` in the state,
and the component handles it with the `useEvent` hook.
Events are single-use notifications. Once a component handles an event,
the event is **spent**, so it only triggers once.

## Creating events

Use the `Evt` suffix when naming events. For example, an event that clears an input
can be named `clearInputEvt`.

A boolean event is created with `new Evt()`, with no value. Its value is `true`.
An event can also hold a value of any type, with `new Evt<T>(value)`:

```tsx
const clearInputEvt = new Evt();
const changeTextEvt = new Evt('Hello');
const selectUserEvt = new Evt<User>(user);
```

### Declare spent events in the initial state

Declare the events in your state class, and initialize them as **spent**, with `Evt.spent()`.
A spent event never fires, so nothing happens when the app starts:

```tsx
import { Evt } from 'kiss-for-react';

class State {
  constructor(
    readonly messages: readonly Message[],
    readonly clearInputEvt: Evt,           // A boolean event.
    readonly changeTextEvt: Evt<string>,   // An event with a value.
  ) {}

  static initialState = new State([], Evt.spent(), Evt.spent());
}
```

### Actions place new events in the state

Actions then create new, unspent events, and put them in the state:

```tsx
// A boolean event.
class ClearInput extends Action {
  reduce() {
    return this.state.copy({ clearInputEvt: new Evt() });
  }
}

// An event with a string value.
class ChangeText extends Action {
  async reduce() {
    const text = await api.fetchText();
    return (state: State) => state.copy({ changeTextEvt: new Evt(text) });
  }
}
```

## Handling events

In the component, use `useEvent` with a selector that returns the event,
and a callback that gets its value. The callback runs **once per event**:

```tsx
import { useEvent } from 'kiss-for-react';

function Chat() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Clears the input once, each time the action puts a new event in the state.
  useEvent((state: State) => state.clearInputEvt, () => { inputRef.current!.value = ''; });

  // Gets the text of the event, once per event.
  useEvent((state: State) => state.changeTextEvt, (text) => { inputRef.current!.value = text; });

  return <input ref={inputRef} />;
}
```

The callback runs in an effect, after React commits the render that shows the new state,
like a `useEffect`. It's always the callback of the latest render, so it sees the latest props.
This is how it behaves:

| Situation                                 | `Evt`                        |
|-------------------------------------------|------------------------------|
| New event while the component is mounted  | Fires once                   |
| Event created before the component mounts | Fires once, when it mounts   |
| The component remounts later              | Doesn't fire (already spent) |
| Two components use the same event         | Only the first one fires     |
| Unrelated re-render                       | Doesn't fire                 |
| React's `StrictMode` (effects run twice)  | Fires once                   |

Each event is handled by **one component only**. If more than one component must react to the
same trigger, create separate events in the state, or use an [`EvtState`](#evtstate).

### useLayoutEvent

`useEvent` runs the callback after the browser paints. A scroll or a focus may look better
before the paint. For that, use `useLayoutEvent`, which is the same but runs in a layout effect,
like a `useLayoutEffect`:

```tsx
useLayoutEvent((state: State) => state.scrollToTopEvt, () => listRef.current?.scrollTo({ top: 0 }));
```

Like `useLayoutEffect`, it does nothing on the server, and React 18 warns about it there.
Prefer `useEvent` when the timing doesn't matter.

## Complete example

A chat screen. The `SendMessage` action adds the message and asks the UI to clear the input.
The `ScrollToTop` action, dispatched from a menu somewhere else in the app,
asks the list to scroll to the top:

```tsx
import { Evt, KissAction, useDispatch, useEvent, useLayoutEvent, useSelect } from 'kiss-for-react';

class State {
  constructor(
    readonly messages: readonly string[],
    readonly clearInputEvt: Evt,
    readonly scrollToTopEvt: Evt,
  ) {}

  static initialState = new State([], Evt.spent(), Evt.spent());

  copy(changes: Partial<State>): State {
    return Object.assign(new State(this.messages, this.clearInputEvt, this.scrollToTopEvt), changes);
  }
}

class SendMessage extends KissAction<State> {
  constructor(readonly text: string) { super(); }

  reduce() {
    return this.state.copy({
      messages: [...this.state.messages, this.text],
      clearInputEvt: new Evt(),
    });
  }
}

class ScrollToTop extends KissAction<State> {
  reduce() {
    return this.state.copy({ scrollToTopEvt: new Evt() });
  }
}

function Chat() {
  const messages = useSelect((state: State) => state.messages);
  const dispatch = useDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEvent((state: State) => state.clearInputEvt, () => { inputRef.current!.value = ''; });
  useLayoutEvent((state: State) => state.scrollToTopEvt, () => listRef.current?.scrollTo({ top: 0 }));

  return (
    <>
      <div ref={listRef}>{messages.map((message, i) => <p key={i}>{message}</p>)}</div>
      <input ref={inputRef} />
      <button onClick={() => dispatch(new SendMessage(inputRef.current!.value))}>Send</button>
    </>
  );
}
```

## When should I use events?

Some guidelines:

1. Use events for one-off work on things the component owns: clearing or filling an input,
   changing focus, scrolling, or triggering an animation.
2. Use events for one-off implicit UI state, like opening a dialog, showing a snackbar, or
   navigating.
3. If you need to read the same value more than once, it should be regular state, not an event.
4. If several components need the value, it should be regular state too.

And two cases that look like events, but are simpler without them:

- **The component dispatched the action itself.** It can wait for the action, and then act.
  No event needed:

  ```tsx
  await dispatchAndWait(new SendMessage(text));
  inputRef.current!.value = '';
  ```

- **There's already a state change to react to.** Do it in an effect. For example, scroll to
  the end whenever a message arrives, including messages pushed by the server:

  ```tsx
  useEffect(() => scrollToEnd(), [messages.length]);
  ```

Events are for the rest: an **action** decides that the UI must do something once,
and there is no other state change to watch.
The short answer is that you'll know it when you see it.
When you want something to happen once, and it's not clear how to do it with regular state,
events are often the easier way.

### Why not a boolean or a counter?

A simple value in the state is not enough:

- A **boolean** doesn't work. Once it's `true`, setting it to `true` again changes nothing,
  so a second request is lost.
- A **counter** (or a new object each time), with an effect that runs when it changes,
  only works while the component is mounted. On mount, the component can't tell an event it
  already handled from one that happened before it was mounted. If it ignores the current
  value on mount, events dispatched before mounting are lost. If it fires on mount, it fires
  again on every remount.

To fire an event once, including when the component mounts later, something must remember
that it was already handled. That's what spending the event does.

## Questions

### Can events be in an immutable state?

Yes. The `Evt` object never changes. It's the **store** that remembers which events were spent,
in a `WeakSet`. This means:

- State classes stay immutable, and Kiss keeps comparing states by identity.
- Two stores that share a state object with the same event (for example, in two tests)
  each spend it on their own.
- Events nobody references anymore are garbage collected.

### Why can't I consume an event during render?

Renders must be pure: React may render a component and throw the result away (concurrent
rendering, Suspense), and `StrictMode` renders twice in development. If a render spent the
event, the event could be spent by a render that never shows up, and the UI work would never
happen. So events are only spent in effects, by `useEvent` and `useLayoutEvent`,
which React runs only for renders that are shown.

### Can I read an event without spending it?

Yes. Reading `evt.value` doesn't spend the event. Its type is `T | undefined`, since spent and
restored events have no value. And `store.isEventSpent(evt)` tells whether the event was
already handled. Both are mostly for [tests](#testing). Components should get the value from
`useEvent`.

## EvtState

An `EvtState` is an event that is never spent. Every mounted component that uses it reacts to
it, but only while mounted: events that happen while the component is not mounted are missed.

```tsx
class State {
  constructor(readonly highlightEvt: EvtState<string>) {}
  static initialState = new State(EvtState.spent());
}

// In an action:
reduce() { return this.state.copy({ highlightEvt: new EvtState(this.itemId) }); }

// In any number of components:
useEvent((state: State) => state.highlightEvt, (itemId) => highlight(itemId));
```

Each `new EvtState(value)` is a new object, and the component fires when the state has a
different `EvtState` than the last one it saw:

| Situation                                 | `EvtState`   |
|-------------------------------------------|--------------|
| New event while the component is mounted  | Fires        |
| Event created before the component mounts | Doesn't fire |
| The component remounts later              | Doesn't fire |
| Two components use the same event         | Both fire    |
| Unrelated re-render                       | Doesn't fire |

In the initial state, use `EvtState.spent()`, which never fires. With a `new EvtState()`
there instead, the components would fire again when a `logOut` puts the initial state back.

## Persistence

An old event must not fire when the app restarts: a "scroll to top" from the previous session
would fire as soon as the component mounts. So the `ClassPersistor` saves events as spent,
without their value, and restores them as `Evt.spent()` (and `EvtState.spent()`).
You don't need to list `Evt` and `EvtState` in its `classesToSerialize`.

If you write your own [persistor](../miscellaneous/persistor), do the same: don't save the
events, or restore them as `Evt.spent()`.

## Testing

In action tests, check that the action created a new event, and its value:

```ts
const before = store.state.clearInputEvt;
await store.dispatchAndWait(new SendMessage('Hi'));
expect(store.state.clearInputEvt).not.toBe(before);
expect(store.state.messages).toEqual(['Hi']);

await store.dispatchAndWait(new ChangeText()); // With `api.fetchText` mocked to return 'Hello'.
expect(store.state.changeTextEvt.value).toBe('Hello');
```

In component tests, `store.isEventSpent(evt)` tells whether a component handled the event:

```ts
expect(store.isEventSpent(store.state.clearInputEvt)).toBe(true);
```

## Lint rules

The [linter](../intro#linter) has two rules for events:

- `event-name-suffix`: name event fields with the `Evt` suffix.
- `event-not-spent-initially`: use `Evt.spent()` in the initial state, not `new Evt()`,
  which would fire when the first component mounts.
