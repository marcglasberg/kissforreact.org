---
sidebar_position: 3
---

# Comparing with Zustand

This page is for people who know Zustand. It shows how to get the same results with Kiss,
which does things in a different way, and what changes when an AI agent writes the code. Each
section shows the Zustand code first, and then the Kiss code that does the same.

Zustand is based on **stores**. You call `create` with a function that returns an object. Some
fields of that object are the state, and the others are the functions that change it, by
calling `set`. The result is a hook. Components call the hook with a selector, and re-render
when the selected value changes.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components read the state
with a selector, and re-render when the selected value changes.

So the two agree on the component side: a selector picks a value, and the component re-renders
when it changes. They differ on the other side: how the state is changed, and where the code
that changes it lives. Every time Zustand "calls `set` inside a store function", Kiss
"dispatches an action that returns a new state".

## The big difference

Zustand is a box. It holds state and functions, and it has no opinion about what goes in the
box, or about what the functions may do. That is what makes it small, and it's what people
like about it. It's also what it leaves for you to decide, for every feature, for every
developer on the team, and for every session of an AI agent: where does the code that calls
the server go? Where do the loading flags go? What happens when the call fails? What if the
user clicks twice? Where do timers and listeners live? How do tests get a clean store?

Kiss answers these questions once. The state is one class. A change is an action, with a
name. An async change is an action with `async` in front of its reducer. Loading and failure
are tracked for you. Timers and listeners go in the store props. Dependencies are injected
into the store. Each test creates its own store. None of this makes the code longer than the
Zustand code. It makes it the same shape everywhere.

Three things follow from this, and they come up in every section below:

* **Every change goes through one door.** In Zustand, any function in the store, any
  component, and any module can call `set` or `setState`. There is no single entry point, so
  there is nowhere to hang behavior that applies to all changes: logging, retry, debouncing,
  "don't run this twice at the same time". In Kiss, every change is a dispatched action, so
  all of that is a property you set on the action.

* **Loading and failure are not state you keep.** In Zustand, `isLoading` and `error` are
  fields you write to the store by hand, before and after each `await`, in every async
  function. In Kiss, the store tracks which actions are running and which have failed, and
  the components ask.

* **The state has one shape.** Zustand makes it easy to create many stores, so the app's data
  ends up spread across files, with no place that shows how it all fits together. Kiss has
  one `State` class, where every field of the app is declared.

|                           | Zustand                                    | Kiss                                      |
|---------------------------|--------------------------------------------|-------------------------------------------|
| State                     | An object, with the functions inside it    | An immutable value, separate from actions |
| Changing the state        | `set`, called from anywhere                | An action class with `reduce()`           |
| Async changes             | An `async` function that calls `set` twice | `async reduce()`                          |
| Loading and failed states | Flags you keep by hand                     | `useIsWaiting`, `useIsFailed`             |
| Derived values            | In the selector, or by hand                | Getters, selectors, cached fields         |
| Side effects              | `subscribe`, `useEffect`                   | Actions, `useStoreEffect`, store props    |
| Retry, debounce, fresh    | By hand                                    | Action features                           |
| Optimistic updates        | By hand                                    | `OptimisticCommand`, `OptimisticSync`     |
| Undo and redo             | `zundo`                                    | `stateObserver` and `UpdateStateAction`   |
| Persistence               | `persist` middleware (plain JSON)          | The persistor (plain objects and classes) |
| Dependencies              | Imported from modules                      | Injected into the store                   |
| Devtools                  | `devtools` middleware                      | `actionObserver`, `stateObserver`         |
| Server-side rendering     | One store per request, with a context      | `StoreProvider` with `serverState`        |
| Testing without UI        | Yes, resetting the stores between tests    | Yes, with one store per test              |

## Quick translation

If you know Zustand, this table tells you where to look in Kiss. The sections below explain
each line, with code.

