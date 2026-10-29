---
sidebar_position: 8
---

# Comparing with Effector

This page is for people who know Effector. It shows how to get the same results with Kiss,
which does things in a different way. Each section shows the Effector code first, and then the
Kiss code that does the same.

Effector is based on **units**: events, stores, and effects. An event is a message. A store
holds one value, and changes it with `.on(event, reducer)`. An effect is an async function, with
events for success and failure, and a `pending` store. Units are connected with `sample`, which
says "when this happens, take that value, and send it there". The app is a graph of small units,
wired together.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components read the state with
a selector, and re-render when the selected value changes.

Of all the libraries that are not Redux, Effector is the closest to Kiss. Both have messages and
reducers. Both track if async work is running. Both keep the logic out of the components, and
test it without a UI. So, every time Effector "fires an event that a store reduces", Kiss
"dispatches an action that returns a new state". And every time Effector "wires units with
`sample`", Kiss "writes the steps in an action".

## The big difference

Effector splits the logic into many small pieces, and connects them. A store doesn't know who
changes it, an event doesn't know who listens, and the connections are in `sample` calls, often
in another file. This is very flexible, and Effector has real strengths: effects give you
`pending` for free, `sample` describes data flow without callbacks, and scopes (`fork`) make
server-side rendering and tests clean.

The cost is that one feature is spread over many units. To know what happens when the user logs
in, you follow the wires: the event, the effect it triggers, the `doneData` of the effect, the
stores that reduce it, the `sample` calls that start other effects. And `sample`, `combine`,
`attach`, gates, and the operators from `patronum` are a lot to learn before the code reads
naturally.

Kiss keeps one feature in one place. An action is a class, and its `reduce()` method does the
steps in order: read the state, await the server, dispatch the next action, return the new
state.

Three things follow from this, and they come up in every section below:

* **The steps are in order, in one place.** In Effector, "log in, then load the todos" is an
  effect, a `.on` on a store, and a `sample` from the effect's `doneData` to another effect. In
  Kiss, it's an action that awaits the login and dispatches `LoadTodos`.

* **Failure is tracked too, not only loading.** Effector gives you `pending`, but the error is
  an event, so the "failed" state is a store you write by hand, and reset by hand. In Kiss, the
  store tracks which actions are running **and** which have failed.

* **There is one state, not many stores.** In Effector, each value is its own store: `$user`,
  `$todos`, `$filter`. In Kiss, there is one `State` class, where every field of the app is
  declared, and every action can read all of it.

|                           | Effector                                          | Kiss                                      |
|---------------------------|---------------------------------------------------|-------------------------------------------|
| State                     | Many small stores                                 | One immutable value                       |
| Changing the state        | An event, and a `.on` reducer on each store       | An action class with `reduce()`           |
| Async changes             | `createEffect`, wired with `doneData`, `failData` | `async reduce()`                          |
| Loading state             | `fx.pending`                                      | `useIsWaiting`                            |
| Failed state              | A store you keep from `fx.failData`               | `useIsFailed`, `useExceptionFor`          |
| Connecting features       | `sample`                                          | Actions that dispatch other actions       |
| Derived values            | `combine`, `store.map`                            | Getters, selectors, cached fields         |
| Retry, debounce, fresh    | `patronum`, Farfetched (other libraries)          | Action features                           |
| Optimistic updates        | By hand                                           | `OptimisticCommand`, `OptimisticSync`     |
| Dependencies              | `attach`, and `handlers` in `fork`                | Injected into the store                   |
| Persistence               | `effector-storage` (another library)              | The persistor (plain objects and classes) |
| Server-side rendering     | `fork`, `serialize`, and a compiler plugin        | `StoreProvider` with `serverState`        |
| Testing without UI        | Yes, with `fork` and `allSettled`                 | Yes, with one store per test              |

## Quick translation

If you know Effector, this table tells you where to look in Kiss. The sections below explain each
line, with code.

