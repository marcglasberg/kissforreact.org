---
sidebar_position: 6
---

# Comparing with Jotai

This page is for people who know Jotai. It shows how to get the same results with Kiss, which
does things in a different way. Each section shows the Jotai code first, and then the Kiss code
that does the same.

Jotai is based on **atoms**. An atom is a small piece of state, like `useState`, but shared. You
create atoms where you need them, and build bigger state from smaller atoms: a derived atom reads
other atoms, and is recalculated when they change. Components read and write atoms with hooks,
and re-render only when the atoms they read change. Jotai calls this a **bottom-up** approach.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components read the state
with a selector, and re-render when the selected value changes. This is a **top-down** approach:
the shape of the state is written first, in one class.

So, every time Jotai "sets an atom", Kiss "dispatches an action that returns a new state". And
every time Jotai "derives an atom from other atoms", Kiss "writes a getter or a selector".

## The big difference

Jotai is small and flexible, and some of its ideas are very good. A component that reads an atom
re-renders only when that atom changes, with no selectors to write. A derived atom tracks the
atoms it reads, so it's recalculated only when they change. And async atoms work with React's
Suspense out of the box.

What Jotai leaves to you is everything around the atoms. An atom holds a value, and anyone can
set it. Where does the code that calls the server go? Where do the "saving" flags go? What if
the save fails? What if the user clicks twice? How does the app reset all its atoms on logout?

Kiss answers these questions once, the same way for the whole app. Three things follow from
this, and they come up in every section below:

* **Every change goes through one door.** In Jotai, a component can set any primitive atom
  directly, and a write atom is just a function. There is no single entry point, so there is
  nowhere to hang behavior that applies to all changes: logging, retry, debouncing, "don't run
  this twice at the same time". In Kiss, every change is a dispatched action, so all of that is
  a property you set on the action.

* **Loading and failure are not state you keep.** Jotai's async story is about reading: an
  async atom suspends the component until its data arrives. For async writes, like saving a
  todo, the "saving" and "error" flags are atoms you keep by hand. In Kiss, the store tracks
  which actions are running and which have failed, reads and writes alike, and the components
  ask.

* **The state has one shape.** Jotai's state is a graph of atoms, spread across files, and the
  graph only exists at runtime. No file shows everything the app knows. Kiss has one `State`
  class, where every field of the app is declared.

|                           | Jotai                                           | Kiss                                      |
|---------------------------|-------------------------------------------------|-------------------------------------------|
| State                     | Many atoms, each with its own value             | One immutable value                       |
| Changing the state        | Set an atom, from anywhere, or a write atom     | An action class with `reduce()`           |
| Derived values            | Derived atoms                                   | Getters, selectors, cached fields         |
| Async reads               | Async atoms, with Suspense                      | `async reduce()`                          |
| Async writes              | Async write atoms, with flags kept by hand      | `async reduce()`                          |
| Loading and failed states | Suspense and error boundaries, or flags by hand | `useIsWaiting`, `useIsFailed`, `useSuspense` |
| Side effects              | `onMount`, `jotai-effect`                       | Actions, `useStoreEffect`, store props    |
| Retry, debounce, fresh    | By hand, or `jotai-tanstack-query`              | Action features                           |
| Optimistic updates        | By hand                                         | `OptimisticCommand`, `OptimisticSync`     |
| One value per item        | `atomFamily` (in the `jotai-family` package)    | A field keyed by id, and `statusKey`      |
| Persistence               | `atomWithStorage`, one atom at a time           | The persistor, for the whole state        |
| Devtools                  | `jotai-devtools`, with a UI panel               | `actionObserver`, `stateObserver`         |
| Server-side rendering     | A `Provider` per request, `useHydrateAtoms`     | `StoreProvider` with `serverState`        |
| Testing without UI        | Possible, with a store                          | Yes, with one store per test              |

## Quick translation

If you know Jotai, this table tells you where to look in Kiss. The sections below explain each
line, with code.

