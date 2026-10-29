---
sidebar_position: 9
---

# Comparing with Preact Signals

This page is for people who use Preact Signals in React, with the `@preact/signals-react`
package. It shows how to get the same results with Kiss, which does things in a different way.
Each section shows the Signals code first, and then the Kiss code that does the same.

Signals are based on **reactive values**. A signal is a small box that holds one value. You
read it and change it through `.value`. When a component reads a signal, it subscribes to it,
and when the value changes, the component updates. The state is many small boxes, and they
change in place. Signals are not only a Preact idea: Solid, Angular and Svelte 5 are built on
the same idea, and there is a TC39 proposal to add them to JavaScript itself.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components say which part of
the state they read, and re-render when that part changes.

So, every time Signals "assigns to `.value`", Kiss "dispatches an action that returns a new
state". And every time Signals "tracks what a component read", Kiss "runs the selector the
component gave it".

## The big difference

Signals are about as small as state management gets. A signal is one line, a change is one
assignment, and the updates are fine-grained: a signal rendered in JSX can update its text
without re-rendering the component at all. That is the appeal, and it's real.

What Signals leave out is everything around the value. Who may change it? Where does the code
that calls the server go? How do you know a request is loading, or failed? When does an effect
stop? How does a test start clean? Like MobX, Signals answer none of this, and the tracking that
makes them short is also implicit: what updates depends on what was read, not on what is written
in the code.

Kiss answers these questions once. The state is one class. A change is an action, with a name.
An async change is an action with `async` in front of its reducer. Loading and failure are
tracked for you. Timers and listeners go in the store props. Each test creates its own store.

Three things follow from this, and they come up in every section below:

* **A change has a name.** Any code that can import a signal can assign to it: a function, a
  component, a callback, a timer. In Kiss, every change is an action with a name, so logs,
  tests, and your IDE can find it.

* **Mistakes are loud, not silent.** The common Signals mistakes in React, like a component the
  Babel transform didn't detect, a signal read inside a render prop, or a `push` into the array
  inside a signal, don't throw. The screen just stays stale. In Kiss, those mistakes can't be
  made, because there is nothing to track and nothing to mutate.

* **The state is one value.** With Signals, the app's data is spread across many signals, in
  many modules. There is no single object you can log, save, compare, or restore. In Kiss, the
  state is one value, so snapshots, undo, persistence and tests come for free.

|                           | Signals                                              | Kiss                                          |
|---------------------------|------------------------------------------------------|-----------------------------------------------|
| State                     | Many mutable signals                                 | One immutable value                           |
| Changing the state        | Assign to `.value`, from anywhere                    | An action class with `reduce()`               |
| Async changes             | An `async` function that assigns signals             | `async reduce()`                              |
| Loading and failed states | Signals you keep by hand                             | `useIsWaiting`, `useIsFailed`                 |
| Derived values            | `computed`                                           | Getters, selectors, cached fields             |
| Side effects              | `effect`, `useSignalEffect`                          | Actions, `useStoreEffect`, store props        |
| Connecting to React       | A Babel transform, or `useSignals()` in components   | `useSelect`                                   |
| Rendering                 | Fine-grained. A signal in JSX updates its own text.  | The component re-renders when its value changes |
| Retry, debounce, fresh    | By hand                                              | Action features                               |
| Optimistic updates        | By hand                                              | `OptimisticCommand`, `OptimisticSync`         |
| Snapshots, undo           | Read and write each signal by hand                   | `store.state`, `UpdateStateAction`            |
| Persistence               | By hand, with an `effect`                            | The persistor                                 |
| Server-side rendering     | A factory and a context you write                    | `StoreProvider` with `serverState`            |
| Testing without UI        | Yes, if you reset the signals between tests          | Yes, with one store per test                  |

## Quick translation

If you know Signals, this table tells you where to look in Kiss. The sections below explain each
line, with code.