| Effector                                                       | Kiss                                                                          |
|----------------------------------------------------------------|-------------------------------------------------------------------------------|
| `createStore(initialValue)`, one per value                     | A field of the `State` class, given to `createStore({ initialState })`        |
| `createEvent<Todo>()`                                          | An action class, `class AddTodo extends Action`                               |
| `$todos.on(todoAdded, (todos, todo) => [...todos, todo])`      | `reduce()`, returning `this.state.copy({ todos: [...] })`                      |
| `todoAdded(todo)`                                              | `dispatch(new AddTodo(todo))`                                                 |
| `useUnit($todos)`                                              | `useSelect((state) => state.todos)`                                           |
| `useUnit([$todos, todoAdded])`                                 | `useSelect(...)` and `useDispatch()`                                          |
| `useStoreMap`                                                  | `useSelect`, `useObject`                                                      |
| `createEffect(handler)`                                        | An action with `async reduce()`                                               |
| `$todos.on(loadTodosFx.doneData, ...)`                         | The function returned by `async reduce()`                                     |
| `loadTodosFx.pending`                                          | `useIsWaiting(LoadTodos)`                                                     |
| `$error.on(loadTodosFx.failData, ...)`                         | `useIsFailed(LoadTodos)`, `useExceptionFor(LoadTodos)`, `wrapError()`         |
| `loadTodosFx.finally`                                          | `after()`                                                                     |
| `sample({ clock, source, filter, fn, target })`                | An action that reads the state, checks, and dispatches another action         |
| `filter` in `sample`                                           | An `if` in the reducer, or `abortDispatch()`                                  |
| `combine`, `$store.map`                                        | Getters on the `State` class, a `Selector` class, or a cached field           |
| `attach({ source, effect })`                                   | `this.state` inside the action                                                |
| `createGate` and `useGate`                                     | `useStoreEffect({ onMount, onUnmount })`                                      |
| `.reset(loggedOut)` on every store                             | `store.logOut()`, or `UpdateStateAction`                                      |
| `fork({ values, handlers })`                                   | `new Store({ initialState, dependencies })`                                   |
| `allSettled(unit, { scope })`                                  | `store.dispatchAndWait(action)`                                               |
| `scope.getState($todos)`                                       | `store.state.todos`                                                           |
| `serialize(scope)`, `fork({ values })`, `<Provider value={scope}>` | `StoreProvider` with `serverState`, and `StoreSlice`                      |
| `debounce`, `throttle` from `patronum`                         | `debounce`, `throttle`                                                        |
| `retry`, `cache`, `concurrency` from Farfetched                | `retry`, `fresh`, `ignoreOld`                                                 |
| `effector-storage`                                             | The [persistor](../miscellaneous/persistor)                                   |
| `effector/inspect`, the Redux DevTools adapter                 | `actionObserver`, `stateObserver`                                             |

## Stores and state

In Effector, each value is a store. You create one store per value, and give it its initial
value. By convention, store names start with `$`:

```tsx title="Effector"
import { createStore } from 'effector';

export const $todos = createStore<Todo[]>([]);
export const $user = createStore<User | null>(null);
export const $filter = createStore<Filter>('all');
```

The stores are declared at module level, and live in many files. There is no one place that
shows everything the app knows.

In Kiss, the state is one class. All the fields of the app are declared there, so you can read
the whole shape of your app in one file. The fields are readonly, and `copy()` returns a new
state with some fields changed. The store gets the initial state, and `StoreProvider` passes the
store to the components:

```tsx title="Kiss"
class State {
  constructor(
    readonly todos: readonly Todo[],
    readonly user: User | null,
    readonly filter: Filter,
  ) {}

  copy(changes: Partial<State>): State {
    return Object.assign(new State(this.todos, this.user, this.filter), changes);
  }

  static initialState = new State([], null, 'all');
}

const store = createStore<State>({ initialState: State.initialState });

<StoreProvider store={store}>
  <App />
</StoreProvider>
```

The fields of the `State` class play the role of Effector's stores: `state.todos` is `$todos`,
and `state.user` is `$user`. They live in the same object, so one action can read and change
both. See [Store and state](../basics/store-and-state).

## Changing the state

In Effector, a change is an event. You create it with its payload type, and each store that
cares about it says how to change, with `.on`. The reducer gets the current value of the store
and the payload, and returns the new value. You fire the event by calling it:

```tsx title="Effector"
import { createEvent, createStore } from 'effector';

export const todoAdded = createEvent<Todo>();
export const todoRemoved = createEvent<string>();

export const $todos = createStore<Todo[]>([])
  .on(todoAdded, (todos, todo) => [...todos, todo])
  .on(todoRemoved, (todos, id) => todos.filter((todo) => todo.id !== id));

todoAdded(todo);
```

