---
sidebar_position: 7
sidebar_label: Comparing with React Context
---

# Comparing with React Context and useReducer

This page is for people who think "we don't need a state library: React already has Context,
`useState` and `useReducer`". It shows how to get the same results with Kiss, and what changes
when an AI agent writes the code. Each section shows the plain React code first, and then the
Kiss code that does the same.

React has three tools for state. `useState` keeps a value inside a component. `useReducer` does
the same, but moves the changes into a **reducer**: a function that gets the state and an action,
and returns the new state. And **Context** passes a value down the tree, so that any component
below can read it without props. The React documentation puts the three together, in a pattern
called "scaling up with a reducer and context": a provider component holds the reducer, and
passes the state and the `dispatch` function down through two contexts. React 19 adds
**Actions**: async functions run in a transition, with `useTransition`, `useActionState` and
`useOptimistic`.

Kiss is based on **immutable state** and **actions**. There is one state object, and it never
changes. An action takes the current state and returns a new one. Components read the state
with a selector, and re-render when the selected value changes.

So the ideas are close. A Kiss action and its reducer come from the same place as `useReducer`:
you dispatch something, and a reducer returns the new state. The difference is in what React
leaves to you. Every time React "dispatches to a pure reducer, after the async work was done in a
component", Kiss "dispatches an action whose reducer does the async work itself". And every time
React "re-renders every component that reads the context", Kiss "re-renders only the components
whose selected value changed".

## The big difference

Plain React gives you the parts of a store, not the store. That is fine, and often the right
call, for a small app, or for state that belongs to one component. There is no dependency to add,
nothing to learn, and the React team maintains it. If a dropdown is open, or what the user typed
before pressing "Send", that state belongs to the component, and `useState` is the right tool,
with or without Kiss.

The trouble starts with state that the app shares. Then you build the store yourself: a context,
a provider, a reducer, custom hooks, loading flags, and an effect for each request. Each team, each
feature, and each agent session builds it a little differently. It's also what an AI agent
usually writes when nobody picks a library for it. Kiss is that store, already built.

Three things follow from this, and they come up in every section below:

* **Async logic has a home.** A `useReducer` reducer must be pure, and can't `await`. So the
  requests, the loading flags, and the error handling live in components: in effects, in event
  handlers, or in React 19 Actions. In Kiss, an action can be async, and the store tracks if it's
  running or failed.

* **Components read only what they need.** Context has no selectors. When the value of a context
  changes, every component that reads it re-renders, even if the part it uses didn't change. In
  Kiss, `useSelect` picks a part of the state, and the component re-renders only when that part
  changes.

* **The state lives outside the component tree.** With Context, the state lives inside a provider
  component. Only components below it can reach it. Code outside React, like a WebSocket
  handler, a timer, or a test, can't. In Kiss, the store is an object you create. Components,
  actions, and plain code all reach it the same way.

|                           | React (Context and useReducer)                           | Kiss                                      |
|---------------------------|----------------------------------------------------------|-------------------------------------------|
| Where the state lives     | Inside a provider component                              | In a store you create                     |
| Changing the state        | `dispatch({ type })` to a pure, sync reducer             | An action class with `reduce()`           |
| Async changes             | In components: effects, event handlers, React 19 Actions | `async reduce()`                          |
| Loading and failed states | `useState` flags, or `isPending`, in one component       | `useIsWaiting`, `useIsFailed`, anywhere   |
| Re-renders                | Every component that reads the context                   | Only the ones whose selection changed     |
| Derived values            | `useMemo` in each component                              | Getters, selectors, cached fields         |
| Race conditions           | An `ignore` flag in each effect                          | `ignoreOld`                               |
| Retry, debounce, fresh    | By hand                                                  | Action features                           |
| Optimistic updates        | `useOptimistic`, in one component                        | `OptimisticCommand`, `OptimisticSync`     |
| Code outside components   | Can't reach the state                                    | `store.state`, `store.dispatch`           |
| Persistence               | By hand                                                  | The persistor                             |
| Dependencies              | A context                                                | Injected into the store                   |
| Testing the logic         | Reducers: yes. Async logic: by rendering.                | Yes, with one store per test              |

