---
sidebar_position: 5
---

# Comparing with XState

This page is for people who know XState. It shows how to get the same results with Kiss, which
does things in a different way, and what changes when an AI agent writes the code. Each section
shows the XState code first, and then the Kiss code that does the same.

XState is based on **state machines** and **actors**. A machine lists the states it can be in,
like `idle`, `loading` and `failure`, and the events that move it from one state to another.
Next to the state, it keeps data, called the **context**, which changes with `assign` when a
transition happens. A running machine is an actor. You send it events, and components read its
snapshot.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components read the state
with a selector, and re-render when the selected value changes.

The two agree on a lot. Every change is a named message: an event in XState, an action in Kiss.
The logic lives outside the components. And it can be tested without a UI. Where they differ is
what comes first. So, every time XState "sends an event that makes a transition", Kiss
"dispatches an action that returns a new state". And every time XState "is in a state", Kiss
either "has an action running" or "has a field with that value".

## The big difference

XState starts from **behavior**: what can happen next, given where you are. You draw the states
and the arrows between them, and the data rides along in the context. This is great for a flow
with many steps and rules, like a checkout, a video call, or a multi-step form. The machine
shows every step, and an event that doesn't fit the current step is simply ignored.

But most of an app is not a flow. It's data: a list of todos, a user, some settings, a filter.
That data changes in many ways, in almost any order, and there is no diagram to draw. In
XState, that data still goes through the machine: each change is an event, a transition, and
an `assign`, with the event typed in a union and the implementation named in `setup`. And every
request to the server becomes states of its own: `loading`, `success` and `failure`.

Kiss starts from **data**. The state is one class, and an action changes it. When a part of the
app really is a flow, the step is a field of the state, and the rules go in the state class.

Three things follow from this, and they come up in every section below:

* **Loading and failure are not states you draw.** In XState, every request is a `loading`
  state, an `onDone` arrow, an `onError` arrow, a `failure` state, and an `error` field in the
  context. In Kiss, the store tracks which actions are running and which have failed, and the
  components ask.

* **The logic is code, not configuration.** An XState machine is a big object, where the
  targets are strings, and the actions, guards and actors are names, implemented somewhere
  else, in `setup`. In Kiss, an action is a class, and its logic is plain `if`, `await` and
  `return`.

* **There is one state, not many actors.** In XState, each actor keeps its context to itself.
  Other actors can't read it. They can only send it events. In Kiss, every action can read the
  whole state.

|                           | XState                                           | Kiss                                      |
|---------------------------|--------------------------------------------------|-------------------------------------------|
| State                     | A finite state value, plus the `context`         | An immutable value                        |
| Changing the state        | Send an event. The transition runs `assign`.     | An action class with `reduce()`           |
| Async changes             | Invoke a promise actor, with `onDone`, `onError` | `async reduce()`                          |
| Loading and failed states | States you draw: `loading`, `failure`            | `useIsWaiting`, `useIsFailed`             |
| Flows with steps          | States and transitions                           | A field for the step, and state methods   |
| Rules about what can run  | Guards, and events the state doesn't handle      | `abortDispatch()`, state methods          |
| Timers                    | Delayed transitions (`after`)                    | `debounce`, store props                   |
| Retry, debounce, fresh    | Built with extra states and `after`              | Action features                           |
| Optimistic updates        | By hand                                          | `OptimisticCommand`, `OptimisticSync`     |
| App-wide state            | One big machine, or many actors sending events   | One `State` class                         |
| Dependencies              | `machine.provide()`                              | Injected into the store                   |
| Persistence               | `getPersistedSnapshot()` (plain JSON)            | The persistor (plain objects and classes) |
| Diagrams of the logic     | Yes (Stately Studio, the inspector)              | No                                        |
| Testing without UI        | Yes                                              | Yes                                       |

## Quick translation

If you know XState, this table tells you where to look in Kiss. The sections below explain each
line, with code.