This is close to Kiss. The difference is where the reducer lives. In Effector, the reducer
belongs to the store, so an event that changes three stores has its reducer in three places,
one `.on` on each store. To know what `todoAdded` does, you search for every `.on(todoAdded`.

In Kiss, the reducer belongs to the action. An action is a class. Its constructor parameters are
the payload, and its `reduce()` method returns the new state, with every field it changes:

```tsx title="Kiss"
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  reduce() { return this.state.copy({ todos: [...this.state.todos, this.todo] }); }
}

class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }
  reduce() { return this.state.copy({ todos: this.state.todos.filter((todo) => todo.id !== this.id) }); }
}

store.dispatch(new AddTodo(todo));
```

To know what `AddTodo` does, you read `AddTodo`. In your IDE, you can click the action where
it's dispatched and land on its reducer. See [Actions and reducers](../basics/actions-and-reducers).

## Components

In Effector, a component reads stores and binds events with `useUnit`. It accepts one unit, an
array, or an object. The component re-renders when one of the stores it read changes:

```tsx title="Effector"
import { useUnit } from 'effector-react';

function TodoList() {
  const [todos, removeTodo] = useUnit([$todos, todoRemoved]);

  return (
    <ul>
      {todos.map((todo) => <li key={todo.id} onClick={() => removeTodo(todo.id)}>{todo.title}</li>)}
    </ul>
  );
}
```

In Kiss, a component reads the state with `useSelect`, and gives it a function that picks the
part it needs. It dispatches actions with `useDispatch`:

```tsx title="Kiss"
function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  const dispatch = useDispatch();

  return (
    <ul>
      {todos.map((todo) => <li key={todo.id} onClick={() => dispatch(new RemoveTodo(todo.id))}>{todo.title}</li>)}
    </ul>
  );
}
```

Effector's `useStoreMap` selects a part of a store, so the component re-renders only when that
part changes. In Kiss, that's what every `useSelect` does. To select several values at once, use
`useObject`. See [Components use the state](../basics/components-use-the-state).

## Async changes

This is where Effector is strong. An effect is an async function. Calling it runs the function,
and the effect gives you a `pending` store, which is `true` while it runs, a `doneData` event
with the result, and a `failData` event with the error. Stores reduce those events with `.on`:

```tsx title="Effector"
import { createEffect, createStore } from 'effector';

export const loadTodosFx = createEffect(() => api.loadTodos());

export const $todos = createStore<Todo[]>([])
  .on(loadTodosFx.doneData, (_, todos) => todos);

export const $error = createStore<Error | null>(null)
  .on(loadTodosFx.failData, (_, error) => error)
  .reset(loadTodosFx);

function TodoList() {
  const [todos, isLoading, error, loadTodos] = useUnit([$todos, loadTodosFx.pending, $error, loadTodosFx]);

  useEffect(() => { loadTodos(); }, [loadTodos]);

  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

The `pending` store is free, and always right. That's better than most libraries, where the
loading flag is a field you keep by hand. But the error is an event, not a state, so to show it,
you keep a `$error` store, and remember to reset it when the effect runs again. Every effect
whose failure the UI must show needs one.

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

The result and the new state are in one place: the reducer. Loading **and** failure are tracked
for you, and the failure is cleared when the action runs again. To turn any error into a message
for the user, override `wrapError()` in the action. A `UserException` is shown to the user in a
dialog, by default:

```tsx title="Kiss"
class LoadTodos extends Action {
  async reduce() { ... }

  wrapError(error: any) {
    return new UserException('Could not load the todos.', { hardCause: error });
  }
}
```

If the status must be per item, as in "is user 42 loading?", give the action a `statusKey`, and
pass the same key to the hooks: `useIsWaiting(LoadUser, { statusKey: userId })`. In Effector,
`pending` is per effect, so a per-item status is a store you build by hand. See
[Wait, fail, succeed](../basics/wait-fail-succeed).

### Loading when a component mounts

Instead of calling the effect in a `useEffect`, Effector apps often use a **gate**: the
component opens the gate when it mounts, and a `sample` starts the effect when the gate opens:

```tsx title="Effector"
import { createGate, useGate } from 'effector-react';