## Quick translation

If you know React's own tools, this table tells you where to look in Kiss. The sections below
explain each line, with code.

| React                                                                 | Kiss                                                                        |
|-----------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `useReducer(reducer, initialState)` inside a provider component       | `createStore({ initialState })`                                             |
| A state context, a dispatch context, and a provider for each feature  | One `StoreProvider` at the top of the app                                   |
| Custom hooks like `useTodos()` and `useTodosDispatch()`               | `useSelect`, `useDispatch`                                                  |
| `useContext(TodosContext)`                                            | `useSelect((state) => state.todos)`                                         |
| Splitting contexts, `useMemo` on the value, `use-context-selector`    | Not needed. `useSelect` and `useObject` select.                             |
| An action, like `{ type: 'added', todo }`                             | An action, like `new AddTodo(todo)`                                         |
| A `case 'added':` in the reducer's `switch`                           | The `reduce()` method of `AddTodo`                                          |
| A union type of all the actions                                       | Not needed. Each action class is its own type.                              |
| `useEffect` that fetches, with an `ignore` flag                       | `useStoreEffect({ onMount })`, and an async action with `ignoreOld`         |
| `isLoading` and `error` kept with `useState`                          | `useIsWaiting(Action)`, `useIsFailed(Action)`, `useExceptionFor(Action)`    |
| `useTransition` with an async function, and `isPending`               | An async action, and `useIsWaiting(Action)`                                 |
| `useActionState(reducerAction, initialState)`                         | An async action. Its result goes in the state.                              |
| `useOptimistic`                                                       | `OptimisticCommand`, `OptimisticSync`                                       |
| `use(promise)` with `<Suspense>`                                      | `useSuspense(Action)`                                                       |
| An error boundary around a failed Action                              | `wrapError()` and `UserException`, or `useSuspense`                         |
| `useMemo` for a derived value                                         | A getter on the state class, or a `Selector` class                          |
| A context that holds the API client                                   | `dependencies` in `createStore`, read with `this.deps`                      |
| `useEffect` that saves to `localStorage`, and a lazy initial state    | The [persistor](../miscellaneous/persistor)                                 |
| A `dispatch` saved in a module variable, to use outside React         | `store.dispatch(action)`, `store.state`                                     |
| `renderHook` with the provider as `wrapper`                           | `new Store(...)`, then `dispatchAndWait`                                    |
| Retry, debounce, throttle, fresh, non-reentrant                       | `retry`, `debounce`, `throttle`, `fresh`, `nonReentrant`                    |

## Creating the store

In React, a feature's shared state is a provider component. It holds the reducer, and passes the
state and the `dispatch` function down through two contexts. Two custom hooks read them, and
check that the provider is there:

```tsx title="React"
const TodosContext = createContext<Todo[] | null>(null);
const TodosDispatchContext = createContext<Dispatch<TodoAction> | null>(null);

export function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, dispatch] = useReducer(todosReducer, []);
  return (
    <TodosContext value={todos}>
      <TodosDispatchContext value={dispatch}>
        {children}
      </TodosDispatchContext>
    </TodosContext>
  );
}

export function useTodos() {
  const todos = useContext(TodosContext);
  if (todos === null) throw new Error('useTodos must be used inside a TodosProvider.');
  return todos;
}

export function useTodosDispatch() {
  const dispatch = useContext(TodosDispatchContext);
  if (dispatch === null) throw new Error('useTodosDispatch must be used inside a TodosProvider.');
  return dispatch;
}
```

That is one feature. The user, the settings, and the filter each get the same: two contexts, a
provider, and two hooks. The providers then nest at the top of the app, in an order that matters,
because a provider can only read the providers above it:

```tsx title="React"
<UserProvider>
  <SettingsProvider>
    <TodosProvider>
      <App />
    </TodosProvider>
  </SettingsProvider>
</UserProvider>
```