| Zustand                                                                  | Kiss                                                                        |
|--------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `create((set, get) => ({ ... }))`                                        | A `State` class, given to `createStore({ initialState })`                   |
| The data fields of the store object                                      | The readonly fields of the `State` class                                    |
| A function in the store that calls `set`                                 | An action class, whose `reduce()` returns a new state                       |
| `set((state) => ({ count: state.count + 1 }))`                           | `this.state.copy({ count: this.state.count + 1 })`                          |
| `set(newState, true)` (replace the whole state)                          | `UpdateStateAction`                                                         |
| `get()` inside a store function                                          | `this.state` inside the action                                              |
| `useStore.getState()` outside React                                      | `store.state`                                                               |
| `useStore.setState(...)` outside React                                   | `store.dispatch(new SomeAction())`                                          |
| `useStore((state) => state.todos)`                                       | `useSelect((state) => state.todos)`                                         |
| `useStore(useShallow((state) => ({ a: state.a, b: state.b })))`          | `useObject((state) => ({ a: state.a, b: state.b }))`                        |
| `useStore()` with no selector                                            | `useAllState()`                                                             |
| `isLoading` and `error` fields in the store                              | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`    |
| `useStore.subscribe(listener)`                                           | `stateObserver` in `createStore`                                            |
| `subscribeWithSelector`, `subscribe(selector, listener)`                 | `dispatchWhen`, `waitCondition`, or an action that dispatches another       |
| Many stores (`useUserStore`, `useTodoStore`, ...)                        | One `State` class. Its fields are your "stores".                            |
| The slices pattern (`StateCreator`, spread into one store)               | One `State` class, and base actions if you want [slices](../miscellaneous/slices) |
| An `api` module imported by the store                                    | `dependencies` in `createStore`, read with `this.deps`                      |
| `immer` middleware                                                       | Not needed. `copy()` returns a new state.                                   |
| `persist` middleware                                                     | The [persistor](../miscellaneous/persistor)                                 |
| `persist.hasHydrated()`, `onRehydrateStorage`                            | `store.ready()`, `useIsStoreReady()`                                        |
| `devtools` middleware, and `set(..., false, 'name')` to name the change  | `actionObserver`, `stateObserver`. The action class is the name.            |
| `temporal` (zundo)                                                       | `stateObserver` and `UpdateStateAction`                                     |
| A `reset()` function that calls `set(initialState)`                      | `UpdateStateAction`, or `store.logOut()`                                    |
| `createStore` from `zustand/vanilla`, a context, and `useStore(store, selector)` | `StoreProvider` with `serverState`, and `StoreSlice`                 |
| Mocking `zustand` to reset the stores between tests                      | A new store in each test                                                    |
| Retry, debounce, throttle, fresh, non-reentrant (not in Zustand)         | `retry`, `debounce`, `throttle`, `fresh`, `nonReentrant`                    |

## Creating the store

In Zustand, the state and the functions that change it go in one object, returned by the
function you give to `create`. The functions get `set`, to change the state, and `get`, to
read it. The result is a hook:

```tsx title="Zustand"
import { create } from 'zustand';

interface TodoStore {
  todos: Todo[];
  user: User | null;
  addTodo: (todo: Todo) => void;
  removeTodo: (id: string) => void;
}

export const useTodoStore = create<TodoStore>()((set, get) => ({
  todos: [],
  user: null,
  addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] })),
  removeTodo: (id) => set((state) => ({ todos: state.todos.filter((todo) => todo.id !== id) })),
}));
```

Note the type mixes two things: the data (`todos`, `user`) and the functions (`addTodo`,
`removeTodo`). When you log the state, persist it, or compare it in a test, the functions are
in the way.

In Kiss, the state is one class, with only data. The fields are readonly, and `copy()` returns
a new state with some fields changed. The store gets the initial state, and `StoreProvider`
passes the store to the components:

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

The functions that change the state are not in the state. They are actions, shown next. See
[Store and state](../basics/store-and-state).

## Changing the state

In Zustand, a change is a function in the store that calls `set`. You give `set` an object,
which is merged into the state, or a function that gets the state and returns the changes.
Since the function is just a field of the store, you can also call `setState` from anywhere,
with no function at all:

```tsx title="Zustand"
const useTodoStore = create<TodoStore>()((set) => ({
  todos: [],
  addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] })),
}));

// In a component.
const addTodo = useTodoStore((state) => state.addTodo);
addTodo(todo);

// Or from anywhere, skipping the function.
useTodoStore.setState((state) => ({ todos: [...state.todos, todo] }));
```

In Kiss, you change the state by dispatching an action. An action is a class. Its constructor
parameters are the data it needs, and its `reduce()` method returns the new state. There is no
other way to change the state, so every change has a name, and you can search for it:

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

// Or from anywhere.
store.dispatch(new AddTodo(todo));
```