export const TodosGate = createGate();

sample({ clock: TodosGate.open, target: loadTodosFx });

function TodoList() {
  useGate(TodosGate);
  ...
}
```

In Kiss, `useStoreEffect` does this, in the component, with no extra unit:

```tsx title="Kiss"
useStoreEffect({
  onMount: (store) => store.dispatch(new LoadTodos()),
  onUnmount: (store) => store.abort(LoadTodos),
});
```

See [Hooks to dispatch actions](../basics/hooks-to-dispatch-actions#dispatching-when-the-component-mounts).

## Connecting features with sample

In Effector, the logic that connects features goes in `sample`. When the `clock` fires, it reads
the `source`, checks the `filter`, transforms the value with `fn`, and sends it to the `target`.
For example, when the user logs in, load their todos. And when the user presses "refresh", load
them again, but only if there is a user:

```tsx title="Effector"
export const logInFx = createEffect((credentials: Credentials) => api.logIn(credentials));
export const loadTodosFx = createEffect((userId: string) => api.loadTodos(userId));
export const refreshClicked = createEvent();

$user.on(logInFx.doneData, (_, user) => user);
$todos.on(loadTodosFx.doneData, (_, todos) => todos);

sample({
  clock: logInFx.doneData,
  fn: (user) => user.id,
  target: loadTodosFx,
});

sample({
  clock: refreshClicked,
  source: $user,
  filter: (user): user is User => user !== null,
  fn: (user) => user.id,
  target: loadTodosFx,
});
```

This is declarative, and `sample` is pure, so it works with scopes. But the logic is in pieces.
"Log in" is an effect, a `.on`, and a `sample`. "Refresh" is an event and a `sample`. Nothing
says, in one place, what happens when the user logs in.

In Kiss, the steps are written in order, in the action. An action reads the whole state, so it
needs no `source`. It checks with `if`, so it needs no `filter`. And it dispatches the next
action, so it needs no `target`:

```tsx title="Kiss"
class LogIn extends Action {
  constructor(readonly credentials: Credentials) { super(); }

  async reduce() {
    const user = await this.deps.api.logIn(this.credentials);
    this.dispatch(new LoadTodos());
    return (state: State) => state.copy({ user });
  }
}

class LoadTodos extends Action {
  async reduce() {
    const user = this.state.user;
    if (!user) return null; // No state change.
    const todos = await this.deps.api.loadTodos(user.id);
    return (state: State) => state.copy({ todos });
  }
}

// The refresh button.
dispatch(new LoadTodos());
```

To stop an action before it runs, as `filter` does, you can also override `abortDispatch()`. See
[Aborting the dispatch](../advanced-actions/aborting-the-dispatch). To dispatch an action when the
state meets a condition, as a `sample` with a store `clock` does, use `dispatchWhen`. See
[Wait for condition](../miscellaneous/wait-for-condition#dispatchwhen).

### Reading stores inside effects

In Effector, an effect gets only its parameter. To use a store's value in an effect, without the
caller passing it, you `attach` the store to the effect:

```tsx title="Effector"
import { attach } from 'effector';

export const loadMyTodosFx = attach({
  source: $user,
  effect: loadTodosFx,
  mapParams: (_: void, user) => user!.id,
});
```

In Kiss, the action reads `this.state`, as shown above. Nothing to attach.

## Derived values

Effector has good derived values. `combine` makes a store from other stores, and `$store.map`
makes a store from one store. They update only when their inputs change:

```tsx title="Effector"
import { combine } from 'effector';

export const $doneCount = $todos.map((todos) => todos.filter((todo) => todo.done).length);

export const $todosForDisplay = combine($todos, $filter, (todos, filter) =>
  todos.filter((todo) => filter === 'all' || (filter === 'done') === todo.done),
);
```

Kiss has three ways to do this, from the simplest to the most elaborate.

**A getter on the state class.** For a value that depends on one part of the state, write a
getter on that class. Because the state is immutable, the getter can cache its result inside the
object, and the cached value can never go stale:

```tsx title="Kiss"
class State {
  constructor(readonly todos: readonly Todo[]) {}

  private _doneCount?: number;