| XState                                                          | Kiss                                                                          |
|-----------------------------------------------------------------|-------------------------------------------------------------------------------|
| `setup({ types, actions, actors, guards }).createMachine(...)`  | A `State` class, given to `createStore({ initialState })`, and action classes  |
| The `context`                                                   | The fields of the `State` class                                               |
| `createActorContext(machine)` and its `Provider`                | `StoreProvider`                                                               |
| An event, like `{ type: 'todo.add', todo }`                     | An action, like `new AddTodo(todo)`                                           |
| The union of events in `types.events`                           | Not needed. Each action class is its own type.                                |
| `actorRef.send(event)`                                          | `dispatch(action)`, or `store.dispatch(action)`                               |
| A transition that runs `assign({ ... })`                        | `reduce()`, returning `this.state.copy({ ... })`                              |
| `TodoContext.useSelector((snapshot) => snapshot.context.todos)` | `useSelect((state) => state.todos)`                                           |
| `useSelector(actorRef, selector, shallowEqual)`                 | `useObject(selector)`                                                         |
| `invoke` a `fromPromise` actor, with `onDone` and `onError`     | `async reduce()`. Errors are thrown.                                          |
| `snapshot.matches('loading')`                                   | `useIsWaiting(LoadTodos)`                                                     |
| `snapshot.matches('failure')`, and an `error` in the context    | `useIsFailed(LoadTodos)`, `useExceptionFor(LoadTodos)`                        |
| `snapshot.matches('payment')`, in a flow with steps             | `state.checkout.step === 'payment'`                                           |
| `guard`                                                         | `abortDispatch()`, or a state method that returns the state unchanged         |
| An event ignored because the current state doesn't handle it   | `abortDispatch()`, `nonReentrant`                                             |
| Nested states                                                   | Nested state classes                                                          |
| Parallel states (`type: 'parallel'`)                            | Separate fields of the `State` class                                          |
| History states                                                  | A field that remembers the previous step                                      |
| `after: { 3000: 'hidden' }` (delayed transition)                | `debounce`, or a timer in the store props                                     |
| An invoked actor, stopped when its state is exited              | `ignoreOld`, `store.abort()`, `abortReduce()`                                 |
| `signal` in `fromPromise`                                       | `this.abortSignal`                                                            |
| `entry` and `exit` actions                                      | The action that changes the step does it                                      |
| `spawn` (one actor per item)                                    | `statusKey`                                                                   |
| `sendTo`, `system.get(systemId)`                                | Not needed. Actions read the whole state, and dispatch other actions.         |
| `emit`, and `actorRef.on(...)` in a component                   | `Evt` in the state, and `useEvent`                                            |
| `machine.provide({ actors, actions })`                          | `dependencies` in `createStore`, and `store.mocks` in tests                   |
| `getPersistedSnapshot()`, and the `snapshot` option             | The [persistor](../miscellaneous/persistor)                                   |
| `inspect`, the Stately inspector                                | `actionObserver`, `stateObserver`                                             |
| `createActor(machine).start()` and `waitFor` in tests           | `new Store(...)`, `dispatchAndWait`, `waitCondition`                          |
| Retry, debounce, fresh (built with states)                      | `retry`, `debounce`, `fresh`                                                  |
| `@xstate/store`                                                 | See [XState Store](#xstate-store)                                             |

## Creating the store

In XState, you describe the machine with `setup` and `createMachine`. The types of the context
go in `setup`, and the initial context goes in the machine. To share one running machine with
the whole app, you create a context with `createActorContext`, and put its `Provider` at the
top:

```tsx title="XState"
import { setup } from 'xstate';
import { createActorContext } from '@xstate/react';

const todoMachine = setup({
  types: {
    context: {} as { todos: Todo[]; user: User | null },
  },
}).createMachine({
  context: { todos: [], user: null },
});

export const TodoContext = createActorContext(todoMachine);

<TodoContext.Provider>
  <App />
</TodoContext.Provider>
```

This machine has no states yet. It's only context, which is how XState holds plain data.

In Kiss, the state is one class. The fields are readonly, and `copy()` returns a new state with
some fields changed. The store gets the initial state, and `StoreProvider` passes the store to
the components:

```tsx title="Kiss"
class State {
  constructor(
    readonly todos: readonly Todo[],
    readonly user: User | null,
  ) {}

  copy(changes: Partial<State>): State {
    return Object.assign(new State(this.todos, this.user), changes);
  }

  static initialState = new State([], null);
}

const store = createStore<State>({ initialState: State.initialState });

<StoreProvider store={store}>
  <App />
</StoreProvider>
```

See [Store and state](../basics/store-and-state).

## Changing the state

In XState, a change is an event. You add its type to the union of events in `setup`, and handle
it in the machine with a transition. The transition runs `assign`, which gets the context and
the event, and returns the new values of some fields. A component sends the event to the
actor:

```tsx title="XState"
const todoMachine = setup({
  types: {
    context: {} as { todos: Todo[] },
    events: {} as
      | { type: 'todo.add'; todo: Todo }
      | { type: 'todo.remove'; id: string },
  },
}).createMachine({
  context: { todos: [] },
  on: {
    'todo.add': {
      actions: assign({ todos: ({ context, event }) => [...context.todos, event.todo] }),
    },
    'todo.remove': {
      actions: assign({ todos: ({ context, event }) => context.todos.filter((todo) => todo.id !== event.id) }),
    },
  },
});

// In a component.
const todoActor = TodoContext.useActorRef();
todoActor.send({ type: 'todo.add', todo });
```

Each change is written in three places: its type in the union, its transition in the machine,
and the `send` in the component. The event name is a string, so to find who handles
`'todo.add'`, you search for the string.

In Kiss, a change is an action. An action is a class. Its constructor parameters are the data it
needs, and its `reduce()` method returns the new state. The class is the type, the payload, and
the handler, in one place:

```tsx title="Kiss"
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  reduce() { return this.state.copy({ todos: [...this.state.todos, this.todo] }); }
}

class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }
  reduce() { return this.state.copy({ todos: this.state.todos.filter((todo) => todo.id !== this.id) }); }
}

// In a component.
const dispatch = useDispatch();
dispatch(new AddTodo(todo));
```

There is nothing to register, and no union to keep up to date. In your IDE, you can click
`AddTodo` where it's dispatched and land on its reducer. See
[Actions and reducers](../basics/actions-and-reducers).

## Components

In XState, a component reads the actor with `useSelector`, and gives it a selector. The
component re-renders when the selected value changes. With `createActorContext`, the hooks come
from the context you created:

```tsx title="XState"
function TodoList() {
  const todos = TodoContext.useSelector((snapshot) => snapshot.context.todos);
  const todoActor = TodoContext.useActorRef();

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id} onClick={() => todoActor.send({ type: 'todo.remove', id: todo.id })}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

In Kiss, it's the same idea. `useSelect` gets a selector, and the component re-renders when the
selected value changes:

```tsx title="Kiss"
function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  const dispatch = useDispatch();

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id} onClick={() => dispatch(new RemoveTodo(todo.id))}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