In Kiss, the state is one class, with a field for each of those features. The fields are
readonly, and `copy()` returns a new state with some fields changed. The store gets the initial
state, and one `StoreProvider` passes it to the components:

```tsx title="Kiss"
class State {
  constructor(
    readonly user: User | null,
    readonly settings: Settings,
    readonly todos: readonly Todo[],
  ) {}

  copy(changes: Partial<State>): State {
    return Object.assign(new State(this.user, this.settings, this.todos), changes);
  }

  static initialState = new State(null, Settings.default, []);
}

const store = createStore<State>({ initialState: State.initialState });

<StoreProvider store={store}>
  <App />
</StoreProvider>
```

The hooks come with Kiss, and work for every field. There are no contexts or custom hooks to
write. See [Store and state](../basics/store-and-state) and
[Provide the store](../basics/provide-the-store).

## Changing the state

In React, the actions are plain objects with a `type`. You list them in a union type, and the
reducer handles each one in a `switch`:

```tsx title="React"
type TodoAction =
  | { type: 'added'; todo: Todo }
  | { type: 'removed'; id: string };

function todosReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'added': return [...todos, action.todo];
    case 'removed': return todos.filter((todo) => todo.id !== action.id);
  }
}

// In a component.
const dispatch = useTodosDispatch();
dispatch({ type: 'added', todo });
```

This is clean, and it is the same idea as Kiss. The differences are in the details. Each action
is written in three places: the union, the `switch`, and the `dispatch`. And the reducer only sees
its own state. If adding a todo needs the user, the reducer can't read `UserContext`, so the
component must read it and put it in the action.

In Kiss, an action is a class. Its constructor parameters are the data it needs, and its
`reduce()` method returns the new state. The class is the type, the payload, and the reducer, in
one place. And `this.state` is the whole state, so the action can read the user, the settings, and
the todos:

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

There is no union to keep up to date, and no `switch`. In your IDE, you can click `AddTodo` where
it's dispatched and land on its reducer. See [Actions and reducers](../basics/actions-and-reducers).

## Reading the state, and re-renders

Context has no selectors. A component reads the whole value of the context. When the value
changes, React re-renders **every** component that reads that context, and wrapping a component in
`memo` doesn't stop it. So if one context holds several things, a component that shows only the
user's name re-renders every time a todo changes:

```tsx title="React"
function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext value={value}>{children}</AppContext>;
}

function UserName() {
  const { state } = useContext(AppContext)!;
  return <p>{state.user.name}</p>; // Re-renders when the todos change, too.
}
```

Note the `useMemo`. Without it, the `{ state, dispatch }` object is new on every render of the
provider, and every reader re-renders even when nothing changed. The React documentation
recommends it, along with `useCallback` for functions in the value.

In a small app, those extra renders don't matter. In a bigger one, the usual fixes are to split
the state into many small contexts (the provider pyramid shown above), or to add a library like
`use-context-selector`, which adds selectors to Context.

In Kiss, a component gives `useSelect` a selector, and re-renders only when the selected value
changes. `UserName` doesn't re-render when a todo changes:

```tsx title="Kiss"
function UserName() {
  const name = useSelect((state: State) => state.user?.name);
  return <p>{name}</p>;
}
```

To select several values at once, use `useObject`, which compares the new object with the
previous one, value by value:

```tsx title="Kiss"
const { name, todoCount } = useObject((state: State) => ({
  name: state.user?.name,
  todoCount: state.todos.length,
}));
```

The hooks connect to the store with `useSyncExternalStore`, React's own hook for reading a store
that lives outside React. See
[Components use the state](../basics/components-use-the-state).