`this.state` is Zustand's `get()`. `this.state.copy({ ... })` is Zustand's
`set((state) => ({ ... }))`. The difference is that the action is a unit: it has a name, it
can be logged, tested, and given [features](#retry-debounce-fresh-data-and-more) like retry
and debounce. A `set` call is not a unit. It's a line inside a function. See
[Actions and reducers](../basics/actions-and-reducers).

### Nested state and Immer

Zustand's `set` merges only the first level. To change a nested field, you spread each level
by hand, or add the `immer` middleware and write mutations:

```tsx title="Zustand"
// By hand.
setCity: (city) => set((state) => ({
  user: { ...state.user, address: { ...state.user.address, city } },
})),

// With the immer middleware.
import { immer } from 'zustand/middleware/immer';

const useTodoStore = create<TodoStore>()(immer((set) => ({
  ...
  setCity: (city) => set((state) => { state.user.address.city = city; }),
})));
```

In Kiss, nested state is nested immutable classes, each with its own `copy()`. No middleware:

```tsx title="Kiss"
class SetCity extends Action {
  constructor(readonly city: string) { super(); }

  reduce() {
    const user = this.state.user;
    return this.state.copy({ user: user.copy({ address: user.address.copy({ city: this.city }) }) });
  }
}
```

The [tutorial](../tutorial/creating-the-state) shows how to build these classes. The
[business logic](../miscellaneous/business-logic) goes in them, so an action is often one
line, like `return this.state.copy({ todos: this.state.todos.add(this.todo) })`. If you prefer
plain objects, Kiss works with them too, and you can use Immer inside your reducers. See
[State as plain objects](../tutorial/plain-javascript-obj).

## Components

This is the part where Zustand and Kiss are the same. A component gives a selector, gets a
value, and re-renders when that value changes:

```tsx title="Zustand"
function TodoList() {
  const todos = useTodoStore((state) => state.todos);
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

```tsx title="Kiss"
function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

To select several fields at once, a selector that returns a new object would re-render the
component on every state change, so Zustand has `useShallow`, and Kiss has `useObject`, which
compares the new object with the previous one, value by value:

```tsx title="Zustand"
import { useShallow } from 'zustand/react/shallow';

const { name, age } = useUserStore(useShallow((state) => ({ name: state.name, age: state.age })));
```

```tsx title="Kiss"
const { name, age } = useObject((state: State) => ({ name: state.user.name, age: state.user.age }));
```

To read the whole state, Zustand's hook is called with no selector, and Kiss has
`useAllState()`. Both re-render the component on every state change. Both libraries connect
to React with `useSyncExternalStore`, so the rendering behavior is the same. See
[Components use the state](../basics/components-use-the-state).

One difference: in Zustand, the component selects the function it needs from the store, as in
`useTodoStore((state) => state.addTodo)`. In Kiss, the component dispatches an action, with
`useDispatch()` or `useStore()`. See [Hooks to dispatch actions](../basics/hooks-to-dispatch-actions).

## Outside components

Zustand's hook is also a plain object, with `getState`, `setState` and `subscribe`, for code
that is not a component:

```tsx title="Zustand"
const todos = useTodoStore.getState().todos;
useTodoStore.getState().addTodo(todo);
useTodoStore.setState({ todos: [] });
```

In Kiss, the store object has the state, and `dispatch`:

```tsx title="Kiss"
const todos = store.state.todos;
store.dispatch(new AddTodo(todo));
```

Inside a component, `useStore()` gives you the same `store`, to read `store.state` in event
handlers and effects. (To render the state, use `useSelect`, which re-renders the component
when the state changes.) The `subscribe` method is covered in
[Side effects, timers and listeners](#side-effects-timers-and-listeners).

## Async changes

In Zustand, an async change is an async function in the store. It calls `set` more than
once: before the `await`, to turn on a loading flag, and after it, to put the data in and turn
the flag off. The failure case needs a third `set`, and an `error` field:

```tsx title="Zustand"
interface TodoStore {
  todos: Todo[];
  isLoading: boolean;
  error: string | null;
  loadTodos: () => Promise<void>;
}

const useTodoStore = create<TodoStore>()((set) => ({
  todos: [],
  isLoading: false,
  error: null,
  loadTodos: async () => {
    set({ isLoading: true, error: null });
    try {
      const todos = await api.loadTodos();
      set({ todos, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
}));

function TodoList() {
  const { todos, isLoading, error, loadTodos } = useTodoStore(
    useShallow((state) => ({ todos: state.todos, isLoading: state.isLoading, error: state.error, loadTodos: state.loadTodos })),
  );

  useEffect(() => { loadTodos(); }, [loadTodos]);

  if (isLoading) return <Spinner />;
  if (error) return <p>{error}</p>;
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

This is the shape of every async function in a Zustand store, and each one is a chance to get
it wrong. If you forget to clear `isLoading` in one branch, the spinner never goes away. If
the store has one `isLoading` but three async functions, loading one thing shows a spinner on
another. The function catches its own error, so whoever called it can't know it failed. And
the error became a string, so its type is gone.

In Kiss, an action can be async. Its `reduce()` method awaits what it needs, and returns a
function that produces the new state. If something goes wrong, the action throws, and the
state is not changed:

```tsx title="Kiss"
class LoadTodos extends Action {
  async reduce() {
    const todos = await this.deps.api.loadTodos();
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

The reducer returns a function of the state, instead of the state, for the same reason
Zustand's `set` accepts a function: the state may have changed during the `await`, and the
reducer must apply its change to the latest one.

There are no `isLoading` and `error` fields, because loading and failure are not state you
keep. They are questions you ask about the action: is `LoadTodos` running? Did it fail? What
was the message? Kiss tracks the answers for you, so they are always right. Any component can
ask, not only the one that dispatched the action. And since each action class has its own
status, loading the todos never shows a spinner on the user. See
[Wait, fail, succeed](../basics/wait-fail-succeed).

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

If the status must be per item, as in "is user 42 loading?", give the action a `statusKey`,
and pass the same key to the hooks: `useIsWaiting(LoadUser, { statusKey: userId })`. See
[Status per key](../basics/wait-fail-succeed#status-per-key).

## One state, or many stores

Zustand's documentation recommends many small stores, one per concern. The `create` call is
cheap, so that's what most apps do. The trouble starts when one store needs another: a store
function reaches into the other store with `getState()`, or a component reads from both and
passes the values along. The alternative is the slices pattern, which puts everything back in
one store, at the cost of some type gymnastics:

```tsx title="Zustand"
// Two stores. One reaches into the other.
const useUserStore = create<UserStore>()((set) => ({ user: null, ... }));

const useTodoStore = create<TodoStore>()((set) => ({
  todos: [],
  loadTodos: async () => {
    const user = useUserStore.getState().user;
    if (!user) return;
    set({ todos: await api.loadTodos(user.id) });
  },
}));

// Or the slices pattern. Everything in one store.
const createUserSlice: StateCreator<UserSlice & TodoSlice, [], [], UserSlice> = (set) => ({
  user: null,
  ...
});

const createTodoSlice: StateCreator<UserSlice & TodoSlice, [], [], TodoSlice> = (set, get) => ({
  todos: [],
  loadTodos: async () => {
    const user = get().user;
    if (!user) return;
    set({ todos: await api.loadTodos(user.id) });
  },
});

const useBoundStore = create<UserSlice & TodoSlice>()((...a) => ({
  ...createUserSlice(...a),
  ...createTodoSlice(...a),
}));
```

In Kiss, there is one `State` class, and every action sees all of it. "The user store" is
`state.user`, and "the todo store" is `state.todos`. An action that needs both just reads
both:

```tsx title="Kiss"
class State {
  constructor(
    readonly user: User | null,
    readonly todos: readonly Todo[],
  ) {}
  ...
}

class LoadTodos extends Action {
  async reduce() {
    const user = this.state.user;
    if (!user) return null; // No state change.
    const todos = await this.deps.api.loadTodos(user.id);
    return (state: State) => state.copy({ todos });
  }
}
```

If you want actions that see only one part of the state, like a slice, the
[Slices](../miscellaneous/slices) page shows how to write a base action for that, and explains
why you probably won't need it.

## Derived values

Zustand has no derived values of its own. You compute them in the selector, which runs on
every state change, or you keep them as fields and update them by hand in every function that
changes their inputs:

```tsx title="Zustand"
// In the selector. Recomputed on every state change.
const doneCount = useTodoStore((state) => state.todos.filter((todo) => todo.done).length);

// Or as a field, kept in sync by hand, in every function that changes the todos.
addTodo: (todo) => set((state) => {
  const todos = [...state.todos, todo];
  return { todos, doneCount: todos.filter((t) => t.done).length };
}),
```

Kiss has three ways to do this, from the simplest to the most elaborate.

**A getter on the state class.** For a value that depends on one part of the state, write a
getter on that class. The component reads it with `useSelect`, like any other field, and
re-renders only when the result changes. Because the state is immutable, the getter can cache
its result inside the object, and the cached value can never go stale:

```tsx title="Kiss"
class State {
  constructor(readonly todos: readonly Todo[]) {}

  private _doneCount?: number;

  get doneCount() {
    return (this._doneCount ??= this.todos.filter((todo) => todo.done).length);
  }
}

function DoneCount() {
  const doneCount = useSelect((state: State) => state.doneCount);
  return <p>{doneCount} done</p>;
}
```

**A selector class.** For values that depend on several parts of the state, put the logic in
a class that takes the state. Components use it in `useSelect`, and actions use it with
`this.state`. The logic is written once:

```tsx title="Kiss"
class Selector {
  constructor(readonly state: State) {}

  todosForDisplay(): Todo[] {
    const { todos, filter } = this.state;
    return todos.filter((todo) => filter === 'all' || (filter === 'done') === todo.done);
  }
}

// In a component.
const todos = useSelect((state: State) => new Selector(state).todosForDisplay());

// In an action.
const todos = new Selector(this.state).todosForDisplay();
```

**A cache in the state.** For a value that is expensive to compute, compute it in the action
that changes its inputs, and store the result in the state. This is the Zustand "field kept by
hand" above, but since the state is immutable, the cached value and its inputs always change
together, so they can never disagree.

## Side effects, timers and listeners

In Zustand, code that must run when the state changes goes in `subscribe`, usually at module
level, and with the `subscribeWithSelector` middleware when it should watch one field. Timers
and listeners go wherever they fit: a module variable, a `useEffect`, a store function. Each
one returns something you must remember to stop, and none of them has an owner:

```tsx title="Zustand"
import { subscribeWithSelector } from 'zustand/middleware';

const useAppStore = create<AppStore>()(subscribeWithSelector((set) => ({ ... })));

// At module level. Who calls unsubscribe?
const unsubscribe = useAppStore.subscribe(
  (state) => state.user,
  (user) => { if (user) useAppStore.getState().loadTodos(); },
);

// A timer, also at module level.
let interval: ReturnType<typeof setInterval> | undefined;
export const startClock = () => { interval = setInterval(() => useAppStore.getState().tick(), 1000); };
export const stopClock = () => clearInterval(interval);
```

In Kiss, the same needs have more direct answers:

* **Something must happen after a change.** The action that makes the change does it. If
  loading the user should load the todos, `LoadUser` dispatches `LoadTodos`:

  ```tsx title="Kiss"
  class LoadUser extends Action {
    async reduce() {
      const user = await this.deps.api.loadUser();
      this.dispatch(new LoadTodos());
      return (state: State) => state.copy({ user });
    }
  }
  ```

* **Something must happen when a condition becomes true.** Use `dispatchWhen`, which
  dispatches an action as soon as the state meets a condition, or `waitCondition` inside an
  action:

  ```tsx title="Kiss"
  store.dispatchWhen(new LoadTodos(), (state) => state.user !== null, { timeoutMillis: 0 });
  ```

* **Something must happen when a component mounts or unmounts.** Use `useStoreEffect`:

  ```tsx title="Kiss"
  useStoreEffect({
    onMount: (store) => store.dispatch(new StartClock()),
    onUnmount: (store) => store.dispatch(new StopClock()),
  });
  ```

* **Something must run on every state change,** like saving to local storage. Use the
  [persistor](../miscellaneous/persistor), or a `stateObserver` in `createStore` (see
  [Devtools and logging](#devtools-and-logging) below).

Long-lived things, like timers, sockets and listeners, go in the store **props**. An action
creates them and gives them to the store with `setProp`, along with the function that closes
them. Another action closes them with `disposeProp`. And `store.dispose()` closes all of them
at once, at the end of the app, or at the end of each test:

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

## Telling a component to do something once

Sometimes the state must tell a component to do something that is not rendering: clear an
input, scroll a list to the top, open a dialog. In Zustand, this is usually a boolean in the
store, which the component watches in an effect and then resets:

```tsx title="Zustand"
// In the store.
clearInput: false,
addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo], clearInput: true })),
clearInputDone: () => set({ clearInput: false }),

// In the component.
const clearInput = useTodoStore((state) => state.clearInput);
useEffect(() => {
  if (clearInput) {
    inputRef.current!.value = '';
    useTodoStore.getState().clearInputDone();
  }
}, [clearInput]);
```

It works, but the boolean is not state. It's a message, and the reset is the component
telling the store "I got it". If two todos are added before the effect runs, one message is
lost.

Kiss has **events** for this. An action puts an `Evt` in the state, and the component handles
it with `useEvent`. The event is spent once handled, so it fires once, and there is nothing to
reset:

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

In Zustand, a store function gets its API client by importing it. There is no other place for
it. So, in a test, the module must be mocked:

```tsx title="Zustand"
import { api } from './api';

const useTodoStore = create<TodoStore>()((set) => ({
  todos: [],
  loadTodos: async () => { set({ todos: await api.loadTodos() }); },
}));

// In the test.
vi.mock('./api');
```

In Kiss, you give the dependencies to the store, and a base action class gives you typed
access to them. Every action extends that base class:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  dependencies: () => ({ api: new Api() }),
});

abstract class Action extends KissAction<State> {
  get deps(): Dependencies { return this.store.dependencies as Dependencies; }
}

class LoadTodos extends Action {
  async reduce() {
    const todos = await this.deps.api.loadTodos();
    return (state: State) => state.copy({ todos });
  }
}
```

In a test, give the store fake dependencies instead. Nothing is mocked by module name, and
nothing leaks between tests, because the dependencies live and die with the store. See
[Dependency injection](../miscellaneous/dependency-injection).

## Persistence

In Zustand, saving the state to local storage is the `persist` middleware. Since the store
object has functions in it, you use `partialize` to pick the fields to save. The state goes
through JSON, so class instances come back as plain objects, unless you write a custom
`storage` or `merge`:

```tsx title="Zustand"
import { persist, createJSONStorage } from 'zustand/middleware';

const useTodoStore = create<TodoStore>()(
  persist(
    (set) => ({ todos: [], filter: 'all', addTodo: ..., setFilter: ... }),
    {
      name: 'todo-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ todos: state.todos, filter: state.filter }), // Leave the functions out.
    },
  ),
);

// To know if the saved state has loaded.
const hasHydrated = useTodoStore.persist.hasHydrated();
```

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state
as it changes, and loads it when the app starts. There are no functions in the state, so there
is nothing to leave out. The `ClassPersistor` works with class instances, so the state comes
back as the same classes you defined:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});

// To know if the saved state has loaded.
await store.ready();                    // Outside components.
const isReady = useIsStoreReady();      // In components.
```

## Devtools and logging

Zustand connects to the Redux DevTools with the `devtools` middleware. But a `set` call has no
name, so the devtools show each change as "anonymous", unless you name it by hand, as the
third argument of every `set`:

```tsx title="Zustand"
import { devtools } from 'zustand/middleware';

const useTodoStore = create<TodoStore>()(
  devtools(
    (set) => ({
      todos: [],
      addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] }), false, 'todos/addTodo'),
    }),
    { name: 'TodoStore' },
  ),
);
```

In Kiss, the action class is the name. The `actionObserver` is called when an action starts
and ends, and the `stateObserver` is called with the state before and after each action:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'Started' : 'Finished', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

A log line like `Finished AddTodo` tells you what happened, and there was nothing to name by
hand. See [Log and metrics](../miscellaneous/log-and-metrics).

## Retry, debounce, fresh data, and more

Zustand has no opinion about these. Not running the same request twice at the same time, not
reloading data that is still fresh, retrying a failed request, and debouncing a search are all
written inline, inside the one function that needs them, and differently each time:

```tsx title="Zustand"
loadTodos: async () => {
  if (get().isLoading) return;                           // Non-reentrant, by hand.
  if (Date.now() - get().loadedAt < 60000) return;       // Fresh, by hand.
  set({ isLoading: true });
  for (let attempt = 1; attempt <= 3; attempt++) {       // Retry, by hand.
    try {
      const todos = await api.loadTodos();
      set({ todos, isLoading: false, loadedAt: Date.now() });
      return;
    } catch (error) {
      if (attempt === 3) set({ error: String(error), isLoading: false });
    }
  }
},
```

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
  async reduce() { ... }
}
```

This is only possible because every change goes through `dispatch`. The store sees the action
before it runs, so it can skip it, delay it, or run it again. There is no such place in
Zustand. The [comparison with TanStack Query](./comparing-tanstack) goes through all these
features in detail, including polling, `ignoreOld`, `sequential`, and paged loading.

## Optimistic updates

In Zustand, an optimistic update is done by hand: save the old value, change the state, send
the command, and put the old value back if it fails:

```tsx title="Zustand"
addTodo: async (todo) => {
  const previous = get().todos;
  set({ todos: [...previous, todo] });
  try {
    await api.addTodo(todo);
  } catch (error) {
    set({ todos: previous }); // Rollback. But what if the todos changed meanwhile?
    throw error;
  }
},
```

In Kiss, there are ready-made action classes, so you don't write the rollback by hand, and
the rollback is done right even when other changes happened in between:

```tsx title="Kiss"
class AddTodo extends OptimisticCommand<State, Todo[]> {
  constructor(readonly todo: Todo) { super(); }

  optimisticValue() { return [...this.state.todos, this.todo]; }
  getValueFromState(state: State) { return state.todos; }
  applyValueToState(state: State, todos: Todo[]) { return state.copy({ todos }); }
  sendCommandToServer() { return this.deps.api.addTodo(this.todo); }
  reloadFromServer() { return this.deps.api.loadTodos(); }
}
```

Use [OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) for
commands like "add a todo", and
[OptimisticSync](../advanced-actions/optimistic-features#optimisticsync) for values that
change fast, like a "like" button, where only the latest value is sent to the server.

## Undo and redo

In Zustand, undo needs a third-party middleware, `zundo`, which keeps past and future states:

```tsx title="Zustand"
import { temporal } from 'zundo';

const useTodoStore = create<TodoStore>()(temporal((set) => ({ ... })));

const { undo, redo } = useTodoStore.temporal.getState();
```

In Kiss, the states are values, so undo is a list of them. A `stateObserver` saves each new
state, and `UpdateStateAction` goes back to one of them:

```tsx title="Kiss"
const history: State[] = [];

const store = createStore<State>({
  initialState: State.initialState,
  stateObserver: (action, prevState, newState) => { history.push(newState); },
});

// Undo: go back to the state before the last one.
store.dispatch(new UpdateStateAction((state) => history[history.length - 2]));
```

See [Undo and redo](../miscellaneous/undo-and-redo).

## Resetting the state

In Zustand, you keep the initial data in a variable, and write a `reset` function that sets
it back. With many stores, logging out means calling `reset` on each one, and remembering all
of them:

```tsx title="Zustand"
const initialState = { todos: [], user: null };

const useTodoStore = create<TodoStore>()((set) => ({
  ...initialState,
  addTodo: ...,
  reset: () => set(initialState),
}));

// On logout, every store must be reset, one by one.
useTodoStore.getState().reset();
useUserStore.getState().reset();
useSettingsStore.getState().reset();
```

In Kiss, there is one state, so resetting it is one action. And on logout, `store.logOut()`
does more than reset: it waits for the running actions, deletes the persisted state, and
puts the initial state back:

```tsx title="Kiss"
store.dispatch(new UpdateStateAction(() => State.initialState));

// On logout.
await store.logOut({ initialState: State.initialState });
```

## Server-side rendering

A Zustand store made with `create` is a module-level singleton, shared by every request on
the server. So, for server-side rendering, the Zustand documentation says not to use it. You
use `createStore` from `zustand/vanilla` to make one store per request, pass it down with a
React context you write, and read it with a `useStore` hook you also write:

```tsx title="Zustand"
// store.ts
import { createStore } from 'zustand/vanilla';

export const createTodoStore = (initState: TodoState) =>
  createStore<TodoStore>()((set) => ({ ...initState, addTodo: ... }));

// provider.tsx
'use client';
const TodoStoreContext = createContext<TodoStoreApi | null>(null);

export function TodoStoreProvider({ initState, children }: { initState: TodoState; children: ReactNode }) {
  const storeRef = useRef<TodoStoreApi>(null);
  if (!storeRef.current) storeRef.current = createTodoStore(initState);
  return <TodoStoreContext.Provider value={storeRef.current}>{children}</TodoStoreContext.Provider>;
}

export function useTodoStore<T>(selector: (store: TodoStore) => T): T {
  const store = useContext(TodoStoreContext);
  if (!store) throw new Error('Missing TodoStoreProvider');
  return useStore(store, selector);
}
```

The global hook that Zustand is known for is gone, replaced by a provider and a hook you
maintain. And if the store also uses `persist`, you must set `skipHydration` and rehydrate in
an effect, or the server HTML and the first browser render won't match.

In Kiss, the store is always an object you create, so one per request is the normal case.
`StoreProvider` is the context, and `serverState` tells the hooks what the server rendered, so
hydration matches even if a persistor already changed the state. In Next.js, each route loads
its data on the server and puts it in the store with `StoreSlice`:

```tsx title="Kiss"
// KissProvider.tsx
'use client';
export function KissProvider({ initialState, children }: { initialState: State; children: ReactNode }) {
  const [store] = useState(() => createStore<State>({ initialState }));
  return (
    <StoreProvider store={store} serverState={initialState}>
      {children}
    </StoreProvider>
  );
}

// app/todos/page.tsx (a server component)
export default async function TodosPage() {
  const todos = await api.loadTodos();
  return (
    <StoreSlice state={{ todos }}>
      <TodoList />
    </StoreSlice>
  );
}
```

See [Server-side rendering](../miscellaneous/server-side-rendering).

## Testing

Zustand stores can be tested without a UI, which is good. But a store made with `create` is a
module singleton, so the state of one test leaks into the next. The Zustand documentation
solves this by mocking the `zustand` module itself, with a `create` that remembers every
store's initial state and resets all of them after each test. The API is mocked by module
name too:

```tsx title="Zustand"
// __mocks__/zustand.ts (simplified from the Zustand docs).
const storeResetFns = new Set<() => void>();

export const create = (<T>() => (stateCreator: StateCreator<T>) => {
  const store = actualCreate<T>()(stateCreator);
  const initialState = store.getInitialState();
  storeResetFns.add(() => store.setState(initialState, true));
  return store;
}) as typeof actualCreate;

afterEach(() => { storeResetFns.forEach((reset) => reset()); });

// The test.
vi.mock('zustand');
vi.mock('./api');

test('loads the todos', async () => {
  vi.mocked(api.loadTodos).mockResolvedValue([todo1, todo2]);

  await useTodoStore.getState().loadTodos();

  expect(useTodoStore.getState().todos).toEqual([todo1, todo2]);
  expect(useTodoStore.getState().isLoading).toBe(false);
});
```

In Kiss, each test creates its own store, with any initial state and fake dependencies. Then
it dispatches the action, waits for it, and checks the state. There is no singleton to reset
and no module to mock. When the test ends, `store.dispose()` closes every prop, so nothing
leaks into the next test:

```tsx title="Kiss"
test('loads the todos', async () => {
  const store = new Store<State>({
    initialState: State.initialState,
    dependencies: () => ({ api: new FakeApi([todo1, todo2]) }),
  });

  await store.dispatchAndWait(new LoadTodos());

  expect(store.state.todos).toEqual([todo1, todo2]);
  expect(store.isWaiting(LoadTodos)).toBe(false);
  store.dispose();
});
```

Kiss also has many features to [help you test](../category/testing), like waiting for a
state condition, mocking actions, and recording all actions and state changes.

## Why this matters

Zustand code is short, and for a small app it stays short. The cost shows up as the app grows,
because the library decided nothing, so every file decides for itself:

* **Changes have no single door.** Any function, component, or module can call `set`, so
  there is nowhere to add retry, debounce, logging, or "don't run twice" once, for all of
  them. In Kiss, every change is an action, and those are properties on the action.
* **Loading and failure are state you keep.** Every async function sets and clears its own
  flags, and catches its own errors, in its own way. In Kiss, the store tracks them, and the
  components ask.
* **The state has no single shape.** With many stores, no file shows what the app knows. In
  Kiss, the `State` class does.
* **Nothing has a home.** Timers, listeners, dependencies, and side effects go wherever they
  fit. In Kiss, they go in the store props, the dependencies, and the actions, and
  `store.dispose()` closes all of it.

## When an AI agent writes the code

Zustand leaves most decisions to whoever writes the code. When that is an AI agent, it makes
them again in each session, and you review the result:

* **One shape for every feature.** Zustand allows many ways to do the same thing: one store or
  many, slices, `set` inside the store or `setState` from outside, and loading flags named by
  each function. Your agent picks one in each session, and not always the same one. In Kiss,
  there is one way: a field in the `State` class, and an action that changes it. The tenth
  feature looks like the first, so it's easier to review.
* **Less to write by hand.** The "don't run twice" check, the "still fresh" check, and the
  retry loop in [Retry, debounce, fresh data, and more](#retry-debounce-fresh-data-and-more)
  are code your agent writes again for each function, along with the loading flags and the
  `try`/`catch` that clears them. Each one can be wrong. In Kiss, they are properties on the
  action, like `nonReentrant`, `fresh` and `retry`, and the store tracks the loading state. In
  review, each one is a single line.
* **Checks it can run.** A Kiss test creates a store, calls `dispatchAndWait`, and checks the
  state, as in [Testing](#testing). There is no `vi.mock('zustand')`, no store reset after each
  test, and nothing to render, so your agent can write the test and run it as part of its
  work. And `npx eslint`, with the [Kiss ESLint plugin](../getting-started/intro.md#linter),
  reports the mistakes that compile but fail at runtime, like a state changed in place, or an
  `expect` that doesn't wait for the action. The agent reads the errors and fixes them.
* **Where Zustand is ahead.** Zustand's API is small, and agents have seen far more Zustand
  code than Kiss code, so they write it well without help. For a small app, it's also less
  code. Kiss makes up for this in three ways. The
  [single-file docs](../getting-started/intro.md#docs) give your agent the whole API. The
  linter catches what it gets wrong. And once the project has some Kiss code, that code shows
  the agent the pattern to follow. See also
  [Claude's own take](../getting-started/claude-opinion-kiss.md#zustand).

---

Give it a try: [follow the tutorial](../tutorial/setting-up-the-store), or
[give your agent the docs](../getting-started/intro.md#docs) and ask it to rewrite one of your
Zustand stores with Kiss.