To select several values at once, XState's `useSelector` takes `shallowEqual` as a third
argument, and Kiss has `useObject`, which compares the new object with the previous one, value
by value:

```tsx title="XState"
import { shallowEqual } from '@xstate/react';

const { name, age } = TodoContext.useSelector(
  (snapshot) => ({ name: snapshot.context.user.name, age: snapshot.context.user.age }),
  shallowEqual,
);
```

```tsx title="Kiss"
const { name, age } = useObject((state: State) => ({ name: state.user.name, age: state.user.age }));
```

XState also has `useMachine(machine)`, which creates an actor that lives and dies with one
component, and re-renders the component on every change. In Kiss, the app state lives in the
store, where actions and tests can reach it. See
[Components use the state](../basics/components-use-the-state).

## Async changes

In XState, an async change is an actor, usually a promise wrapped in `fromPromise`. You name it
in `setup`, and **invoke** it in a state. When the machine enters that state, the promise
starts. When it resolves, the `onDone` transition runs, and the result is in `event.output`.
When it rejects, the `onError` transition runs, and the error is in `event.error`. So, loading
the todos needs a `loading` state, a `success` state, a `failure` state, and an `error` field:

```tsx title="XState"
const todoMachine = setup({
  types: {
    context: {} as { todos: Todo[]; error: unknown },
    events: {} as { type: 'todos.load' },
  },
  actors: {
    loadTodos: fromPromise(({ signal }) => api.loadTodos(signal)),
  },
}).createMachine({
  initial: 'idle',
  context: { todos: [], error: null },
  states: {
    idle: { on: { 'todos.load': 'loading' } },
    loading: {
      invoke: {
        src: 'loadTodos',
        onDone: { target: 'success', actions: assign({ todos: ({ event }) => event.output }) },
        onError: { target: 'failure', actions: assign({ error: ({ event }) => event.error }) },
      },
    },
    success: { on: { 'todos.load': 'loading' } },
    failure: { on: { 'todos.load': 'loading' } },
  },
});

function TodoList() {
  const todoActor = TodoContext.useActorRef();
  const todos = TodoContext.useSelector((snapshot) => snapshot.context.todos);
  const isLoading = TodoContext.useSelector((snapshot) => snapshot.matches('loading'));
  const isFailed = TodoContext.useSelector((snapshot) => snapshot.matches('failure'));
  const error = TodoContext.useSelector((snapshot) => snapshot.context.error);

  useEffect(() => { todoActor.send({ type: 'todos.load' }); }, [todoActor]);

  if (isLoading) return <Spinner />;
  if (isFailed) return <p>{String(error)}</p>;
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

This is what XState is known for, and it's a good idea. With two flags, `isLoading` and
`isError`, a bug can make both true at once. The machine is in one state at a time, so it can't
be loading and failed together. Those "impossible states" are gone.

The cost is that you draw this machine for every request. And since the machine is in one state
at a time, a screen that loads the todos **and** the user at the same time needs two parallel
regions, each with its own `loading`, `success` and `failure`, or a second machine.

Kiss removes the impossible states in another way: it doesn't keep them. An action can be async.
Its `reduce()` method awaits what it needs, and returns a function that produces the new state.
If something goes wrong, the action throws, and the state is not changed:

```tsx title="Kiss"
class LoadTodos extends Action {
  async reduce() {
    const todos = await this.deps.api.loadTodos(this.abortSignal);
    return (state: State) => state.copy({ todos });
  }
}

function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  const isWaiting = useIsWaiting(LoadTodos);
  const isFailed = useIsFailed(LoadTodos);
  const error = useExceptionFor(LoadTodos);

  useStoreEffect({ onMount: (store) => store.dispatch(new LoadTodos()) });

  if (isWaiting) return <Spinner />;
  if (isFailed) return <p>{error?.message}</p>;
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