One trade-off, to be fair: a state change in `useState` or `useReducer` can be rendered as a
transition, which React may pause to keep the screen responsive. Updates from a store read with
`useSyncExternalStore` are always rendered right away. See
[How the hooks follow the store](../basics/components-use-the-state#how-the-hooks-follow-the-store).

## Async changes

Since the reducer must be pure, React does the async work in the component, before dispatching.
Loading data when the screen opens is an effect. The loading flag and the error go in `useState`.
And, as the React documentation explains, the effect needs an `ignore` flag, so that a slow old
response doesn't overwrite a newer one:

```tsx title="React"
function TodoList() {
  const todos = useTodos();
  const dispatch = useTodosDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let ignore = false;
    api.loadTodos()
      .then((todos) => { if (!ignore) dispatch({ type: 'loaded', todos }); })
      .catch((error) => { if (!ignore) setError(error); })
      .finally(() => { if (!ignore) setIsLoading(false); });
    return () => { ignore = true; };
  }, [dispatch]);

  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <ul>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ul>;
}
```

This works, and it's what most React apps do. But look at where things ended up:

* The loading flag and the error belong to this component. A spinner in the header can't know
  that the todos are loading, unless you move the flags into the context too, and set them in the
  reducer, by hand.
* If two components need the todos, both fetch them, or you decide which one is in charge.
* In development, `StrictMode` runs the effect twice, so the request is sent twice. The `ignore`
  flag throws one result away, but both requests still hit the server.
* The logic is inside a component, so testing it means rendering the component.

In Kiss, an action can be async. Its `reduce()` method awaits what it needs, and returns a function
that produces the new state. If something goes wrong, the action throws, and the state is not
changed:

```tsx title="Kiss"
class LoadTodos extends Action {
  ignoreOld = true; // A newer LoadTodos makes this one old: its result is ignored.

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

There are no `isLoading` and `error` states, because loading and failure are not state you keep.
They are questions you ask about the action: is `LoadTodos` running? Did it fail? Any component can
ask, including the header. `useStoreEffect` runs `onMount` once, even in `StrictMode`. And
[ignoreOld](../advanced-actions/control-features#ignoreold) does what the `ignore` flag did, and
also cancels the old request, through `this.abortSignal`. See
[Wait, fail, succeed](../basics/wait-fail-succeed) and
[Dispatching when the component mounts](../basics/hooks-to-dispatch-actions#dispatching-when-the-component-mounts).

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

## React 19 Actions

React 19 gives async work a better home than effects, for changes that start with the user: a
button, a form. You pass an async function to `startTransition`, and `isPending` is `true` until
it finishes. React calls this function an **Action**:

```tsx title="React"
function SaveButton({ text }: { text: string }) {
  const dispatch = useTodosDispatch();
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const todo = await api.saveText(text);
      startTransition(() => { dispatch({ type: 'added', todo }); });
    });
  }

  return <button onClick={save} disabled={isPending}>Save</button>;
}
```

Note the second `startTransition`. The React documentation says that, for now, state updates after
an `await` must be wrapped again, or they are not part of the transition. If the Action throws,
React shows the nearest error boundary.

For forms, `useActionState` goes further. Its function looks like a reducer that can be async:
it gets the previous state and a payload, and returns the next state. Calls are queued, and run one
after the other. Known errors are returned as part of the state:

```tsx title="React"
function NewTodoForm() {
  const [result, formAction, isPending] = useActionState(
    async (previous: { error: string | null }, formData: FormData) => {
      try {
        await api.addTodo(String(formData.get('title')));
        return { error: null };
      } catch (error) {
        return { error: 'Could not add the todo.' };
      }
    },
    { error: null },
  );

  return (
    <form action={formAction}>
      <input name="title" />
      <button disabled={isPending}>Add</button>
      {result.error && <p>{result.error}</p>}
    </form>
  );
}
```

These are good tools, and they fix real problems of effects. But they are tied to the component
that calls the hook. The `isPending` of `NewTodoForm` is known only to `NewTodoForm`. The state of
`useActionState` lives in that component, and goes away when it unmounts. And the todo list still
doesn't know a todo was added, unless the Action also dispatches to the todos context. The logic is
still in the UI, so testing it still means rendering it.

In Kiss, the same work is an action. The component dispatches it, and any component can ask if it's
running or failed. The result goes in the state, where the todo list reads it:

```tsx title="Kiss"
class AddTodo extends Action {
  constructor(readonly title: string) { super(); }