  get doneCount() {
    return (this._doneCount ??= this.todos.filter((todo) => todo.done).length);
  }
}

const doneCount = useSelect((state: State) => state.doneCount);
```

**A selector class.** For values that depend on several parts of the state, put the logic in a
class that takes the state. Components use it in `useSelect`, and actions use it with
`this.state`:

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

**A cache in the state.** For a value that is expensive to compute, compute it in the action
that changes its inputs, and store the result in the state. Since the state is immutable, the
cached value and its inputs always change together.

One more difference: in Effector, the logic is in the reducers and in the `fn` of `sample`, and
the stores hold plain data. In Kiss, the state can be your own immutable classes, with the
[business logic](../miscellaneous/business-logic) in their methods, so an action is often one
line, like `return this.state.copy({ todos: this.state.todos.add(this.todo) })`.

## Retry, debounce, fresh data, and more

Effector's core has none of these. You add them from other libraries of the Effector family.
`patronum` has `debounce` and `throttle`, which make a new event from an event:

```tsx title="Effector"
import { debounce } from 'patronum';

export const searchChanged = createEvent<string>();

sample({
  clock: debounce(searchChanged, 300),
  target: searchFx,
});
```

For retry, freshness, and cancelling old requests, the Effector team has Farfetched, a data
fetching library with its own units, queries and mutations, and operators like `retry`, `cache`
and `concurrency`. That's a third library to learn, with a different way of loading data than
the effects you already have.

In Kiss these are [action features](../advanced-actions/action-features). They work on any
action, and you declare them on the action:

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

The [comparison with TanStack Query](./comparing-tanstack) goes through all these features in
detail, including polling, `sequential`, and paged loading.

## Optimistic updates

In Effector, an optimistic update is done by hand: a store reduces the effect itself, which
fires when the effect is called, to change the value right away, and reduces `fail` to put it
back:

```tsx title="Effector"
export const addTodoFx = createEffect((todo: Todo) => api.addTodo(todo));

$todos
  .on(addTodoFx, (todos, todo) => [...todos, todo])
  .on(addTodoFx.fail, (todos, { params }) => todos.filter((todo) => todo.id !== params.id));
```

This works for adding a todo. For other changes, like editing a field, you must save the old
value somewhere to put it back, and decide what to do if another change happened in between.

In Kiss, there are ready-made action classes, so you don't write the rollback by hand, and the
rollback is done right even when other changes happened in between:

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

Use [OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) for commands
like "add a todo", and [OptimisticSync](../advanced-actions/optimistic-features#optimisticsync)
for values that change fast, like a "like" button, where only the latest value is sent to the
server.

## Resetting the state

In Effector, each store resets itself, with `.reset(event)`. On logout, every store must list
the logout event, or you list every store in `patronum`'s `reset`:

```tsx title="Effector"
export const loggedOut = createEvent();

$user.reset(loggedOut);
$todos.reset(loggedOut);
$filter.reset(loggedOut);
```

A new store that forgets its `.reset` keeps the old user's data after logout.

In Kiss, there is one state, so resetting it is one action. And on logout, `store.logOut()` does
more than reset: it waits for the running actions, deletes the persisted state, and puts the
initial state back:

```tsx title="Kiss"
store.dispatch(new UpdateStateAction(() => State.initialState));

// On logout.
await store.logOut({ initialState: State.initialState });
```

## Dependencies

In Effector, an effect calls its API directly. To use a fake API in a test, you give the scope
new handlers for the effects, with `fork({ handlers })`, shown in [Testing](#testing). That
works well, but it replaces the whole effect, not only the API it calls.

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

In a test, give the store fake dependencies instead, and the real action runs against the fake
API. To replace a whole action, as `handlers` does, use `store.mocks`. See
[Dependency injection](../miscellaneous/dependency-injection) and
[Mocking actions](../testing/mocking-actions).

## Persistence

Effector's core has no persistence. Most apps use `effector-storage`, and persist each store on
its own:

```tsx title="Effector"
import { persist } from 'effector-storage/local';

persist({ store: $todos, key: 'todos' });
persist({ store: $filter, key: 'filter' });
```

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the whole
state as it changes, and loads it when the app starts. The `ClassPersistor` works with class
instances, so the state comes back as the same classes you defined:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});

await store.ready();                    // Outside components.
const isReady = useIsStoreReady();      // In components.
```