| Signals                                                        | Kiss                                                                          |
|----------------------------------------------------------------|-------------------------------------------------------------------------------|
| `signal(initialValue)` in a module                             | A readonly field of the `State` class                                         |
| A `createAppState()` factory, passed down with a context       | `createStore`, and `StoreProvider`                                            |
| `todos.value = [...todos.value, todo]`                         | An action whose `reduce()` returns `this.state.copy({ todos: ... })`          |
| A function that assigns to signals, like `addTodo(todo)`       | An action class, like `AddTodo`                                               |
| `createModel`, and its methods                                 | State classes with methods, and actions that call them                        |
| `batch(() => { ... })`                                         | Not needed. One action makes one new state.                                   |
| Reading `todos.value` in a component                           | `useSelect((state) => state.todos)`                                           |
| The Babel transform, or `useSignals()`                         | Not needed. `useSelect` subscribes the component.                             |
| `{count}` in JSX (updates the text, no re-render)              | `useSelect((state) => state.count)` (re-renders only this component)          |
| `useSignal(initialValue)`                                      | A field of the state, or React's `useState` for state only one component uses |
| `computed(() => ...)`, `useComputed`                           | A getter on the state class, a `Selector` class, or a cached field            |
| `effect`, `useSignalEffect`                                    | An action that dispatches another; `useStoreEffect`; `dispatchWhen`           |
| The dispose function an `effect` returns                       | Store props, disposed by the store                                            |
| `peek()`, `untracked()`                                        | Not needed. Reading `this.state` in an action subscribes to nothing.          |
| `isLoading` and `error` signals                                | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`      |
| An API imported by the module                                  | `dependencies` in `createStore`, read with `this.deps`                        |
| An `effect` that writes to `localStorage`                      | The [persistor](../miscellaneous/persistor)                                   |
| The `name` option, and `@preact/signals-debug`                 | `actionObserver`, `stateObserver`                                             |
| Retry, debounce, throttle, fresh (not in Signals)              | `retry`, `debounce`, `throttle`, `fresh`                                      |

## Creating the state

With Signals, the state is a set of signals. The simplest way is to create them at module level,
and import them where they are needed:

```tsx title="Signals"
import { signal } from '@preact/signals-react';

export const todos = signal<Todo[]>([]);
export const user = signal<User | null>(null);
```

Module-level signals are shared by everything that imports them: every test, and every request
on the server. So the Preact documentation suggests a factory that creates the signals, passed
down with a React context:

```tsx title="Signals"
function createAppState() {
  const todos = signal<Todo[]>([]);
  const user = signal<User | null>(null);
  return { todos, user };
}

type AppState = ReturnType<typeof createAppState>;
const AppStateContext = createContext<AppState | null>(null);

function Root() {
  const [state] = useState(createAppState);
  return (
    <AppStateContext.Provider value={state}>
      <App />
    </AppStateContext.Provider>
  );
}
```

That is a store, written by hand.

In Kiss, the state is one class. All the fields of the app are declared there, so you can read
the whole shape of your app in one file. The fields are readonly, and `copy()` returns a new
state with some fields changed. The store gets the initial state, and `StoreProvider` passes the
store to the components:

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

With Signals, you change the state by assigning to `.value`. The Preact documentation suggests
putting these assignments in functions, kept apart from the data. But that is a convention.
Nothing stops a component, a callback, or another module from assigning directly:

```tsx title="Signals"
export function addTodo(todo: Todo) {
  todos.value = [...todos.value, todo];
}

export function removeTodo(id: string) {
  todos.value = todos.value.filter((todo) => todo.id !== id);
}

// Anywhere else.
todos.value = [];
```

Two details to remember. A signal only notifies when `.value` is assigned a different value, so
`todos.value.push(todo)` changes the array but updates nothing. And each assignment is its own
update, so a function that changes three signals should wrap them in `batch`, or the components
may see the state halfway through the change:

```tsx title="Signals"
batch(() => {
  todos.value = [...todos.value, todo];
  draft.value = '';
});
```

Newer versions add `createModel`, which groups signals with the methods that change them. The
methods are batched for you:

```tsx title="Signals"
const TodoModel = createModel(() => {
  const todos = signal<Todo[]>([]);
  return {
    todos,
    addTodo(todo: Todo) { todos.value = [...todos.value, todo]; },
  };
});
```

This is a step toward named changes. But `todos` is still a signal that anyone holding the model
can assign to.

In Kiss, you change the state by dispatching an action. An action is a class. Its constructor
parameters are the data it needs, and its `reduce()` method returns the new state. There is no
other way to change the state, so every change has a name, and you can search for it:

```tsx title="Kiss"
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  reduce() { return this.state.copy({ todos: [...this.state.todos, this.todo], draft: '' }); }
}

class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }
  reduce() { return this.state.copy({ todos: this.state.todos.filter((todo) => todo.id !== this.id) }); }
}