| Jotai                                                   | Kiss                                                                        |
|---------------------------------------------------------|-----------------------------------------------------------------------------|
| `atom(initialValue)`                                    | A field of the `State` class                                                |
| Many atoms, in many files                               | One `State` class. Its fields are your "atoms".                              |
| `useAtomValue(todosAtom)`                               | `useSelect((state) => state.todos)`                                         |
| Several `useAtomValue` calls                            | `useObject((state) => ({ ... }))`                                           |
| `useSetAtom(todosAtom)`, then `setTodos(...)`           | `dispatch(new SomeAction(...))`                                             |
| A derived atom, `atom((get) => ...)`                    | A getter on the state class, or a `Selector` class                          |
| A write atom, `atom(null, (get, set, arg) => ...)`      | An action class. `get` is `this.state`. `set` is returning a new state.     |
| `atomWithReducer`                                       | Action classes                                                              |
| An async atom, `atom(async (get) => ...)`               | An async action that puts the data in the state                             |
| `<Suspense>` around components that read async atoms    | `useSuspense(Action)`, or `useIsWaiting(Action)`                            |
| An error boundary for a failed async atom               | `useIsFailed(Action)`, `useExceptionFor(Action)`, or `useSuspense(Action)`  |
| `unwrap(asyncAtom, (prev) => prev)` (keep the old data) | Not needed. The state keeps the old data until the new data arrives.        |
| `atomWithRefresh`, and calling the refresh function     | Dispatch the action again                                                   |
| `signal` in an async atom                               | `this.abortSignal`, and `ignoreOld`                                         |
| `atomFamily` (`jotai-family`)                           | A field keyed by id, and `statusKey`                                        |
| `onMount` on an atom                                    | `useStoreEffect({ onMount })`                                               |
| `atomEffect`, `observe` (`jotai-effect`)                | An action that dispatches another, `dispatchWhen`, `stateObserver`          |
| `atomWithReset`, `RESET`, `useResetAtom`                | `UpdateStateAction`, or `store.logOut()`                                    |
| `atomWithStorage`                                       | The [persistor](../miscellaneous/persistor)                                 |
| `createStore()` and `<Provider store={store}>`          | `createStore()` and `<StoreProvider store={store}>`                         |
| `getDefaultStore()`, `store.get(atom)`, `store.set(...)` | `store.state`, `store.dispatch(action)`                                    |
| `store.sub(atom, listener)`                             | `stateObserver`, `dispatchWhen`                                             |
| `useHydrateAtoms`                                       | `serverState` in `StoreProvider`, and `StoreSlice`                          |
| `jotai-devtools`, `debugLabel`                          | `actionObserver`, `stateObserver`. The action class is the name.            |
| `jotai-tanstack-query`                                  | [Action features](../advanced-actions/action-features)                      |
| Retry, debounce, throttle, fresh (not in Jotai)         | `retry`, `debounce`, `throttle`, `fresh`                                    |

## Atoms and the state

In Jotai, the state is a set of atoms. You create each one with `atom`, usually next to the code
that uses it. A `Provider` is optional. Without one, the atoms live in a default store:

```tsx title="Jotai"
// todos.ts
export const todosAtom = atom<Todo[]>([]);
export const filterAtom = atom<'all' | 'done' | 'active'>('all');

// user.ts
export const userAtom = atom<User | null>(null);

// App.tsx. The Provider is optional.
<Provider>
  <App />
</Provider>
```

This is easy to start with, and it works well with code splitting: an atom is only created when
the module that defines it is loaded. But as the app grows, the atoms spread across many files,
and there is no place that shows the whole state, or how the atoms relate.

In Kiss, the state is one class, with readonly fields. `copy()` returns a new state with some
fields changed. The store gets the initial state, and `StoreProvider` passes the store to the
components:

```tsx title="Kiss"
class State {
  constructor(
    readonly todos: readonly Todo[],
    readonly filter: 'all' | 'done' | 'active',
    readonly user: User | null,
  ) {}

  copy(changes: Partial<State>): State {
    return Object.assign(new State(this.todos, this.filter, this.user), changes);
  }

  static initialState = new State([], 'all', null);
}

const store = createStore<State>({ initialState: State.initialState });

<StoreProvider store={store}>
  <App />
</StoreProvider>
```