  async reduce() {
    const todo = await this.deps.api.addTodo(this.title);
    return (state: State) => state.copy({ todos: [...state.todos, todo] });
  }

  wrapError(error: any) {
    return new UserException('Could not add the todo.', { hardCause: error });
  }
}

function NewTodoForm() {
  const dispatch = useDispatch();
  const isAdding = useIsWaiting(AddTodo);

  return (
    <form action={(formData) => { dispatch(new AddTodo(String(formData.get('title')))); }}>
      <input name="title" />
      <button disabled={isAdding}>Add</button>
    </form>
  );
}
```

`useActionState` runs its calls one after the other. In Kiss that's a choice you make per action:
add [sequential](../advanced-actions/control-features#sequential) to queue them,
[nonReentrant](../advanced-actions/control-features#nonreentrant) to ignore a second click while the
first one runs, or nothing, to let them run in parallel.

## Suspense and use

React 19's `use(promise)` suspends the component until the promise resolves, and throws to the
nearest error boundary if it rejects. But the promise can't be created during the render of a
client component, because it would be a new promise on every render. The React documentation says
to get it from a Server Component, or from a cache, such as a Suspense-enabled framework or
library. So `use` reads data, but something else must load it and keep it:

```tsx title="React"
function Albums({ albumsPromise }: { albumsPromise: Promise<Album[]> }) {
  const albums = use(albumsPromise);
  return <ul>{albums.map((album) => <li key={album.id}>{album.title}</li>)}</ul>;
}
```

In Kiss, the action loads the data and puts it in the state, which is the cache. `useSuspense`
suspends the component while the action runs, and throws to the error boundary if it failed:

```tsx title="Kiss"
function Albums() {
  useSuspense(LoadAlbums);
  const albums = useSelect((state: State) => state.albums);
  return <ul>{albums.map((album) => <li key={album.id}>{album.title}</li>)}</ul>;
}

<ErrorBoundary fallback={<p>Could not load the albums.</p>}>
  <Suspense fallback={<Spinner />}>
    <Albums />
  </Suspense>