dispatch(new AddTodo(todo));
```

There is no `batch`, because an action returns one new state, with all its changes at once. And
there is nothing to mutate by mistake. See [Actions and reducers](../basics/actions-and-reducers).

## Components

`@preact/signals-react` has two ways to make a component update when a signal changes. The
recommended one is a Babel plugin, `@preact/signals-react-transform`. It finds your components,
and adds the subscription code to them. If you can't change your Babel config, you call
`useSignals()` at the top of every component that reads a signal:

```tsx title="Signals"
// With the Babel transform.
function TodoList() {
  return <ul>{todos.value.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}

// Without it.
import { useSignals } from '@preact/signals-react/runtime';

function TodoList() {
  useSignals();
  return <ul>{todos.value.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

Older versions tracked the components by themselves, through React internals. That was fragile,
didn't work with React 19, and was removed. Now, tracking depends on the transform finding your
component, and its documentation lists the cases it can miss:

* It treats a function as a component if its name starts with a capital letter and it returns
  JSX, and as a user of signals if it reads `.value`. A component that doesn't look like that is
  not transformed.
* A signal read inside a render prop may not be tracked.
* A signal read through an object getter may not be tracked.

The fixes are an option in the plugin (`mode: 'all'`), or moving the read into its own
component. In every case, the symptom is the same: no error, and a screen that doesn't update.

Signals also have a trick that Kiss doesn't: if you render the signal itself, as `{count}`
instead of `{count.value}`, the text on the screen updates without re-rendering the component:

```tsx title="Signals"
function Counter() {
  return <p>Count: {count}</p>; // Updates the text. Counter doesn't re-render.
}
```

In Kiss, a component reads the state with `useSelect`, and gives it a function that picks the
part it needs. The component re-renders when that part changes, and only then. There is no
plugin, nothing to call at the top of the component, and nothing to detect:

```tsx title="Kiss"
function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}

function Counter() {
  const count = useSelect((state: State) => state.count);
  return <p>Count: {count}</p>;
}
```

`Counter` re-renders when the count changes, and nothing else does. For most components, the
difference from updating the text directly is too small to notice. To read several fields at once, use `useObject`. To read the whole state, use
`useAllState`. See [Components use the state](../basics/components-use-the-state).

## Derived values

Signals have `computed`: a signal whose value is calculated from other signals, and cached until
one of them changes. Inside a component, `useComputed` does the same. This is one of the best
parts of Signals:

```tsx title="Signals"
const doneCount = computed(() => todos.value.filter((todo) => todo.done).length);

function DoneCount() {
  return <p>{doneCount} done</p>;
}
```

Kiss has three ways to do this, from the simplest to the most elaborate.

**A getter on the state class.** For a value that depends on one part of the state, write a
getter on that class. The component reads it with `useSelect`, and re-renders only when the
result changes. Because the state is immutable, the getter can cache its result inside the
object, and the cached value can never go stale. That is a `computed` with nothing to track:

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

**A selector class.** For values that depend on several parts of the state, put the logic in a
class that takes the state. Components use it in `useSelect`, and actions use it with
`this.state`. The logic is written once:

```tsx title="Kiss"
class Selector {
  constructor(readonly state: State) {}

  todosForDisplay(): Todo[] {
    const { todos, filter } = this.state;
    return todos.filter((todo) => filter === 'all' || (filter === 'done') === todo.done);
  }
}

const todos = useSelect((state: State) => new Selector(state).todosForDisplay());
```

**A cache in the state.** For a value that is expensive to compute, compute it in the action that
changes its inputs, and store the result in the state. Since the state is immutable, the cached
value and its inputs always change together.

## Async changes

Signals have no async story of their own. An async change is an `async` function that assigns
signals before and after the `await`. The loading and error flags are signals too, which you
create and keep by hand:

```tsx title="Signals"
export const todos = signal<Todo[]>([]);
export const isLoading = signal(false);
export const error = signal<string | null>(null);

export async function loadTodos() {
  isLoading.value = true;
  error.value = null;
  try {
    todos.value = await api.loadTodos();
  } catch (e) {
    error.value = String(e);
  } finally {
    isLoading.value = false;
  }
}

function TodoList() {
  useEffect(() => { loadTodos(); }, []);

  if (isLoading.value) return <Spinner />;
  if (error.value) return <p>{error.value}</p>;
  return <ul>{todos.value.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

This is the shape of every async function in a Signals app, and each one is a chance to get it
wrong. If you forget to clear `isLoading` in one branch, the spinner never goes away. If one
`isLoading` is shared by three functions, loading one thing shows a spinner on another. The
function catches its own error, so whoever called it can't know it failed. And the error became a
string, so its type is gone.

In Kiss, an action can be async. Its `reduce()` method awaits what it needs, and returns a
function that produces the new state. If something goes wrong, the action throws, and the state
is not changed:

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

There are no `isLoading` and `error` signals, because loading and failure are not state you keep.
They are questions you ask about the action: is `LoadTodos` running? Did it fail? Kiss tracks the
answers for you, so they are always right. Each action class has its own status, and any
component can ask, not only the one that dispatched the action. See
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

## Side effects

With Signals, code that must run when the state changes goes in an `effect`. It runs once, and
again every time a signal it read changes. It can return a cleanup function, which runs before
the next run. And `effect` itself returns a dispose function, which you must call when the effect
is no longer needed, or it keeps running. Inside a component, `useSignalEffect` disposes it when
the component unmounts:

```tsx title="Signals"
// Module level. Runs now, and again whenever roomId changes. Who calls dispose?
const dispose = effect(() => {
  const connection = chat.connect(roomId.value);
  return () => connection.close();
});

// In a component. Disposed on unmount.
function TodoTitle() {
  useSignalEffect(() => { document.title = `${todos.value.length} todos`; });
  return null;
}
```

What an effect depends on is decided by what it happens to read while it runs. Reading a signal
by accident adds a dependency, so the effect runs more than you meant. Reading one after an
`await` adds none, so the effect runs less than you meant. `peek()` and `untracked()` exist to
read without subscribing, and you need to remember them.

In Kiss, the same needs have more direct answers, and none of them is a tracked function:

* **Something must happen after a change.** The action that makes the change does it. If logging
  in should load the todos, `LogIn` dispatches `LoadTodos`:

  ```tsx title="Kiss"
  class LogIn extends Action {
    async reduce() {
      const user = await this.deps.api.logIn();
      this.dispatch(new LoadTodos());
      return (state: State) => state.copy({ user });
    }
  }
  ```

* **Something must happen when a condition becomes true.** Use `dispatchWhen`, which dispatches
  an action as soon as the state meets a condition:

  ```tsx title="Kiss"
  store.dispatchWhen(new LoadTodos(), (state) => state.user !== null, { timeoutMillis: 0 });
  ```

* **Something must happen when a component mounts or unmounts.** Use `useStoreEffect`:

  ```tsx title="Kiss"
  useStoreEffect({
    onMount: (store) => store.dispatch(new ConnectToRoom(roomId)),
    onUnmount: (store) => store.dispatch(new DisconnectFromRoom()),
  });
  ```

Long-lived things, like connections, listeners and timers, go in the store **props**. An action
creates them and gives them to the store with `setProp`, along with the function that closes
them. Another action closes them with `disposeProp`. And `store.dispose()` closes all of them at
once, at the end of the app, or at the end of each test:

```tsx title="Kiss"
class ConnectToRoom extends Action {
  constructor(readonly roomId: string) { super(); }

  reduce() {
    const connection = chat.connect(this.roomId);
    this.setProp('room', connection, { dispose: (connection) => connection.close() });
    return null;
  }
}

class DisconnectFromRoom extends Action {
  reduce() {
    this.disposeProp('room');
    return null;
  }
}
```

See [Store props](../miscellaneous/store-props).

## Retry, debounce, fresh data, and more

Signals have no opinion about these. Retrying a failed request, debouncing a search, not
reloading data that is still fresh, not running the same request twice at the same time, and
updating the screen before the server answers are all written by hand, inside the function that
needs them.

In Kiss these are [action features](../advanced-actions/action-features). You declare them on the
action, and the logic is done for you:

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

For optimistic updates, extend
[OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) or
[OptimisticSync](../advanced-actions/optimistic-features#optimisticsync), instead of writing the
rollback by hand. The [comparison with TanStack Query](./comparing-tanstack) goes through all
these features in detail.

## Snapshots and undo

With Signals, the state of the app is the current value of many signals, in many modules. To take
a snapshot, you read each one. To restore it, you assign each one, inside a `batch`. To keep a
history for undo, you write an `effect` that reads all of them, and remember to update it every
time you add a signal.

In Kiss, the state is one value. A snapshot is `store.state`, and restoring it is an action. A
`stateObserver` saves each new state, and `UpdateStateAction` goes back to one of them:

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

## Persistence

Signals have no persistence of their own. You write an `effect` that saves the signals you care
about, and code that reads them back when the app starts. The values go through JSON, so class
instances come back as plain objects:

```tsx title="Signals"
const saved = localStorage.getItem('todos');
export const todos = signal<Todo[]>(saved ? JSON.parse(saved) : []);

effect(() => {
  localStorage.setItem('todos', JSON.stringify(todos.value));
});
```

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state as
it changes, and loads it when the app starts. The `ClassPersistor` works with class instances, so
the state comes back as the same classes you defined:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});

// To know if the saved state has loaded.
await store.ready();                    // Outside components.
const isReady = useIsStoreReady();      // In components.
```

## Dependencies

With Signals, a function that calls the server gets its API client by importing it. So, in a
test, the module must be mocked:

```tsx title="Signals"
import { api } from './api';

export async function loadTodos() {
  todos.value = await api.loadTodos();
}

// In the test.
vi.mock('./api');
```

In Kiss, you give the dependencies to the store, and a base action class gives you typed access
to them. Every action extends that base class:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  dependencies: () => ({ api: new Api() }),
});

abstract class Action extends KissAction<State> {
  get deps(): Dependencies { return this.store.dependencies as Dependencies; }
}
```

In a test, give the store fake dependencies instead. See
[Dependency injection](../miscellaneous/dependency-injection).

## Logging and debugging

Signals can be given a `name`, which the `@preact/signals-debug` package uses when it logs the
updates. What you see is a stream of signal writes, which is hard to map back to "what did the
user do".

Kiss logs actions, which have names. The `actionObserver` is called when an action starts and
ends. The `stateObserver` is called with the state before and after each action:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'Started' : 'Finished', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

A log line like `Finished AddTodo` tells you what happened. See
[Log and metrics](../miscellaneous/log-and-metrics).

## Server-side rendering

Module-level signals are shared by every request on the server, so one user's data can leak into
another user's page. To render on the server, you need the `createAppState()` factory from
[Creating the state](#creating-the-state), one per request, passed down with your own context.
On the server, the components don't subscribe to signals, since they render once.

In Kiss, the store is always an object you create, so one per request is the normal case.
`StoreProvider` is the context, and `serverState` tells the hooks what the server rendered. In
Next.js, each route loads its data on the server and puts it in the store with `StoreSlice`:

```tsx title="Kiss"
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

Signals can be tested without a UI, which is good. But module-level signals keep their values
from one test to the next, so each test must reset them by hand. Effects created at module level
keep running. And the API is mocked by module name:

```tsx title="Signals"
vi.mock('./api');

beforeEach(() => {
  todos.value = [];
  isLoading.value = false;
  error.value = null;
});

test('loads the todos', async () => {
  vi.mocked(api.loadTodos).mockResolvedValue([todo1, todo2]);

  await loadTodos();

  expect(todos.value).toEqual([todo1, todo2]);
  expect(isLoading.value).toBe(false);
});
```

In Kiss, each test creates its own store, with any initial state and fake dependencies. Then it
dispatches the action, waits for it, and checks the state. There is nothing to reset and no
module to mock. When the test ends, `store.dispose()` closes every prop, so nothing leaks into
the next test:

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

Kiss also has many features to [help you test](../category/testing), like waiting for a state
condition, mocking actions, and recording all actions and state changes.

## Why this matters

Signals code is short, and the updates are as precise as they get. The cost shows up as the app
grows:

* **Changes have no name.** Any code can assign to `.value`, so "who changed this?" has no place
  to look. In Kiss, every change is an action, and you can search for it, log it, and test it.
* **Mistakes are silent.** A component the transform didn't detect, a signal read in a render
  prop, a `push` into the array inside a signal: the screen just stays stale. In Kiss, those
  mistakes can't be made.
* **Async is left to you.** Every request needs its own loading and error signals, set and
  cleared by hand. In Kiss, the store tracks them, and features like retry and debounce are
  properties on the action.
* **The state is not a value.** Snapshots, undo, persistence, server rendering, and clean tests
  all need one object that holds the app's data. Signals don't have it, so you build it. In Kiss,
  it's the state.

---

Give it a try and [follow the tutorial](../tutorial/setting-up-the-store).