There are no `loading` and `failure` states, and no `error` field, because loading and failure
are not state you keep. They are questions you ask about the action: is `LoadTodos` running? Did
it fail? Kiss tracks the answers, so they can't contradict each other, and nothing has to be
drawn. Each action class has its own status, so loading the todos and the user at the same time
is two actions, with no parallel regions. And any component can ask, not only the one that
dispatched the action. See [Wait, fail, succeed](../basics/wait-fail-succeed).

To turn any error into a message for the user, override `wrapError()` in the action. A
`UserException` is shown to the user in a dialog, by default:

```tsx title="Kiss"
class LoadTodos extends Action {
  async reduce() { ... }

  wrapError(error: any) {
    return new UserException('Could not load the todos.', { hardCause: error });
  }
}
```

## Flows with steps

Some parts of an app really are flows: a checkout, a wizard, a sign-up with email
verification. The user is at one step, and only some things can happen at that step. This is
where XState is at its best. Here is a checkout with four steps. The user can go back, but not
while the order is being placed:

```tsx title="XState"
const checkoutMachine = setup({
  types: {
    context: {} as { address: Address | null; orderId: string | null; error: unknown },
    events: {} as
      | { type: 'checkout.start' }
      | { type: 'address.submit'; address: Address }
      | { type: 'order.place' }
      | { type: 'back' },
  },
  actors: {
    placeOrder: fromPromise(({ input }: { input: { address: Address } }) => api.placeOrder(input.address)),
  },
}).createMachine({
  initial: 'cart',
  context: { address: null, orderId: null, error: null },
  states: {
    cart: {
      on: { 'checkout.start': 'shipping' },
    },
    shipping: {
      on: {
        'address.submit': { target: 'payment', actions: assign({ address: ({ event }) => event.address }) },
        back: 'cart',
      },
    },
    payment: {
      on: { 'order.place': 'placingOrder', back: 'shipping' },
    },
    placingOrder: {
      invoke: {
        src: 'placeOrder',
        input: ({ context }) => ({ address: context.address! }),
        onDone: { target: 'done', actions: assign({ orderId: ({ event }) => event.output }) },
        onError: { target: 'payment', actions: assign({ error: ({ event }) => event.error }) },
      },
    },
    done: { type: 'final' },
  },
});
```

The whole flow is in one place, and each step lists what can happen there. An event that the
current step doesn't handle is ignored, so `back` does nothing while the order is being placed,
and `order.place` does nothing twice.

In Kiss, the step is a field of the state, with a union type. The rules of the flow go in the
state class, which is where Kiss puts [business logic](../miscellaneous/business-logic). Each
method returns the next `Checkout`, or the same one when the move is not allowed at the current
step:

```tsx title="Kiss"
type Step = 'cart' | 'shipping' | 'payment' | 'done';

class Checkout {
  constructor(
    readonly step: Step,
    readonly address: Address | null = null,
    readonly orderId: string | null = null,
  ) {}

  start() {
    return this.step === 'cart' ? new Checkout('shipping') : this;
  }

  withAddress(address: Address) {
    return this.step === 'shipping' ? new Checkout('payment', address) : this;
  }

  back() {
    if (this.step === 'shipping') return new Checkout('cart');
    if (this.step === 'payment') return new Checkout('shipping', this.address);
    return this;
  }

  get canPlaceOrder() { return this.step === 'payment' && this.address !== null; }

  withOrder(orderId: string) { return new Checkout('done', this.address, orderId); }
}
```

So the whole flow is in one place here too, and it's a plain class, which you can test without a
store. The actions call it. The one that places the order is async. It runs only at the
`payment` step, and only once at a time. The `placingOrder` state is not needed, because it's
`useIsWaiting(PlaceOrder)`:

```tsx title="Kiss"
class StartCheckout extends Action {
  reduce() { return this.state.copy({ checkout: this.state.checkout.start() }); }
}

class SubmitAddress extends Action {
  constructor(readonly address: Address) { super(); }
  reduce() { return this.state.copy({ checkout: this.state.checkout.withAddress(this.address) }); }
}

class Back extends Action {
  abortDispatch() { return this.isWaiting(PlaceOrder); } // Not while the order is being placed.
  reduce() { return this.state.copy({ checkout: this.state.checkout.back() }); }
}

class PlaceOrder extends Action {
  nonReentrant = true;
  abortDispatch() { return !this.state.checkout.canPlaceOrder; }

  async reduce() {
    const orderId = await this.deps.api.placeOrder(this.state.checkout.address!);
    return (state: State) => state.copy({ checkout: state.checkout.withOrder(orderId) });
  }

  wrapError(error: any) {
    return new UserException('Could not place the order.', { hardCause: error });
  }
}
```

In the component, `useSelect((state: State) => state.checkout.step)` picks the screen to show,
`useIsWaiting(PlaceOrder)` disables the buttons, and a failed order shows a dialog, with the
user still at the `payment` step.