`state.todos`, `state.filter` and `state.user` play the role of the atoms. They live in the same
object, so one action can read and change all of them. See
[Store and state](../basics/store-and-state).

## Components

In Jotai, a component reads an atom with `useAtomValue`, and gets a setter with `useSetAtom`.
`useAtom` gives both, like `useState`. The component re-renders when an atom it reads changes:

```tsx title="Jotai"
function TodoList() {
  const todos = useAtomValue(todosAtom);
  const filter = useAtomValue(filterAtom);
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

This is one of the nice parts of Jotai. Each atom is its own unit, so there are no selectors to
write, and no new objects to compare.

In Kiss, a component reads the state with `useSelect`, and gives it a selector. It re-renders
only when the selected value changes:

```tsx title="Kiss"
function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  const filter = useSelect((state: State) => state.filter);
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

To read several fields with one hook, `useObject` compares the new object with the previous
one, value by value:

```tsx title="Kiss"
const { todos, filter } = useObject((state: State) => ({ todos: state.todos, filter: state.filter }));
```

One thing to watch in Jotai: an atom is known by its identity, so an atom created during the
render is a new atom every time, and `useAtom(atom(0))` loops forever. Atoms must be created
outside the component, or kept with `useMemo`. Kiss selectors are plain functions of the state,
so there is nothing to keep stable. See
[Components use the state](../basics/components-use-the-state).

## Changing the state

In Jotai, a component can set a primitive atom directly. For logic that should live outside the
component, you write a **write atom**: an atom whose second argument is a function that gets
`get`, `set`, and the arguments you call it with:

```tsx title="Jotai"
// Directly, from a component.
const setTodos = useSetAtom(todosAtom);
setTodos((todos) => [...todos, todo]);

// Or with a write atom.
export const addTodoAtom = atom(null, (get, set, todo: Todo) => {
  set(todosAtom, [...get(todosAtom), todo]);
});

const addTodo = useSetAtom(addTodoAtom);
addTodo(todo);
```

In Kiss, you change the state by dispatching an action. An action is a class. Its constructor
parameters are the data it needs, and its `reduce()` method returns the new state. There is no
other way to change the state:

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