</ErrorBoundary>
```

See [Suspense and error boundaries](../basics/wait-fail-succeed#suspense-and-error-boundaries).

## Optimistic updates

React 19 has `useOptimistic`. Inside an Action, you set a value that is shown right away. When the
Action ends, React goes back to the real value. If the Action failed, the real value didn't change,
so the screen shows what it showed before:

```tsx title="React"
function LikeButton({ isLiked, onToggle }: { isLiked: boolean; onToggle: (liked: boolean) => Promise<void> }) {
  const [optimisticLiked, setOptimisticLiked] = useOptimistic(isLiked);

  function handleClick() {
    startTransition(async () => {
      const next = !optimisticLiked;
      setOptimisticLiked(next);   // Shown right away.
      await onToggle(next);       // Saves, and updates the real isLiked.
    });
  }

  return <button onClick={handleClick}>{optimisticLiked ? 'Unlike' : 'Like'}</button>;
}
```

This is simple, and good for one button. But the optimistic value lives only in this component, and
only while the Action runs. Another component that shows the same "like" doesn't see it. And
nothing stops two quick clicks from sending two requests that finish in the wrong order.

In Kiss, the optimistic value goes in the state, so every component sees it.
[OptimisticSync](../advanced-actions/optimistic-features#optimisticsync) is made for values like a
"like": every click changes the state right away, but only one request at a time goes to the server,
with the latest value. For commands like "add a todo",
[OptimisticCommand](../advanced-actions/optimistic-features#optimisticcommand) changes the state,
sends the command, puts the old value back if it fails, and can reload from the server:

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

See [Optimistic features](../advanced-actions/optimistic-features).

## Derived values

In React, a value computed from the state is computed in the component, usually with `useMemo`. Each
component that needs it computes it again, or you move it into a custom hook:

```tsx title="React"
function DoneCount() {
  const todos = useTodos();
  const doneCount = useMemo(() => todos.filter((todo) => todo.done).length, [todos]);
  return <p>{doneCount} done</p>;
}
```

In Kiss, put the logic in the state class, as a getter. Components and actions use the same getter.
Because the state is immutable, the getter can cache its result inside the object, and the cached
value can never go stale:

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

For values that depend on several parts of the state, a `Selector` class works the same way. See
[Business logic](../miscellaneous/business-logic), and the
[comparison with Zustand](./comparing-zustand#derived-values), which shows all three ways.

## Retry, debounce, fresh data, and more

React has no opinion about these. Debouncing a search is a `setTimeout` in an effect, cleared in the
cleanup. Retrying is a loop with a `try`. Not reloading data that is still fresh is a timestamp in a
ref. Not running the same request twice is a flag. Each one is written by hand, in the component
that needs it:

```tsx title="React"
useEffect(() => {
  let ignore = false;
  const timeout = setTimeout(() => {
    api.search(text).then((results) => { if (!ignore) setResults(results); });
  }, 300);
  return () => { ignore = true; clearTimeout(timeout); };
}, [text]);
```

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

The [comparison with TanStack Query](./comparing-tanstack) goes through all these features in
detail, including polling, and paged loading.

## Code outside components

With Context, the state lives inside a provider component, and only components below it can read it
or change it. But some code is not a component: a WebSocket handler that receives messages, an HTTP
interceptor that must log the user out on a 401, a timer, a push notification. To reach the state
from there, React apps save the `dispatch` function in a module variable, from inside the provider:

```tsx title="React"
let dispatchFromOutside: Dispatch<AppAction> | null = null;

function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  dispatchFromOutside = dispatch;
  ...
}

socket.on('message', (message) => dispatchFromOutside?.({ type: 'messageReceived', message }));
```

It works, but it's a workaround: the code outside can dispatch, but can't read the state, and
nothing works before the provider renders.

In Kiss, the store is an object you create, before React renders anything. Any code can read
`store.state` and call `store.dispatch`:

```tsx title="Kiss"
socket.on('message', (message) => store.dispatch(new ReceiveMessage(message)));

api.onUnauthorized(() => store.dispatch(new LogOut()));
```

Long-lived things, like the socket itself, go in the store **props**, so that an action can open
them, another can close them, and `store.dispose()` closes all of them at once. See
[Store props](../miscellaneous/store-props).

## Dependencies

Context is React's way to inject dependencies, and it does this well. You put the API client in a
context, and components read it with `useContext`. In a test, you wrap the component in a provider
with a fake client:

```tsx title="React"
const ApiContext = createContext<Api>(new Api());

<ApiContext value={new FakeApi()}>
  <TodoList />
</ApiContext>
```

The limit is that only components can read it. A reducer can't, and code outside React can't.

In Kiss, you give the dependencies to the store, and a base action class gives you typed access to
them. Every action extends that base class:

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

## Persistence

In React, saving the state to local storage is done by hand. A lazy initial state reads it, and an
effect writes it on every change:

```tsx title="React"
function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, dispatch] = useReducer(todosReducer, null, () =>
    JSON.parse(localStorage.getItem('todos') ?? '[]'),
  );

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);
  ...
}
```

This is short, but each provider does it on its own. It goes through JSON, so class instances come
back as plain objects. It writes on every change, with no throttling. It breaks on the server, where
there is no `localStorage`. And it only works with storage that answers right away. With storage that
is async, like `AsyncStorage` in React Native, the first render can't wait for it, so you need a
"not loaded yet" state, and code to hide the app until it's loaded.

Kiss persists the state with a [persistor](../miscellaneous/persistor), which saves the state as it
changes (at most once every 2 seconds, by default), and loads it when the app starts. It works with
async storage, and with class instances. `useIsStoreReady()` tells you when the saved state has
loaded:

```tsx title="Kiss"
const store = createStore<State>({
  initialState: State.initialState,
  persistor: new ClassPersistor(...),
});