This is how each part translates:

* A state of the machine is a value of the `step` field.
* A transition is a method of the state class, called by an action.
* An event that the current state doesn't handle is a method that returns `this`, or an action
  whose `abortDispatch()` returns `true`. Both are ignored, silently, as in XState. If you'd
  rather tell the user, throw a `UserException` in the reducer instead.
* A state that only exists while a promise runs, like `placingOrder`, is `useIsWaiting` of the
  action.

What Kiss doesn't give you is the diagram. If a flow has dozens of steps, and the hard part of
the feature is the flow itself, seeing it drawn helps, and that is what XState is built for.
Most features are not like that.

## Nested, parallel and history states

XState machines can nest states inside states, run several regions in parallel, and remember the
last step with a history state. A media player, for example, is playing or paused, and at the
same time muted or not:

```tsx title="XState"
const playerMachine = setup({ ... }).createMachine({
  type: 'parallel',
  states: {
    playback: {
      initial: 'paused',
      states: {
        paused: { on: { play: 'playing' } },
        playing: { on: { pause: 'paused' } },
      },
    },
    volume: {
      initial: 'unmuted',
      states: {
        unmuted: { on: { mute: 'muted' } },
        muted: { on: { unmute: 'unmuted' } },
      },
    },
  },
});

snapshot.matches({ playback: 'playing', volume: 'muted' });
```

In Kiss, these are fields:

* **Parallel states** are separate fields. Two things that change on their own are two fields
  of the state: `isPlaying` and `isMuted`.
* **Nested states** are nested state classes. The checkout above is a field of the `State`
  class, with its own `step`, so `{ checkout: 'payment' }` is `state.checkout.step === 'payment'`.
* **History states** are a field that remembers the previous value, like `previousStep`, set by
  the method that leaves the step.

```tsx title="Kiss"
class Player {
  constructor(readonly isPlaying: boolean, readonly isMuted: boolean) {}
  play() { return new Player(true, this.isMuted); }
  mute() { return new Player(this.isPlaying, true); }
  ...
}

const { isPlaying, isMuted } = useObject((state: State) => ({
  isPlaying: state.player.isPlaying,
  isMuted: state.player.isMuted,
}));
```

## Delays and timers

In XState, a state can move to another one after some time, with `after`. If the event that
enters the state happens again, the transition re-enters the state with `reenter: true`, and the
timer starts again. A toast that hides 3 seconds after the last message:

```tsx title="XState"
const toastMachine = setup({
  types: {
    context: {} as { message: string | null },
    events: {} as { type: 'toast.show'; message: string },
  },
}).createMachine({
  initial: 'hidden',
  context: { message: null },
  states: {
    hidden: {
      on: { 'toast.show': { target: 'visible', actions: assign({ message: ({ event }) => event.message }) } },
    },
    visible: {
      after: { 3000: 'hidden' },
      on: {
        'toast.show': { target: 'visible', reenter: true, actions: assign({ message: ({ event }) => event.message }) },
      },
    },
  },
});
```

In Kiss, `ShowToast` shows the message, and dispatches `HideToast`. `HideToast` has
`debounce = 3000`, so it waits 3 seconds, and each new dispatch starts the wait again. Only the
last one hides the toast:

```tsx title="Kiss"
class ShowToast extends Action {
  constructor(readonly message: string) { super(); }

  reduce() {
    this.dispatch(new HideToast());
    return this.state.copy({ toast: this.message });
  }
}

class HideToast extends Action {
  debounce = 3000;
  reduce() { return this.state.copy({ toast: null }); }
}
```

For timers that repeat, like a clock, an action creates the interval and gives it to the store
with `setProp`, along with the function that stops it. Another action stops it with
`disposeProp`. And `store.dispose()` stops all of them at once, at the end of the app, or at the
end of each test:

```tsx title="Kiss"
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

See [Store props](../miscellaneous/store-props).

## Cancelling work that is no longer needed

In XState, an invoked actor belongs to its state. When the machine leaves the state, the actor
is stopped, and its result is thrown away. This is how XState makes sure that an old request
doesn't overwrite newer data. For example, when the user picks another tab, the machine
re-enters `loading`, and the request for the old tab is stopped:

```tsx title="XState"
loading: {
  invoke: {
    src: 'loadTab',
    input: ({ context }) => ({ tab: context.tab }),
    onDone: { target: 'loaded', actions: assign({ items: ({ event }) => event.output }) },
  },
  on: {
    'tab.select': { target: 'loading', reenter: true, actions: assign({ tab: ({ event }) => event.tab }) },
  },
},
```

In Kiss, add `ignoreOld = true` to the action. When the action is dispatched again, the older
ones still running are ignored, and their requests are cancelled, through `this.abortSignal`:

```tsx title="Kiss"
class LoadTab extends Action {
  constructor(readonly tab: string) { super(); }
  ignoreOld = true;

