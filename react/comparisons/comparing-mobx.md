---
sidebar_position: 4
---

# Comparing with MobX

This page is for people who know MobX. It shows how to get the same results with Kiss, which
does things in a different way, and what changes when an AI agent writes the code. Each section
shows the MobX code first, and then the Kiss code that does the same. If you use Valtio, most of
this page applies to it too, and the [Valtio](#valtio) section at the end translates it.

MobX is based on **observable** state. You put your state in class fields, mark them as
observable, and change them by assigning to them. MobX watches which fields each component
reads, and re-renders the component when one of those fields changes. The state is mutable:
there is one object, and it changes in place.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components say which part
of the state they read, and re-render when that part changes.

So, every time MobX "assigns to an observable", Kiss "dispatches an action that returns a new
state". And every time MobX "tracks what a component read", Kiss "runs the selector the
component gave it".

## The big difference

MobX is implicit. You write what looks like plain mutable code, and the library works out, at
runtime, what depends on what. That is pleasant to write, and it hides the wiring. It also
hides what's happening. To know why a component re-rendered, or why it didn't, you have to
know what it read during its last render, and what was assigned since. None of that is
written in the code.

Kiss is explicit. The state changes only in actions, so you can search for every change. A
component reads the state with `useSelect`, so what it depends on is in the code. And each
state is a value: you can hold it, compare it, log it, and put it in a test.

Three things follow from this, and they come up in every section below:

* **A change has a name.** In MobX, anything can assign to an observable: a store method, a
  component, a callback, a timer. In Kiss, every change is an action with a name, so logs,
  tests, and your IDE can find it.

* **Mistakes are loud, not silent.** The common MobX mistakes, like forgetting `observer`,
  destructuring an observable, or assigning after an `await`, don't throw. The screen just
  stays stale, and there's no error for you, or for an AI agent, to read and fix.
  (`eslint-plugin-mobx` catches some of them, like a missing `observer`.) In Kiss, those
  mistakes can't be made, because there is nothing to track and nothing to mutate. And the
  Kiss mistakes that compile but fail at runtime are reported by its ESLint plugin.

* **The state stays simple as the app grows.** MobX is easy with flat stores. With deep
  nesting, serialization, snapshots, and undo, people reach for MobX-State-Tree or MobX
  Keystone, which add their own type system on top of TypeScript. Kiss needs none of that,
  because the state is already a plain immutable value.

|                           | MobX                        | Kiss                            |
|---------------------------|-----------------------------|---------------------------------|
| State                     | Mutable, observable         | Immutable value                 |
| Changing the state        | Assign, inside an `action`  | An action class with `reduce()` |
| Async changes             | `flow` or `runInAction`     | `async reduce()`                |
| Loading and failed states | Flags you keep by hand      | `useIsWaiting`, `useIsFailed`   |
| Derived values            | `computed`                  | Getters, selectors, cached fields |
| Side effects              | `autorun`, `reaction`       | Actions, `useStoreEffect`, props |
| Retry, debounce, fresh    | By hand                     | Action features                 |
| Optimistic updates        | By hand                     | `OptimisticCommand`, `OptimisticSync` |
| Undo and redo             | MobX-State-Tree patches     | `stateObserver` and `UpdateStateAction` |
| Snapshots, serialization  | `toJS`, MobX-State-Tree     | The state is already a value    |
| Persistence               | `mobx-persist-store`        | The persistor                   |
| Server-side rendering     | Yes                         | Yes                             |
| Testing without UI        | Yes                         | Yes                             |

## Quick translation

If you know MobX, this table tells you where to look in Kiss. The sections below explain
each line, with code.

| MobX                                                       | Kiss                                                                      |
|------------------------------------------------------------|---------------------------------------------------------------------------|
| A store class with `makeAutoObservable(this)`              | A `State` class with readonly fields, given to `createStore`              |
| Several stores, and a `RootStore` that holds them          | One `State` class. Its fields are your "stores".                           |
| Passing the stores with a React context                    | `StoreProvider` at the top of the app                                     |
| `observable` fields                                        | Readonly fields of the `State` class                                      |
| An `action` method that assigns to fields                  | An action class, whose `reduce()` returns a new state                     |
| `store.addTodo(todo)`                                      | `dispatch(new AddTodo(todo))`                                             |
| `runInAction`, `flow`, generators                          | `async reduce()`, with plain `await`                                      |
| `isLoading` and `error` fields in the store                | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`  |
| `observer(Component)`                                      | Not needed. `useSelect` subscribes the component.                         |
| Reading `store.todos` in the render                        | `useSelect((state) => state.todos)`                                       |
| `computed` getters                                         | Getters on the `State` class, a `Selector` class, or a cached field       |
| `autorun`, `reaction`, `when`                              | An action that dispatches another; `useStoreEffect`; `dispatchWhen`       |
| Disposers you must call                                    | Store props, disposed by the store                                        |
| `enforceActions: 'always'`                                 | Not needed. The state can only change in actions.                         |
| Injecting an API through the store constructor             | `dependencies` in `createStore`, read with `this.deps`                    |
| `toJS(store)`, `getSnapshot(model)`                        | `store.state`. It's already a plain value.                                |
| `applySnapshot(model, snapshot)`                           | `UpdateStateAction`                                                       |
| `onPatch`, undo with MobX-State-Tree                       | `stateObserver`, and `UpdateStateAction` to go back                       |
| `spy`, `trace()`, MobX devtools                            | `actionObserver`, `stateObserver`                                         |
| `mobx-persist-store`                                       | The persistor                                                             |
| Retry, debounce, throttle, fresh (not in MobX)             | `retry`, `debounce`, `throttle`, `fresh`                                  |

## Stores and state

In MobX, the state lives in store classes. Each field is made observable with
`makeAutoObservable`, and the methods that change the fields become actions. Most apps have
several stores, a `RootStore` that creates them, and a React context to pass the root store
down to the components:

```tsx title="MobX"
import { makeAutoObservable } from 'mobx';

class TodoStore {
  todos: Todo[] = [];

  constructor(private api: Api) {
    makeAutoObservable(this, { api: false });
  }

  addTodo(todo: Todo) {
    this.todos.push(todo);
  }
}

class RootStore {
  todoStore: TodoStore;
  userStore: UserStore;

  constructor(api: Api) {
    this.todoStore = new TodoStore(api);
    this.userStore = new UserStore(api);
  }
}

const StoreContext = createContext<RootStore | null>(null);

function useStores() {
  const stores = useContext(StoreContext);
  if (!stores) throw new Error('No StoreContext.Provider found.');
  return stores;
}

<StoreContext.Provider value={new RootStore(api)}>
  <App />
</StoreContext.Provider>
```

In Kiss, the state is one class. All the fields of the app are declared there, so you can
read the whole shape of your app in one file. The fields are readonly, and `copy()` returns
a new state with some fields changed. There is one store, and `StoreProvider` passes it to
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

const store = createStore<State>({
  initialState: State.initialState,
  dependencies: () => ({ api }),
});

<StoreProvider store={store}>
  <App />
</StoreProvider>
```

If you like the idea of several stores, the fields of the `State` class play that role:
`state.todos` and `state.user` are your "todo store" and "user store". They live in the same
object, so one action can read and change both. See
[Store and state](../basics/store-and-state).

## Changing the state

In MobX, you change the state by assigning to observable fields, inside a method marked as
an action. MobX asks you to do that, and can be set to warn you when you don't, with
`configure({ enforceActions: 'always' })`. But an action is just a method, and nothing stops a
component or a callback from being that method:

```tsx title="MobX"
class TodoStore {
  todos: Todo[] = [];

  constructor() { makeAutoObservable(this); }

  addTodo(todo: Todo) {
    this.todos.push(todo);
  }

  removeTodo(id: string) {
    this.todos = this.todos.filter((todo) => todo.id !== id);
  }
}

todoStore.addTodo(todo);
```

In Kiss, you change the state by dispatching an action. An action is a class. Its
constructor parameters are the data it needs, and its `reduce()` method returns the new
state. There is no other way to change the state, so every change has a name, and you can
search for it:

```tsx title="Kiss"
class AddTodo extends Action {
  constructor(readonly todo: Todo) { super(); }
  reduce() { return this.state.copy({ todos: [...this.state.todos, this.todo] }); }
}

class RemoveTodo extends Action {
  constructor(readonly id: string) { super(); }
  reduce() { return this.state.copy({ todos: this.state.todos.filter((todo) => todo.id !== this.id) }); }
}

dispatch(new AddTodo(todo));
```

Note that the MobX `push` changes the array in place. The Kiss reducer makes a new array and
a new state. The old state is untouched, which is what makes undo, logging, and testing
simple, as shown below. See [Actions and reducers](../basics/actions-and-reducers).

## Components

In MobX, a component must be wrapped in `observer`. During the render, MobX records which
observables the component read, and re-renders it when one of them changes:

```tsx title="MobX"
const TodoList = observer(function TodoList() {
  const { todoStore } = useStores();
  return (
    <ul>
      {todoStore.todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}
    </ul>
  );
});
```

This works well until it doesn't, and when it doesn't, it fails silently:

* If you forget `observer`, the component renders once and never updates.
* If you destructure, as in `const { todos } = todoStore`, outside the render, the tracking
  is lost, and the component doesn't update.
* If you pass `todoStore.todos` to a child that is not an `observer`, the child doesn't
  update either.

In Kiss, a component reads the state with `useSelect`, and gives it a function that picks the
part it needs. The component re-renders when that part changes. There is nothing to wrap and
nothing to track, so none of the mistakes above exist:

```tsx title="Kiss"
function TodoList() {
  const todos = useSelect((state: State) => state.todos);
  return (
    <ul>
      {todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}
    </ul>
  );
}
```

To read several fields at once, use `useObject`. To read the whole state, use `useAllState`.
See [Components use the state](../basics/components-use-the-state).

## Derived values

MobX has `computed` values: a getter whose result is cached, and recalculated only when the
observables it read have changed. This is one of the best ideas in MobX:

```tsx title="MobX"
class TodoStore {
  todos: Todo[] = [];

  constructor() { makeAutoObservable(this); }

  get doneCount() {
    return this.todos.filter((todo) => todo.done).length;
  }
}
```

Kiss has three ways to do this, from the simplest to the most elaborate.

**A getter on the state class.** For a value that depends on one part of the state, write a
getter on that class. The component reads it with `useSelect`, like any other field, and
re-renders only when the result changes:

```tsx title="Kiss"
class State {
  constructor(readonly todos: readonly Todo[]) {}

  get doneCount() {
    return this.todos.filter((todo) => todo.done).length;
  }
}

function DoneCount() {
  const doneCount = useSelect((state: State) => state.doneCount);
  return <p>{doneCount} done</p>;
}
```

Because the state is immutable, the getter can cache its own result inside the object. The
object never changes, so the cached value can never go stale. That is a `computed` with
nothing to invalidate:

```tsx title="Kiss"
class State {
  constructor(readonly todos: readonly Todo[]) {}

  private _doneCount?: number;

  get doneCount() {
    return (this._doneCount ??= this.todos.filter((todo) => todo.done).length);
  }
}
```

**A selector class.** For values that depend on several parts of the state, put the logic in
a class that takes the state. Components use it in `useSelect`, and actions use it with
`this.state`. The logic is written once, and it has one home:

```tsx title="Kiss"
class Selector {
  constructor(readonly state: State) {}

  selectedTodo(): Todo | undefined {
    return this.state.todos.find((todo) => todo.id === this.state.selectedTodoId);
  }

  todosForDisplay(): Todo[] {
    const { todos, filter } = this.state;
    return todos.filter((todo) => filter === 'all' || (filter === 'done') === todo.done);
  }
}

// In a component.
const todos = useSelect((state: State) => new Selector(state).todosForDisplay());

// In an action.
class RemoveSelectedTodo extends Action {
  reduce() {
    const todo = new Selector(this.state).selectedTodo();
    if (!todo) return null;
    return this.state.copy({ todos: this.state.todos.filter((t) => t !== todo) });
  }
}
```

Your [base action](../advanced-actions/base-action-with-common-logic) can also expose the
selector as `this.select`, so the actions don't create it by hand.

**A cache in the state.** For a value that is expensive to compute, compute it in the action
that changes its inputs, and store the result in the state. Since the state is immutable,
the cached value and its inputs always change together, so they can never disagree:

```tsx title="Kiss"
class LoadPrices extends Action {
  async reduce() {
    const prices = await this.deps.api.loadPrices();
    const portfolioValue = calculatePortfolioValue(this.state.positions, prices); // Expensive.
    return (state: State) => state.copy({ prices, portfolioValue });
  }
}
```

## Async changes

In MobX, an async method is a problem, because after an `await` you are no longer inside the
action. Assigning to an observable there is a mistake, and with `enforceActions` on, MobX
warns about it. You have two ways around it. Wrap every assignment after an `await` in
`runInAction`, or write the method as a generator and wrap it in `flow`:

```tsx title="MobX"
class TodoStore {
  todos: Todo[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(private api: Api) { makeAutoObservable(this, { api: false }); }

  // With runInAction.
  async loadTodos() {
    this.isLoading = true;
    this.error = null;
    try {
      const todos = await this.api.loadTodos();
      runInAction(() => {
        this.todos = todos;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = String(error);
        this.isLoading = false;
      });
    }
  }

  // With flow.
  loadTodosFlow = flow(function* (this: TodoStore) {
    this.isLoading = true;
    try {
      this.todos = yield this.api.loadTodos();
    } catch (error) {
      this.error = String(error);
    } finally {
      this.isLoading = false;
    }
  });
}
```

In Kiss, an action can be async. Its `reduce()` method awaits what it needs, and returns a
function that produces the new state. The `await` is a plain `await`. There is nothing to
wrap, and no generator. If something goes wrong, the action throws, and the state is not
changed:

```tsx title="Kiss"
class LoadTodos extends Action {
  async reduce() {
    const todos = await this.deps.api.loadTodos();
    return (state: State) => state.copy({ todos });
  }
}
```

Also note there are no `isLoading` and `error` fields. The next section explains why.

## Loading and failed states

In MobX, the loading and error flags are fields you keep by hand, as in the code above. You
set them before the work, clear them after, and set them again on failure. They are real
state, so they can be wrong. If you forget to clear `isLoading` in one branch, the spinner
never goes away. The component then reads them like any other field:

```tsx title="MobX"
const TodoList = observer(function TodoList() {
  const { todoStore } = useStores();
  useEffect(() => { todoStore.loadTodos(); }, [todoStore]);

  if (todoStore.isLoading) return <Spinner />;
  if (todoStore.error) return <p>{todoStore.error}</p>;
  return <ul>{todoStore.todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
});
```

In Kiss, loading and failure are not state you keep. They are questions you ask about the
action: is `LoadTodos` running? Did it fail? What was the message? Kiss tracks the answers
for you, so they are always right, and any component can ask, not only the one that
dispatched the action:

```tsx title="Kiss"
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

To turn any error into a message for the user, override `wrapError()` in the action. See
[Wait, fail, succeed](../basics/wait-fail-succeed).

## Side effects and reactions

In MobX, code that must run when the state changes goes in `autorun`, `reaction`, or `when`.
Each one returns a disposer function that you must call when the effect is no longer needed,
or it keeps running forever. The effects can be created anywhere, so they have no owner, and
it's easy to forget one:

```tsx title="MobX"
// Runs now, and again whenever todos change.
const dispose = autorun(() => {
  localStorage.setItem('todos', JSON.stringify(todoStore.todos));
});

// Runs when the user changes, with the new user.
const disposeReaction = reaction(
  () => userStore.user,
  (user) => { if (user) todoStore.loadTodos(); },
);

// Runs once, when the condition becomes true.
when(() => userStore.user !== null, () => analytics.identify(userStore.user!.id));

// Later, somewhere:
dispose();
disposeReaction();
```

In Kiss, the same needs have more direct answers, and none of them needs a disposer:

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
  dispatches an action as soon as the state meets a condition:

  ```tsx title="Kiss"
  store.dispatchWhen(new TrackUser(), (state) => state.user !== null, { timeoutMillis: 0 });
  ```

* **Something must happen when a component mounts or unmounts.** Use `useStoreEffect`:

  ```tsx title="Kiss"
  useStoreEffect({
    onMount: (store) => store.dispatch(new StartListeningToUser()),
    onUnmount: (store) => store.dispatch(new StopListeningToUser()),
  });
  ```

* **Something must run on every state change,** like saving to local storage. Use the
  [persistor](../miscellaneous/persistor) for that, or a `stateObserver` in `createStore`
  (see [Logging and debugging](#logging-and-debugging) below).

Long-lived things, like listeners, sockets, and timers, go in the store **props**. An action
creates them and gives them to the store with `setProp`, along with the function that closes
them. Then `store.dispose()` closes all of them at once. See
[Store props](../miscellaneous/store-props).

## Dependencies

In MobX, a store gets its API client through its constructor, and you must tell
`makeAutoObservable` not to make it observable:

```tsx title="MobX"
class TodoStore {
  constructor(private api: Api) {
    makeAutoObservable(this, { api: false });
  }
}
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
```

In a test, give the store fake dependencies instead. See
[Dependency injection](../miscellaneous/dependency-injection).

## Snapshots, serialization and nested data

MobX observables are not plain objects. An observable array is a proxy, and an observable
object has hidden fields. To get a plain copy, for logging, for sending to a server, or for
comparing in a test, you call `toJS`. And a MobX store can't be "set" to a previous value:
you have to assign each field.

This gets harder with nested data. A todo list with nested projects, labels, and users, all
observable, is hard to serialize, hard to compare, and hard to restore. To solve this, people
move to MobX-State-Tree, which adds its own runtime type system:

```tsx title="MobX-State-Tree"
const Todo = types.model('Todo', {
  id: types.identifier,
  title: types.string,
  done: types.boolean,
});

const TodoStore = types
  .model('TodoStore', { todos: types.array(Todo) })
  .actions((self) => ({
    addTodo(todo: Instance<typeof Todo>) { self.todos.push(todo); },
  }));

const snapshot = getSnapshot(todoStore);
applySnapshot(todoStore, snapshot);
```

Now the types are defined twice: once for MobX-State-Tree, at runtime, and once for
TypeScript, inferred from the model. Errors happen at runtime, with messages that don't point
at the cause. MobX Keystone was created to fix this, and it has its own learning curve.

In Kiss, none of this is needed, because the state is already a value. It is a plain
immutable object, with your own classes, and you can log it, send it, compare it, and restore
it as it is:

```tsx title="Kiss"
const snapshot = store.state;                               // A snapshot. Nothing to convert.
expect(store.state).toEqual(expectedState);                  // Compare it.
store.dispatch(new UpdateStateAction((state) => snapshot)); // Restore it.
```

Nested data is nested immutable classes, each with its own `copy()` method. The
[tutorial](../tutorial/creating-the-state) shows how to build them.

## Undo and redo

In MobX, undo needs MobX-State-Tree, which records patches with `onPatch`, so that you can
apply the inverse patches later.

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

## Retry, debounce, fresh data, and more

MobX has no opinion about these. Retrying a failed request, debouncing a search, not
reloading data that is still fresh, not running the same request twice at the same time,
and updating the screen before the server answers are all written by hand, differently in
each project.

In Kiss these are [action features](../advanced-actions/action-features). You declare them
on the action, and the logic is done for you:

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

For optimistic updates, extend
[OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) or
[OptimisticSync](../advanced-actions/optimistic-features#optimisticsync), instead of writing
the rollback by hand. The [comparison with TanStack Query](./comparing-tanstack) goes through
all these features in detail.

## Persistence

MobX has no persistence of its own. Most apps use `mobx-persist-store`, or an `autorun` that
writes to local storage, plus code to read it back on startup and turn plain objects into
observables again:

```tsx title="MobX"
makePersistable(todoStore, {
  name: 'TodoStore',
  properties: ['todos'],
  storage: window.localStorage,
});
```

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state
as it changes, and loads it when the app starts. It works with class instances, so the state
comes back as the same classes you defined:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});
```

## Logging and debugging

MobX has `spy` to listen to all events, `trace()` to see why a computed value or a component
ran, and a devtools panel. They are useful, but what they show is a stream of observable
reads and writes, which is hard to map back to "what did the user do".

Kiss logs actions, which have names. The `actionObserver` is called when an action starts
and ends. The `stateObserver` is called with the state before and after each action:

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

Both libraries render on the server by creating a store per request, rendering with it, and
sending the state to the browser. In MobX, you serialize the stores with `toJS` and build
new observable stores in the browser from the plain data, which is more code when the state
has classes.

In Kiss, the state travels as JSON, and the browser creates its store with it. In Next.js,
each route loads its data on the server and puts it in the store with `StoreSlice`:

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

MobX stores can be tested without a UI, which is good. You create the store, call a method,
and check the fields. But async methods and reactions need care: you must await the method,
dispose every reaction you created, and remember that the state is the same object before
and after, so you can't compare "the state before" with "the state after":

```tsx title="MobX"
test('loads the todos', async () => {
  const store = new TodoStore(new FakeApi([todo1, todo2]));
  await store.loadTodos();
  expect(toJS(store.todos)).toEqual([todo1, todo2]);
  expect(store.isLoading).toBe(false);
});
```

In Kiss, you create a store with any initial state and fake dependencies, dispatch the
action, wait for it, and check the state. Each state is a value, so you can compare whole
states. When the test ends, `store.dispose()` closes every prop, so nothing leaks into the
next test:

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
state condition, and recording all actions and state changes.

## MobX-State-Tree and MobX Keystone

Plain MobX has no answer for snapshots, patches, undo, references between objects, or
serialization of nested data. Two libraries add those on top of MobX.

### MobX-State-Tree

MobX-State-Tree (MST) describes the state with its own runtime type system. You build models
with `types.model`, add `views` for derived values and `actions` for changes, and MST gives
you snapshots, patches, references, and runtime type checks:

```tsx title="MobX-State-Tree"
import { types, flow, getSnapshot, applySnapshot, onPatch, Instance } from 'mobx-state-tree';

const Todo = types
  .model('Todo', {
    id: types.identifier,
    title: types.string,
    done: false,
  })
  .actions((self) => ({
    toggle() { self.done = !self.done; },
  }));

const TodoStore = types
  .model('TodoStore', {
    todos: types.array(Todo),
    selectedTodo: types.maybe(types.reference(Todo)),
  })
  .views((self) => ({
    get doneCount() { return self.todos.filter((todo) => todo.done).length; },
  }))
  .actions((self) => ({
    addTodo(title: string) { self.todos.push({ id: newId(), title }); },
    loadTodos: flow(function* () {
      const todos = yield api.loadTodos();
      self.todos.replace(todos);
    }),
  }));

type ITodoStore = Instance<typeof TodoStore>;

const store = TodoStore.create({ todos: [] });
onPatch(store, (patch) => log(patch));
const snapshot = getSnapshot(store);
applySnapshot(store, snapshot);
```

The cost is that the types are now defined twice. Once for MST, at runtime, with
`types.string` and `types.array`. And once for TypeScript, inferred from the model with
`Instance<typeof TodoStore>`. That inference is slow on big models, breaks go-to-definition,
and gives errors far from the cause. Mistakes in the data are found at runtime, with messages
like "value is not assignable to type", and no line number in your code. Async changes still
need `flow` and generators. And every object you put in the tree must be an MST model, so you
can't use your own classes.

### MobX Keystone

MobX Keystone was created to fix the TypeScript problems of MST. Models are classes, with
decorators, so TypeScript understands them directly. It keeps snapshots, patches, references,
and undo:

```tsx title="MobX Keystone"
import { model, Model, prop, modelAction, modelFlow, _async, _await, getSnapshot, onPatches } from 'mobx-keystone';

@model('app/Todo')
class Todo extends Model({
  id: prop<string>(),
  title: prop<string>(),
  done: prop(false),
}) {
  @modelAction
  toggle() { this.done = !this.done; }
}

@model('app/TodoStore')
class TodoStore extends Model({
  todos: prop<Todo[]>(() => []),
}) {
  @computed
  get doneCount() { return this.todos.filter((todo) => todo.done).length; }

  @modelAction
  addTodo(title: string) { this.todos.push(new Todo({ id: newId(), title })); }

  @modelFlow
  loadTodos = _async(function* (this: TodoStore) {
    const todos = yield* _await(api.loadTodos());
    this.todos = todos.map((todo) => new Todo(todo));
  });
}

const store = new TodoStore({});
onPatches(store, (patches, inversePatches) => log(patches));
const snapshot = getSnapshot(store);
```

This is better than MST, but it is still a lot to learn: `prop`, `@model`, `@modelAction`,
`@modelFlow` with `_async` and `_await`, snapshots that are a different type from the model,
and rules about what may go inside a model. The async code is still a generator. And when
something goes wrong deep inside the tree, the error message often doesn't say where.

### The same things in Kiss

Everything these two libraries add is already there in Kiss, because the state is a plain
immutable value:

```tsx title="Kiss"
// The model is a TypeScript class. One definition, no runtime types.
class Todo {
  constructor(readonly id: string, readonly title: string, readonly done = false) {}
  toggle() { return new Todo(this.id, this.title, !this.done); }
}

class State {
  constructor(readonly todos: readonly Todo[], readonly selectedTodoId: string | null) {}
  get doneCount() { return this.todos.filter((todo) => todo.done).length; }
  copy(changes: Partial<State>): State { return Object.assign(new State(this.todos, this.selectedTodoId), changes); }
}

// Actions are classes with a reducer. Async is a plain async method.
class LoadTodos extends Action {
  async reduce() {
    const todos = await this.deps.api.loadTodos();
    return (state: State) => state.copy({ todos: todos.map((t) => new Todo(t.id, t.title, t.done)) });
  }
}

// A "patch" is the pair of states the stateObserver gets for each action.
const store = createStore<State>({
  initialState: State.initialState,
  stateObserver: (action, prevState, newState) => history.push(newState),
});

// A snapshot is the state. Restoring it is an action.
const snapshot = store.state;
store.dispatch(new UpdateStateAction((state) => snapshot));
```

Side by side:

| Need                        | MobX-State-Tree                      | MobX Keystone                         | Kiss                                        |
|-----------------------------|--------------------------------------|---------------------------------------|---------------------------------------------|
| Define a model              | `types.model`, runtime types         | A class with `prop` and decorators    | A TypeScript class                          |
| TypeScript types            | Inferred with `Instance<typeof M>`   | The class itself                      | The class itself                            |
| Change the state            | `.actions`, mutate `self`            | `@modelAction`, mutate `this`         | An action class, `reduce()` returns a value |
| Async change                | `flow` and generators                | `@modelFlow`, `_async`, `_await`      | `async reduce()`                            |
| Derived value               | `.views`                             | `@computed`                           | A getter, a selector, or a cached field     |
| Snapshot                    | `getSnapshot`                        | `getSnapshot`                         | `store.state`                               |
| Restore a snapshot          | `applySnapshot`                      | `applySnapshot`                       | `UpdateStateAction`                         |
| Patches, undo               | `onPatch`, `UndoManager`             | `onPatches`, `undoMiddleware`         | `stateObserver`, and the saved states       |
| Reference to another object | `types.reference`                    | `Ref`, `rootRef`                      | An id in the state, and a selector          |
| Error in the data           | At runtime, inside the library       | At runtime, inside the library        | At compile time, in your code               |
| Extra concepts to learn     | Many                                 | Many                                  | None                                        |

## Valtio

[Valtio](https://valtio.dev) is the same idea as MobX, with a smaller API. `proxy` wraps a
plain object, and you change it by assigning to it, from anywhere. In a component,
`useSnapshot` gives you a read-only snapshot of it, and re-renders the component when the
fields it read change:

```tsx title="Valtio"
import { proxy, useSnapshot } from 'valtio';

const state = proxy({ todos: [] as Todo[], isLoading: false, error: null as string | null });

// Change it from anywhere.
function addTodo(todo: Todo) {
  state.todos.push(todo);
}

async function loadTodos() {
  state.isLoading = true;
  state.error = null;
  try {
    state.todos = await api.loadTodos();
  } catch (error) {
    state.error = String(error);
  } finally {
    state.isLoading = false;
  }
}

function TodoList() {
  const snap = useSnapshot(state);
  useEffect(() => { loadTodos(); }, []);

  if (snap.isLoading) return <Spinner />;
  if (snap.error) return <p>{snap.error}</p>;
  return <ul>{snap.todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

Valtio removes some of the MobX friction. There is no `observer` to forget, no
`makeAutoObservable`, and an async function can assign after an `await`, with no `runInAction`
or `flow`. And the component reads an immutable snapshot, not the live object.

The rest of this page applies to Valtio as it does to MobX:

* **A change has no name.** Any function, component, or module can assign to the proxy. In
  Kiss, every change is an action.
* **Loading and failure are fields you keep by hand,** as `isLoading` and `error` above. In
  Kiss, `useIsWaiting(LoadTodos)` and `useIsFailed(LoadTodos)` answer for you.
* **There are two objects to keep apart.** In the render, you read `snap`. In callbacks, you
  write to `state`. Reading `state` in the render doesn't subscribe the component, so it doesn't
  update. And a component that uses a snapshot without reading its fields re-renders on any
  change inside it. In Kiss, the component reads with `useSelect`, and changes with `dispatch`.
* **The proxy is a module singleton,** like a Zustand store. Tests and server-side rendering
  must take care that one test, or one request, doesn't see the state of another. In Kiss, each
  test and each request creates its own store.
* **Retry, debounce, and fresh data are by hand.** In Kiss, they are
  [action features](../advanced-actions/action-features).

This is how Valtio translates to Kiss:

| Valtio                                                      | Kiss                                                                      |
|-------------------------------------------------------------|---------------------------------------------------------------------------|
| `proxy({ ... })`                                            | A `State` class, given to `createStore`                                   |
| `useSnapshot(state)`, reading `snap.todos`                  | `useSelect((state) => state.todos)`, `useObject`                          |
| Assigning to `state`                                        | Dispatching an action                                                     |
| An async function that assigns after `await`                | `async reduce()`                                                          |
| `isLoading` and `error` fields                              | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`  |
| A promise in the state, and `use(snap.data)` with Suspense  | `useSuspense(Action)`                                                     |
| Getters on the proxy, or `derive-valtio`                    | Getters on the `State` class, a `Selector` class, or a cached field      |
| `subscribe`, `subscribeKey`                                 | An action that dispatches another; `dispatchWhen`; `stateObserver`        |
| `snapshot(state)`                                           | `store.state`. It's already a value.                                      |
| `ref()` (keep an object out of the proxy)                   | Store props                                                               |
| `devtools(state)`                                           | `actionObserver`, `stateObserver`                                         |
| `valtio-history` (undo)                                     | `stateObserver` and `UpdateStateAction`                                   |
| Persisting with `subscribe` and `localStorage`              | The persistor                                                             |

The sections above explain each Kiss feature, with code.

## Why this matters

MobX code is short, and it feels natural, because it looks like plain mutable code. The cost
shows up later:

* **Changes have no name.** Anything can assign to an observable, so "who changed this?" has
  no place to look. In Kiss, every change is an action, and you can search for it, log it,
  and test it.
* **Mistakes are silent.** A missing `observer`, a destructured observable, an assignment
  after an `await`: the screen just stays stale. In Kiss, those mistakes can't be made.
* **The state is not a value.** You can't hold a MobX state, compare two of them, or go back
  to one, without extra tools. In Kiss, each state is a value, so snapshots, undo, logging,
  and tests come for free.
* **It gets complex when the app does.** Nested data, serialization, and undo push MobX apps
  toward MobX-State-Tree or Keystone. Kiss stays the same from the first screen to the last.

## When an AI agent writes the code

MobX is pleasant for a human who knows its rules. When an AI agent writes the code, and you
review it, other things count more:

* **Errors it can read.** An agent finds its mistakes by running something and reading the
  error. The MobX mistakes in [Components](#components) give no error, and unless the agent
  opens the app and looks, it doesn't know the screen is stale. In Kiss, a test dispatches the
  action with `dispatchAndWait` and compares whole states, with nothing rendered, so a wrong
  change is a failed test. And `npx eslint`, with the
  [Kiss ESLint plugin](../getting-started/intro.md#linter), reports the Kiss mistakes that
  compile but fail at runtime, like a state changed in place. Your agent runs both, reads the
  errors, and fixes them.
* **Dependencies written in the code.** In MobX, what a component depends on is what it read
  during its last render. To review a change, you must work that out in your head. In Kiss, it's
  the selector given to `useSelect`, and it's in the diff you review.
* **One way to write it.** MobX code can use decorators, `makeObservable`,
  `makeAutoObservable`, or `observable()`, and after an `await`, `runInAction` or `flow`.
  Agents have seen all of them, and may pick a different one in each session, or mix them in
  one project. Kiss has one way: a `State` class, and actions. An async action is
  `async reduce()`, with a plain `await`.
* **Where MobX is ahead.** Simple MobX code is shorter: you assign to a field, and the screen
  updates. `computed` is a good idea, written once. And MobX has a mature ecosystem, with
  devtools, `eslint-plugin-mobx`, and years of examples that agents have learned from. Kiss
  makes up for this with the [single-file docs](../getting-started/intro.md#docs), which give
  your agent the whole API, with the linter, and with the code already in the project, which
  shows the agent the pattern for the next feature. See also
  [Claude's own take](../getting-started/claude-opinion-kiss.md#mobx).

---

Give it a try: [follow the tutorial](../tutorial/setting-up-the-store), or
[give your agent the docs](../getting-started/intro.md#docs) and ask it to rewrite one of your
MobX stores with Kiss.