const isReady = useIsStoreReady(); // In components.
```

## Testing

A `useReducer` reducer is a pure function, so it's easy to test: call it with a state and an
action, and check the result. That's a strength of the React pattern.

But the async logic is not in the reducer. It's in effects, event handlers, and Actions, inside
components and custom hooks. To test it, you render it, with React Testing Library. A custom hook is
rendered with `renderHook`, wrapped in its providers, with the API mocked by module name:

```tsx title="React"
vi.mock('./api');

test('loads the todos', async () => {
  vi.mocked(api.loadTodos).mockResolvedValue([todo1, todo2]);

  const { result } = renderHook(() => useLoadTodos(), { wrapper: TodosProvider });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.todos).toEqual([todo1, todo2]);
});
```

In Kiss, the async logic is in actions, and actions don't need components. Each test creates its own
store, with any initial state and fake dependencies. Then it dispatches the action, waits for it, and
checks the state. No rendering, and no module to mock:

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

Kiss also has many features to [help you test](../category/testing), like waiting for a state
condition, mocking actions, and recording all actions and state changes.

## Why this matters

For a small app, or for state that belongs to one component, plain React is enough, and you should
use it. The cost shows up when the state is shared, and the app grows:

* **You build the store yourself.** A context, a provider, a reducer, and custom hooks for each
  feature, nested in the right order. With Kiss, the store, the provider, and the hooks are there,
  and each feature is a field and a few actions.
* **The async logic lives in components.** The reducer can't `await`, so requests, loading flags,
  errors, and race conditions are handled in effects and Actions, one component at a time. In Kiss,
  an action can be async, and any component can ask if it's running or failed.
* **Context re-renders too much.** Without selectors, every reader of a context re-renders on every
  change, until you split it, memoize it, or add a library. In Kiss, `useSelect` selects.
* **The state is stuck inside the tree.** Code outside React can't reach it, and tests must render
  it. In Kiss, the store is an object: actions, plain code, and tests all use it directly.

## When an AI agent writes the code

When your agent writes the code and you review it, this is what changes:

* **Plain React is your agent's default.** If nobody picks a library, your agent builds the
  store from React's parts: contexts, providers, a reducer, `useState` loading flags, and a
  `useEffect` with an `ignore` flag for each request (see [Async changes](#async-changes)). It
  builds it again, a little differently, in each feature and each session. With Kiss, the store
  is already built, and each new feature looks like the last one.
* **The hand-written parts are declared.** In plain React, retry, debounce, fresh data, and race
  conditions are code in each component that needs them. Your agent writes that code again each
  time, and a small mistake, like a missing cleanup, fails silently. In Kiss, they are action
  features, like `debounce` and `ignoreOld`. You check one line, not a block of effect code.
* **Checks it can run itself.** Testing async logic in plain React means `renderHook`, a provider
  as the wrapper, and modules mocked by name (see [Testing](#testing)). In Kiss, your agent
  creates a store with fake dependencies, calls `dispatchAndWait`, and checks the state, with no
  rendering. With the [Kiss ESLint plugin](../getting-started/intro.md#linter), it also runs
  `npx eslint` to find mistakes that compile fine, like a dispatch that runs on every render, and
  fixes them before you see the code.
* **Where plain React is ahead.** There is no dependency to add, and React's own tools are what
  agents know best. Your agent has seen far more plain React than Kiss. React also has
  `eslint-plugin-react-hooks`, and its rules of hooks still apply to Kiss's hooks, like
  `useSelect`. Kiss makes up for the training data with the
  [single-file docs](../getting-started/intro.md#docs), its own linter, and the code already in
  your project, which shows your agent the pattern to follow.

---

Give it a try: [follow the tutorial](../tutorial/setting-up-the-store), or
[give your agent the docs](../getting-started/intro.md#docs) and ask it to rewrite one of your
contexts with Kiss.