  async reduce() {
    const items = await this.deps.api.loadTab(this.tab, this.abortSignal);
    return (state: State) => state.copy({ items });
  }
}
```

The other ways XState stops an actor have their own answers in Kiss:

* **A "Cancel" button**, which in XState is an event that leaves the state, is
  `store.abort(LoadTab)`. See [Aborting actions](../advanced-actions/aborting-actions).
* **The screen closes**, which in XState stops the actor created by `useMachine`, is
  `useStoreEffect({ onUnmount: (store) => store.abort(LoadTab) })`.
* **The result no longer fits**, for example because another user logged in while the request
  was running, is `abortReduce()`, which throws the result away. See
  [Aborting the dispatch](../advanced-actions/aborting-the-dispatch).

## Retry, debounce, fresh data, and more

XState has no retry, debounce, or "don't reload fresh data" of its own. You build each one with
more states, `after`, guards, and counters in the context. Retrying a failed request 3 times,
with a pause between attempts:

```tsx title="XState"
loading: {
  invoke: {
    src: 'loadTodos',
    onDone: { target: 'success', actions: assign({ todos: ({ event }) => event.output, retries: () => 0 }) },
    onError: [
      { guard: ({ context }) => context.retries < 3, target: 'retrying' },
      { target: 'failure', actions: assign({ error: ({ event }) => event.error }) },
    ],
  },
},
retrying: {
  entry: assign({ retries: ({ context }) => context.retries + 1 }),
  after: { 1000: 'loading' },
},
```

And debouncing a search, with a state that waits, and starts waiting again on every keystroke:

```tsx title="XState"
debouncing: {
  on: { 'search.change': { target: 'debouncing', reenter: true, actions: assign({ text: ({ event }) => event.text }) } },
  after: { 300: 'searching' },
},
```

One thing comes for free in XState: an event that the current state doesn't handle is ignored,
so if `loading` doesn't handle `todos.load`, the request can't start twice.

In Kiss these are [action features](../advanced-actions/action-features). You declare them on
the action, and the logic is done for you:

```tsx title="Kiss"
class LoadTodos extends Action {
  fresh = 60000;          // Don't reload for 60 seconds. The data is still fresh.
  nonReentrant = true;    // If it's already running, don't start it again.
  retry = { on: true };   // If it fails, try again.
  checkInternet = true;   // If there is no internet, fail at once with a clear message.

  async reduce() { ... }
}

class SearchTodos extends Action {
  constructor(readonly text: string) { super(); }
  debounce = 300;         // Wait until the user stops typing.
  ignoreOld = true;       // A newer search cancels the older one.
  async reduce() { ... }
}
```

Optimistic updates are also by hand in XState: an `assign` before the request, and another one
in `onError` to put the old value back. In Kiss, extend
[OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) or
[OptimisticSync](../advanced-actions/optimistic-features#optimisticsync). The
[comparison with TanStack Query](./comparing-tanstack) goes through all these features in
detail, including polling, `sequential`, and paged loading.

## One actor per item

In XState, when each item of a list has its own async work, like saving each todo, you spawn
one actor per item, and keep the actors in the context. Each row then reads the status of its
own actor, and you remove the actor from the context when it's no longer needed:

```tsx title="XState"
'todo.save': {
  actions: assign({
    savers: ({ context, event, spawn }) => ({
      ...context.savers,
      [event.todo.id]: spawn('saveTodo', { input: { todo: event.todo } }),
    }),
  }),
},
```

In Kiss, there are no actors to keep. Give the action a `statusKey`, and pass the same key to
the hooks. Each row sees only its own todo:

```tsx title="Kiss"
class SaveTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  get statusKey() { return this.todo.id; }
  async reduce() { ... }
}

function TodoRow({ todo }: { todo: Todo }) {
  const isSaving = useIsWaiting(SaveTodo, { statusKey: todo.id });
  const isFailed = useIsFailed(SaveTodo, { statusKey: todo.id });
  ...
}
```

See [Status per key](../basics/wait-fail-succeed#status-per-key).

## One state, or many actors

For the state of a whole app, XState offers two ways. You can put everything in one big machine,
which then holds every field and every event of the app. Or you can split it into many actors,
like an auth actor and a todo actor, as the actor model suggests. But each actor keeps its
context to itself. When the todo actor needs the user, it can't read it. It sends an event to
the auth actor, found by its `systemId`, and gets an event back:

```tsx title="XState"
'todos.load': {
  actions: sendTo(({ system }) => system.get('auth'), { type: 'user.request' }),
},
```

In Kiss, there is one `State` class, and every action sees all of it. "The auth actor" is
`state.user`, and "the todo actor" is `state.todos`. An action that needs both just reads both,
and an action that must start another one dispatches it:

```tsx title="Kiss"
class LoadTodos extends Action {
  async reduce() {
    const user = this.state.user;
    if (!user) return null; // No state change.
    const todos = await this.deps.api.loadTodos(user.id);
    return (state: State) => state.copy({ todos });
  }
}