A Jotai write atom is close to a Kiss action: `get` is `this.state`, and `set` is returning a new
state. The difference is that in Jotai the write atom is optional. Nothing stops a component from
setting `todosAtom` directly, so some changes go through write atoms and some don't. And a write
atom is just a function, so there is nothing you can add to all of them at once. A Kiss action
is a unit: it has a name, and it can be logged, tested, and given
[features](#retry-debounce-fresh-data-and-more) like retry and debounce. See
[Actions and reducers](../basics/actions-and-reducers).

Jotai also has `atomWithReducer`, for an atom changed by a reducer function. In Kiss, every
action is its own reducer, so there is no `switch` on an action type.

## Derived values

Derived atoms are one of the best ideas in Jotai. An atom that reads other atoms with `get` is
recalculated only when one of them changes, and the components that read it re-render when its
value changes:

```tsx title="Jotai"
const doneCountAtom = atom((get) => get(todosAtom).filter((todo) => todo.done).length);

const todosForDisplayAtom = atom((get) => {
  const filter = get(filterAtom);
  return get(todosAtom).filter((todo) => filter === 'all' || (filter === 'done') === todo.done);
});

function DoneCount() {
  const doneCount = useAtomValue(doneCountAtom);
  return <p>{doneCount} done</p>;
}
```

Kiss has three ways to do this, from the simplest to the most elaborate.

**A getter on the state class.** For a value that depends on one part of the state, write a
getter on that class. Because the state is immutable, the getter can cache its result inside the
object. The object never changes, so the cached value can never go stale, and it's calculated
again only for a new state:

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

If the todos are kept in their own immutable class, as in the
[tutorial](../tutorial/creating-the-state), the getter goes on that class instead, and is
calculated again only when the todos change.

**A selector class.** For values that depend on several parts of the state, put the logic in a
class that takes the state. Components use it in `useSelect` or `useObject`, and actions use it
with `this.state`, so the logic is written once. Since the result is a new array, read it with
`useObject`, which compares it item by item, and re-renders only when the list really changed:

```tsx title="Kiss"
class Selector {
  constructor(readonly state: State) {}

  todosForDisplay(): Todo[] {
    const { todos, filter } = this.state;
    return todos.filter((todo) => filter === 'all' || (filter === 'done') === todo.done);
  }
}

// In a component.
const todos = useObject((state: State) => new Selector(state).todosForDisplay());

// In an action.
const todos = new Selector(this.state).todosForDisplay();
```

**A cache in the state.** For a value that is expensive to compute, compute it in the action
that changes its inputs, and store the result in the state. Since the state is immutable, the
cached value and its inputs always change together, so they can never disagree.

One difference: a Jotai derived atom is recalculated only when the atoms it read change. A Kiss
selector runs on every state change, and only the re-render is skipped. For cheap selectors,
that makes no difference. For expensive ones, use a cached getter, or a cache in the state.

## Loading data

In Jotai, an atom can be async. It fetches its data when a component first reads it, and the
component suspends until the data arrives, so it must be inside a `<Suspense>`. If the fetch
fails, the error is thrown to the nearest error boundary. A derived async atom fetches again
when the atoms it reads change:

```tsx title="Jotai"
const userIdAtom = atom('1');

const userAtom = atom(async (get, { signal }) => {
  return api.loadUser(get(userIdAtom), signal);
});

function UserName() {
  const user = useAtomValue(userAtom);
  return <p>{user.name}</p>;
}

<ErrorBoundary fallback={<p>Loading failed.</p>}>
  <Suspense fallback={<Spinner />}>
    <UserName />
  </Suspense>
</ErrorBoundary>
```

This is short, and it's a good fit for apps built around Suspense. The data follows the id
without any extra code. To fetch again with the same id, use `atomWithRefresh`. To show the old
data while the new one loads, instead of suspending, wrap the atom with `unwrap`.

In Kiss, an action loads the data, and puts it in the state. The component dispatches it, reads
the state, and asks if the action is running or has failed:

```tsx title="Kiss"
class LoadUser extends Action {
  constructor(readonly userId: string) { super(); }
  ignoreOld = true;  // A newer LoadUser cancels the older one.

  async reduce() {
    const user = await this.deps.api.loadUser(this.userId, this.abortSignal);
    return (state: State) => state.copy({ user });
  }
}

function UserName({ userId }: { userId: string }) {
  const user = useSelect((state: State) => state.user);
  const isWaiting = useIsWaiting(LoadUser);
  const isFailed = useIsFailed(LoadUser);

  useStoreEffect({ onMount: (store) => store.dispatch(new LoadUser(userId)) });

  if (isWaiting) return <Spinner />;
  if (isFailed) return <p>Loading failed.</p>;
  return <p>{user?.name}</p>;
}
```

If you prefer Suspense, `useSuspense(LoadUser)` does the same, in the Suspense style: it
suspends while the action runs, and throws to the nearest error boundary if it failed. See
[Suspense and error boundaries](../basics/wait-fail-succeed#suspense-and-error-boundaries).

Two differences:

* **Who decides when to load.** In Jotai, reading the atom loads the data, and changing the id
  loads it again. In Kiss, you dispatch the action: when the screen opens, and from the action
  that changes the id. It's one more line, but the loading is visible in the code, and it doesn't
  depend on which components happen to be mounted.

* **Where the data lives.** A Jotai async atom holds a promise. Anything that reads it must be
  async too, or deal with the promise. In Kiss, the data is in the state as a plain value, so
  actions, selectors, and tests read it synchronously. While a new user loads, the old one is
  still in the state, with nothing to unwrap.

To turn any error into a message for the user, override `wrapError()` in the action. See
[Wait, fail, succeed](../basics/wait-fail-succeed).

## Saving data

Jotai's async atoms are about reading. For an async write, like saving a todo, you write an
async write atom. The "saving" and "error" flags are atoms you keep by hand, before and after
the `await`:

```tsx title="Jotai"
const isSavingAtom = atom(false);
const saveErrorAtom = atom<string | null>(null);

const saveTodoAtom = atom(null, async (get, set, todo: Todo) => {
  set(isSavingAtom, true);
  set(saveErrorAtom, null);
  try {
    await api.saveTodo(todo);
    set(todosAtom, get(todosAtom).map((t) => (t.id === todo.id ? todo : t)));
  } catch (error) {
    set(saveErrorAtom, String(error));
  } finally {
    set(isSavingAtom, false);
  }
});

function SaveButton({ todo }: { todo: Todo }) {
  const saveTodo = useSetAtom(saveTodoAtom);
  const isSaving = useAtomValue(isSavingAtom);
  return <button onClick={() => saveTodo(todo)} disabled={isSaving}>Save</button>;
}
```

Each async write is a chance to get this wrong. If you forget the `finally`, the button stays
disabled. If two write atoms share one `isSavingAtom`, saving one thing disables another. And the
error became a string, so its type is gone.

In Kiss, an async write is an action like any other. The reducer awaits the server, and returns
the new state. If something goes wrong, the action throws, and the state is not changed:

```tsx title="Kiss"
class SaveTodo extends Action {
  constructor(readonly todo: Todo) { super(); }

  async reduce() {
    await this.deps.api.saveTodo(this.todo);
    return (state: State) => state.copy({ todos: state.todos.map((t) => (t.id === this.todo.id ? this.todo : t)) });
  }

  wrapError(error: any) {
    return new UserException('Could not save the todo.', { hardCause: error });
  }
}

function SaveButton({ todo }: { todo: Todo }) {
  const dispatch = useDispatch();
  const isSaving = useIsWaiting(SaveTodo);
  return <button onClick={() => dispatch(new SaveTodo(todo))} disabled={isSaving}>Save</button>;
}
```

There are no flags, because loading and failure are not state you keep. A `UserException` is
shown to the user in a dialog, by default. Reads and writes work the same way, so there is one
thing to learn, not two.

## One value per item

In Jotai, when each item of a list needs its own atom, like the todo being edited, or the status
of each save, you use `atomFamily`. In Jotai v3, it moved out of the core, to the `jotai-family`
package. It keeps a map from each parameter to its atom, and the Jotai docs warn that the map
grows forever unless you remove the entries you no longer need:

```tsx title="Jotai"
import { atomFamily } from 'jotai-family';

const todoAtomFamily = atomFamily((id: string) => atom((get) => get(todosAtom).find((todo) => todo.id === id)));

const todo = useAtomValue(todoAtomFamily(id));

// When the todo is removed.
todoAtomFamily.remove(id);
```

In Kiss, data per item is a field keyed by id, in the state, which goes away when the item does.
The status of an action per item is a `statusKey`. There is nothing to create, and nothing to
remove:

```tsx title="Kiss"
const todo = useSelect((state: State) => state.todos.find((todo) => todo.id === id));

class SaveTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  get statusKey() { return this.todo.id; }
  async reduce() { ... }
}

const isSaving = useIsWaiting(SaveTodo, { statusKey: todo.id });
```

See [Status per key](../basics/wait-fail-succeed#status-per-key).

## Side effects, timers and listeners

In Jotai, an atom can have an `onMount` function, which runs when the first component reads the
atom, and returns a cleanup that runs when the last one stops. For code that must run when atoms
change, there is the `jotai-effect` package, with `atomEffect` and `observe`:

```tsx title="Jotai"
const clockAtom = atom(new Date());

clockAtom.onMount = (setClock) => {
  const interval = setInterval(() => setClock(new Date()), 1000);
  return () => clearInterval(interval);
};

// With jotai-effect: load the todos when the user changes.
const loadTodosEffect = atomEffect((get, set) => {
  const user = get(userAtom);
  if (user) api.loadTodos(user.id).then((todos) => set(todosAtom, todos));
});
```

`onMount` ties the timer to the components: it runs while some component reads the atom. And an
`atomEffect` only runs while a component reads the effect atom, so it must be mounted somewhere.
(`observe` attaches the effect to a store instead, and returns a function to stop it.)

In Kiss, the same needs have more direct answers:

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

* **Something must happen when a component mounts or unmounts.** Use `useStoreEffect`.

* **Long-lived things, like timers, sockets and listeners,** go in the store **props**. An action
  creates them and gives them to the store with `setProp`, along with the function that closes
  them. Another action closes them with `disposeProp`. And `store.dispose()` closes all of them at
  once, at the end of the app, or at the end of each test:

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

See [Store props](../miscellaneous/store-props) and
[Wait for condition](../miscellaneous/wait-for-condition).

## Retry, debounce, fresh data, and more

Jotai has no opinion about these. Not saving twice at the same time, not reloading data that is
still fresh, retrying a failed request, and debouncing a search are all written by hand, inside
the write atom that needs them. For server data, Jotai has an extension, `jotai-tanstack-query`,
which wraps TanStack Query in atoms, and brings TanStack's cache with it, next to the atoms.

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

This is only possible because every change goes through `dispatch`. The store sees the action
before it runs, so it can skip it, delay it, or run it again. For optimistic updates, extend
[OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) or
[OptimisticSync](../advanced-actions/optimistic-features#optimisticsync), instead of writing the
rollback by hand. The [comparison with TanStack Query](./comparing-tanstack) goes through all
these features in detail.

## Outside components

In Jotai, the store has `get`, `set` and `sub`, for code that is not a component. Without a
`Provider`, it's the default store, from `getDefaultStore()`:

```tsx title="Jotai"
const store = getDefaultStore();

const todos = store.get(todosAtom);
store.set(addTodoAtom, todo);
const unsubscribe = store.sub(todosAtom, () => console.log(store.get(todosAtom)));
```

In Kiss, the store has the state, and `dispatch`:

```tsx title="Kiss"
const todos = store.state.todos;
store.dispatch(new AddTodo(todo));
```

To watch the state from outside, use a `stateObserver` in `createStore` (see
[Devtools and logging](#devtools-and-logging)), or `dispatchWhen`.

## Resetting the state

In Jotai, each atom that must go back to its initial value is created with `atomWithReset`, and
reset with `RESET` or `useResetAtom`. On logout, every atom of the app must be reset, one by
one, and you must remember all of them:

```tsx title="Jotai"
const todosAtom = atomWithReset<Todo[]>([]);
const userAtom = atomWithReset<User | null>(null);

const logOutAtom = atom(null, (get, set) => {
  set(todosAtom, RESET);
  set(userAtom, RESET);
  set(settingsAtom, RESET);
  // ...and every other atom.
});
```

In Kiss, there is one state, so resetting it is one action. And on logout, `store.logOut()` does
more than reset: it waits for the running actions, deletes the persisted state, and puts the
initial state back:

```tsx title="Kiss"
store.dispatch(new UpdateStateAction(() => State.initialState));

// On logout.
await store.logOut({ initialState: State.initialState });
```

## Persistence

In Jotai, an atom that must be saved is created with `atomWithStorage`, with a key. Each saved
atom is its own entry in the storage, as JSON. By default, the first render uses the initial
value, and the saved value arrives right after, unless you set `getOnInit: true`:

```tsx title="Jotai"
const todosAtom = atomWithStorage<Todo[]>('todos', []);
const filterAtom = atomWithStorage<'all' | 'done' | 'active'>('filter', 'all');
```

This is simple for a few values. For a bigger state, you decide atom by atom what's saved, each
one with its own key, and with the default JSON storage, class instances come back as plain
objects.

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state as
it changes, and loads it when the app starts. The `ClassPersistor` works with class instances,
so the state comes back as the same classes you defined:

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

Jotai has `jotai-devtools`, with a UI panel that shows the atoms and their values, and can go
back to a previous snapshot. It can also connect an atom to the Redux DevTools. The atoms are
shown by their `debugLabel`, which you set by hand, or with a Babel plugin:

```tsx title="Jotai"
import { DevTools } from 'jotai-devtools';

todosAtom.debugLabel = 'todos';

<DevTools />
```

This is a good tool, and Kiss has nothing like the panel. But what it shows are atom values. A
change has no name of its own, so to know what caused it, you look at which atoms changed
together.

Kiss logs actions, which have names. The `actionObserver` is called when an
action starts and ends, and the `stateObserver` is called with the state before and after each
action:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'Started' : 'Finished', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

A log line like `Finished AddTodo` tells you what happened, and there was nothing to name by
hand. See [Log and metrics](../miscellaneous/log-and-metrics).

## Server-side rendering

Without a `Provider`, Jotai keeps the atoms in a default store, which lives in the module. On
the server, the Jotai docs warn that this store is shared by every request, so the state of one
user can leak into another's page. So, for server-side rendering, you put a `Provider` at the
root, and give the atoms the data from the server with `useHydrateAtoms`, in a client
component. Each atom is hydrated only once per store:

```tsx title="Jotai"
'use client';

function TodosHydrator({ todos, children }: { todos: Todo[]; children: ReactNode }) {
  useHydrateAtoms([[todosAtom, todos]]);
  return children;
}

// In the layout.
<Provider>
  <TodosHydrator todos={todos}>
    <TodoList />
  </TodosHydrator>
</Provider>
```

In Kiss, the store is always an object you create, so one per request is the normal case.
`StoreProvider` is the context, and `serverState` tells the hooks what the server rendered, so
hydration matches even if a persistor already changed the state. In Next.js, each route loads its
data on the server and puts it in the store with `StoreSlice`:

```tsx title="Kiss"
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

The Jotai docs recommend testing through the components, with React Testing Library: render the
component inside a `Provider`, give atoms their starting values with `useHydrateAtoms`, click,
and check the screen. You can also test atoms without React, with a store of your own, but the
API is still mocked by module name, since the atoms import it:

```tsx title="Jotai"
vi.mock('./api');

test('saves the todo', async () => {
  vi.mocked(api.saveTodo).mockResolvedValue(undefined);
  const store = createStore();
  store.set(todosAtom, [todo1]);

  await store.set(saveTodoAtom, { ...todo1, done: true });

  expect(store.get(todosAtom)).toEqual([{ ...todo1, done: true }]);
  expect(store.get(isSavingAtom)).toBe(false);
});
```

In Kiss, each test creates its own store, with any initial state and fake dependencies. Then it
dispatches the action, waits for it, and checks the state. There is no module to mock, and when
the test ends, `store.dispose()` closes every prop, so nothing leaks into the next test:

```tsx title="Kiss"
test('saves the todo', async () => {
  const store = new Store<State>({
    initialState: State.initialState.copy({ todos: [todo1] }),
    dependencies: () => ({ api: new FakeApi() }),
  });

  await store.dispatchAndWait(new SaveTodo({ ...todo1, done: true }));

  expect(store.state.todos).toEqual([{ ...todo1, done: true }]);
  expect(store.isFailed(SaveTodo)).toBe(false);
  store.dispose();
});
```

The dependencies come from the store, not from an import. See
[Dependency injection](../miscellaneous/dependency-injection). Kiss also has many features to
[help you test](../category/testing), like waiting for a state condition, mocking actions, and
recording all actions and state changes.

## Why this matters

Jotai is a great replacement for `useState` and React Context: small, fast, and pleasant for
state that lives near the components. The cost shows up when the app has real logic, because
the library decided nothing about it:

* **Changes have no single door.** Any component can set any atom, and write atoms are optional,
  so there is nowhere to add retry, debounce, logging, or "don't run twice" once, for all of
  them. In Kiss, every change is an action, and those are properties on the action.
* **Async writes are by hand.** Async atoms help with reading, but every save keeps its own
  flags, and catches its own errors. In Kiss, reads and writes are both actions, and the store
  tracks their status.
* **The state has no single shape.** The atoms spread across files, and resetting, persisting, or
  inspecting the state means going atom by atom. In Kiss, the `State` class shows everything,
  and the store resets, persists, and logs it as a whole.
* **Nothing has a home.** Timers live in `onMount`, effects live in atoms that must be mounted,
  and the API is imported. In Kiss, they go in the store props, the actions, and the
  dependencies, and `store.dispose()` closes all of it.

---

Give it a try and [follow the tutorial](../tutorial/setting-up-the-store).