## Server-side rendering

Effector has a good model for this. Units are declared once, at module level, and a **scope**,
made with `fork`, holds their values for one request. On the server, you run the app in a scope,
wait for it with `allSettled`, and send the values to the browser with `serialize`:

```tsx title="Effector"
// On the server.
const scope = fork();
await allSettled(appStarted, { scope });
const values = serialize(scope);
const html = renderToString(<Provider value={scope}><App /></Provider>);

// In the browser.
const clientScope = fork({ values: window.__SERVER_STATE__ });
hydrateRoot(root, <Provider value={clientScope}><App /></Provider>);
```

To serialize the stores, each one needs a stable id, which a Babel or SWC plugin of Effector
adds at build time. Without the plugin, `serialize` can't match the server values with the
browser stores.

In Kiss, the store is an object you create, so one per request is the normal case, and there is
no build plugin. `StoreProvider` is the context, and `serverState` tells the hooks what the
server rendered. In Next.js, each route loads its data on the server and puts it in the store
with `StoreSlice`:

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

## Devtools and logging

Effector has an `inspect` API, in `effector/inspect`, that reports what each unit does, and
there's an adapter for the Redux DevTools. What they show is a stream of units: events firing,
stores updating, effects starting. For one user click, that can be many entries, one per unit
in the chain.

Kiss logs actions. The `actionObserver` is called when an action starts and ends, and the
`stateObserver` is called with the state before and after each action:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  actionObserver: (action, dispatchCount, ini) => console.log(ini ? 'Started' : 'Finished', action),
  stateObserver: (action, prevState, newState, error) => console.log(action, newState),
});
```

A log line like `Finished LogIn` tells you what the user did. See
[Log and metrics](../miscellaneous/log-and-metrics).

## Testing

Effector tests are good. You create a scope with `fork`, give it initial values and fake effect
handlers, run a unit with `allSettled`, and read the stores of the scope:

```tsx title="Effector"
import { fork, allSettled } from 'effector';

test('loads the todos', async () => {
  const scope = fork({
    values: [[$user, user]],
    handlers: [[loadTodosFx, () => [todo1, todo2]]],
  });

  await allSettled(refreshClicked, { scope });

  expect(scope.getState($todos)).toEqual([todo1, todo2]);
});
```

In Kiss, it's much the same. Each test creates its own store, with any initial state and fake
dependencies. Then it dispatches the action, waits for it, and checks the state:

```tsx title="Kiss"
test('loads the todos', async () => {
  const store = new Store<State>({
    initialState: State.initialState.copy({ user }),
    dependencies: () => ({ api: new FakeApi([todo1, todo2]) }),
  });

  await store.dispatchAndWait(new LoadTodos());

  expect(store.state.todos).toEqual([todo1, todo2]);
  expect(store.isFailed(LoadTodos)).toBe(false);
  store.dispose();
});
```

One difference: in Effector, `allSettled(refreshClicked)` runs the whole chain of `sample` calls
behind the event, so to know what the test covers, you follow the same wires as in the app. In
Kiss, the test dispatches the action, and the action says what it does.

Kiss also has many features to [help you test](../category/testing), like waiting for a state
condition, mocking actions, and recording all actions and state changes.

## Why this matters

Effector and Kiss want the same things: messages with reducers, async work with a status, and
logic that can be tested without a UI. The difference is in how the logic is organized:

* **Pieces, or steps.** Effector splits a feature into small units and wires them with
  `sample`. To know what happens, you follow the wires. In Kiss, an action does the steps in
  order, and you read it from top to bottom.
* **Pending is free, failure is not.** Effector tracks if an effect is running, but the error is
  a store you keep and reset. In Kiss, both are tracked, per action, and per key if you need.
* **Many stores, or one state.** Each Effector store is declared, reset, and persisted on its
  own. In Kiss, the `State` class shows everything, and resetting or persisting it is one call.
* **One library, or a family.** Debounce is in `patronum`, retry and freshness are in
  Farfetched, and persistence is in `effector-storage`. In Kiss, they are part of the action.

---

Give it a try and [follow the tutorial](../tutorial/setting-up-the-store).