class LogIn extends Action {
  async reduce() {
    const user = await this.deps.api.logIn();
    this.dispatch(new LoadTodos());
    return (state: State) => state.copy({ user });
  }
}
```

## Telling a component to do something once

Sometimes the logic must tell a component to do something that is not rendering: clear an
input, scroll a list to the top, open a dialog. In XState, the machine can `emit` an event, and
the component listens to it with `actorRef.on()`, in an effect:

```tsx title="XState"
// In the machine.
'todo.add': {
  actions: [assign({ todos: ({ context, event }) => [...context.todos, event.todo] }), emit({ type: 'input.clear' })],
},

// In the component.
const todoActor = TodoContext.useActorRef();

useEffect(() => {
  const subscription = todoActor.on('input.clear', () => { inputRef.current!.value = ''; });
  return () => subscription.unsubscribe();
}, [todoActor]);
```

Kiss has **events** for this. An action puts an `Evt` in the state, and the component handles it
with `useEvent`. The event is spent once handled, so it fires once, and there is nothing to
subscribe to or unsubscribe from:

```tsx title="Kiss"
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  reduce() { return this.state.copy({ todos: [...this.state.todos, this.todo], clearInputEvt: new Evt() }); }
}

function TodoInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  useEvent((state: State) => state.clearInputEvt, () => { inputRef.current!.value = ''; });
  return <input ref={inputRef} />;
}
```

See [Events](../basics/events).

## Dependencies

XState has a good answer here. The machine refers to its actors and actions by name, and
`machine.provide()` gives them other implementations, without changing the machine. That's how
you swap the real API for a fake one:

```tsx title="XState"
const testMachine = todoMachine.provide({
  actors: { loadTodos: fromPromise(async () => [todo1, todo2]) },
});
```

Kiss does much the same, at the level of the store. You give the dependencies to the store, and
a base action class gives you typed access to them. Every action extends that base class:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  dependencies: () => ({ api: new Api() }),
});

abstract class Action extends KissAction<State> {
  get deps(): Dependencies { return this.store.dependencies as Dependencies; }
}
```

In a test, give the store fake dependencies instead. To replace a whole action, use
`store.mocks`. See [Dependency injection](../miscellaneous/dependency-injection) and
[Mocking actions](../testing/mocking-actions).

## Persistence

In XState, you save the actor with `getPersistedSnapshot()`, and give the saved snapshot back
when you create the actor, with the `snapshot` option:

```tsx title="XState"
const saved = localStorage.getItem('todos');
const todoActor = createActor(todoMachine, { snapshot: saved ? JSON.parse(saved) : undefined }).start();

todoActor.subscribe(() => {
  localStorage.setItem('todos', JSON.stringify(todoActor.getPersistedSnapshot()));
});
```

The XState documentation lists some things to keep in mind. The snapshot must be plain JSON, so
class instances don't survive. It holds the finite state value, which is tied to the shape of
the machine, so if you rename or move a state, old snapshots may no longer fit. Entry actions
don't run again when the snapshot is restored. And invoked actors start again.

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state as
it changes, and loads it when the app starts. The persisted state is your data, and nothing
else. The `ClassPersistor` works with class instances, so the state comes back as the same
classes you defined:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});
```

## Devtools and diagrams

This is where XState is ahead. A machine is data, so it can be drawn. Stately Studio shows the
machine as a diagram, and lets you edit it there. The inspector shows the running actors, the
events they get, and the state they are in, as it happens:

```tsx title="XState"
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();
const todoActor = createActor(todoMachine, { inspect: inspector.inspect }).start();
```

Kiss has no diagram, because its logic is code, not a description of states. What it has is a
log. The `actionObserver` is called when an action starts and ends, and the `stateObserver` is
called with the state before and after each action:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'Started' : 'Finished', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

A log line like `Finished AddTodo` tells you what happened. See
[Log and metrics](../miscellaneous/log-and-metrics).

## Testing

XState machines can be tested without a UI, which is good. You give the machine fake actors with
`provide`, create the actor, send it events, and wait for the state you expect with `waitFor`:

```tsx title="XState"
import { createActor, fromPromise, waitFor } from 'xstate';

test('loads the todos', async () => {
  const machine = todoMachine.provide({
    actors: { loadTodos: fromPromise(async () => [todo1, todo2]) },
  });

  const actor = createActor(machine).start();
  actor.send({ type: 'todos.load' });
  const snapshot = await waitFor(actor, (snapshot) => snapshot.matches('success'));

  expect(snapshot.context.todos).toEqual([todo1, todo2]);
  actor.stop();
});
```

XState can also walk the machine and list the paths through it, with `xstate/graph`, to help
you write tests for every path. Kiss has nothing like that, since there is no machine to walk.

In Kiss, each test creates its own store, with any initial state and fake dependencies. Then it
dispatches the action, waits for it, and checks the state. The test talks about the data, not
about the names of states:

```tsx title="Kiss"
test('loads the todos', async () => {
  const store = new Store<State>({
    initialState: State.initialState,
    dependencies: () => ({ api: new FakeApi([todo1, todo2]) }),
  });

  await store.dispatchAndWait(new LoadTodos());

  expect(store.state.todos).toEqual([todo1, todo2]);
  expect(store.isFailed(LoadTodos)).toBe(false);
  store.dispose();
});
```

And the rules of a flow, like the `Checkout` class above, are plain methods, so you can test
them without a store at all:

```tsx title="Kiss"
expect(new Checkout('payment').start().step).toBe('payment'); // Ignored at this step.
expect(new Checkout('payment', address).back()).toEqual(new Checkout('shipping', address));
```

Kiss also has many features to [help you test](../category/testing), like waiting for a state
condition, mocking actions, and recording all actions and state changes.

## XState Store

The XState team knows that a full machine is too much for simple state. So they also have
`@xstate/store`, and they suggest starting with it, and moving to machines when the logic gets
complex. It's a small store: the context, and one function per event, which returns the new
context:

```tsx title="XState Store"
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store-react';

const todoStore = createStore({
  context: { todos: [] as Todo[] },
  on: {
    add: (context, event: { todo: Todo }) => ({ ...context, todos: [...context.todos, event.todo] }),
  },
});

todoStore.trigger.add({ todo });

const todos = useSelector(todoStore, (snapshot) => snapshot.context.todos);
```

The functions must be pure and sync. For async work, a function queues an effect, and the
effect sends another event when it's done. The loading and error flags are fields you keep by
hand:

```tsx title="XState Store"
const todoStore = createStore({
  context: { todos: [] as Todo[], isLoading: false },
  on: {
    load: (context, event, enqueue) => {
      enqueue.effect(async () => {
        const todos = await api.loadTodos();
        todoStore.trigger.loaded({ todos });
      });
      return { ...context, isLoading: true };
    },
    loaded: (context, event: { todos: Todo[] }) => ({ ...context, todos: event.todos, isLoading: false }),
  },
});
```

This is close to Zustand, with events instead of functions, and the
[comparison with Zustand](./comparing-zustand) applies to it almost line by line. With Kiss,
there is no need to move from one tool to another when the logic grows. A sync action and an
async action are the same thing, and a flow with steps is a field and a few methods, in the same
store.

## Why this matters

XState is very good at what it was made for: flows with many steps and rules, that you want to
see drawn. The cost shows up when the whole app goes through it:

* **Most state is data, not steps.** A list, a user, and a filter have no diagram, but in
  XState each change to them is still an event, a transition, and an `assign`. In Kiss, it's an
  action, and when a part of the app is a flow, the step is a field and the rules are methods.
* **Loading and failure are drawn by hand.** Every request is a `loading` state, a `failure`
  state, `onDone`, `onError`, and an `error` field. In Kiss, the store tracks them, and the
  components ask.
* **Retry, debounce, and freshness are drawn by hand too.** Each one is more states and timers.
  In Kiss, they are properties on the action.
* **The data is split across actors.** Each actor keeps its context to itself, so the parts of
  the app talk with events. In Kiss, there is one state, and every action can read all of it.

## When an AI agent writes the code

When your agent writes the code and you review it, this is what changes:

* **One class, not three places.** In XState, each change is a type in the event union, a
  transition in the machine, and often a name in `setup`, with targets that are strings. Your
  agent must keep all of them in sync. And an event that the current state doesn't handle is
  ignored, with no error, so a transition put in the wrong state is easy to miss in a review.
  In Kiss, a change is one class, which you read from top to bottom.
* **No states to write for every request.** For each request, your agent writes a `loading`
  state, a `failure` state, `onDone`, `onError`, and an `error` field, as in
  [Async changes](#async-changes). Retry and debounce are more states and `after`. Each one is
  written by hand, and a little differently each time. In Kiss, your agent writes
  `async reduce()`, and declares `retry` or `debounce` on the action. The store keeps the status.
* **Checks your agent can run.** XState machines can be tested without a UI too. In Kiss, your
  agent tests an action with `dispatchAndWait`, with no rendering, and no state names to wait
  for. It also runs `npx eslint` with the Kiss ESLint plugin, which finds mistakes that compile
  fine, like using the old state after an `await` (`stale-state-after-await`).
* **Where XState is ahead.** For a long flow, the diagram and the inspector let you check what
  your agent built, at a glance. Kiss has nothing like it: you read the state class and the
  actions. Also, agents have seen much more XState code than Kiss code. But XState v5 renamed a
  lot (`interpret` became `createActor`, and `cond` became `guard`), so an agent that learned
  both versions can mix them. Kiss makes up for having less training data with the single-file
  docs, the linter, and the code already in your project, which shows your agent the pattern.

---

Give it a try: [follow the tutorial](../tutorial/setting-up-the-store), or
[give your agent the docs](../getting-started/intro.md#docs) and ask it to rewrite one of your
machines with Kiss.
